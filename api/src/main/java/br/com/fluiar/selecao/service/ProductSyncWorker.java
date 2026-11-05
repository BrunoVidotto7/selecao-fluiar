package br.com.fluiar.selecao.service;

import br.com.fluiar.selecao.dto.ProductImportPreview;
import br.com.fluiar.selecao.repository.ProductSyncRepository;
import jakarta.annotation.PreDestroy;
import java.time.Clock;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class ProductSyncWorker {
    private static final Logger LOG=LoggerFactory.getLogger(ProductSyncWorker.class);
    private static final List<String> STORES=List.of("moveca","fonte-do-sofa","westwing","abra-casa","casavee");
    private static final int PAGE_SIZE=5;
    private final ExecutorService executor=Executors.newFixedThreadPool(STORES.size());
    private final Set<String> running=ConcurrentHashMap.newKeySet();
    private final ProductSyncRepository jobs;
    private final ProductSyncService sync;
    private final StoreProductCollector collector;
    private final Clock clock;
    public ProductSyncWorker(ProductSyncRepository jobs, ProductSyncService sync, StoreProductCollector collector, Clock clock) {
        this.jobs=jobs; this.sync=sync; this.collector=collector; this.clock=clock;
    }

    @Scheduled(fixedDelayString="${app.product-sync.scan-delay-ms:60000}",initialDelayString="${app.product-sync.initial-delay-ms:60000}")
    public void scan() {
        for (String store:STORES) if (running.add(store)) executor.submit(()->{
            try { synchronizeStore(store); }
            catch (RuntimeException failure) { LOG.warn("Product synchronization store={} result=failed",store); }
            finally { running.remove(store); }
        });
    }

    public void synchronizeStore(String store) {
        long started=System.nanoTime();
        int ok=0,partial=0,failed=0,discarded=0;
        for (var claim:jobs.claim(store,clock.instant(),PAGE_SIZE)) {
            ProductImportPreview preview=null;
            StoreProductCollector.DownloadedImage image=null;
            try {
                preview=collector.preview(claim.sourceUrl(),claim.variantId());
                if (preview.imageUrl()!=null) image=collector.downloadImage(preview.imageUrl());
            } catch (RuntimeException ignored) {
                // A valid title or price remains usable when the independent image download fails.
            }
            String result=sync.apply(claim,preview,image);
            switch (result) {
                case "ok" -> ok++;
                case "partial" -> partial++;
                case "failed" -> failed++;
                default -> discarded++;
            }
        }
        LOG.info("Product synchronization store={} ok={} partial={} failed={} discarded={} durationMs={}",
                store,ok,partial,failed,discarded,(System.nanoTime()-started)/1_000_000);
    }
    @PreDestroy void close() { executor.shutdownNow(); }
}
