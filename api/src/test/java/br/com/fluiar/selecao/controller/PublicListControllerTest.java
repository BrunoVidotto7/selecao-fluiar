package br.com.fluiar.selecao.controller;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.fluiar.selecao.security.SecureTokens;
import br.com.fluiar.selecao.service.ShoppingListService;
import br.com.fluiar.selecao.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MvcTestResult;

class PublicListControllerTest extends ApiIntegrationTest {

    private static final String PAULA_NAME = "Paula Hooper";
    private static final String PAULA_EMAIL = "paula@fluiar.com.br";
    private static final String ISABELA_NAME = "Isabela Machado";
    private static final String ISABELA_EMAIL = "isabela@fluiar.com.br";
    private static final String MARINA_NAME = "Marina Costa";
    private static final String MARINA_EMAIL = "marina@fluiar.com.br";
    private static final String OFFICE_NAME = "Fluiar";
    private static final String SERGIO_NAME = "Sérgio Hooper";
    private static final String LIST_NAME = "Lista de compras da casa";
    private static final String LIST_DESCRIPTION = "Itens para a casa nova.";
    private static final String NEW_LIST_NAME = "Lista do apartamento";
    private static final String KITCHEN = "Cozinha";
    private static final String LAUNDRY = "Lavanderia";
    private static final String MIXER = "Batedeira";
    private static final String MIXER_PRICE = "459.00";
    private static final String MIXER_NOTES = "Para massas pesadas, escolher a opção 3.";
    private static final String MIXER_LINK = "https://meli.la/1sNwTbN";
    private static final String MIXER_LINK_NOTE = "Massas mais leves";
    private static final String OTHER_MIXER_LINK = "https://meli.la/2az7TXp";
    private static final String RENAME_LIST = "update shopping_lists set name = ? where id = ?";

    private TestSession currentReader;

    @Autowired
    private ShoppingListService shoppingListService;

    @Test
    void sharedListRequiresLoginAndTheCurrentOwner() {
        var admin = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID clientId = createClient(admin, SERGIO_NAME, "client@example.com");
        UUID listId = createList(admin, clientId, LIST_NAME);
        String token = shareTokenOf(admin, listId);
        var owner = inviteClient(admin, clientId);
        var other = createClientAccount(admin, createClient(admin, "Other", "other@example.com"), "other@example.com");
        assertThat(mvc.get().uri("/api/public/lists/{token}", token).exchange()).hasStatus(HttpStatus.UNAUTHORIZED);
        assertThat(mvc.get().uri("/api/public/lists/{token}", token).header(HttpHeaders.AUTHORIZATION, bearer(other)).exchange())
                .hasStatus(HttpStatus.NOT_FOUND);
        var result = mvc.get().uri("/api/public/lists/{token}", token).header(HttpHeaders.AUTHORIZATION, bearer(owner)).exchange();
        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(result).bodyJson().extractingPath("$.listId").isEqualTo(listId.toString());
        assertThat(result).bodyJson().extractingPath("$.role").isEqualTo("CLIENT");
        assertThat(result).bodyJson().doesNotHavePath("$.rooms");
    }

    @Test
    void unknownShareTokenIsNotFound() {
        currentReader = createAdmin(PAULA_NAME, PAULA_EMAIL);
        var result = requestSharedList(SecureTokens.generate());

        assertThat(result).hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void rotateShareTokenInvalidatesOldLink() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        String oldToken = shareTokenOf(paula, listId);

        var result = requestRotate(paula, listId);

        assertThat(result).hasStatus(HttpStatus.OK);
        String newToken = readJson(result, "$.shareToken");
        assertThat(newToken).isNotBlank().isNotEqualTo(oldToken);
        assertThat(requestSharedList(oldToken)).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(requestSharedList(newToken)).hasStatus(HttpStatus.OK);
    }

    @Test
    void rotateShareTokenOfAnotherOfficeIsNotFound() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        var marina = createAdmin(MARINA_NAME, MARINA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        String paulaToken = shareTokenOf(paula, listId);

        var result = requestRotate(marina, listId);

        assertThat(result).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(requestSharedList(paulaToken)).hasStatus(HttpStatus.OK);
    }

    /**
     * Another transaction renames the list and commits only while the rotation waits for the list row. Hibernate
     * writes every column of the list, so a rotation that loaded the list before the rename would restore the old
     * name.
     */
    @Test
    void rotateShareTokenKeepsAConcurrentListChange() throws Exception {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);

        var results = requestsDuringConcurrentTransaction(
                () -> jdbc.update(RENAME_LIST, NEW_LIST_NAME, listId),
                List.of(() -> requestRotate(paula, listId)));

        assertThat(statusesOf(results)).containsExactly(HttpStatus.OK);
        String newToken = readJson(results.getFirst(), "$.shareToken");
        var list = requestList(paula, listId);
        assertThat(list).hasStatus(HttpStatus.OK);
        assertThat(list).bodyJson().extractingPath("$.name").isEqualTo(NEW_LIST_NAME);
        assertThat(list).bodyJson().extractingPath("$.shareToken").isEqualTo(newToken);
    }

    /**
     * Another transaction rotates the link and commits only while the edit waits for the list row. Hibernate writes
     * every column of the list, so an edit that loaded the list before the rotation would restore the old link.
     */
    @Test
    void listEditOverlappingARotationKeepsTheNewLink() throws Exception {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID clientId = createClient(paula, SERGIO_NAME);
        UUID listId = createList(paula, clientId, LIST_NAME);
        String oldToken = shareTokenOf(paula, listId);
        AtomicReference<String> newToken = new AtomicReference<>();

        var results = requestsDuringConcurrentTransaction(
                () -> newToken.set(shoppingListService.rotateShareToken(paula.officeId(), listId).shareToken()),
                List.of(() -> requestUpdate(paula, listId, Map.of("name", NEW_LIST_NAME, "clientId", clientId))));

        assertThat(statusesOf(results)).containsExactly(HttpStatus.OK);
        var publicList = requestSharedList(newToken.get());
        assertThat(publicList).hasStatus(HttpStatus.OK);
        assertThat(requestList(paula, listId)).bodyJson().extractingPath("$.name").isEqualTo(NEW_LIST_NAME);
        assertThat(requestSharedList(oldToken)).hasStatus(HttpStatus.NOT_FOUND);
    }

    private void renameOffice(TestSession session, String name) {
        var result = mvc.put().uri("/api/office")
                .header(HttpHeaders.AUTHORIZATION, bearer(session))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("name", name)))
                .exchange();
        assertThat(result).hasStatus(HttpStatus.OK);
    }

    private UUID createListWithDescription(TestSession session, UUID clientId) {
        var result = mvc.post().uri("/api/lists")
                .header(HttpHeaders.AUTHORIZATION, bearer(session))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("name", LIST_NAME, "description", LIST_DESCRIPTION, "clientId", clientId)))
                .exchange();
        assertThat(result).hasStatus(HttpStatus.CREATED);

        return UUID.fromString(readJson(result, "$.id"));
    }

    /** Creates the mixer for 459.00, with notes and two links, in the room. */
    private void createMixer(TestSession session, UUID listId, UUID roomId) {
        var result = mvc.post().uri("/api/lists/{listId}/products", listId)
                .header(HttpHeaders.AUTHORIZATION, bearer(session))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("roomId", roomId, "categoryId", categoryId(session, "Outros"), "name", MIXER, "quantity", 1,
                        "unitPrice", new BigDecimal(MIXER_PRICE), "notes", MIXER_NOTES, "links", List.of(
                                Map.of("url", MIXER_LINK, "note", MIXER_LINK_NOTE),
                                Map.of("url", OTHER_MIXER_LINK)))))
                .exchange();
        assertThat(result).hasStatus(HttpStatus.CREATED);
    }

    private String shareTokenOf(TestSession session, UUID listId) {
        currentReader = session;
        var list = requestList(session, listId);
        assertThat(list).hasStatus(HttpStatus.OK);

        return readJson(list, "$.shareToken");
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

    private MvcTestResult requestRotate(TestSession session, UUID listId) {
        return mvc.post().uri("/api/lists/{id}/share-token", listId)
                .header(HttpHeaders.AUTHORIZATION, bearer(session))
                .exchange();
    }

    private MvcTestResult requestSharedList(String shareToken) {
        return mvc.get().uri("/api/public/lists/{shareToken}", shareToken)
                .header(HttpHeaders.AUTHORIZATION, bearer(currentReader)).exchange();
    }
}
