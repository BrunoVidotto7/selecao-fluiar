package br.com.fluiar.selecao.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.InstanceOfAssertFactories.BIG_DECIMAL;

import br.com.fluiar.selecao.model.Product;
import br.com.fluiar.selecao.model.ProductImage;
import br.com.fluiar.selecao.model.ProductLink;
import br.com.fluiar.selecao.model.Room;
import br.com.fluiar.selecao.repository.ProductImageRepository;
import br.com.fluiar.selecao.repository.ProductRepository;
import br.com.fluiar.selecao.repository.RoomRepository;
import br.com.fluiar.selecao.repository.ShoppingListRepository;
import br.com.fluiar.selecao.service.ShoppingListService;
import br.com.fluiar.selecao.support.ApiIntegrationTest;
import jakarta.persistence.EntityManagerFactory;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MvcTestResult;

class ShoppingListControllerTest extends ApiIntegrationTest {

    private static final String PAULA_NAME = "Paula Hooper";
    private static final String PAULA_EMAIL = "paula@fluiar.com.br";
    private static final String MARINA_NAME = "Marina Costa";
    private static final String MARINA_EMAIL = "marina@fluiar.com.br";
    private static final String SERGIO_NAME = "Sérgio Hooper";
    private static final String HELENA_NAME = "Helena Prado";
    private static final String CAMILA_NAME = "Camila Rezende";
    private static final String LIST_NAME = "Lista de compras da casa";
    private static final String LIST_DESCRIPTION = "Itens para a casa nova.";
    private static final String NEW_LIST_NAME = "Lista do apartamento";
    private static final String NEW_LIST_DESCRIPTION = "Itens para o apartamento.";
    private static final String MARINA_LIST_NAME = "Casa de praia";
    private static final String DESCRIPTION_OVER_LIMIT = "a".repeat(501);
    private static final String CLIENT_REQUIRED = "Escolha o cliente desta lista.";
    private static final int SHARE_TOKEN_LENGTH = 43;
    private static final String KITCHEN = "Cozinha";
    private static final String LAUNDRY = "Lavanderia";
    private static final String MIXER = "Batedeira";
    private static final String CAKE_PAN = "Forma para bolo";
    private static final String STORAGE_BOX = "Caixa organizadora";
    private static final String MIXER_NOTES = "Cor branca";
    private static final String MIXER_STORE_LINK = "https://loja.example/batedeira";
    private static final String MIXER_STORE_NOTE = "Menor preço";
    private static final String MIXER_OTHER_LINK = "https://outra-loja.example/batedeira";
    private static final String STORE_LINK = "https://loja.example/produto";
    private static final String IMAGE_CONTENT_TYPE = "image/png";
    private static final byte[] IMAGE_BYTES = {1, 2, 3};
    private static final Instant OLDER_UPDATE = Instant.parse("2020-01-01T00:00:00Z");
    private static final String LOCK_LISTS = "select id from shopping_lists for update";

    @Autowired
    private ShoppingListService shoppingListService;

    @Autowired
    private ShoppingListRepository shoppingListRepository;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private ProductImageRepository productImageRepository;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    @Test
    void listGetReturnsClientChangesWithoutConsumingThem() {
        var admin = createAdmin("Ana", "ana@example.com");
        var second = createAdminInOffice(admin, "Beatriz", "bea@example.com");
        var client = createClient(admin, "Cliente");
        var owner = createClientAccount(admin, client, "client-login@example.com");
        var list = createList(admin, client, "Casa");
        var product = createProduct(admin, list, createRoom(admin, list, "Sala"), "Sofá");
        var write = mvc.patch().uri("/api/client/lists/{list}/products/{product}", list, product)
                .header(HttpHeaders.AUTHORIZATION, bearer(owner)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"bought\":true}").exchange();
        assertThat(write).hasStatus(HttpStatus.OK);
        for (var reader : List.of(admin, admin, second)) {
            var result = mvc.get().uri("/api/lists/{id}", list).header(HttpHeaders.AUTHORIZATION, bearer(reader)).exchange();
            assertThat(result).bodyJson().extractingPath("$.clientChanges.observedRevision").isEqualTo(1);
            assertThat(readJson(result, "$.clientChanges.products[0].productId")).isEqualTo(product.toString());
            assertThat(result).bodyJson().extractingPath("$.clientChanges.products[0].purchase.value").isEqualTo(true);
            assertThat(result).bodyJson().doesNotHavePath("$.clientChanges.products[0].notes");
        }
    }

    @Test
    void createListForClient() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID clientId = createClient(paula, SERGIO_NAME);

        var result = requestCreate(paula,
                Map.of("name", LIST_NAME, "description", LIST_DESCRIPTION, "clientId", clientId));

        assertThat(result).hasStatus(HttpStatus.CREATED);
        assertThat(result).bodyJson().extractingPath("$.clientName").isEqualTo(SERGIO_NAME);
        assertThat(result).bodyJson().extractingPath("$.shareToken").asString().hasSize(SHARE_TOKEN_LENGTH);
        assertThat(result).bodyJson().extractingPath("$.rooms").asArray().isEmpty();
        assertThat(result).bodyJson().extractingPath("$.stats.totalProducts").isEqualTo(0);
        assertThat(result).bodyJson().extractingPath("$.updatedAt").asString().isNotBlank();
    }

    @Test
    void createListRequiresClient() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);

        var result = requestCreate(paula, Map.of("name", LIST_NAME, "description", LIST_DESCRIPTION));

        assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(result).bodyJson().extractingPath("$.errors.clientId").isEqualTo(CLIENT_REQUIRED);
    }

    @Test
    void createListRejectsClientOfAnotherOffice() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        var marina = createAdmin(MARINA_NAME, MARINA_EMAIL);
        UUID marinaClientId = createClient(marina, CAMILA_NAME);

        var result = requestCreate(paula,
                Map.of("name", LIST_NAME, "description", LIST_DESCRIPTION, "clientId", marinaClientId));

        assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(result).bodyJson().extractingPath("$.errors.clientId").isEqualTo(CLIENT_REQUIRED);
    }

    @Test
    void createListReportsInvalidFields() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID clientId = createClient(paula, SERGIO_NAME);

        var result = requestCreate(paula,
                Map.of("name", "", "description", DESCRIPTION_OVER_LIMIT, "clientId", clientId));

        assertReportsInvalidListFields(result);
    }

    @Test
    void createListTrimsTheNameAndDropsABlankDescription() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID clientId = createClient(paula, SERGIO_NAME);

        var result = requestCreate(paula,
                Map.of("name", "  " + LIST_NAME + " ", "description", "   ", "clientId", clientId));

        assertThat(result).hasStatus(HttpStatus.CREATED);
        assertThat(result).bodyJson().extractingPath("$.name").isEqualTo(LIST_NAME);
        assertThat(result).bodyJson().extractingPath("$.description").isNull();
    }

    @Test
    void listListsReturnsSummaries() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);

        var result = requestLists(paula);

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(result).bodyJson().extractingPath("$[0].clientName").isEqualTo(SERGIO_NAME);
        assertThat(result).bodyJson().extractingPath("$[0].totalProducts").isEqualTo(0);
        assertThat(result).bodyJson().extractingPath("$[0].completed").isEqualTo(false);
    }

    @Test
    void listListsShowsOnlyOwnOfficeLists() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        var marina = createAdmin(MARINA_NAME, MARINA_EMAIL);
        createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        createList(marina, createClient(marina, CAMILA_NAME), MARINA_LIST_NAME);

        var result = requestLists(paula);

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(result).bodyJson().extractingPath("$[*].name").asArray().containsExactly(LIST_NAME);
    }

    @Test
    void clientShowsItsLists() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID clientId = createClient(paula, SERGIO_NAME);
        createList(paula, clientId, LIST_NAME);

        var client = mvc.get().uri("/api/clients/{id}", clientId)
                .header(HttpHeaders.AUTHORIZATION, bearer(paula))
                .exchange();
        var clients = mvc.get().uri("/api/clients").header(HttpHeaders.AUTHORIZATION, bearer(paula)).exchange();

        assertThat(client).hasStatus(HttpStatus.OK);
        assertThat(client).bodyJson().extractingPath("$.lists").asArray().hasSize(1);
        assertThat(clients).hasStatus(HttpStatus.OK);
        assertThat(clients).bodyJson().extractingPath("$[0].listCount").isEqualTo(1);
    }

    /** Lavanderia is stored first, so the order of the response comes from the positions. */
    @Test
    void getListShowsRoomsProductsAndStats() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        Room laundry = storeRoom(listId, LAUNDRY, 1);
        Room kitchen = storeRoom(listId, KITCHEN, 0);
        Product mixer = productRepository.save(new Product(kitchen, defaultCategory(paula.officeId()), MIXER, 1, new BigDecimal("459.00"), MIXER_NOTES,
                false, List.of(new ProductLink(MIXER_STORE_LINK, MIXER_STORE_NOTE),
                        new ProductLink(MIXER_OTHER_LINK, null))));
        productRepository.save(new Product(kitchen, defaultCategory(paula.officeId()), CAKE_PAN, 2, new BigDecimal("39.90"), null, true, List.of()));
        productRepository.save(new Product(laundry, defaultCategory(paula.officeId()), STORAGE_BOX, 3, null, null, false, List.of()));

        var result = requestList(paula, listId);

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(result).bodyJson().extractingPath("$.rooms[*].name").asArray().containsExactly(KITCHEN, LAUNDRY);
        assertThat(result).bodyJson().extractingPath("$.rooms[*].position").asArray().containsExactly(0, 1);
        assertThat(result).bodyJson().extractingPath("$.rooms[0].id").isEqualTo(kitchen.getId().toString());
        assertThat(result).bodyJson().extractingPath("$.rooms[0].products[*].name").asArray()
                .containsExactly(MIXER, CAKE_PAN);

        assertThat(result).bodyJson().extractingPath("$.rooms[0].products[0].id").isEqualTo(mixer.getId().toString());
        assertThat(result).bodyJson().extractingPath("$.rooms[0].products[0].roomId")
                .isEqualTo(kitchen.getId().toString());
        assertThat(result).bodyJson().extractingPath("$.rooms[0].products[0].quantity").isEqualTo(1);
        assertThat(result).bodyJson().extractingPath("$.rooms[0].products[0].unitPrice").convertTo(BIG_DECIMAL)
                .isEqualByComparingTo("459.00");
        assertThat(result).bodyJson().extractingPath("$.rooms[0].products[0].notes").isEqualTo(MIXER_NOTES);
        assertThat(result).bodyJson().extractingPath("$.rooms[0].products[0].bought").isEqualTo(false);
        assertThat(result).bodyJson().extractingPath("$.rooms[0].products[0].imageUrl").isNull();
        assertThat(result).bodyJson().extractingPath("$.rooms[0].products[0].links[*].url").asArray()
                .containsExactly(MIXER_STORE_LINK, MIXER_OTHER_LINK);
        assertThat(result).bodyJson().extractingPath("$.rooms[0].products[0].links[0].note")
                .isEqualTo(MIXER_STORE_NOTE);

        assertThat(result).bodyJson().extractingPath("$.stats.totalProducts").isEqualTo(3);
        assertThat(result).bodyJson().extractingPath("$.stats.boughtProducts").isEqualTo(1);
        assertThat(result).bodyJson().extractingPath("$.stats.pendingProducts").isEqualTo(2);
        assertThat(result).bodyJson().extractingPath("$.stats.estimatedTotal").convertTo(BIG_DECIMAL)
                .isEqualByComparingTo("538.80");
        assertThat(result).bodyJson().extractingPath("$.stats.remainingTotal").convertTo(BIG_DECIMAL)
                .isEqualByComparingTo("459.00");
    }

    @Test
    void getListShowsTheProductImageUrl() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        Product mixer = productRepository.save(
                new Product(storeRoom(listId, KITCHEN, 0), defaultCategory(paula.officeId()), MIXER, 1, null, null, false, List.of()));
        UUID imageId = productImageRepository.save(new ProductImage(mixer.getId(), IMAGE_CONTENT_TYPE, IMAGE_BYTES))
                .getId();

        var result = requestList(paula, listId);

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(result).bodyJson().extractingPath("$.rooms[0].products[0].imageUrl")
                .isEqualTo("/api/images/" + imageId);
    }

    /** Loading the products and links of one room or product at a time would add statements for each of them. */
    @Test
    void getListStatementCountDoesNotGrowWithRoomsAndProducts() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID clientId = createClient(paula, SERGIO_NAME);
        UUID smallListId = createList(paula, clientId, LIST_NAME);
        var category = defaultCategory(paula.officeId());
        storeProductWithLink(storeRoom(smallListId, KITCHEN, 0), category, MIXER);
        UUID largeListId = createList(paula, clientId, NEW_LIST_NAME);
        Room kitchen = storeRoom(largeListId, KITCHEN, 0);
        Room laundry = storeRoom(largeListId, LAUNDRY, 1);
        storeProductWithLink(kitchen, category, MIXER);
        storeProductWithLink(kitchen, category, CAKE_PAN);
        storeProductWithLink(laundry, category, STORAGE_BOX);

        long smallListStatements = statementsToGet(paula, smallListId);
        long largeListStatements = statementsToGet(paula, largeListId);

        assertThat(largeListStatements).isEqualTo(smallListStatements);
    }

    @Test
    void updateListCanMoveToAnotherClient() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        UUID helenaId = createClient(paula, HELENA_NAME);

        var result = requestUpdate(paula, listId, Map.of("name", LIST_NAME, "clientId", helenaId));

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(result).bodyJson().extractingPath("$.clientId").isEqualTo(helenaId.toString());
        assertThat(result).bodyJson().extractingPath("$.clientName").isEqualTo(HELENA_NAME);
    }

    @Test
    void updateListChangesNameAndDescription() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID clientId = createClient(paula, SERGIO_NAME);
        UUID listId = createList(paula, clientId, LIST_NAME);
        storeUpdatedAt(listId, OLDER_UPDATE);

        var result = requestUpdate(paula, listId,
                Map.of("name", NEW_LIST_NAME, "description", NEW_LIST_DESCRIPTION, "clientId", clientId));

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(Instant.parse(readJson(result, "$.updatedAt"))).isAfter(OLDER_UPDATE);
        var list = requestList(paula, listId);
        assertThat(list).hasStatus(HttpStatus.OK);
        assertThat(list).bodyJson().extractingPath("$.name").isEqualTo(NEW_LIST_NAME);
        assertThat(list).bodyJson().extractingPath("$.description").isEqualTo(NEW_LIST_DESCRIPTION);
    }

    @Test
    void updateListReportsInvalidFields() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID clientId = createClient(paula, SERGIO_NAME);
        UUID listId = createList(paula, clientId, LIST_NAME);

        var result = requestUpdate(paula, listId,
                Map.of("name", "", "description", DESCRIPTION_OVER_LIMIT, "clientId", clientId));

        assertReportsInvalidListFields(result);
    }

    @Test
    void deleteListRemovesIt() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);

        var result = requestDelete(paula, listId);

        assertThat(result).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(requestList(paula, listId)).hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void listOfAnotherOfficeIsNotFound() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        var marina = createAdmin(MARINA_NAME, MARINA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        UUID marinaClientId = createClient(marina, CAMILA_NAME);

        assertThat(requestList(marina, listId)).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(requestUpdate(marina, listId, Map.of("name", MARINA_LIST_NAME, "clientId", marinaClientId)))
                .hasStatus(HttpStatus.NOT_FOUND);
        assertThat(requestDelete(marina, listId)).hasStatus(HttpStatus.NOT_FOUND);

        var list = requestList(paula, listId);
        assertThat(list).hasStatus(HttpStatus.OK);
        assertThat(list).bodyJson().extractingPath("$.name").isEqualTo(LIST_NAME);
    }

    /** Both deletes wait for another transaction's lock on the list, so they reach the delete together. */
    @Test
    void overlappingDeletesOfTheSameListDeleteItOnce() throws Exception {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);

        var results = requestsDuringConcurrentTransaction(() -> jdbc.queryForList(LOCK_LISTS), List.of(
                () -> requestDelete(paula, listId),
                () -> requestDelete(paula, listId)));

        assertThat(statusesOf(results)).containsExactlyInAnyOrder(HttpStatus.NO_CONTENT, HttpStatus.NOT_FOUND);
        assertThat(requestList(paula, listId)).hasStatus(HttpStatus.NOT_FOUND);
    }

    /**
     * Another transaction deletes the list and commits only while the PUT waits for the list row, so the PUT finds the
     * list gone.
     */
    @Test
    void updateOfAListDeletedMeanwhileIsNotFound() throws Exception {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID clientId = createClient(paula, SERGIO_NAME);
        UUID listId = createList(paula, clientId, LIST_NAME);

        var results = requestsDuringConcurrentTransaction(
                () -> shoppingListService.delete(paula.officeId(), listId),
                List.of(() -> requestUpdate(paula, listId, Map.of("name", NEW_LIST_NAME, "clientId", clientId))));

        assertThat(statusesOf(results)).containsExactly(HttpStatus.NOT_FOUND);
        assertThat(requestList(paula, listId)).hasStatus(HttpStatus.NOT_FOUND);
    }

    private void assertReportsInvalidListFields(MvcTestResult result) {
        assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(result).bodyJson().extractingPath("$.errors.name").isEqualTo("Preencha este campo.");
        assertThat(result).bodyJson().extractingPath("$.errors.description")
                .isEqualTo("Use no máximo 500 caracteres.");
    }

    /** The rooms and products endpoints come later, so the tests store them with the repositories. */
    private Room storeRoom(UUID listId, String name, int position) {
        return roomRepository.save(new Room(shoppingListRepository.findById(listId).orElseThrow(), name, position));
    }

    private void storeProductWithLink(Room room, br.com.fluiar.selecao.model.ProductCategory category, String name) {
        productRepository.save(
                new Product(room, category, name, 1, null, null, false, List.of(new ProductLink(STORE_LINK, null))));
    }

    /** Stores a known past update time, so any later write by Hibernate is certainly newer, without waiting. */
    private void storeUpdatedAt(UUID listId, Instant updatedAt) {
        jdbc.update("update shopping_lists set updated_at = ? where id = ?",
                OffsetDateTime.ofInstant(updatedAt, ZoneOffset.UTC), listId);
    }

    /** Counts the SQL statements that one GET of the list prepares. */
    private long statementsToGet(TestSession session, UUID listId) {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();
        statistics.setStatisticsEnabled(true);
        try {
            assertThat(requestList(session, listId)).hasStatus(HttpStatus.OK);
            return statistics.getPrepareStatementCount();
        } finally {
            statistics.setStatisticsEnabled(false);
        }
    }

    private MvcTestResult requestLists(TestSession session) {
        return mvc.get().uri("/api/lists").header(HttpHeaders.AUTHORIZATION, bearer(session)).exchange();
    }

    private MvcTestResult requestCreate(TestSession session, Map<String, ?> list) {
        return mvc.post().uri("/api/lists")
                .header(HttpHeaders.AUTHORIZATION, bearer(session))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(list))
                .exchange();
    }

    private MvcTestResult requestList(TestSession session, UUID listId) {
        return mvc.get().uri("/api/lists/{id}", listId).header(HttpHeaders.AUTHORIZATION, bearer(session)).exchange();
    }

    private MvcTestResult requestUpdate(TestSession session, UUID listId, Map<String, ?> list) {
        return mvc.put().uri("/api/lists/{id}", listId)
                .header(HttpHeaders.AUTHORIZATION, bearer(session))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(list))
                .exchange();
    }

    private MvcTestResult requestDelete(TestSession session, UUID listId) {
        return mvc.delete().uri("/api/lists/{id}", listId)
                .header(HttpHeaders.AUTHORIZATION, bearer(session))
                .exchange();
    }
}
