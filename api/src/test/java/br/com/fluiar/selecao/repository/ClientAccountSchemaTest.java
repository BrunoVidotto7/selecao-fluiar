package br.com.fluiar.selecao.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.com.fluiar.selecao.support.ApiIntegrationTest;
import java.util.UUID;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;

class ClientAccountSchemaTest extends ApiIntegrationTest {
    @Autowired
    private DataSource dataSource;

    @Test
    void databaseRejectsInvalidClientAccountRelationships() {
        var admin = createAdmin("Admin", "admin@example.com");
        var other = createAdmin("Other", "other@example.com");
        var clientId = createClient(admin, "Client");
        String insert = """
                insert into users (id, office_id, name, email, password_hash, role, client_id, created_at, updated_at)
                values (?, ?, 'Client', ?, 'test-hash', ?, ?, now(), now())
                """;
        assertThatThrownBy(() -> jdbc.update(insert, UUID.randomUUID(), admin.officeId(),
                "missing@example.com", "CLIENT", null)).isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update(insert, UUID.randomUUID(), admin.officeId(),
                "admin-client@example.com", "ADMIN", clientId)).isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update(insert, UUID.randomUUID(), other.officeId(),
                "other-client@example.com", "CLIENT", clientId)).isInstanceOf(DataIntegrityViolationException.class);
        jdbc.update(insert, UUID.randomUUID(), admin.officeId(), "first@example.com", "CLIENT", clientId);
        assertThatThrownBy(() -> jdbc.update(insert, UUID.randomUUID(), admin.officeId(),
                "second@example.com", "CLIENT", clientId)).isInstanceOf(DataIntegrityViolationException.class);
        jdbc.update("delete from clients where id = ?", clientId);
        assertThat(jdbc.queryForObject("select count(*) from users where client_id = ?", Integer.class, clientId)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from users where id = ?", Integer.class, admin.userId())).isEqualTo(1);
    }

    @Test
    void upgradingLegacySchemaPreservesAccountsAndShoppingData() {
        String schema = "upgrade_" + UUID.randomUUID().toString().replace("-", "");
        try {
            Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema).target("4").load().migrate();
            UUID office = UUID.randomUUID();
            UUID user = UUID.randomUUID();
            UUID client = UUID.randomUUID();
            UUID list = UUID.randomUUID();
            UUID room = UUID.randomUUID();
            UUID product = UUID.randomUUID();
            jdbc.update("insert into " + schema + ".offices values (?, 'Office', now(), now())", office);
            jdbc.update("insert into " + schema + ".users values (?, ?, 'Admin', 'admin@example.com', 'legacy-hash', 3, now(), now())", user, office);
            jdbc.update("insert into " + schema + ".clients values (?, ?, 'Client', 'client@example.com', '31999999999', now(), now())", client, office);
            jdbc.update("insert into " + schema + ".shopping_lists values (?, ?, 'Home', null, 'legacy-token', now(), now())", list, client);
            jdbc.update("insert into " + schema + ".rooms values (?, ?, 'Kitchen', 0, now())", room, list);
            jdbc.update("insert into " + schema + ".products values (?, ?, 'Chair', 1, 10, 'Internal note', true, now(), now())", product, room);
            jdbc.update("insert into " + schema + ".office_invitations values (?, ?, 'invite@example.com', ?, 'legacy-hash', now() + interval '7 days', now())", UUID.randomUUID(), office, user);

            Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema).load().migrate();

            assertThat(jdbc.queryForMap("select role, client_id, password_hash, credentials_version from " + schema + ".users where id = ?", user))
                    .containsEntry("role", "ADMIN").containsEntry("client_id", null)
                    .containsEntry("password_hash", "legacy-hash").containsEntry("credentials_version", 4);
            assertThat(jdbc.queryForMap("select bought, notes from " + schema + ".products where id = ?", product))
                    .containsEntry("bought", true).containsEntry("notes", "Internal note");
            assertThat(jdbc.queryForObject("select count(*) from " + schema + ".office_invitations", Integer.class)).isZero();
        } finally {
            jdbc.execute("drop schema if exists " + schema + " cascade");
        }
    }
}
