package br.com.fluiar.selecao.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.withSettings;

import br.com.fluiar.selecao.security.AttemptLimiter.Action;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class AttemptLimiterTest {

    private static final Instant START = Instant.parse("2026-10-30T17:00:00Z");
    private static final Duration WINDOW = Duration.ofMinutes(15);
    private static final Duration FILL_TIME = Duration.ofMinutes(5);
    private static final Duration DURING_WINDOWS = Duration.ofMinutes(15);
    private static final Duration AFTER_WINDOWS_END = Duration.ofMinutes(21);
    private static final Duration CLEANUP_INTERVAL = Duration.ofMinutes(1);
    private static final int MAX_ATTEMPTS = 5;
    private static final int MAX_TRACKED_KEYS = 100_000 / Action.values().length;
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
            assertThat(limiter.tryAcquire(Action.LOG_IN_FROM_IP_FOR_EMAIL, EMAIL)).isTrue();
        }

        assertThat(limiter.tryAcquire(Action.LOG_IN_FROM_IP_FOR_EMAIL, EMAIL)).isFalse();
    }

    @Test
    void keepsRefusingUntilTheWindowEnds() {
        for (int attempt = 0; attempt <= MAX_ATTEMPTS; attempt++) {
            limiter.tryAcquire(Action.LOG_IN_FROM_IP_FOR_EMAIL, EMAIL);
        }

        when(clock.instant()).thenReturn(START.plus(WINDOW).minusMillis(1));
        assertThat(limiter.tryAcquire(Action.LOG_IN_FROM_IP_FOR_EMAIL, EMAIL)).isFalse();

        when(clock.instant()).thenReturn(START.plus(WINDOW));
        assertThat(limiter.tryAcquire(Action.LOG_IN_FROM_IP_FOR_EMAIL, EMAIL)).isTrue();
    }

    @Test
    void resetForgetsOnlyTheResetKey() {
        for (int attempt = 0; attempt <= MAX_ATTEMPTS; attempt++) {
            limiter.tryAcquire(Action.LOG_IN_FROM_IP_FOR_EMAIL, EMAIL);
            limiter.tryAcquire(Action.LOG_IN_FROM_IP_FOR_EMAIL, OTHER_EMAIL);
        }

        limiter.reset(Action.LOG_IN_FROM_IP_FOR_EMAIL, EMAIL);

        assertThat(limiter.tryAcquire(Action.LOG_IN_FROM_IP_FOR_EMAIL, EMAIL)).isTrue();
        assertThat(limiter.tryAcquire(Action.LOG_IN_FROM_IP_FOR_EMAIL, OTHER_EMAIL)).isFalse();
    }

    @Test
    void countsEachActionAndKeySeparately() {
        for (int attempt = 0; attempt <= MAX_ATTEMPTS; attempt++) {
            limiter.tryAcquire(Action.LOG_IN_FROM_IP_FOR_EMAIL, EMAIL);
        }

        assertThat(limiter.tryAcquire(Action.REQUEST_PASSWORD_RESET, EMAIL)).isTrue();
        assertThat(limiter.tryAcquire(Action.LOG_IN_FROM_IP_FOR_EMAIL, OTHER_EMAIL)).isTrue();
    }

    @Test
    void aFloodOfNewResetKeysDoesNotBlockALogIn() {
        for (int i = 0; i < MAX_TRACKED_KEYS + 1; i++) {
            assertThat(limiter.tryAcquire(Action.REQUEST_PASSWORD_RESET, FLOOD_KEY_PREFIX + i)).isTrue();
        }

        assertThat(limiter.tryAcquire(Action.LOG_IN_FROM_IP_FOR_EMAIL, NEW_KEY)).isTrue();
    }

    @Test
    void aFullMapForgetsTheOldestWindowAndKeepsTheNewerCounts() {
        for (int attempt = 0; attempt <= MAX_ATTEMPTS; attempt++) {
            limiter.tryAcquire(Action.LOG_IN_FROM_IP_FOR_EMAIL, EMAIL);
        }
        for (int i = 0; i < MAX_TRACKED_KEYS - 2; i++) {
            limiter.tryAcquire(Action.LOG_IN_FROM_IP_FOR_EMAIL, FLOOD_KEY_PREFIX + i);
        }
        for (int attempt = 0; attempt <= MAX_ATTEMPTS; attempt++) {
            limiter.tryAcquire(Action.LOG_IN_FROM_IP_FOR_EMAIL, OTHER_EMAIL);
        }
        assertThat(limiter.tryAcquire(Action.LOG_IN_FROM_IP_FOR_EMAIL, EMAIL)).isFalse();

        assertThat(limiter.tryAcquire(Action.LOG_IN_FROM_IP_FOR_EMAIL, NEW_KEY)).isTrue();

        assertThat(limiter.tryAcquire(Action.LOG_IN_FROM_IP_FOR_EMAIL, EMAIL)).isTrue();
        assertThat(limiter.tryAcquire(Action.LOG_IN_FROM_IP_FOR_EMAIL, OTHER_EMAIL)).isFalse();
    }

    @Test
    void acceptsNewKeysAgainSoonAfterTheirWindowsEnd() {
        when(clock.instant()).thenReturn(START.plus(FILL_TIME));
        for (int i = 0; i < MAX_TRACKED_KEYS; i++) {
            assertThat(limiter.tryAcquire(Action.LOG_IN_FROM_IP_FOR_EMAIL, FLOOD_KEY_PREFIX + i)).isTrue();
        }

        when(clock.instant()).thenReturn(START.plus(DURING_WINDOWS));
        limiter.tryAcquire(Action.LOG_IN_FROM_IP_FOR_EMAIL, FLOOD_KEY_PREFIX + "0");

        when(clock.instant()).thenReturn(START.plus(AFTER_WINDOWS_END));
        assertThat(limiter.tryAcquire(Action.LOG_IN_FROM_IP_FOR_EMAIL, NEW_KEY)).isTrue();
    }

    @Test
    void refundGivesBackOneAttempt() {
        for (int attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            limiter.tryAcquire(Action.LOG_IN_FROM_IP_FOR_EMAIL, EMAIL);
        }

        limiter.refund(Action.LOG_IN_FROM_IP_FOR_EMAIL, EMAIL);

        assertThat(limiter.tryAcquire(Action.LOG_IN_FROM_IP_FOR_EMAIL, EMAIL)).isTrue();
        assertThat(limiter.tryAcquire(Action.LOG_IN_FROM_IP_FOR_EMAIL, EMAIL)).isFalse();
    }

    @Test
    void refundNeverGoesBelowZero() {
        limiter.refund(Action.LOG_IN_FROM_IP_FOR_EMAIL, EMAIL);
        limiter.tryAcquire(Action.LOG_IN_FROM_IP_FOR_EMAIL, EMAIL);
        limiter.refund(Action.LOG_IN_FROM_IP_FOR_EMAIL, EMAIL);
        limiter.refund(Action.LOG_IN_FROM_IP_FOR_EMAIL, EMAIL);

        for (int attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            assertThat(limiter.tryAcquire(Action.LOG_IN_FROM_IP_FOR_EMAIL, EMAIL)).isTrue();
        }
        assertThat(limiter.tryAcquire(Action.LOG_IN_FROM_IP_FOR_EMAIL, EMAIL)).isFalse();
    }

    @Test
    void clearForgetsEveryCount() {
        for (int attempt = 0; attempt <= MAX_ATTEMPTS; attempt++) {
            limiter.tryAcquire(Action.LOG_IN_FROM_IP_FOR_EMAIL, EMAIL);
        }

        limiter.clear();

        assertThat(limiter.tryAcquire(Action.LOG_IN_FROM_IP_FOR_EMAIL, EMAIL)).isTrue();
    }
}
