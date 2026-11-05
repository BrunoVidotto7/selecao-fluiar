package br.com.fluiar.selecao.repository;

import java.util.UUID;
import java.util.List;
import br.com.fluiar.selecao.dto.ClientChangeSummaryResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class ClientChangeRepository {
    private static final String PENDING_SQL = """
            with pending as (
                select l.id as list_id, l.name as list_name, c.id as client_id, c.name as client_name,
                    p.client_purchase_revision > coalesce(cr.seen_revision, 0) as purchase_pending,
                    p.client_notes_revision > coalesce(cr.seen_revision, 0) as notes_pending,
                    p.client_purchase_value, p.client_notes_value,
                    p.client_purchase_changed_at, p.client_notes_changed_at
                from products p
                join rooms r on r.id = p.room_id
                join shopping_lists l on l.id = r.list_id
                join clients c on c.id = l.client_id
                left join list_client_change_reads cr on cr.list_id = l.id and cr.user_id = ?
                where c.office_id = ? and (p.client_purchase_revision > coalesce(cr.seen_revision, 0)
                    or p.client_notes_revision > coalesce(cr.seen_revision, 0))
            )
            """;
    static final String SUMMARIES_SQL = PENDING_SQL + """
            select list_id, list_name, client_id, client_name,
                count(*) as changed_product_count,
                count(*) filter (where purchase_pending and client_purchase_value) as purchase_marked_count,
                count(*) filter (where purchase_pending and not client_purchase_value) as purchase_unmarked_count,
                count(*) filter (where notes_pending and client_notes_value is not null) as notes_changed_count,
                count(*) filter (where notes_pending and client_notes_value is null) as notes_removed_count,
                max(greatest(case when purchase_pending then client_purchase_changed_at end,
                    case when notes_pending then client_notes_changed_at end)) as last_changed_at
            from pending
            group by list_id, list_name, client_id, client_name
            order by last_changed_at desc, list_id asc
            limit ? offset ?
            """;

    private final JdbcTemplate jdbc;

    public ClientChangeRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public long seenRevision(UUID userId, UUID listId) {
        return jdbc.queryForObject("""
                select coalesce((select seen_revision from list_client_change_reads
                where user_id=? and list_id=?), 0)
                """, Long.class, userId, listId);
    }
    public void advanceRead(UUID userId, UUID listId, long observedRevision) {
        jdbc.update("""
                insert into list_client_change_reads(user_id, list_id, seen_revision) values (?, ?, ?)
                on conflict(user_id, list_id) do update set seen_revision =
                    greatest(list_client_change_reads.seen_revision, excluded.seen_revision)
                """, userId, listId, observedRevision);
    }

    public long pendingListCount(UUID officeId, UUID userId) {
        return jdbc.queryForObject(PENDING_SQL + "select count(distinct list_id) from pending", Long.class, userId, officeId);
    }

    public List<ClientChangeSummaryResponse> summaries(UUID officeId, UUID userId, int page, int pageSize) {
        long offset = (long) page * pageSize;
        return jdbc.query(SUMMARIES_SQL, (row, index) -> new ClientChangeSummaryResponse(
                row.getObject("list_id", UUID.class), row.getString("list_name"),
                row.getObject("client_id", UUID.class), row.getString("client_name"),
                row.getLong("changed_product_count"), row.getLong("purchase_marked_count"),
                row.getLong("purchase_unmarked_count"), row.getLong("notes_changed_count"),
                row.getLong("notes_removed_count"), row.getTimestamp("last_changed_at").toInstant()),
                userId, officeId, pageSize, offset);
    }

}
