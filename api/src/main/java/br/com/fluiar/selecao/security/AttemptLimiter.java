package br.com.fluiar.selecao.security;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.EnumMap;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Every attempt counts, and a key over the limit is refused until its window ends. The total budget of
 * MAX_TRACKED_KEYS is split evenly between the actions, so a flood of keys of one action cannot touch another. When
 * an action is full, the key with the oldest window is forgotten: a flood never refuses a key, it can only make old
 * counts start again. Counts live in memory, so each API instance counts on its own and a restart forgets them.
 */
@Component
public class AttemptLimiter {

    private static final int MAX_ATTEMPTS_PER_KEY = 5;
    /** One address may try about six accounts at the per-e-mail limit; more is spraying across e-mails. */
    private static final int MAX_ATTEMPTS_PER_IP = 30;
    /** Caps guessing from many fake addresses, while a targeted lockout still costs this many requests per window. */
    private static final int MAX_ATTEMPTS_PER_EMAIL = 50;
    private static final Duration WINDOW = Duration.ofMinutes(15);
    private static final int MAX_TRACKED_KEYS = 100_000;
    private static final int MAX_KEYS_PER_ACTION = MAX_TRACKED_KEYS / Action.values().length;
    private static final Duration CLEANUP_INTERVAL = Duration.ofMinutes(1);

    public enum Action {
        LOG_IN_FROM_IP_FOR_EMAIL(MAX_ATTEMPTS_PER_KEY),
        LOG_IN_FOR_EMAIL(MAX_ATTEMPTS_PER_EMAIL),
        LOG_IN_FROM_IP(MAX_ATTEMPTS_PER_IP),
        REQUEST_PASSWORD_RESET(MAX_ATTEMPTS_PER_KEY),
        REQUEST_PASSWORD_RESET_FROM_IP(MAX_ATTEMPTS_PER_IP),
        CONFIRM_CURRENT_PASSWORD(MAX_ATTEMPTS_PER_KEY);

        private final int maxAttempts;

        Action(int maxAttempts) {
            this.maxAttempts = maxAttempts;
        }
    }

    private record Window(Instant end, int attempts) {

        boolean hasEnded(Instant now) {
            return !now.isBefore(end);
        }
    }

    private final Clock clock;
    private final Map<Action, Map<String, Window>> windowsByAction = new EnumMap<>(Action.class);
    private Instant nextCleanup;

    public AttemptLimiter(Clock clock) {
        this.clock = clock;
        this.nextCleanup = clock.instant().plus(CLEANUP_INTERVAL);
        for (Action action : Action.values()) {
            windowsByAction.put(action, newWindowMap());
        }
    }

    /** Counts one attempt of the action for the key and tells whether it is still under the limit. */
    public synchronized boolean tryAcquire(Action action, String key) {
        Instant now = clock.instant();
        forgetEndedWindows(now);

        Map<String, Window> windows = windowsByAction.get(action);
        Window current = windows.get(key);
        if (current != null && !current.hasEnded(now)) {
            // Replacing a value keeps the insertion order, which is the order of the window starts.
            Window next = new Window(current.end(), current.attempts() + 1);
            windows.put(key, next);
            return next.attempts() <= action.maxAttempts;
        }

        windows.remove(key);
        windows.put(key, new Window(now.plus(WINDOW), 1));
        return true;
    }

    /** Gives back one attempt, so a success does not count against the key. */
    public synchronized void refund(Action action, String key) {
        Map<String, Window> windows = windowsByAction.get(action);
        Window current = windows.get(key);
        if (current == null || current.hasEnded(clock.instant())) {
            return;
        }
        if (current.attempts() <= 1) {
            windows.remove(key);
        } else {
            windows.put(key, new Window(current.end(), current.attempts() - 1));
        }
    }

    public synchronized void reset(Action action, String key) {
        windowsByAction.get(action).remove(key);
    }

    public synchronized void clear() {
        windowsByAction.values().forEach(Map::clear);
    }

    private void forgetEndedWindows(Instant now) {
        if (now.isBefore(nextCleanup)) {
            return;
        }

        // Windows are in start order, so the first one still open ends the cleanup of that action.
        for (Map<String, Window> windows : windowsByAction.values()) {
            Iterator<Window> oldestFirst = windows.values().iterator();
            while (oldestFirst.hasNext() && oldestFirst.next().hasEnded(now)) {
                oldestFirst.remove();
            }
        }
        nextCleanup = now.plus(CLEANUP_INTERVAL);
    }

    private static Map<String, Window> newWindowMap() {
        return new LinkedHashMap<>() {
            @Override
            protected boolean removeEldestEntry(Map.Entry<String, Window> eldest) {
                return size() > MAX_KEYS_PER_ACTION;
            }
        };
    }
}
