package br.com.fluiar.selecao.security;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.withSettings;

import br.com.fluiar.selecao.security.AttemptLimiter.Action;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.stream.IntStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class AttemptLimiterTest {

    private static final Instant START = Instant.parse("2026-10-30T17:00:00Z");
    private static final Duration WINDOW = Duration.ofMinutes(15);
    private static final Duration FILL_TIME = Duration.ofMinutes(5);
    private static final Duration DURING_WINDOWS = Duration.ofMinutes(15);
    private static final Duration AFTER_WINDOWS_END = Duration.ofMinutes(21);
    private static final Duration CLEANUP_INTERVAL = Duration.ofMinutes(1);
    private static final int CONCURRENT_KEYS = 32;
    private static final int MAX_WAIT_SECONDS = 10;
    private static final int MAX_ATTEMPTS = 5;
    private static final int MAX_TRACKED_KEYS = 100_000;
    private static final String EMAIL = "paula@fluiar.com.br";
    private static final String OTHER_EMAIL = "isabela@fluiar.com.br";
    private static final String NEW_KEY = "new-key";
    private static final String FLOOD_KEY_PREFIX = "flood-";

    private Clock clock;
    private AttemptLimiter limiter;

    @BeforeEach
    void setUp() {
        clock = mock(Clock.class, withSettings().stubOnly());
        when(clock.instant()).thenReturn(START);
        limiter = new AttemptLimiter(clock);
    }

    @Test
    void allowsAttemptsUpToTheLimitAndRefusesTheNextOne() {
        for (int attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            assertThat(limiter.tryAcquire(Action.LOG_IN, EMAIL)).isTrue();
        }

        assertThat(limiter.tryAcquire(Action.LOG_IN, EMAIL)).isFalse();
    }

    @Test
    void keepsRefusingUntilTheWindowEnds() {
        for (int attempt = 0; attempt <= MAX_ATTEMPTS; attempt++) {
            limiter.tryAcquire(Action.LOG_IN, EMAIL);
        }

        when(clock.instant()).thenReturn(START.plus(WINDOW).minusMillis(1));
        assertThat(limiter.tryAcquire(Action.LOG_IN, EMAIL)).isFalse();

        when(clock.instant()).thenReturn(START.plus(WINDOW));
        assertThat(limiter.tryAcquire(Action.LOG_IN, EMAIL)).isTrue();
    }

    @Test
    void resetForgetsOnlyTheResetKey() {
        for (int attempt = 0; attempt <= MAX_ATTEMPTS; attempt++) {
            limiter.tryAcquire(Action.LOG_IN, EMAIL);
            limiter.tryAcquire(Action.LOG_IN, OTHER_EMAIL);
        }

        limiter.reset(Action.LOG_IN, EMAIL);

        assertThat(limiter.tryAcquire(Action.LOG_IN, EMAIL)).isTrue();
        assertThat(limiter.tryAcquire(Action.LOG_IN, OTHER_EMAIL)).isFalse();
    }

    @Test
    void countsEachActionAndKeySeparately() {
        for (int attempt = 0; attempt <= MAX_ATTEMPTS; attempt++) {
            limiter.tryAcquire(Action.LOG_IN, EMAIL);
        }

        assertThat(limiter.tryAcquire(Action.REQUEST_PASSWORD_RESET, EMAIL)).isTrue();
        assertThat(limiter.tryAcquire(Action.LOG_IN, OTHER_EMAIL)).isTrue();
    }

    @Test
    void aFloodOfNewKeysIsRefusedWithoutErasingKnownCounts() {
        for (int attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            assertThat(limiter.tryAcquire(Action.LOG_IN, EMAIL)).isTrue();
        }
        for (int i = 0; i < MAX_TRACKED_KEYS - 1; i++) {
            assertThat(limiter.tryAcquire(Action.LOG_IN, FLOOD_KEY_PREFIX + i)).isTrue();
        }

        assertThat(limiter.tryAcquire(Action.LOG_IN, NEW_KEY)).isFalse();
        assertThat(limiter.tryAcquire(Action.LOG_IN, EMAIL)).isFalse();
        assertThat(limiter.tryAcquire(Action.LOG_IN, FLOOD_KEY_PREFIX + "0")).isTrue();
    }

    @Test
    void acceptsNewKeysAgainSoonAfterTheirWindowsEnd() {
        when(clock.instant()).thenReturn(START.plus(FILL_TIME));
        for (int i = 0; i < MAX_TRACKED_KEYS; i++) {
            assertThat(limiter.tryAcquire(Action.LOG_IN, FLOOD_KEY_PREFIX + i)).isTrue();
        }

        when(clock.instant()).thenReturn(START.plus(DURING_WINDOWS));
        limiter.tryAcquire(Action.LOG_IN, FLOOD_KEY_PREFIX + "0");

        when(clock.instant()).thenReturn(START.plus(AFTER_WINDOWS_END));
        assertThat(limiter.tryAcquire(Action.LOG_IN, NEW_KEY)).isTrue();
    }

    @Test
    void aConcurrentFloodAdmitsOnlyOneNewKey() throws Exception {
        for (int attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            limiter.tryAcquire(Action.LOG_IN, EMAIL);
        }
        for (int i = 0; i < MAX_TRACKED_KEYS - 2; i++) {
            limiter.tryAcquire(Action.LOG_IN, FLOOD_KEY_PREFIX + i);
        }

        CountDownLatch start = new CountDownLatch(1);
        List<Callable<Boolean>> admissions = IntStream.range(0, CONCURRENT_KEYS)
                .mapToObj(i -> (Callable<Boolean>) () -> {
                    start.await();
                    return limiter.tryAcquire(Action.LOG_IN, NEW_KEY + i);
                })
                .toList();
        List<Boolean> admitted = new ArrayList<>();
        try (ExecutorService pool = Executors.newFixedThreadPool(CONCURRENT_KEYS)) {
            List<Future<Boolean>> futures = admissions.stream().map(pool::submit).toList();
            try {
                start.countDown();
                for (Future<Boolean> future : futures) {
                    admitted.add(future.get(MAX_WAIT_SECONDS, SECONDS));
                }
            } finally {
                start.countDown();
                futures.forEach(future -> future.cancel(true));
            }
        }

        assertThat(admitted.stream().filter(Boolean::booleanValue).count()).isOne();
        assertThat(limiter.tryAcquire(Action.LOG_IN, EMAIL)).isFalse();
        assertThat(limiter.tryAcquire(Action.LOG_IN, FLOOD_KEY_PREFIX + "0")).isTrue();
    }

    @Test
    void clearForgetsEveryCount() {
        for (int attempt = 0; attempt <= MAX_ATTEMPTS; attempt++) {
            limiter.tryAcquire(Action.LOG_IN, EMAIL);
        }

        limiter.clear();

        assertThat(limiter.tryAcquire(Action.LOG_IN, EMAIL)).isTrue();
    }
}
