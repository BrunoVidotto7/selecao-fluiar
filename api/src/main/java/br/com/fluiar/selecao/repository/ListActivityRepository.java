package br.com.fluiar.selecao.repository;

import java.time.Instant;
import java.sql.Timestamp;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class ListActivityRepository {
    private final JdbcTemplate jdbc;
    public ListActivityRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public void record(UUID listId, Instant now) {
        jdbc.update("""
                insert into list_human_activity(list_id,last_human_activity_at) values (?,?)
                on conflict(list_id) do update set last_human_activity_at =
                greatest(list_human_activity.last_human_activity_at, excluded.last_human_activity_at)
                """, listId, Timestamp.from(now));
    }

    public boolean active(UUID listId, Instant since) {
        return Boolean.TRUE.equals(jdbc.queryForObject("""
                select exists(select 1 from list_human_activity where list_id=? and last_human_activity_at>=?)
                """, Boolean.class, listId, Timestamp.from(since)));
    }
}
