package br.com.fluiar.selecao.repository;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.fluiar.selecao.model.ProductCategory;
import br.com.fluiar.selecao.support.ApiIntegrationTest;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class ProductCategoryMigrationTest extends ApiIntegrationTest {

    private static final List<String> DEFAULT_NAMES = List.of("Marcenaria", "Mobiliário solto", "Pedras",
            "Louças e metais", "Vidros e espelhos", "Esquadrias", "Pisos, revestimentos e rodapés",
            "Eletrodomésticos", "Equipamentos", "Luminotécnica", "Elétrica", "Hidráulica", "Adornos",
            "Acessibilidade", "Têxteis", "Forros", "Acústica", "Tintas e texturas", "Outros");

    @Autowired
    private DataSource dataSource;

    @Test
    void newOfficeGetsTheNineteenDefaultCategories() {
        var admin = createAdmin("Paula", "paula@example.com");

        var names = jdbc.queryForList("select name from product_categories where office_id = ? and deleted_at is null",
                String.class, admin.officeId());

        assertThat(DEFAULT_NAMES).hasSize(19);
        assertThat(names).containsExactlyInAnyOrderElementsOf(DEFAULT_NAMES);
    }

    @Test
    void seededKeysMatchJavaNormalization() {
        createAdmin("Paula", "paula@example.com");

        var rows = jdbc.queryForList("select name, name_key from product_categories");

        assertThat(rows).hasSize(19);
        for (Map<String, Object> row : rows) {
            assertThat(row.get("name_key")).isEqualTo(ProductCategory.keyOf((String) row.get("name")));
        }
    }

    @Test
    void existingProductsMoveToOutros() {
        String schema = "migration_check";
        try {
            Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema).target("9").load().migrate();
            UUID office = UUID.randomUUID();
            UUID client = UUID.randomUUID();
            UUID list = UUID.randomUUID();
            UUID room = UUID.randomUUID();
            UUID product = UUID.randomUUID();
            jdbc.update("insert into " + schema + ".offices (id, name, created_at, updated_at) values (?, 'Office', now(), now())", office);
            jdbc.update("insert into " + schema + ".clients (id, office_id, name, email, phone, created_at, updated_at) values (?, ?, 'Client', 'client@example.com', '31999999999', now(), now())", client, office);
            jdbc.update("insert into " + schema + ".shopping_lists (id, client_id, name, share_token, created_at, updated_at) values (?, ?, 'Home', 'token', now(), now())", list, client);
            jdbc.update("insert into " + schema + ".rooms (id, list_id, name, position, created_at) values (?, ?, 'Kitchen', 0, now())", room, list);
            jdbc.update("insert into " + schema + ".products (id, room_id, name, quantity, created_at, updated_at) values (?, ?, 'Chair', 1, now(), now())", product, room);

            Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema).target("10").load().migrate();

            String categoryName = jdbc.queryForObject("select pc.name from " + schema + ".products p join "
                    + schema + ".product_categories pc on pc.id = p.category_id and pc.office_id = ? where p.id = ?",
                    String.class, office, product);
            assertThat(categoryName).isEqualTo(ProductCategory.DEFAULT_NAME);
            assertThat(jdbc.queryForObject("select is_nullable from information_schema.columns where table_schema = ? "
                    + "and table_name = 'products' and column_name = 'category_id'", String.class, schema))
                    .isEqualTo("NO");
        } finally {
            jdbc.execute("drop schema if exists " + schema + " cascade");
        }
    }
}
