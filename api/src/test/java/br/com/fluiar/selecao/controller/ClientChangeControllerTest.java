package br.com.fluiar.selecao.controller;

import static org.assertj.core.api.Assertions.assertThat;
import br.com.fluiar.selecao.support.ApiIntegrationTest;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MvcTestResult;

class ClientChangeControllerTest extends ApiIntegrationTest {
    private TestSession ana;
    private TestSession bea;
    private TestSession owner;
    private UUID client;
    private UUID list;
    private UUID room;
    private UUID product;

    @BeforeEach
    void prepare() {
        ana = createAdmin("Ana", "ana@example.com");
        bea = createAdminInOffice(ana, "Beatriz", "bea@example.com");
        client = createClient(ana, "Cliente");
        owner = createClientAccount(ana, client, "login@example.com");
        list = createList(ana, client, "Casa");
        room = createRoom(ana, list, "Sala");
        product = createProduct(ana, list, room, "Sofá");
    }

    @Test
    void openingListMarksOnlyThisArchitectsObservedRevision() {
        purchase(true);
        assertThat(confirm(ana, "{\"observedRevision\":1}")).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(detail(ana)).bodyJson().extractingPath("$.clientChanges.products").asArray().isEmpty();
        assertThat(detail(bea)).bodyJson().extractingPath("$.clientChanges.products").asArray().hasSize(1);
    }

    @Test
    void laterChangesAndOutOfOrderConfirmationsRemainMonotonic() {
        purchase(true);
        var updated = readJson(detail(ana), "$.updatedAt");
        assertThat(confirm(ana, "{\"observedRevision\":1}")).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(readJson(detail(ana), "$.updatedAt")).isEqualTo(updated);
        notes("Prefiro preto");
        confirm(ana, "{\"observedRevision\":1}");
        assertThat(detail(ana)).bodyJson().extractingPath("$.clientChanges.products[0].notes.value").isEqualTo("Prefiro preto");
        assertThat(detail(ana)).bodyJson().doesNotHavePath("$.clientChanges.products[0].purchase");
        confirm(ana, "{\"observedRevision\":2}");
        confirm(ana, "{\"observedRevision\":1}");
        confirm(ana, "{\"observedRevision\":0}");
        assertThat(detail(ana)).bodyJson().extractingPath("$.clientChanges.products").asArray().isEmpty();
        assertThat(jdbc.queryForObject("select seen_revision from list_client_change_reads where user_id=? and list_id=?", Long.class, ana.userId(), list)).isEqualTo(2L);
    }

    @Test
    void rejectsMalformedBodiesAndEnforcesScopeAndRoles() {
        for (var body : List.of("", "{}", "{\"observedRevision\":null}", "{\"observedRevision\":\"0\"}",
                "{\"observedRevision\":true}", "{\"observedRevision\":0.5}", "{\"observedRevision\":-1}",
                "{\"observedRevision\":9223372036854775808}", "{\"observedRevision\":0,\"userId\":null}")) {
            assertThat(confirm(ana, body)).as(body).hasStatus(HttpStatus.BAD_REQUEST);
        }
        var future = confirm(ana, "{\"observedRevision\":1}");
        assertThat(future).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(future).bodyJson().hasPath("$.errors.observedRevision");
        var remote = createAdmin("Remote", "remote@example.com");
        assertThat(confirm(remote, "{\"observedRevision\":0}")).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(confirm(owner, "{\"observedRevision\":0}")).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.post().uri("/api/lists/{id}/client-changes/read", list).contentType(MediaType.APPLICATION_JSON)
                .content("{\"observedRevision\":0}").exchange()).hasStatus(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void summaryCountsDistinctProductsAndLatestClientValues() throws Exception {
        purchase(true);
        notes("Preto");
        UUID second = createProduct(ana, list, room, "Mesa");
        jdbc.update("update products set bought=true where id=?", second);
        assertThat(mvc.patch().uri("/api/client/lists/{id}/products/{product}", list, second)
                .header(HttpHeaders.AUTHORIZATION, bearer(owner)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"bought\":false}").exchange()).hasStatus(HttpStatus.OK);
        var result = summary(ana, "0");
        assertThat(result).hasStatus(HttpStatus.OK);
        var body = jsonMapper.readTree(result.getResponse().getContentAsString());
        assertThat(body.at("/pendingListCount").asLong()).isEqualTo(1);
        assertThat(body.at("/items/0/changedProductCount").asLong()).isEqualTo(2);
        assertThat(body.at("/items/0/purchaseMarkedCount").asLong()).isEqualTo(1);
        assertThat(body.at("/items/0/purchaseUnmarkedCount").asLong()).isEqualTo(1);
        assertThat(body.at("/items/0/notesChangedCount").asLong()).isEqualTo(1);
        notes(null);
        var removed = jsonMapper.readTree(summary(ana, "0").getResponse().getContentAsString());
        assertThat(removed.at("/items/0/notesChangedCount").asLong()).isZero();
        assertThat(removed.at("/items/0/notesRemovedCount").asLong()).isEqualTo(1);
        assertThat(detail(ana)).bodyJson().hasPath("$.clientChanges.products[0]");
    }

    private MvcTestResult summary(TestSession session, String page) {
        return mvc.get().uri("/api/client-changes?page=" + page).header(HttpHeaders.AUTHORIZATION, bearer(session)).exchange();
    }

    @Test
    void administrativeEditsPreserveClientSnapshotsAndDoNotCreateChanges() {
        purchase(true);
        notes("Prefiro preto");
        assertThat(mvc.patch().uri("/api/products/{id}", product).header(HttpHeaders.AUTHORIZATION, bearer(ana))
                .contentType(MediaType.APPLICATION_JSON).content("{\"bought\":false}").exchange()).hasStatus(HttpStatus.OK);
        assertThat(mvc.put().uri("/api/products/{id}/client-notes", product).header(HttpHeaders.AUTHORIZATION, bearer(ana))
                .contentType(MediaType.APPLICATION_JSON).content("{\"clientNotes\":\"Valor administrativo\"}").exchange()).hasStatus(HttpStatus.OK);
        var result = detail(ana);
        assertThat(result).bodyJson().extractingPath("$.rooms[0].products[0].bought").isEqualTo(false);
        assertThat(result).bodyJson().extractingPath("$.rooms[0].products[0].clientNotes").isEqualTo("Valor administrativo");
        assertThat(result).bodyJson().extractingPath("$.clientChanges.observedRevision").isEqualTo(2);
        assertThat(result).bodyJson().extractingPath("$.clientChanges.products[0].purchase.value").isEqualTo(true);
        assertThat(result).bodyJson().extractingPath("$.clientChanges.products[0].notes.value").isEqualTo("Prefiro preto");
    }

    @Test
    void readDuringUncommittedWriteHasOneSnapshot() throws Exception {
        purchase(true);
        var results = requestsDuringConcurrentTransaction(() -> {
            jdbc.queryForObject("select client_change_revision from shopping_lists where id=? for update", Long.class, list);
            jdbc.update("update shopping_lists set client_change_revision=2 where id=?", list);
            jdbc.update("update products set bought=false, client_purchase_revision=2, client_purchase_value=false where id=?", product);
        }, List.of(() -> detail(ana)));
        var before = results.getFirst();
        assertThat(before).bodyJson().extractingPath("$.clientChanges.observedRevision").isEqualTo(1);
        assertThat(before).bodyJson().extractingPath("$.rooms[0].products[0].bought").isEqualTo(true);
        assertThat(before).bodyJson().extractingPath("$.clientChanges.products[0].purchase.value").isEqualTo(true);
        assertThat(detail(ana)).bodyJson().extractingPath("$.clientChanges.observedRevision").isEqualTo(2);
    }

    @Test
    void concurrentConfirmationsNeverRegressOrConsumeLaterChanges() throws Exception {
        purchase(true);
        notes("Preto");
        var responses = requestsDuringConcurrentTransaction(() ->
                jdbc.queryForObject("select client_change_revision from shopping_lists where id=? for update", Long.class, list),
                List.of(() -> confirm(ana, "{\"observedRevision\":1}"), () -> confirm(ana, "{\"observedRevision\":2}")));
        assertThat(statusesOf(responses)).containsOnly(HttpStatus.NO_CONTENT);
        assertThat(detail(ana)).bodyJson().extractingPath("$.clientChanges.products").asArray().isEmpty();
        notes(null);
        assertThat(detail(ana)).bodyJson().extractingPath("$.clientChanges.products[0].notes.value").isNull();
    }

    @Test
    void pagesAllListsWithStableOrderingAndPersonalTotals() throws Exception {
        org.mockito.Mockito.doReturn(java.time.Instant.parse("2026-11-05T12:00:00Z")).when(testClock).instant();
        try {
            purchase(true);
            var ids = new java.util.ArrayList<UUID>();
            ids.add(list);
            for (int index = 0; index < 20; index++) {
                UUID next = createList(ana, client, "Lista " + index);
                UUID nextProduct = createProduct(ana, next, createRoom(ana, next, "Sala"), "Produto");
                assertThat(mvc.patch().uri("/api/client/lists/{id}/products/{product}", next, nextProduct)
                        .header(HttpHeaders.AUTHORIZATION, bearer(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"bought\":true}").exchange()).hasStatus(HttpStatus.OK);
                ids.add(next);
            }
            ids.sort(java.util.Comparator.comparing(UUID::toString));
            var first = jsonMapper.readTree(summary(ana, "0").getResponse().getContentAsString());
            var second = jsonMapper.readTree(summary(ana, "1").getResponse().getContentAsString());
            assertThat(first.at("/pendingListCount").asLong()).isEqualTo(21);
            assertThat(second.at("/pendingListCount").asLong()).isEqualTo(21);
            assertThat(first.at("/items").size()).isEqualTo(20);
            assertThat(second.at("/items").size()).isEqualTo(1);
            for (int index = 0; index < 20; index++) {
                assertThat(first.at("/items/" + index + "/listId").asString()).isEqualTo(ids.get(index).toString());
            }
            assertThat(second.at("/items/0/listId").asString()).isEqualTo(ids.getLast().toString());
            confirm(ana, "{\"observedRevision\":1}");
            assertThat(jsonMapper.readTree(summary(ana, "0").getResponse().getContentAsString()).at("/pendingListCount").asLong()).isEqualTo(20);
            assertThat(jsonMapper.readTree(summary(bea, "0").getResponse().getContentAsString()).at("/pendingListCount").asLong()).isEqualTo(21);
            assertThat(jsonMapper.readTree(summary(ana, "2147483647").getResponse().getContentAsString()).at("/items").size()).isZero();
        } finally {
            org.mockito.Mockito.doCallRealMethod().when(testClock).instant();
        }
    }

    @Test
    void validatesSummaryPageAndScopesItsResults() throws Exception {
        purchase(true);
        for (var value : List.of("-1", "0.5", "x", "2147483648")) {
            assertThat(summary(ana, value)).hasStatus(HttpStatus.BAD_REQUEST);
        }
        var remote = createAdmin("Remote", "remote@example.com");
        assertThat(jsonMapper.readTree(summary(remote, "0").getResponse().getContentAsString()).at("/pendingListCount").asLong()).isZero();
        assertThat(summary(owner, "0")).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri("/api/client-changes").exchange()).hasStatus(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void deletionsRemovePendingProductsAndCascadeReadCursors() throws Exception {
        purchase(true);
        confirm(ana, "{\"observedRevision\":1}");
        assertThat(mvc.delete().uri("/api/products/{id}", product).header(HttpHeaders.AUTHORIZATION, bearer(ana)).exchange()).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(jsonMapper.readTree(summary(bea, "0").getResponse().getContentAsString()).at("/pendingListCount").asLong()).isZero();
        assertThat(mvc.delete().uri("/api/clients/{id}", client).header(HttpHeaders.AUTHORIZATION, bearer(ana)).exchange()).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(jdbc.queryForObject("select count(*) from list_client_change_reads", Long.class)).isZero();
    }

    @Test
    void cursorsBelongToOneUserAndOneListAndNewAdminsStartAtZero() throws Exception {
        purchase(true);
        UUID firstList = list;
        UUID secondList = createList(ana, client, "Outra lista");
        UUID secondRoom = createRoom(ana, secondList, "Sala");
        UUID secondProduct = createProduct(ana, secondList, secondRoom, "Mesa");
        assertThat(mvc.patch().uri("/api/client/lists/{id}/products/{product}", secondList, secondProduct)
                .header(HttpHeaders.AUTHORIZATION, bearer(owner)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"bought\":true}").exchange()).hasStatus(HttpStatus.OK);
        confirm(ana, "{\"observedRevision\":1}");
        var newcomer = createAdminInOffice(ana, "Nova", "new@example.com");
        assertThat(detail(newcomer)).bodyJson().extractingPath("$.clientChanges.products").asArray().hasSize(1);
        assertThat(jsonMapper.readTree(summary(ana, "0").getResponse().getContentAsString()).at("/pendingListCount").asLong()).isEqualTo(1);
        assertThat(jsonMapper.readTree(summary(newcomer, "0").getResponse().getContentAsString()).at("/pendingListCount").asLong()).isEqualTo(2);
        assertThat(mvc.post().uri("/api/lists/{id}/client-changes/read", UUID.randomUUID())
                .header(HttpHeaders.AUTHORIZATION, bearer(ana)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"observedRevision\":0}").exchange()).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(mvc.delete().uri("/api/rooms/{id}", secondRoom).header(HttpHeaders.AUTHORIZATION, bearer(ana)).exchange()).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(jsonMapper.readTree(summary(ana, "0").getResponse().getContentAsString()).at("/pendingListCount").asLong()).isZero();
        assertThat(mvc.delete().uri("/api/lists/{id}", firstList).header(HttpHeaders.AUTHORIZATION, bearer(ana)).exchange()).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(jdbc.queryForObject("select count(*) from list_client_change_reads where list_id=?", Long.class, firstList)).isZero();
    }

    @Test
    void adminWritesBeforeClientFeedbackCreateNoRetroactiveNotifications() throws Exception {
        assertThat(mvc.patch().uri("/api/products/{id}", product).header(HttpHeaders.AUTHORIZATION, bearer(ana))
                .contentType(MediaType.APPLICATION_JSON).content("{\"bought\":true}").exchange()).hasStatus(HttpStatus.OK);
        assertThat(mvc.put().uri("/api/products/{id}/client-notes", product).header(HttpHeaders.AUTHORIZATION, bearer(ana))
                .contentType(MediaType.APPLICATION_JSON).content("{\"clientNotes\":\"Administrativo\"}").exchange()).hasStatus(HttpStatus.OK);
        assertThat(detail(ana)).bodyJson().extractingPath("$.clientChanges.observedRevision").isEqualTo(0);
        assertThat(detail(ana)).bodyJson().extractingPath("$.clientChanges.products").asArray().isEmpty();
        assertThat(jsonMapper.readTree(summary(ana, "0").getResponse().getContentAsString()).at("/pendingListCount").asLong()).isZero();
    }

    @Test
    void adminEditWithoutBoughtKeepsClientPurchase() {
        purchase(true);
        var edit = Map.of("roomId", room, "categoryId", categoryId(ana, "Outros"), "name", "Sofá retrátil", "quantity", 1);
        assertThat(mvc.put().uri("/api/products/{id}", product).header(HttpHeaders.AUTHORIZATION, bearer(ana))
                .contentType(MediaType.APPLICATION_JSON).content(json(edit)).exchange()).hasStatus(HttpStatus.OK);
        assertThat(jdbc.queryForObject("select bought from products where id = ?", Boolean.class, product)).isTrue();
        assertThat(detail(ana)).bodyJson().extractingPath("$.clientChanges.products[0].purchase.value").isEqualTo(true);
    }

    private void purchase(boolean bought) {
        assertThat(mvc.patch().uri("/api/client/lists/{id}/products/{product}", list, product)
                .header(HttpHeaders.AUTHORIZATION, bearer(owner)).contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("bought", bought))).exchange()).hasStatus(HttpStatus.OK);
    }
    private void notes(String value) {
        assertThat(mvc.put().uri("/api/client/lists/{id}/products/{product}/client-notes", list, product)
                .header(HttpHeaders.AUTHORIZATION, bearer(owner)).contentType(MediaType.APPLICATION_JSON)
                .content(json(java.util.Collections.singletonMap("clientNotes", value))).exchange()).hasStatus(HttpStatus.OK);
    }
    private MvcTestResult detail(TestSession session) {
        return mvc.get().uri("/api/lists/{id}", list).header(HttpHeaders.AUTHORIZATION, bearer(session)).exchange();
    }
    private MvcTestResult confirm(TestSession session, String body) {
        return mvc.post().uri("/api/lists/{id}/client-changes/read", list).header(HttpHeaders.AUTHORIZATION, bearer(session))
                .contentType(MediaType.APPLICATION_JSON).content(body).exchange();
    }
}
