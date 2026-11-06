package br.com.fluiar.selecao.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;

class AsyncConfigTest {

    private final AtomicReference<String> seenInside = new AtomicReference<>();
    private final AtomicReference<String> seenAfter = new AtomicReference<>();

    @AfterEach
    void clearMdc() {
        MDC.clear();
    }

    @Test
    void asyncTaskSeesTheRequestIdOfItsCaller() throws InterruptedException {
        MDC.put("requestId", "trace-3");
        Runnable task = new AsyncConfig().mdcTaskDecorator().decorate(() -> seenInside.set(MDC.get("requestId")));
        MDC.clear();

        Thread worker = new Thread(() -> {
            task.run();
            seenAfter.set(MDC.get("requestId"));
        });
        worker.start();
        worker.join();

        assertThat(seenInside.get()).isEqualTo("trace-3");
        assertThat(seenAfter.get()).isNull();
    }
}
