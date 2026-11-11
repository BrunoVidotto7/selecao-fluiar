package br.com.fluiar.selecao.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.com.fluiar.selecao.support.ApiIntegrationTest;
import java.util.UUID;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class ListProfilesMigrationTest extends ApiIntegrationTest {

    @Autowired
    private DataSource dataSource;

    @Test
    void existingNotesAndPurchasesMoveToThePrincipalProfile() {
        String schema = "migration_check";
        try {
            Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema).target("9").load().migrate();
            UUID office = UUID.randomUUID();
            UUID client = UUID.randomUUID();
            UUID list = UUID.randomUUID();
            UUID room = UUID.randomUUID();
            UUID withNote = UUID.randomUUID();
            UUID plain = UUID.randomUUID();
            jdbc.update("insert into " + schema + ".offices (id, name, created_at, updated_at) values (?, 'Office', now(), now())", office);
            jdbc.update("insert into " + schema + ".clients (id, office_id, name, email, phone, created_at, updated_at) values (?, ?, 'Client', 'client@example.com', '31999999999', now(), now())", client, office);
            jdbc.update("insert into " + schema + ".shopping_lists (id, client_id, name, share_token, created_at, updated_at) values (?, ?, 'Home', 'token', now(), now())", list, client);
            jdbc.update("insert into " + schema + ".rooms (id, list_id, name, position, created_at) values (?, ?, 'Kitchen', 0, now())", room, list);
            String insertProduct = "insert into " + schema + ".products (id, room_id, name, quantity, created_at, updated_at, "
                    + "client_notes, client_notes_revision, client_notes_changed_at, "
                    + "client_purchase_revision, client_purchase_changed_at, client_purchase_value) "
                    + "values (?, ?, ?, 1, now(), now(), ?, ?, case when ? > 0 then now() end, ?, case when ? > 0 then now() end, "
                    + "case when ? > 0 then true end)";
            jdbc.update(insertProduct, withNote, room, "Chair", "Prefiro preto", 3, 3, 2, 2, 2);
            jdbc.update(insertProduct, plain, room, "Table", null, 0, 0, 0, 0, 0);

            Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema).load().migrate();

            var notes = jdbc.queryForList("select client_id, text, revision from " + schema + ".product_client_notes");
            assertThat(notes).hasSize(1);
            assertThat(notes.get(0)).containsEntry("client_id", client).containsEntry("text", "Prefiro preto")
                    .containsEntry("revision", 3L);
            assertThat(jdbc.queryForObject("select client_purchase_client_id from " + schema + ".products where id = ?",
                    UUID.class, withNote)).isEqualTo(client);
            assertThat(jdbc.queryForObject("select client_purchase_client_id from " + schema + ".products where id = ?",
                    UUID.class, plain)).isNull();

            String insertMember = "insert into " + schema + ".list_members (id, list_id, client_id, role, created_at) values (?, ?, ?, 'READER', now())";
            UUID other = UUID.randomUUID();
            jdbc.update("insert into " + schema + ".clients (id, office_id, name, email, phone, created_at, updated_at) values (?, ?, 'Other', 'other@example.com', '31999999998', now(), now())", other, office);
            jdbc.update(insertMember, UUID.randomUUID(), list, other);
            assertThatThrownBy(() -> jdbc.update(insertMember, UUID.randomUUID(), list, other))
                    .isInstanceOf(org.springframework.dao.DuplicateKeyException.class);
        } finally {
            jdbc.execute("drop schema if exists " + schema + " cascade");
        }
    }
}
