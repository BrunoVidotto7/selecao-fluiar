package br.com.fluiar.selecao.controller;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.fluiar.selecao.support.ApiIntegrationTest;
import com.jayway.jsonpath.JsonPath;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MvcTestResult;

class ProductCategoryControllerTest extends ApiIntegrationTest {

    private static final String PAULA_NAME = "Paula Hooper";
    private static final String PAULA_EMAIL = "paula@fluiar.com.br";
    private static final String MARINA_NAME = "Marina Costa";
    private static final String MARINA_EMAIL = "marina@fluiar.com.br";
    private static final String SERGIO_NAME = "Sérgio Hooper";
    private static final String LIST_NAME = "Apartamento";
    private static final String ROOM_NAME = "Cozinha";
    private static final String PEDRAS = "Pedras";
    private static final String PAISAGISMO = "Paisagismo";
    private static final String NAME_REQUIRED = "Informe o nome da categoria.";
    private static final String NAME_TOO_LONG = "Use até 60 caracteres.";
    private static final String NAME_IN_USE = "Já existe uma categoria com esse nome.";
    private static final String LOCK_OFFICES = "select id from offices where id = ? for update";

    @Test
    void listsActiveCategoriesInPortugueseAlphabeticalOrder() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);

        var result = requestList(paula);

        assertThat(result).hasStatus(HttpStatus.OK);
        List<String> names = names(result);
        assertThat(names).hasSize(19);
        assertThat(names.getFirst()).isEqualTo("Acessibilidade");
        assertThat(names.getLast()).isEqualTo("Vidros e espelhos");
        assertThat(names).containsSubsequence("Mobiliário solto", "Outros", "Pedras");
        assertThat(result).bodyJson().extractingPath("$[0].productCount").isEqualTo(0);
    }

    @Test
    void createsCategoryAndListsIt() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);

        var result = requestCreate(paula, PAISAGISMO);

        assertThat(result).hasStatus(HttpStatus.CREATED);
        assertThat(result).bodyJson().extractingPath("$.name").isEqualTo(PAISAGISMO);
        assertThat(result).bodyJson().extractingPath("$.productCount").isEqualTo(0);
        assertThat(names(requestList(paula))).contains(PAISAGISMO);
    }

    @Test
    void rejectsBlankAndTooLongNames() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);

        var blank = requestCreate(paula, "");
        var tooLong = requestCreate(paula, "a".repeat(61));

        assertThat(blank).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(blank).bodyJson().extractingPath("$.errors.name").isEqualTo(NAME_REQUIRED);
        assertThat(tooLong).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(tooLong).bodyJson().extractingPath("$.errors.name").isEqualTo(NAME_TOO_LONG);
    }

    @Test
    void rejectsDuplicateOfActiveIgnoringCaseAndAccents() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);

        for (String name : List.of("pedras", "PEDRAS ", "Pédras")) {
            var result = requestCreate(paula, name);

            assertThat(result).hasStatus(HttpStatus.CONFLICT);
            assertThat(result).bodyJson().extractingPath("$.errors.name").isEqualTo(NAME_IN_USE);
        }
    }

    @Test
    void recreatingDeletedCategoryRestoresIt() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID pedrasId = categoryId(paula, PEDRAS);
        createProductIn(paula, pedrasId);
        assertThat(requestDelete(paula, pedrasId)).hasStatus(HttpStatus.NO_CONTENT);

        var result = requestCreate(paula, "pedras");

        assertThat(result).hasStatus(HttpStatus.CREATED);
        assertThat(result).bodyJson().extractingPath("$.id").isEqualTo(pedrasId.toString());
        assertThat(result).bodyJson().extractingPath("$.name").isEqualTo("pedras");
        assertThat(result).bodyJson().extractingPath("$.productCount").isEqualTo(1);
        assertThat(names(requestList(paula))).contains("pedras").doesNotContain(PEDRAS);
    }

    @Test
    void renamesCategoryKeepingProducts() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID pedrasId = categoryId(paula, PEDRAS);
        UUID productId = createProductIn(paula, pedrasId);

        var result = requestRename(paula, pedrasId, "Pedras naturais");

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(result).bodyJson().extractingPath("$.id").isEqualTo(pedrasId.toString());
        assertThat(result).bodyJson().extractingPath("$.name").isEqualTo("Pedras naturais");
        assertThat(result).bodyJson().extractingPath("$.productCount").isEqualTo(1);
        var product = mvc.get().uri("/api/products/{id}", productId)
                .header(HttpHeaders.AUTHORIZATION, bearer(paula)).exchange();
        assertThat(product).hasStatus(HttpStatus.OK);
        assertThat(product).bodyJson().extractingPath("$.category.name").isEqualTo("Pedras naturais");
    }

    @Test
    void renameToOwnNameWithDifferentCaseSucceeds() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID pedrasId = categoryId(paula, PEDRAS);

        var result = requestRename(paula, pedrasId, "PEDRAS");

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(result).bodyJson().extractingPath("$.name").isEqualTo("PEDRAS");
    }

    @Test
    void renameToOtherActiveCategoryNameIsDuplicate() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);

        var result = requestRename(paula, categoryId(paula, PEDRAS), "marcenaria");

        assertThat(result).hasStatus(HttpStatus.CONFLICT);
        assertThat(result).bodyJson().extractingPath("$.errors.name").isEqualTo(NAME_IN_USE);
    }

    @Test
    void renameToDeletedCategoryNameIsDuplicate() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        assertThat(requestDelete(paula, categoryId(paula, "Forros"))).hasStatus(HttpStatus.NO_CONTENT);

        var result = requestRename(paula, categoryId(paula, PEDRAS), "Forros");

        assertThat(result).hasStatus(HttpStatus.CONFLICT);
        assertThat(result).bodyJson().extractingPath("$.errors.name").isEqualTo(NAME_IN_USE);
    }

    @Test
    void deleteHidesCategoryFromList() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID pedrasId = categoryId(paula, PEDRAS);

        assertThat(requestDelete(paula, pedrasId)).hasStatus(HttpStatus.NO_CONTENT);

        assertThat(names(requestList(paula))).doesNotContain(PEDRAS);
        assertThat(requestDelete(paula, pedrasId)).hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void productCountCountsProductsInCategory() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID pedrasId = categoryId(paula, PEDRAS);
        createProductIn(paula, pedrasId);
        createProductIn(paula, pedrasId);

        var result = requestList(paula);

        assertThat(result).bodyJson().extractingPath("$[?(@.name == 'Pedras')].productCount").asArray()
                .containsExactly(2);
    }

    /** Both creates wait for the office lock, so the second one runs after the first and finds the name taken. */
    @Test
    void concurrentCreatesWithSameNameYieldOneRow() throws Exception {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);

        var results = requestsDuringConcurrentTransaction(
                () -> jdbc.queryForList(LOCK_OFFICES, paula.officeId()), List.of(
                        () -> requestCreate(paula, PAISAGISMO),
                        () -> requestCreate(paula, PAISAGISMO)));

        assertThat(statusesOf(results)).containsExactlyInAnyOrder(HttpStatus.CREATED, HttpStatus.CONFLICT);
        assertThat(jdbc.queryForObject(
                "select count(*) from product_categories where office_id = ? and name_key = 'paisagismo'",
                Integer.class, paula.officeId())).isEqualTo(1);
    }

    @Test
    void anotherOfficeCategoryIs404() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        var marina = createAdmin(MARINA_NAME, MARINA_EMAIL);
        UUID marinaPedras = categoryId(marina, PEDRAS);

        assertThat(requestRename(paula, marinaPedras, "Rochas")).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(requestDelete(paula, marinaPedras)).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(names(requestList(marina))).contains(PEDRAS);
    }

    @Test
    void clientAccountIsForbidden() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID clientId = createClient(paula, SERGIO_NAME);
        var client = createClientAccount(paula, clientId, "sergio@example.com");

        assertThat(requestList(client)).hasStatus(HttpStatus.FORBIDDEN);
    }

    private UUID createProductIn(TestSession session, UUID categoryId) {
        UUID listId = createList(session, createClient(session, SERGIO_NAME, "c" + UUID.randomUUID() + "@example.com"),
                LIST_NAME);
        UUID roomId = createRoom(session, listId, ROOM_NAME);
        var result = mvc.post().uri("/api/lists/{listId}/products", listId)
                .header(HttpHeaders.AUTHORIZATION, bearer(session))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("roomId", roomId, "categoryId", categoryId, "name", "Bancada", "quantity", 1)))
                .exchange();
        assertThat(result).hasStatus(HttpStatus.CREATED);
        return UUID.fromString(readJson(result, "$.id"));
    }

    private List<String> names(MvcTestResult list) {
        String body = new String(list.getResponse().getContentAsByteArray(), StandardCharsets.UTF_8);
        return JsonPath.read(body, "$[*].name");
    }

    private MvcTestResult requestList(TestSession session) {
        return mvc.get().uri("/api/office/categories").header(HttpHeaders.AUTHORIZATION, bearer(session)).exchange();
    }

    private MvcTestResult requestCreate(TestSession session, String name) {
        return mvc.post().uri("/api/office/categories").header(HttpHeaders.AUTHORIZATION, bearer(session))
                .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("name", name))).exchange();
    }

    private MvcTestResult requestRename(TestSession session, UUID id, String name) {
        return mvc.put().uri("/api/office/categories/{id}", id).header(HttpHeaders.AUTHORIZATION, bearer(session))
                .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("name", name))).exchange();
    }

    private MvcTestResult requestDelete(TestSession session, UUID id) {
        return mvc.delete().uri("/api/office/categories/{id}", id).header(HttpHeaders.AUTHORIZATION, bearer(session))
                .exchange();
    }
}
