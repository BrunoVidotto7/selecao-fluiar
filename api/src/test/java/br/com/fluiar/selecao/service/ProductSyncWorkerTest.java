package br.com.fluiar.selecao.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.after;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import br.com.fluiar.selecao.dto.ProductImportPreview;
import br.com.fluiar.selecao.exception.ApiException;
import br.com.fluiar.selecao.model.Store;
import br.com.fluiar.selecao.model.SyncStatus;
import br.com.fluiar.selecao.repository.ProductSyncRepository;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import java.io.IOException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;

class ProductSyncWorkerTest {
    private final ProductSyncRepository jobs = mock(ProductSyncRepository.class);
    private final ProductSyncService sync = mock(ProductSyncService.class);
    private final StoreProductCollector collector = mock(StoreProductCollector.class);
    private final ProductSyncWorker worker = new ProductSyncWorker(jobs, sync, collector, Clock.fixed(Instant.EPOCH, ZoneOffset.UTC));
    private final ListAppender<ILoggingEvent> logs = new ListAppender<>();
    private final Logger logger = (Logger) LoggerFactory.getLogger(ProductSyncWorker.class);

    @BeforeEach void captureLogs() { logs.start(); logger.addAppender(logs); }
    @AfterEach void stopLogs() { logger.detachAppender(logs); worker.close(); }

    private static ProductSyncRepository.Claim claim() {
        return new ProductSyncRepository.Claim(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(),
                UUID.randomUUID(), UUID.randomUUID(), "https://moveca.com.br/products/chair?token=secret", "moveca", "chair", null);
    }

    private String logText() { return logs.list.stream().map(ILoggingEvent::getFormattedMessage).reduce("", (a, b) -> a + "\n" + b); }

    @Test void failedCollectionIsLoggedWithStoreProductAndCauseWithoutTheUrl() {
        var failing = claim();
        when(jobs.claim(eq("moveca"), any(), anyInt())).thenReturn(List.of(failing));
        when(collector.preview(anyString(), any())).thenThrow(ApiException.invalidField("url", "x").causedBy(new IOException("Store unavailable status=503")));
        when(sync.apply(any(), any(), any())).thenReturn(SyncStatus.FAILED);
        worker.synchronizeStore(Store.MOVECA);
        assertThat(logText()).contains("moveca").contains(failing.productId().toString()).contains("status=503").doesNotContain("secret");
    }

    @Test void oneProductFailingToApplyDoesNotStopTheOthers() {
        var first = claim();
        var second = claim();
        when(jobs.claim(eq("moveca"), any(), anyInt())).thenReturn(List.of(first, second));
        when(collector.preview(anyString(), any())).thenReturn(mock(ProductImportPreview.class));
        when(sync.apply(eq(first), any(), any())).thenThrow(new IllegalStateException("db down"));
        when(sync.apply(eq(second), any(), any())).thenReturn(SyncStatus.OK);
        worker.synchronizeStore(Store.MOVECA);
        verify(sync).apply(eq(second), any(), any());
        assertThat(logText()).contains(first.productId().toString()).contains("IllegalStateException");
    }

    @Test void dataAccessFailureLogsOnlyClassNamesNotValuesFromTheMessage() {
        var failing = claim();
        when(jobs.claim(eq("moveca"), any(), anyInt())).thenReturn(List.of(failing));
        when(collector.preview(anyString(), any())).thenReturn(mock(ProductImportPreview.class));
        when(sync.apply(any(), any(), any())).thenThrow(new DataIntegrityViolationException("Key (name)=(Mesa da Ana) exists",
                new IllegalStateException("duplicate value ana@test.com")));
        worker.synchronizeStore(Store.MOVECA);
        assertThat(logText()).contains("DataIntegrityViolationException").contains("IllegalStateException")
                .doesNotContain("Mesa da Ana").doesNotContain("ana@test.com");
    }

    @Test void scanFailureIsLoggedWithStoreAndCause() {
        when(jobs.claim(anyString(), any(), anyInt())).thenThrow(new IllegalStateException("db down"));
        worker.scan();
        verify(jobs, timeout(2000).times(Store.values().length)).claim(anyString(), any(), anyInt());
        org.awaitility.Awaitility.await().atMost(2, TimeUnit.SECONDS).untilAsserted(
                () -> assertThat(logText()).contains("store=moveca").contains("IllegalStateException").doesNotContain("db down"));
    }

    @Test void secondScanWhileOneIsRunningDoesNotClaimAgain() throws Exception {
        var release = new CountDownLatch(1);
        when(jobs.claim(anyString(), any(), anyInt())).thenAnswer(invocation -> { release.await(5, TimeUnit.SECONDS); return List.of(); });
        worker.scan();
        verify(jobs, timeout(2000).times(Store.values().length)).claim(anyString(), any(), anyInt());
        worker.scan();
        verify(jobs, after(300).times(Store.values().length)).claim(anyString(), any(), anyInt());
        release.countDown();
        verify(sync, never()).apply(any(), any(), any());
    }
}
