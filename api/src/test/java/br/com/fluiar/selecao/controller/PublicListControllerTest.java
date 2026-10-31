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

    @Autowired
    private ShoppingListService shoppingListService;

    @Test
    void publicListShowsOnlyClientFacingData() {
        signUp(MARINA_NAME, MARINA_EMAIL);
        var paula = signUp(PAULA_NAME, PAULA_EMAIL);
        renameOffice(paula, OFFICE_NAME);
        inviteMember(paula, ISABELA_NAME, ISABELA_EMAIL);
        UUID listId = createListWithDescription(paula, createClient(paula, SERGIO_NAME));
        createMixer(paula, listId, createRoom(paula, listId, KITCHEN));
        createRoom(paula, listId, LAUNDRY);

        var result = requestPublicList(shareTokenOf(paula, listId));

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(result).bodyJson().extractingPath("$.name").isEqualTo(LIST_NAME);
        assertThat(result).bodyJson().extractingPath("$.description").isEqualTo(LIST_DESCRIPTION);
        assertThat(result).bodyJson().doesNotHavePath("$.id");
        assertThat(result).bodyJson().extractingPath("$.rooms[*].name").asArray().containsExactly(KITCHEN);
        assertThat(result).bodyJson().doesNotHavePath("$.rooms[0].id");

        assertThat(result).bodyJson().extractingPath("$.rooms[0].products[0].name").isEqualTo(MIXER);
        assertThat(result).bodyJson().extractingPath("$.rooms[0].products[0].quantity").isEqualTo(1);
        assertThat(result).bodyJson().extractingPath("$.rooms[0].products[0].bought").isEqualTo(false);
        assertThat(result).bodyJson().extractingPath("$.rooms[0].products[0].links[*].url").asArray()
                .containsExactly(MIXER_LINK, OTHER_MIXER_LINK);
        assertThat(result).bodyJson().doesNotHavePath("$.rooms[0].products[0].unitPrice");
        assertThat(result).bodyJson().doesNotHavePath("$.rooms[0].products[0].notes");
        assertThat(result).bodyJson().doesNotHavePath("$.rooms[0].products[0].id");

        assertThat(result).bodyJson().extractingPath("$.signature.officeName").isEqualTo(OFFICE_NAME);
        assertThat(result).bodyJson().extractingPath("$.signature.architectNames").asArray()
                .containsExactly(ISABELA_NAME, PAULA_NAME);
    }

    @Test
    void unknownShareTokenIsNotFound() {
        var result = requestPublicList(SecureTokens.generate());

        assertThat(result).hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void rotateShareTokenInvalidatesOldLink() {
        var paula = signUp(PAULA_NAME, PAULA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        String oldToken = shareTokenOf(paula, listId);

        var result = requestRotate(paula, listId);

        assertThat(result).hasStatus(HttpStatus.OK);
        String newToken = readJson(result, "$.shareToken");
        assertThat(newToken).isNotBlank().isNotEqualTo(oldToken);
        assertThat(requestPublicList(oldToken)).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(requestPublicList(newToken)).hasStatus(HttpStatus.OK);
    }

    @Test
    void rotateShareTokenOfAnotherOfficeIsNotFound() {
        var paula = signUp(PAULA_NAME, PAULA_EMAIL);
        var marina = signUp(MARINA_NAME, MARINA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        String paulaToken = shareTokenOf(paula, listId);

        var result = requestRotate(marina, listId);

        assertThat(result).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(requestPublicList(paulaToken)).hasStatus(HttpStatus.OK);
    }

    /**
     * Another transaction renames the list and commits only while the rotation waits for the list row. Hibernate
     * writes every column of the list, so a rotation that loaded the list before the rename would restore the old
     * name.
     */
    @Test
    void rotateShareTokenKeepsAConcurrentListChange() throws Exception {
        var paula = signUp(PAULA_NAME, PAULA_EMAIL);
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
        var paula = signUp(PAULA_NAME, PAULA_EMAIL);
        UUID clientId = createClient(paula, SERGIO_NAME);
        UUID listId = createList(paula, clientId, LIST_NAME);
        String oldToken = shareTokenOf(paula, listId);
        AtomicReference<String> newToken = new AtomicReference<>();

        var results = requestsDuringConcurrentTransaction(
                () -> newToken.set(shoppingListService.rotateShareToken(paula.officeId(), listId).shareToken()),
                List.of(() -> requestUpdate(paula, listId, Map.of("name", NEW_LIST_NAME, "clientId", clientId))));

        assertThat(statusesOf(results)).containsExactly(HttpStatus.OK);
        var publicList = requestPublicList(newToken.get());
        assertThat(publicList).hasStatus(HttpStatus.OK);
        assertThat(publicList).bodyJson().extractingPath("$.name").isEqualTo(NEW_LIST_NAME);
        assertThat(requestPublicList(oldToken)).hasStatus(HttpStatus.NOT_FOUND);
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
                .content(json(Map.of("roomId", roomId, "name", MIXER, "quantity", 1,
                        "unitPrice", new BigDecimal(MIXER_PRICE), "notes", MIXER_NOTES, "links", List.of(
                                Map.of("url", MIXER_LINK, "note", MIXER_LINK_NOTE),
                                Map.of("url", OTHER_MIXER_LINK)))))
                .exchange();
        assertThat(result).hasStatus(HttpStatus.CREATED);
    }

    private String shareTokenOf(TestSession session, UUID listId) {
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

    /** Sends no Authorization header, like the client who opens the shared link. */
    private MvcTestResult requestPublicList(String shareToken) {
        return mvc.get().uri("/api/public/lists/{shareToken}", shareToken).exchange();
    }
}
