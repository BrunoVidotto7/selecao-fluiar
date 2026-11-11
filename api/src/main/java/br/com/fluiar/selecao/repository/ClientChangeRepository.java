package br.com.fluiar.selecao.repository;

import java.util.UUID;
import java.util.List;
import br.com.fluiar.selecao.dto.ClientChangeSummaryResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class ClientChangeRepository {
    private static final String PENDING_SQL = """
            with purchase_changes as (
                select l.id as list_id, l.name as list_name, c.id as client_id, c.name as client_name,
                    p.id as product_id, 'PURCHASE' as kind, p.client_purchase_value as purchase_value,
                    p.client_purchase_changed_at as changed_at, author.name as author_name
                from products p
                join rooms r on r.id = p.room_id
                join shopping_lists l on l.id = r.list_id
                join clients c on c.id = l.client_id
                left join clients author on author.id = p.client_purchase_client_id
                left join list_client_change_reads cr on cr.list_id = l.id and cr.user_id = ?
                where c.office_id = ? and p.client_purchase_revision > coalesce(cr.seen_revision, 0)
            ),
            note_changes as (
                select l.id as list_id, l.name as list_name, c.id as client_id, c.name as client_name,
                    p.id as product_id,
                    case when n.text is null then 'NOTE_REMOVED' else 'NOTE_CHANGED' end as kind,
                    null::boolean as purchase_value, n.changed_at as changed_at, author.name as author_name
                from product_client_notes n
                join products p on p.id = n.product_id
                join rooms r on r.id = p.room_id
                join shopping_lists l on l.id = r.list_id
                join clients c on c.id = l.client_id
                join clients author on author.id = n.client_id
                left join list_client_change_reads cr on cr.list_id = l.id and cr.user_id = ?
                where c.office_id = ? and n.revision > coalesce(cr.seen_revision, 0)
            ),
            pending as (
                select * from purchase_changes
                union all
                select * from note_changes
            )
            """;
    static final String SUMMARIES_SQL = PENDING_SQL + """
            select list_id, list_name, client_id, client_name,
                count(distinct product_id) as changed_product_count,
                count(*) filter (where kind = 'PURCHASE' and purchase_value) as purchase_marked_count,
                count(*) filter (where kind = 'PURCHASE' and not purchase_value) as purchase_unmarked_count,
                count(*) filter (where kind = 'NOTE_CHANGED') as notes_changed_count,
                count(*) filter (where kind = 'NOTE_REMOVED') as notes_removed_count,
                max(changed_at) as last_changed_at,
                coalesce(array_agg(distinct author_name) filter (where author_name is not null), '{}') as author_names
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
        return jdbc.queryForObject(PENDING_SQL + "select count(distinct list_id) from pending", Long.class, userId, officeId, userId, officeId);
    }

    public List<ClientChangeSummaryResponse> summaries(UUID officeId, UUID userId, int page, int pageSize) {
        long offset = (long) page * pageSize;
        return jdbc.query(SUMMARIES_SQL, (row, index) -> new ClientChangeSummaryResponse(
                row.getObject("list_id", UUID.class), row.getString("list_name"),
                row.getObject("client_id", UUID.class), row.getString("client_name"),
                row.getLong("changed_product_count"), row.getLong("purchase_marked_count"),
                row.getLong("purchase_unmarked_count"), row.getLong("notes_changed_count"),
                row.getLong("notes_removed_count"), row.getTimestamp("last_changed_at").toInstant(),
                List.of((String[]) row.getArray("author_names").getArray())),
                userId, officeId, userId, officeId, pageSize, offset);
    }

}
