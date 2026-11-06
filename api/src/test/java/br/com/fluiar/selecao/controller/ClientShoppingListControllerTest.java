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

class ClientShoppingListControllerTest extends ApiIntegrationTest {
    private TestSession admin;
    private TestSession owner;
    private TestSession other;
    private UUID clientId;
    private UUID otherClientId;
    private UUID listId;
    private UUID productId;

    @BeforeEach
    void prepareOwnedList() {
        admin = createAdmin("Admin", "admin@example.com");
        clientId = createClient(admin, "Client", "client@example.com");
        otherClientId = createClient(admin, "Other", "other@example.com");
        owner = inviteClient(admin, clientId);
        other = inviteClient(admin, otherClientId);
        listId = createList(admin, clientId, "Home");
        productId = createProduct(admin, listId, createRoom(admin, listId, "Kitchen"), "Chair");
    }

    @Test
    void clientsOnlyReadTheirOwnListsIncludingNewOnes() {
        UUID newList = createList(admin, clientId, "New list");
        var own = mvc.get().uri("/api/client/lists").header(HttpHeaders.AUTHORIZATION, bearer(owner)).exchange();
        assertThat(own).hasStatus(HttpStatus.OK);
        assertThat(own).bodyJson().extractingPath("$[*].id").asArray()
                .containsExactlyInAnyOrder(listId.toString(), newList.toString());
        assertThat(read(other, listId)).hasStatus(HttpStatus.NOT_FOUND);
        var otherOffice = createAdmin("Other office", "other-office@example.com");
        var remoteClient = createClient(otherOffice, "Remote", "remote@example.com");
        var remote = inviteClient(otherOffice, remoteClient);
        assertThat(read(remote, listId)).hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void clientListIncludesCategory() {
        var result = read(owner, listId);

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(result).bodyJson().extractingPath("$.rooms[0].products[0].category.name").isEqualTo("Outros");
        assertThat(result).bodyJson().extractingPath("$.rooms[0].products[0].category.deleted").isEqualTo(false);
    }

    @Test
    void privateDetailsOmitInternalFieldsAndClientAccountsFromSignature() {
        jdbc.update("update products set notes = 'Internal', unit_price = 10 where id = ?", productId);
        var response = read(owner, listId);
        assertThat(response).hasStatus(HttpStatus.OK);
        assertThat(response).bodyJson().doesNotHavePath("$.clientChanges");
        assertThat(response).bodyJson().doesNotHavePath("$.shareToken");
        assertThat(response).bodyJson().doesNotHavePath("$.clientId");
        assertThat(response).bodyJson().doesNotHavePath("$.rooms[0].products[0].notes");
        assertThat(response).bodyJson().doesNotHavePath("$.rooms[0].products[0].unitPrice");
        assertThat(response).bodyJson().doesNotHavePath("$.rooms[0].products[0].imageUrl");
        assertThat(response).bodyJson().extractingPath("$.signature.architectNames").asArray().containsExactly("Admin");
    }

    @Test
    void clientFeedbackIsVisibleAndEditableByAdminWithoutOverwritingOtherFields() {
        assertThat(notes(owner, "{\"clientNotes\":\"  Ordered locally  \"}")).hasStatus(HttpStatus.OK);
        assertThat(purchase(owner, "{\"bought\":true}")).hasStatus(HttpStatus.OK);
        var product = mvc.get().uri("/api/products/{id}", productId).header(HttpHeaders.AUTHORIZATION, bearer(admin)).exchange();
        assertThat(product).bodyJson().extractingPath("$.clientNotes").isEqualTo("Ordered locally");
        assertThat(product).bodyJson().extractingPath("$.bought").isEqualTo(true);
        var update = mvc.put().uri("/api/products/{id}/client-notes", productId)
                .header(HttpHeaders.AUTHORIZATION, bearer(admin)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"clientNotes\":\"Delivery confirmed\"}").exchange();
        assertThat(update).hasStatus(HttpStatus.OK);
        assertThat(update).bodyJson().extractingPath("$.bought").isEqualTo(true);
        assertThat(read(owner, listId)).bodyJson().extractingPath("$.rooms[0].products[0].clientNotes").isEqualTo("Delivery confirmed");
    }

    @Test
    void forbiddenWritesAndMalformedBodiesCannotMutateTheProduct() {
        assertThat(purchase(other, "{\"bought\":true}")).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(notes(other, "{\"clientNotes\":\"Other\"}")).hasStatus(HttpStatus.NOT_FOUND);
        for (String body : new String[] {"{}", "{\"bought\":null}", "{\"bought\":\"true\"}",
                "{\"bought\":true,\"quantity\":9}", "{\"bought\":true,\"clientId\":\"forged\"}"}) {
            assertThat(purchase(owner, body)).hasStatus(HttpStatus.BAD_REQUEST);
        }
        assertThat(notes(owner, "{}")).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(notes(owner, json(Map.of("clientNotes", "a".repeat(1001))))).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(notes(owner, json(Map.of("clientNotes", "a".repeat(1000))))).hasStatus(HttpStatus.OK);
        assertThat(notes(owner, "{\"clientNotes\":null}")).hasStatus(HttpStatus.OK);
        assertThat(read(owner, listId)).bodyJson().extractingPath("$.rooms[0].products[0].bought").isEqualTo(false);
    }

    @Test
    void transferringAListImmediatelyChangesItsOwner() {
        assertThat(notes(owner, "{\"clientNotes\":\"Existing note\"}")).hasStatus(HttpStatus.OK);
        var transfer = mvc.put().uri("/api/lists/{id}", listId).header(HttpHeaders.AUTHORIZATION, bearer(admin))
                .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("name", "Home", "clientId", otherClientId))).exchange();
        assertThat(transfer).hasStatus(HttpStatus.OK);
        assertThat(read(owner, listId)).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(purchase(owner, "{\"bought\":true}")).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(read(other, listId)).bodyJson().extractingPath("$.rooms[0].products[0].clientNotes").isEqualTo("Existing note");
    }

    /** The owner's write waits for a concurrent transfer of the list and must not apply after it commits. */
    @Test
    void ownerWriteWaitingForATransferOfTheListIsNotFound() throws Exception {
        var result = requestsDuringConcurrentTransaction(() -> {
            jdbc.queryForObject("select id from shopping_lists where id = ? for update", UUID.class, listId);
            jdbc.update("update shopping_lists set client_id = ? where id = ?", otherClientId, listId);
        }, List.of(() -> purchase(owner, "{\"bought\":true}"))).getFirst();

        assertThat(result).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(jdbc.queryForObject("select bought from products where id = ?", Boolean.class, productId)).isFalse();
    }

    @Test
    void recordsOnlyRealClientChangesAndKeepsLatestFieldSnapshots() {
        assertThat(purchase(owner, "{\"bought\":true}")).hasStatus(HttpStatus.OK);
        assertThat(jdbc.queryForMap("select * from products where id = ?", productId))
                .containsEntry("client_purchase_revision", 1L).containsEntry("client_purchase_value", true);
        purchase(owner, "{\"bought\":true}");
        notes(owner, "{\"clientNotes\":\"  Prefiro preto  \"}");
        notes(owner, "{\"clientNotes\":\"Prefiro preto\"}");
        assertThat(jdbc.queryForObject("select client_change_revision from shopping_lists where id = ?", Long.class, listId)).isEqualTo(2L);
        purchase(owner, "{\"bought\":false}");
        notes(owner, "{\"clientNotes\":null}");
        assertThat(jdbc.queryForMap("select * from products where id = ?", productId))
                .containsEntry("client_purchase_revision", 3L).containsEntry("client_purchase_value", false)
                .containsEntry("client_notes_revision", 4L).containsEntry("client_notes_value", null);
    }

    private MvcTestResult read(TestSession session, UUID id) {
        return mvc.get().uri("/api/client/lists/{id}", id).header(HttpHeaders.AUTHORIZATION, bearer(session)).exchange();
    }

    private MvcTestResult purchase(TestSession session, String body) {
        return mvc.patch().uri("/api/client/lists/{list}/products/{product}", listId, productId)
                .header(HttpHeaders.AUTHORIZATION, bearer(session)).contentType(MediaType.APPLICATION_JSON).content(body).exchange();
    }

    private MvcTestResult notes(TestSession session, String body) {
        return mvc.put().uri("/api/client/lists/{list}/products/{product}/client-notes", listId, productId)
                .header(HttpHeaders.AUTHORIZATION, bearer(session)).contentType(MediaType.APPLICATION_JSON).content(body).exchange();
    }
}
