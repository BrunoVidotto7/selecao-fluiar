package br.com.fluiar.selecao.security;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Every attempt counts, and a key over the limit is refused until its window ends. It keeps at most MAX_TRACKED_KEYS
 * keys and, while full, refuses keys it does not hold yet. Counts live in memory, so each API instance counts on its
 * own and a restart forgets them.
 */
@Component
public class AttemptLimiter {

    private static final int MAX_ATTEMPTS = 5;
    private static final Duration WINDOW = Duration.ofMinutes(15);
    private static final int MAX_TRACKED_KEYS = 100_000;
    private static final Duration CLEANUP_INTERVAL = Duration.ofMinutes(1);

    public enum Action {
        LOG_IN,
        REQUEST_PASSWORD_RESET,
        CONFIRM_CURRENT_PASSWORD
    }

    private record Key(Action action, String key) {
    }

    private record Window(Instant end, int attempts) {

        boolean hasEnded(Instant now) {
            return !now.isBefore(end);
        }
    }

    private final Clock clock;
    private final Map<Key, Window> windows = new HashMap<>();
    private Instant nextCleanup;

    public AttemptLimiter(Clock clock) {
        this.clock = clock;
        this.nextCleanup = clock.instant().plus(CLEANUP_INTERVAL);
    }

    /** Counts one attempt of the action for the key and tells whether it is still under the limit. */
    public synchronized boolean tryAcquire(Action action, String key) {
        Instant now = clock.instant();
        forgetEndedWindows(now);

        Window window = windows.compute(new Key(action, key), (k, current) -> nextWindow(current, now));
        return window != null && window.attempts() <= MAX_ATTEMPTS;
    }

    /** While the map is full, a key it does not hold yet is refused, so a flood of new keys cannot fill the memory. */
    private Window nextWindow(Window current, Instant now) {
        if (current != null && !current.hasEnded(now)) {
            return new Window(current.end(), current.attempts() + 1);
        }
        if (current == null && windows.size() >= MAX_TRACKED_KEYS) {
            return null;
        }
        return new Window(now.plus(WINDOW), 1);
    }

    public synchronized void reset(Action action, String key) {
        windows.remove(new Key(action, key));
    }

    public synchronized void clear() {
        windows.clear();
    }

    private void forgetEndedWindows(Instant now) {
        if (now.isBefore(nextCleanup)) {
            return;
        }

        windows.values().removeIf(window -> window.hasEnded(now));
        nextCleanup = now.plus(CLEANUP_INTERVAL);
    }
}
