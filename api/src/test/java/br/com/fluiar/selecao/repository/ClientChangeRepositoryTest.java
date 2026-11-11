package br.com.fluiar.selecao.repository;

import static org.assertj.core.api.Assertions.assertThat;
import br.com.fluiar.selecao.support.ApiIntegrationTest;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class ClientChangeRepositoryTest extends ApiIntegrationTest {
    @Autowired
    private ClientChangeRepository changes;

    @Test
    void aggregatesAndPaginatesRepresentativeDataInTheDatabase() {
        var admin = createAdmin("Ana", "ana@example.com");
        var client = createClient(admin, "Cliente");
        for (int index = 0; index < 40; index++) {
            var list = createList(admin, client, "Lista " + index);
            var room = createRoom(admin, list, "Sala");
            jdbc.update("update shopping_lists set client_change_revision=1 where id=?", list);
            jdbc.update("""
                    insert into products(id, room_id, category_id, name, quantity, bought, created_at, updated_at,
                        client_purchase_revision, client_purchase_changed_at, client_purchase_value)
                    select gen_random_uuid(), ?, ?, 'Produto', 1, true, now(), now(), 1, '2026-11-05T12:00:00Z', true
                    from generate_series(1, 100)
                    """, room, categoryId(admin, "Outros"));
        }
        jdbc.execute("analyze products; analyze rooms; analyze shopping_lists; analyze clients");
        assertThat(changes.pendingListCount(admin.officeId(), admin.userId())).isEqualTo(40);
        var page = changes.summaries(admin.officeId(), admin.userId(), 1, 20);
        assertThat(page).hasSize(20).allSatisfy(item -> {
            assertThat(item.changedProductCount()).isEqualTo(100);
            assertThat(item.purchaseMarkedCount()).isEqualTo(100);
        });
        var plan = jdbc.queryForList("explain (analyze, buffers) " + ClientChangeRepository.SUMMARIES_SQL,
                String.class, admin.userId(), admin.officeId(), admin.userId(), admin.officeId(), 20, 20L);
        System.out.println("Client change aggregate EXPLAIN (4000 products / 40 lists):\n" + String.join("\n", plan));
    }
}
