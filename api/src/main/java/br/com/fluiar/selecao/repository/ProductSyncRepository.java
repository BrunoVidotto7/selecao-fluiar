package br.com.fluiar.selecao.repository;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class ProductSyncRepository {
    public static final Duration ACTIVITY_WINDOW=Duration.ofDays(30);
    public static final Duration ATTEMPT_INTERVAL=Duration.ofHours(24);
    private static final Duration LEASE_DURATION=Duration.ofMinutes(10);
    private final JdbcTemplate jdbc;
    public ProductSyncRepository(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    public record Claim(UUID productId, UUID officeId, UUID clientId, UUID listId, UUID bindingVersion,
            UUID leaseToken, String sourceUrl, String store, String productIdentity, String variantId) {}

    @Transactional
    public List<Claim> claim(String store, Instant now, int limit) {
        UUID token=UUID.randomUUID();
        return jdbc.query("""
                with candidates as (
                    select p.id from products p join rooms r on r.id=p.room_id
                    join list_human_activity a on a.list_id=r.list_id
                    where p.store=? and p.sync_enabled and not p.bought
                    and a.last_human_activity_at>=?
                    and ((p.lease_token is null and p.next_attempt_at<=?)
                         or (p.lease_token is not null and p.lease_expires_at<=?))
                    order by p.next_attempt_at,p.id for update of p skip locked limit ?
                ), claimed as (
                    update products p set lease_token=?,lease_expires_at=?,
                    last_attempt_at=case when p.lease_token is null then ? else p.last_attempt_at end,
                    next_attempt_at=case when p.lease_token is null then ? else p.next_attempt_at end
                    from candidates c where p.id=c.id returning p.*
                ) select p.id,c.office_id,l.client_id,l.id list_id,p.binding_version,p.lease_token,
                    p.source_url,p.store,p.store_product_id,p.variant_id
                from claimed p join rooms r on r.id=p.room_id join shopping_lists l on l.id=r.list_id
                join clients c on c.id=l.client_id
                """, (rs,row)->new Claim(rs.getObject("id",UUID.class),rs.getObject("office_id",UUID.class),
                rs.getObject("client_id",UUID.class),rs.getObject("list_id",UUID.class),
                rs.getObject("binding_version",UUID.class),rs.getObject("lease_token",UUID.class),
                rs.getString("source_url"),rs.getString("store"),rs.getString("store_product_id"),rs.getString("variant_id")),
                store,Timestamp.from(now.minus(ACTIVITY_WINDOW)),Timestamp.from(now),Timestamp.from(now),limit,
                token,Timestamp.from(now.plus(LEASE_DURATION)),Timestamp.from(now),Timestamp.from(now.plus(ATTEMPT_INTERVAL)));
    }
}
