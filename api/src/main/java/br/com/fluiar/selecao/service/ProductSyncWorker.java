package br.com.fluiar.selecao.service;

import br.com.fluiar.selecao.dto.ProductImportPreview;
import br.com.fluiar.selecao.model.Store;
import br.com.fluiar.selecao.model.SyncStatus;
import br.com.fluiar.selecao.repository.ProductSyncRepository;
import jakarta.annotation.PreDestroy;
import java.time.Clock;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class ProductSyncWorker {
    private static final Logger LOG=LoggerFactory.getLogger(ProductSyncWorker.class);
    private static final int PAGE_SIZE=5;
    private final ExecutorService executor=Executors.newFixedThreadPool(Store.values().length);
    private final Set<Store> running=ConcurrentHashMap.newKeySet();
    private final ProductSyncRepository jobs;
    private final ProductSyncService sync;
    private final StoreProductCollector collector;
    private final Clock clock;
    public ProductSyncWorker(ProductSyncRepository jobs, ProductSyncService sync, StoreProductCollector collector, Clock clock) {
        this.jobs=jobs; this.sync=sync; this.collector=collector; this.clock=clock;
    }

    @Scheduled(fixedDelayString="${app.product-sync.scan-delay-ms:60000}",initialDelayString="${app.product-sync.initial-delay-ms:60000}")
    public void scan() {
        for (Store store:Store.values()) if (running.add(store)) executor.submit(()->{
            try { synchronizeStore(store); }
            catch (RuntimeException failure) { LOG.warn("Product synchronization store={} result=failed cause={}",store.id(),describeClasses(failure)); }
            finally { running.remove(store); }
        });
    }

    public void synchronizeStore(Store store) {
        long started=System.nanoTime();
        int ok=0,partial=0,failed=0,discarded=0;
        for (var claim:jobs.claim(store.id(),clock.instant(),PAGE_SIZE)) {
            SyncStatus result;
            try { result=synchronize(store,claim); }
            catch (RuntimeException failure) {
                LOG.warn("Product synchronization store={} productId={} result=failed cause={}",store.id(),claim.productId(),describeClasses(failure));
                result=SyncStatus.FAILED;
            }
            switch (result) {
                case OK -> ok++;
                case PARTIAL -> partial++;
                case FAILED -> failed++;
                default -> discarded++;
            }
        }
        LOG.info("Product synchronization store={} ok={} partial={} failed={} discarded={} durationMs={}",
                store.id(),ok,partial,failed,discarded,(System.nanoTime()-started)/1_000_000);
    }

    private SyncStatus synchronize(Store store, ProductSyncRepository.Claim claim) {
        ProductImportPreview preview=null;
        StoreProductCollector.DownloadedImage image=null;
        try {
            preview=collector.preview(claim.sourceUrl(),claim.variantId());
            if (preview.imageUrl()!=null) image=collector.downloadImage(preview.imageUrl());
        } catch (RuntimeException failure) {
            // A valid title or price remains usable when the independent image download fails.
            LOG.warn("Product synchronization store={} productId={} step=collect cause={}",store.id(),claim.productId(),describeCollectFailure(failure));
        }
        return sync.apply(claim,preview,image);
    }

    /** Only the collect step has fixed messages (SafeStoreHttpClient). Other messages can carry database values. */
    private static String describeCollectFailure(RuntimeException failure) {
        Throwable cause=failure.getCause()==null ? failure : failure.getCause();
        return cause.getClass().getSimpleName()+": "+cause.getMessage();
    }
    private static String describeClasses(RuntimeException failure) {
        return failure.getClass().getSimpleName()+" / "+NestedExceptionUtils.getMostSpecificCause(failure).getClass().getSimpleName();
    }
    @PreDestroy void close() { executor.shutdownNow(); }
}
