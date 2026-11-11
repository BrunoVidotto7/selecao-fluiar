package br.com.fluiar.selecao.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doReturn;

import br.com.fluiar.selecao.service.ClientService;
import br.com.fluiar.selecao.support.ApiIntegrationTest;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MvcTestResult;

class ClientControllerTest extends ApiIntegrationTest {

    private static final String PAULA_NAME = "Paula Hooper";
    private static final String PAULA_EMAIL = "paula@fluiar.com.br";
    private static final String MARINA_NAME = "Marina Costa";
    private static final String MARINA_EMAIL = "marina@fluiar.com.br";
    private static final String ISABELA_NAME = "Isabela Machado";
    private static final String ISABELA_EMAIL = "isabela@fluiar.com.br";
    private static final String SERGIO_NAME = "Sérgio Hooper";
    private static final String HELENA_NAME = "Helena Prado";
    private static final String CAMILA_NAME = "Camila Rezende";
    private static final String NEW_CLIENT_NAME_AS_TYPED = "  Sérgio e Ana Hooper ";
    private static final String NEW_CLIENT_NAME = "Sérgio e Ana Hooper";
    private static final String NEW_CLIENT_EMAIL = "ana.hooper@gmail.com";
    private static final String NEW_CLIENT_PHONE_AS_TYPED = "(31) 3822-4410";
    private static final String NEW_CLIENT_PHONE = "3138224410";
    private static final Map<String, String> NEW_CLIENT_DATA = Map.of(
            "name", NEW_CLIENT_NAME_AS_TYPED, "email", NEW_CLIENT_EMAIL, "phone", NEW_CLIENT_PHONE_AS_TYPED);
    private static final Map<String, String> INVALID_CLIENT_DATA = Map.of("name", "", "email", "sergio@", "phone", "123");
    private static final String LIST_NAME = "Apartamento";
    private static final Instant OLDER_UPDATE = Instant.parse("2020-01-01T00:00:00Z");
    private static final String LOCK_CLIENTS = "select id from clients for update";
    private static final String MALFORMED_JSON = "{\"name\": ";
    private static final String NOT_A_UUID = "abc";
    private static final String INVALID_REQUEST = "Revise os dados enviados.";

    private static final String CPF = "52998224725";
    private static final String CPF_AS_TYPED = "529.982.247-25";
    private static final String BIRTH_DATE = "1985-03-25";
    private static final String CPF_MESSAGE = "Digite um CPF válido.";
    private static final String BIRTH_DATE_MESSAGE = "Digite uma data de nascimento válida, como 25/03/1985.";
    /** 23:30 of 2026-11-11 in São Paulo, already 2026-11-12 in UTC. */
    private static final Instant SAO_PAULO_LATE_EVENING = Instant.parse("2026-11-12T02:30:00Z");

    @Autowired
    private ClientService clientService;

    @Test
    void createClientNormalizesEmailAndPhone() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);

        var result = requestCreate(paula, Map.of(
                "name", SERGIO_NAME, "email", " Sergio.Hooper@Gmail.com ", "phone", "(31) 98842-1170"));

        assertThat(result).hasStatus(HttpStatus.CREATED);
        assertThat(result).bodyJson().extractingPath("$.name").isEqualTo(SERGIO_NAME);
        assertThat(result).bodyJson().extractingPath("$.email").isEqualTo("sergio.hooper@gmail.com");
        assertThat(result).bodyJson().extractingPath("$.phone").isEqualTo("31988421170");
        assertThat(result).bodyJson().extractingPath("$.createdAt").asString().isNotBlank();
        assertThat(result).bodyJson().extractingPath("$.updatedAt").asString().isNotBlank();
    }

    @Test
    void createClientReportsInvalidFields() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);

        var result = requestCreate(paula, INVALID_CLIENT_DATA);

        assertReportsInvalidClientFields(result);
    }

    @Test
    void createClientRejectsMalformedJson() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);

        var result = mvc.post().uri("/api/clients")
                .header(HttpHeaders.AUTHORIZATION, bearer(paula))
                .contentType(MediaType.APPLICATION_JSON)
                .content(MALFORMED_JSON)
                .exchange();

        assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(result).bodyJson().extractingPath("$.detail").isEqualTo(INVALID_REQUEST);
    }

    @Test
    void listClientsShowsOfficeClients() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        var marina = createAdmin(MARINA_NAME, MARINA_EMAIL);
        createClient(paula, SERGIO_NAME);
        createClient(paula, HELENA_NAME);
        createClient(marina, CAMILA_NAME);

        var result = requestClients(paula);

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(result).bodyJson().extractingPath("$[*].name").asArray()
                .containsExactlyInAnyOrder(SERGIO_NAME, HELENA_NAME);
        assertThat(result).bodyJson().extractingPath("$[*].listCount").asArray().containsExactly(0, 0);
    }

    @Test
    void colleaguesShareClients() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID clientId = createClient(paula, SERGIO_NAME);
        var isabela = createAdminInOffice(paula, ISABELA_NAME, ISABELA_EMAIL);

        var result = requestClients(isabela);

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(result).bodyJson().extractingPath("$[*].id").asArray().containsExactly(clientId.toString());
    }

    @Test
    void getClientReturnsDetail() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID clientId = createClient(paula, SERGIO_NAME);

        var result = requestClient(paula, clientId);

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(result).bodyJson().extractingPath("$.name").isEqualTo(SERGIO_NAME);
        assertThat(result).bodyJson().extractingPath("$.lists").asArray().isEmpty();
    }

    @Test
    void getClientShowsItsLists() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID clientId = createClient(paula, SERGIO_NAME);
        createClient(paula, HELENA_NAME);
        storeList(clientId, LIST_NAME);

        var result = requestClient(paula, clientId);

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(result).bodyJson().extractingPath("$.lists[*].name").asArray().containsExactly(LIST_NAME);
    }

    @Test
    void getClientShowsTheListsItWasAddedTo() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID sergio = createClient(paula, SERGIO_NAME);
        UUID helena = createClient(paula, HELENA_NAME);
        UUID ownList = createList(paula, sergio, "Casa de praia");
        UUID otherList = createList(paula, helena, LIST_NAME);
        addMember(paula, otherList, helena, sergio, "READER");

        var result = requestClient(paula, sergio);

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(result).bodyJson().extractingPath("$.lists[*].id").asArray().containsExactly(ownList.toString());
        assertThat(result).bodyJson().extractingPath("$.memberLists[*].id").asArray().containsExactly(otherList.toString());
        assertThat(result).bodyJson().extractingPath("$.memberLists[0].name").isEqualTo(LIST_NAME);
        assertThat(result).bodyJson().extractingPath("$.memberLists[0].role").isEqualTo("READER");
    }

    @Test
    void deleteClientDeletesItsListsAndLeavesOtherListsWithoutIt() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID sergio = createClient(paula, SERGIO_NAME);
        UUID helena = createClient(paula, HELENA_NAME);
        UUID ownList = createList(paula, sergio, "Casa de praia");
        UUID otherList = createList(paula, helena, LIST_NAME);
        addMember(paula, otherList, helena, sergio, "READER");

        assertThat(requestDelete(paula, sergio)).hasStatus(HttpStatus.NO_CONTENT);

        assertThat(jdbc.queryForObject("select count(*) from shopping_lists where id = ?", Integer.class, ownList)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from shopping_lists where id = ?", Integer.class, otherList)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from list_members where list_id = ?", Integer.class, otherList)).isZero();
    }

    @Test
    void clientIdThatIsNotAUuidIsRejected() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);

        var result = mvc.get().uri("/api/clients/{id}", NOT_A_UUID)
                .header(HttpHeaders.AUTHORIZATION, bearer(paula))
                .exchange();

        assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(result).bodyJson().extractingPath("$.detail").isEqualTo(INVALID_REQUEST);
    }

    @Test
    void updateClientChangesData() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID clientId = createClient(paula, SERGIO_NAME);
        storeUpdatedAt(clientId, OLDER_UPDATE);

        var result = requestUpdate(paula, clientId, NEW_CLIENT_DATA);

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(Instant.parse(readJson(result, "$.updatedAt"))).isAfter(OLDER_UPDATE);
        var client = requestClient(paula, clientId);
        assertThat(client).hasStatus(HttpStatus.OK);
        assertThat(client).bodyJson().extractingPath("$.name").isEqualTo(NEW_CLIENT_NAME);
        assertThat(client).bodyJson().extractingPath("$.email").isEqualTo(NEW_CLIENT_EMAIL);
        assertThat(client).bodyJson().extractingPath("$.phone").isEqualTo(NEW_CLIENT_PHONE);
    }

    @Test
    void updateClientReportsInvalidFields() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID clientId = createClient(paula, SERGIO_NAME);

        var result = requestUpdate(paula, clientId, INVALID_CLIENT_DATA);

        assertReportsInvalidClientFields(result);
    }

    @Test
    void deleteClientRemovesIt() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID clientId = createClient(paula, SERGIO_NAME);

        var result = requestDelete(paula, clientId);

        assertThat(result).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(requestClient(paula, clientId)).hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void clientOfAnotherOfficeIsNotFound() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        var marina = createAdmin(MARINA_NAME, MARINA_EMAIL);
        UUID clientId = createClient(paula, SERGIO_NAME);

        assertThat(requestClient(marina, clientId)).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(requestUpdate(marina, clientId, NEW_CLIENT_DATA)).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(requestDelete(marina, clientId)).hasStatus(HttpStatus.NOT_FOUND);

        var client = requestClient(paula, clientId);
        assertThat(client).hasStatus(HttpStatus.OK);
        assertThat(client).bodyJson().extractingPath("$.name").isEqualTo(SERGIO_NAME);
    }

    /** Both deletes wait for another transaction's lock on the client, so they reach the delete together. */
    @Test
    void overlappingDeletesOfTheSameClientDeleteItOnce() throws Exception {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID clientId = createClient(paula, SERGIO_NAME);

        var results = requestsDuringConcurrentTransaction(() -> jdbc.queryForList(LOCK_CLIENTS), List.of(
                () -> requestDelete(paula, clientId),
                () -> requestDelete(paula, clientId)));

        assertThat(statusesOf(results)).containsExactlyInAnyOrder(HttpStatus.NO_CONTENT, HttpStatus.NOT_FOUND);
        assertThat(requestClient(paula, clientId)).hasStatus(HttpStatus.NOT_FOUND);
    }

    /**
     * Another transaction deletes the client and commits only while the PUT waits to write the row it already loaded,
     * so the PUT's update finds the row gone.
     */
    @Test
    void updateOfAClientDeletedMeanwhileIsNotFound() throws Exception {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID clientId = createClient(paula, SERGIO_NAME);

        var results = requestsDuringConcurrentTransaction(
                () -> clientService.delete(paula.officeId(), clientId),
                List.of(() -> requestUpdate(paula, clientId, NEW_CLIENT_DATA)));

        assertThat(statusesOf(results)).containsExactly(HttpStatus.NOT_FOUND);
        assertThat(results.getFirst()).bodyJson().extractingPath("$.detail")
                .isEqualTo("Não encontramos o que você procurava.");
        assertThat(requestClient(paula, clientId)).hasStatus(HttpStatus.NOT_FOUND);
    }

    private void assertReportsInvalidClientFields(MvcTestResult result) {
        assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(result).bodyJson().extractingPath("$.errors.name").isEqualTo("Preencha este campo.");
        assertThat(result).bodyJson().extractingPath("$.errors.email")
                .isEqualTo("Digite um e-mail válido, como nome@email.com.");
        assertThat(result).bodyJson().extractingPath("$.errors.phone")
                .isEqualTo("Digite o telefone com DDD, como (31) 99999-9999.");
    }

    /** Stores the list directly, so this test depends only on the clients API. */
    private void storeList(UUID clientId, String name) {
        jdbc.update("""
                insert into shopping_lists (id, client_id, name, share_token, created_at, updated_at)
                values (?, ?, ?, ?, now(), now())
                """, UUID.randomUUID(), clientId, name, UUID.randomUUID().toString());
    }

    /** Stores a known past update time, so any later write by Hibernate is certainly newer, without waiting. */
    private void storeUpdatedAt(UUID clientId, Instant updatedAt) {
        jdbc.update("update clients set updated_at = ? where id = ?",
                OffsetDateTime.ofInstant(updatedAt, ZoneOffset.UTC), clientId);
    }

    private MvcTestResult requestClients(TestSession session) {
        return mvc.get().uri("/api/clients").header(HttpHeaders.AUTHORIZATION, bearer(session)).exchange();
    }

    @Test
    void createClientStoresBirthDateAndCompactCpf() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);

        var result = requestCreate(paula, withPersonalData(BIRTH_DATE, CPF_AS_TYPED));

        assertThat(result).hasStatus(HttpStatus.CREATED);
        assertThat(result).bodyJson().extractingPath("$.birthDate").isEqualTo(BIRTH_DATE);
        assertThat(result).bodyJson().extractingPath("$.cpf").isEqualTo(CPF);
        UUID clientId = UUID.fromString(readJson(result, "$.id"));
        var detail = requestClient(paula, clientId);
        assertThat(detail).bodyJson().extractingPath("$.birthDate").isEqualTo(BIRTH_DATE);
        assertThat(detail).bodyJson().extractingPath("$.cpf").isEqualTo(CPF);
    }

    @Test
    void createClientWithoutBirthDateAndCpfLeavesThemEmpty() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);

        var without = requestCreate(paula, NEW_CLIENT_DATA);
        var blank = requestCreate(paula, withPersonalData(null, "  "));

        assertThat(without).hasStatus(HttpStatus.CREATED);
        assertThat(without).bodyJson().extractingPath("$.birthDate").isNull();
        assertThat(without).bodyJson().extractingPath("$.cpf").isNull();
        assertThat(blank).hasStatus(HttpStatus.CREATED);
        assertThat(blank).bodyJson().extractingPath("$.cpf").isNull();
    }

    @Test
    void updateClientClearsBirthDateAndCpf() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID clientId = UUID.fromString(readJson(requestCreate(paula, withPersonalData(BIRTH_DATE, CPF)), "$.id"));

        var result = requestUpdate(paula, clientId, withPersonalData(null, null));

        assertThat(result).hasStatus(HttpStatus.OK);
        var detail = requestClient(paula, clientId);
        assertThat(detail).bodyJson().extractingPath("$.birthDate").isNull();
        assertThat(detail).bodyJson().extractingPath("$.cpf").isNull();
    }

    @ParameterizedTest
    @ValueSource(strings = {"529.982.247-24", "111.111.111-11", "5299822472", "11.222.333/0001-81"})
    void invalidCpfIsReported(String cpf) {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);

        var result = requestCreate(paula, withPersonalData(null, cpf));

        assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(result).bodyJson().extractingPath("$.errors.cpf").isEqualTo(CPF_MESSAGE);
    }

    @Test
    void birthDateGoesFrom1900ToTodayInSaoPaulo() {
        doReturn(SAO_PAULO_LATE_EVENING).when(testClock).instant();
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);

        assertThat(requestCreate(paula, withPersonalData("2026-11-11", null))).hasStatus(HttpStatus.CREATED);
        assertThat(requestCreate(paula, withPersonalData("1900-01-01", null))).hasStatus(HttpStatus.CREATED);
        for (String birthDate : List.of("2026-11-12", "1899-12-31")) {
            var result = requestCreate(paula, withPersonalData(birthDate, null));
            assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
            assertThat(result).bodyJson().extractingPath("$.errors.birthDate").isEqualTo(BIRTH_DATE_MESSAGE);
        }
    }

    @Test
    void updateRejectsAFutureBirthDateAndKeepsTheStoredOne() {
        doReturn(SAO_PAULO_LATE_EVENING).when(testClock).instant();
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID clientId = UUID.fromString(readJson(requestCreate(paula, withPersonalData(BIRTH_DATE, null)), "$.id"));

        var result = requestUpdate(paula, clientId, withPersonalData("2026-11-12", null));

        assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(result).bodyJson().extractingPath("$.errors.birthDate").isEqualTo(BIRTH_DATE_MESSAGE);
        assertThat(requestClient(paula, clientId)).bodyJson().extractingPath("$.birthDate").isEqualTo(BIRTH_DATE);
    }

    @ParameterizedTest
    @ValueSource(strings = {"2023-02-29", "25/03/1985"})
    void birthDateThatIsNotAnIsoCalendarDateIsRejected(String birthDate) {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);

        var result = requestCreate(paula, withPersonalData(birthDate, null));

        assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(result).bodyJson().extractingPath("$.detail").isEqualTo(INVALID_REQUEST);
    }

    /** NEW_CLIENT_DATA plus the two optional fields; either may be null. */
    private static Map<String, String> withPersonalData(String birthDate, String cpf) {
        Map<String, String> data = new HashMap<>(NEW_CLIENT_DATA);
        data.put("birthDate", birthDate);
        data.put("cpf", cpf);
        return data;
    }

    private MvcTestResult requestCreate(TestSession session, Map<String, String> client) {
        return mvc.post().uri("/api/clients")
                .header(HttpHeaders.AUTHORIZATION, bearer(session))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(client))
                .exchange();
    }

    private MvcTestResult requestClient(TestSession session, UUID clientId) {
        return mvc.get().uri("/api/clients/{id}", clientId)
                .header(HttpHeaders.AUTHORIZATION, bearer(session))
                .exchange();
    }

    private MvcTestResult requestUpdate(TestSession session, UUID clientId, Map<String, String> client) {
        return mvc.put().uri("/api/clients/{id}", clientId)
                .header(HttpHeaders.AUTHORIZATION, bearer(session))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(client))
                .exchange();
    }

    private MvcTestResult requestDelete(TestSession session, UUID clientId) {
        return mvc.delete().uri("/api/clients/{id}", clientId)
                .header(HttpHeaders.AUTHORIZATION, bearer(session))
                .exchange();
    }
}
