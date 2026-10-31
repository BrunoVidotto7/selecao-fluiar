package br.com.fluiar.selecao.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import br.com.fluiar.selecao.dto.ClientSummaryResponse;
import br.com.fluiar.selecao.dto.ListSummaryResponse;
import br.com.fluiar.selecao.model.Client;
import br.com.fluiar.selecao.model.Office;
import br.com.fluiar.selecao.model.Product;
import br.com.fluiar.selecao.model.ProductImage;
import br.com.fluiar.selecao.model.ProductLink;
import br.com.fluiar.selecao.model.Room;
import br.com.fluiar.selecao.model.ShoppingList;
import br.com.fluiar.selecao.support.TestcontainersConfiguration;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.hibernate.Hibernate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase.Replace;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

@DataJpaTest
@AutoConfigureTestDatabase(replace = Replace.NONE)
@Import(TestcontainersConfiguration.class)
class SummaryQueriesTest {

    private static final List<String> CLIENT_CONTENT_TABLES =
            List.of("shopping_lists", "rooms", "products", "product_links", "product_images");
    private static final Instant OLDER_UPDATE = Instant.parse("2020-01-01T00:00:00Z");
    private static final Instant NEWER_UPDATE = Instant.parse("2020-01-02T00:00:00Z");
    private static final byte[] IMAGE_BYTES = {1, 2, 3};

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private OfficeRepository officeRepository;

    @Autowired
    private ClientRepository clientRepository;

    @Autowired
    private ShoppingListRepository shoppingListRepository;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private ProductImageRepository productImageRepository;

    @Test
    void listSummaryCountsBoughtProductsAndSumsPricedOnes() {
        UUID officeId = office();
        ShoppingList list = list(client(officeId, "Ana Souza"), "Apartamento");
        Room livingRoom = room(list, "Sala", 0);
        Room bedroom = room(list, "Quarto", 1);
        product(livingRoom, 2, new BigDecimal("10.00"), true);
        product(livingRoom, 1, null, false);
        product(bedroom, 3, new BigDecimal("5.50"), false);
        flushAndClear();

        List<ListSummaryResponse> summaries = shoppingListRepository.findSummaries(officeId);

        assertThat(summaries).singleElement().satisfies(summary -> {
            assertThat(summary.totalProducts()).isEqualTo(3);
            assertThat(summary.boughtProducts()).isEqualTo(1);
            assertThat(summary.estimatedTotal()).isEqualByComparingTo("36.50");
            assertThat(summary.isCompleted()).isFalse();
        });
    }

    @Test
    void emptyListIsNotCompleted() {
        UUID officeId = office();
        Client client = client(officeId, "Ana Souza");
        list(client, "Sem ambientes");
        room(list(client, "Com um ambiente vazio"), "Sala", 0);
        flushAndClear();

        List<ListSummaryResponse> summaries = shoppingListRepository.findSummaries(officeId);

        assertThat(summaries).hasSize(2).allSatisfy(summary -> {
            assertThat(summary.totalProducts()).isZero();
            assertThat(summary.estimatedTotal()).isNotNull().isEqualByComparingTo(BigDecimal.ZERO);
            assertThat(summary.isCompleted()).isFalse();
        });
    }

    @Test
    void fullyBoughtListIsCompleted() {
        UUID officeId = office();
        Room room = room(list(client(officeId, "Ana Souza"), "Apartamento"), "Sala", 0);
        product(room, 1, new BigDecimal("10.00"), true);
        product(room, 2, null, true);
        flushAndClear();

        List<ListSummaryResponse> summaries = shoppingListRepository.findSummaries(officeId);

        assertThat(summaries).singleElement().satisfies(summary -> assertThat(summary.isCompleted()).isTrue());
    }

    @Test
    void summariesOnlyIncludeOwnOffice() {
        UUID officeA = office();
        UUID officeB = office();
        list(client(officeA, "Cliente do A"), "Lista do A");
        list(client(officeB, "Cliente do B"), "Lista do B");
        flushAndClear();

        assertThat(shoppingListRepository.findSummaries(officeA))
                .extracting(ListSummaryResponse::name)
                .containsExactly("Lista do A");
        assertThat(clientRepository.findSummaries(officeA))
                .extracting(ClientSummaryResponse::name)
                .containsExactly("Cliente do A");
    }

    @Test
    void summariesByClientOnlyIncludeThatClientOfOwnOffice() {
        UUID officeA = office();
        UUID officeB = office();
        Client ana = client(officeA, "Ana Souza");
        list(ana, "Apartamento");
        list(client(officeA, "Bruno Lima"), "Casa de praia");
        flushAndClear();

        assertThat(shoppingListRepository.findSummariesByClient(officeA, ana.getId()))
                .extracting(ListSummaryResponse::name)
                .containsExactly("Apartamento");
        assertThat(shoppingListRepository.findSummariesByClient(officeB, ana.getId())).isEmpty();
    }

    @Test
    void clientSummaryCountsLists() {
        UUID officeId = office();
        Client withLists = client(officeId, "Ana Souza");
        list(withLists, "Apartamento");
        list(withLists, "Casa de praia");
        client(officeId, "Bruno Lima");
        flushAndClear();

        List<ClientSummaryResponse> summaries = clientRepository.findSummaries(officeId);

        assertThat(summaries)
                .extracting(ClientSummaryResponse::name, ClientSummaryResponse::listCount)
                .containsExactlyInAnyOrder(tuple("Ana Souza", 2L), tuple("Bruno Lima", 0L));
    }

    @Test
    void touchedListComesFirstInSummariesWithANewerUpdateTime() {
        UUID officeId = office();
        Client client = client(officeId, "Ana Souza");
        ShoppingList touchedList = list(client, "Apartamento");
        ShoppingList otherList = list(client, "Casa de praia");
        storeUpdatedAt(touchedList, OLDER_UPDATE);
        storeUpdatedAt(otherList, NEWER_UPDATE);

        touchedList.touch();
        flushAndClear();
        List<ListSummaryResponse> summaries = shoppingListRepository.findSummaries(officeId);

        assertThat(summaries).extracting(ListSummaryResponse::name).containsExactly("Apartamento", "Casa de praia");
        assertThat(summaries.getFirst().updatedAt()).isAfter(NEWER_UPDATE);
    }

    @Test
    void updatedListShowsItsNewDataAndANewerUpdateTime() {
        UUID officeId = office();
        ShoppingList list = list(client(officeId, "Ana Souza"), "Apartamento");
        Client newClient = client(officeId, "Bruno Lima");
        storeUpdatedAt(list, OLDER_UPDATE);

        list.update("Casa de praia", "Reforma da varanda", newClient);
        flushAndClear();
        List<ListSummaryResponse> summaries = shoppingListRepository.findSummaries(officeId);

        assertThat(summaries).singleElement().satisfies(summary -> {
            assertThat(summary)
                    .extracting(ListSummaryResponse::name, ListSummaryResponse::description,
                            ListSummaryResponse::clientName)
                    .containsExactly("Casa de praia", "Reforma da varanda", "Bruno Lima");
            assertThat(summary.updatedAt()).isAfter(OLDER_UPDATE);
        });
    }

    @Test
    void findInOfficeIgnoresOtherOffices() {
        UUID officeA = office();
        UUID officeB = office();
        ShoppingList list = list(client(officeA, "Ana Souza"), "Apartamento");
        Room room = room(list, "Sala", 0);
        Product product = product(room, 1, null, false);
        flushAndClear();

        assertThat(shoppingListRepository.findInOffice(list.getId(), officeB)).isEmpty();
        assertThat(roomRepository.findInOffice(room.getId(), officeB)).isEmpty();
        assertThat(productRepository.findInOffice(product.getId(), officeB)).isEmpty();
        assertThat(shoppingListRepository.findInOffice(list.getId(), officeA).map(ShoppingList::getId))
                .contains(list.getId());
        assertThat(roomRepository.findInOffice(room.getId(), officeA).map(Room::getId)).contains(room.getId());
        assertThat(productRepository.findInOffice(product.getId(), officeA).map(Product::getId))
                .contains(product.getId());
    }

    /** The public read needs the client's office; loading the client later could find it deleted meanwhile. */
    @Test
    void findByShareTokenLoadsTheClientWithTheList() {
        ShoppingList list = list(client(office(), "Ana Souza"), "Apartamento");
        flushAndClear();

        ShoppingList found = shoppingListRepository.findByShareToken(list.getShareToken()).orElseThrow();

        assertThat(Hibernate.isInitialized(found.getClient())).isTrue();
    }

    @Test
    void imageIdIsReadThroughFormula() {
        UUID officeId = office();
        Room room = room(list(client(officeId, "Ana Souza"), "Apartamento"), "Sala", 0);
        Product product = product(room, 1, null, false);
        ProductImage image = productImageRepository.save(new ProductImage(product.getId(), "image/png", IMAGE_BYTES));
        flushAndClear();

        UUID imageId = productRepository.findById(product.getId()).orElseThrow().getImageId();

        assertThat(imageId).isEqualTo(image.getId());
    }

    @Test
    void deletingClientCascadesToEverything() {
        UUID officeId = office();
        Client client = client(officeId, "Ana Souza");
        Room room = room(list(client, "Apartamento"), "Sala", 0);
        Product product = productRepository.save(new Product(room, "Sofá", 1, null, null, false, List.of(
                new ProductLink("https://loja.example/sofa", "Cor cinza"),
                new ProductLink("https://loja.example/sofa-azul", null))));
        productImageRepository.save(new ProductImage(product.getId(), "image/png", IMAGE_BYTES));
        flushAndClear();
        assertThat(rowCounts(CLIENT_CONTENT_TABLES)).containsExactly(1, 1, 1, 2, 1);

        clientRepository.delete(clientRepository.findById(client.getId()).orElseThrow());
        entityManager.flush();

        assertThat(rowCounts(CLIENT_CONTENT_TABLES)).containsExactly(0, 0, 0, 0, 0);
    }

    private UUID office() {
        return officeRepository.save(new Office("Escritório")).getId();
    }

    private Client client(UUID officeId, String name) {
        return clientRepository.save(new Client(officeId, name, "cliente@email.com", "11987654321"));
    }

    private ShoppingList list(Client client, String name) {
        return shoppingListRepository.save(new ShoppingList(client, name, null, UUID.randomUUID().toString()));
    }

    /** Stores a known past update time, so any later write by Hibernate is certainly newer, without waiting. */
    private void storeUpdatedAt(ShoppingList list, Instant updatedAt) {
        entityManager.flush();
        jdbc.update("update shopping_lists set updated_at = ? where id = ?",
                OffsetDateTime.ofInstant(updatedAt, ZoneOffset.UTC), list.getId());
        entityManager.refresh(list);
    }

    private Room room(ShoppingList list, String name, int position) {
        return roomRepository.save(new Room(list, name, position));
    }

    private Product product(Room room, int quantity, BigDecimal unitPrice, boolean bought) {
        return productRepository.save(new Product(room, "Produto", quantity, unitPrice, null, bought, List.of()));
    }

    private void flushAndClear() {
        entityManager.flush();
        entityManager.clear();
    }

    private List<Integer> rowCounts(List<String> tables) {
        return tables.stream()
                .map(table -> jdbc.queryForObject("select count(*) from " + table, Integer.class))
                .toList();
    }
}
