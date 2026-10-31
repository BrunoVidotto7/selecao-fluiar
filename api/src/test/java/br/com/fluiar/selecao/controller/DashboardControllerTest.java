package br.com.fluiar.selecao.controller;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.fluiar.selecao.support.ApiIntegrationTest;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MvcTestResult;

class DashboardControllerTest extends ApiIntegrationTest {

    private static final String PAULA_NAME = "Paula Hooper";
    private static final String PAULA_EMAIL = "paula@fluiar.com.br";
    private static final String MARINA_NAME = "Marina Costa";
    private static final String MARINA_EMAIL = "marina@fluiar.com.br";
    private static final String SERGIO_NAME = "Sérgio Hooper";
    private static final String HELENA_NAME = "Helena Prado";
    private static final String CAMILA_NAME = "Camila Rezende";
    private static final String EMPTY_LIST = "Lista vazia";
    private static final String LIST_IN_PROGRESS = "Lista em andamento";
    private static final String COMPLETED_LIST = "Lista concluída";
    private static final String LIST_NAME = "Lista de compras da casa";
    private static final String MARINA_LIST_NAME = "Casa de praia";
    private static final String KITCHEN = "Cozinha";
    private static final String MIXER = "Batedeira";
    private static final String CAKE_PAN = "Forma para bolo";
    private static final String CLIENT_NAME_PREFIX = "Cliente ";
    private static final String LIST_NAME_PREFIX = "Lista ";
    private static final int CLIENTS_OVER_RECENT_LIMIT = 6;
    private static final Instant OLDEST_UPDATE = Instant.parse("2020-01-01T00:00:00Z");
    private static final Instant MIDDLE_UPDATE = Instant.parse("2020-01-02T00:00:00Z");
    private static final Instant NEWEST_UPDATE = Instant.parse("2020-01-03T00:00:00Z");
    private static final String MOVE_CLIENT_CREATION_TO_40_DAYS_AGO =
            "update clients set created_at = now() - interval '40 days' where id = ?";
    private static final Duration TIME_BEFORE_MONTH_START = Duration.ofHours(1);

    @Autowired
    private Clock clock;

    /**
     * The update times put the lists in an order that differs from their creation order and from their names, so only
     * the order by last update gives the expected recent lists.
     */
    @Test
    void dashboardSummarizesOffice() {
        var paula = signUp(PAULA_NAME, PAULA_EMAIL);
        UUID sergioId = createClient(paula, SERGIO_NAME);
        UUID helenaId = createClient(paula, HELENA_NAME);
        jdbc.update(MOVE_CLIENT_CREATION_TO_40_DAYS_AGO, helenaId);

        UUID emptyListId = createList(paula, sergioId, EMPTY_LIST);
        UUID listInProgressId = createList(paula, sergioId, LIST_IN_PROGRESS);
        UUID inProgressKitchenId = createRoom(paula, listInProgressId, KITCHEN);
        markBought(paula, createProduct(paula, listInProgressId, inProgressKitchenId, MIXER));
        createProduct(paula, listInProgressId, inProgressKitchenId, CAKE_PAN);
        UUID completedListId = createList(paula, helenaId, COMPLETED_LIST);
        markBought(paula, createProduct(paula, completedListId, createRoom(paula, completedListId, KITCHEN), MIXER));

        storeListUpdatedAt(completedListId, OLDEST_UPDATE);
        storeListUpdatedAt(emptyListId, MIDDLE_UPDATE);
        storeListUpdatedAt(listInProgressId, NEWEST_UPDATE);

        var result = requestDashboard(paula);

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(result).bodyJson().extractingPath("$.clientCount").isEqualTo(2);
        assertThat(result).bodyJson().extractingPath("$.clientsCreatedThisMonth").isEqualTo(1);
        assertThat(result).bodyJson().extractingPath("$.listCount").isEqualTo(3);
        assertThat(result).bodyJson().extractingPath("$.completedListCount").isEqualTo(1);
        assertThat(result).bodyJson().extractingPath("$.listsWithPendingProductsCount").isEqualTo(1);
        assertThat(result).bodyJson().extractingPath("$.totalProductCount").isEqualTo(3);
        assertThat(result).bodyJson().extractingPath("$.pendingProductCount").isEqualTo(1);
        assertThat(result).bodyJson().extractingPath("$.recentLists[*].name").asArray()
                .containsExactly(LIST_IN_PROGRESS, EMPTY_LIST, COMPLETED_LIST);
    }

    /** The first client and the first list are updated earlier than the others, so they are the ones left out. */
    @Test
    void recentItemsAreLimitedToFive() {
        var paula = signUp(PAULA_NAME, PAULA_EMAIL);
        List<UUID> clientIds = new ArrayList<>();
        List<UUID> listIds = new ArrayList<>();
        for (int number = 1; number <= CLIENTS_OVER_RECENT_LIMIT; number++) {
            UUID clientId = createClient(paula, CLIENT_NAME_PREFIX + number);
            clientIds.add(clientId);
            listIds.add(createList(paula, clientId, LIST_NAME_PREFIX + number));
        }
        storeClientUpdatedAt(clientIds.getFirst(), OLDEST_UPDATE);
        storeListUpdatedAt(listIds.getFirst(), OLDEST_UPDATE);

        var result = requestDashboard(paula);

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(result).bodyJson().extractingPath("$.clientCount").isEqualTo(6);
        assertThat(result).bodyJson().extractingPath("$.recentClients[*].name").asArray()
                .hasSize(5).doesNotContain(CLIENT_NAME_PREFIX + 1);
        assertThat(result).bodyJson().extractingPath("$.listCount").isEqualTo(6);
        assertThat(result).bodyJson().extractingPath("$.recentLists[*].name").asArray()
                .hasSize(5).doesNotContain(LIST_NAME_PREFIX + 1);
    }

    /**
     * One hour before the month starts in São Paulo is still the previous month there, but already this month in UTC
     * (3 hours ahead), so only a count by the São Paulo month leaves that client out.
     */
    @Test
    void clientsCreatedThisMonthUseTheSaoPauloMonth() {
        var paula = signUp(PAULA_NAME, PAULA_EMAIL);
        Instant monthStart = YearMonth.now(clock).atDay(1).atStartOfDay(clock.getZone()).toInstant();
        storeClientCreatedAt(createClient(paula, SERGIO_NAME), monthStart);
        storeClientCreatedAt(createClient(paula, HELENA_NAME), monthStart.minus(TIME_BEFORE_MONTH_START));

        var result = requestDashboard(paula);

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(result).bodyJson().extractingPath("$.clientCount").isEqualTo(2);
        assertThat(result).bodyJson().extractingPath("$.clientsCreatedThisMonth").isEqualTo(1);
    }

    @Test
    void emptyOfficeReturnsZeros() {
        var paula = signUp(PAULA_NAME, PAULA_EMAIL);

        var result = requestDashboard(paula);

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(result).bodyJson().extractingPath("$.clientCount").isEqualTo(0);
        assertThat(result).bodyJson().extractingPath("$.clientsCreatedThisMonth").isEqualTo(0);
        assertThat(result).bodyJson().extractingPath("$.listCount").isEqualTo(0);
        assertThat(result).bodyJson().extractingPath("$.completedListCount").isEqualTo(0);
        assertThat(result).bodyJson().extractingPath("$.listsWithPendingProductsCount").isEqualTo(0);
        assertThat(result).bodyJson().extractingPath("$.totalProductCount").isEqualTo(0);
        assertThat(result).bodyJson().extractingPath("$.pendingProductCount").isEqualTo(0);
        assertThat(result).bodyJson().extractingPath("$.recentClients").asArray().isEmpty();
        assertThat(result).bodyJson().extractingPath("$.recentLists").asArray().isEmpty();
    }

    @Test
    void dashboardCountsOnlyOwnOfficeData() {
        var paula = signUp(PAULA_NAME, PAULA_EMAIL);
        var marina = signUp(MARINA_NAME, MARINA_EMAIL);
        UUID paulaListId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        createProduct(paula, paulaListId, createRoom(paula, paulaListId, KITCHEN), MIXER);
        UUID marinaListId = createList(marina, createClient(marina, CAMILA_NAME), MARINA_LIST_NAME);
        UUID marinaKitchenId = createRoom(marina, marinaListId, KITCHEN);
        markBought(marina, createProduct(marina, marinaListId, marinaKitchenId, MIXER));
        createProduct(marina, marinaListId, marinaKitchenId, CAKE_PAN);

        var result = requestDashboard(paula);

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(result).bodyJson().extractingPath("$.clientCount").isEqualTo(1);
        assertThat(result).bodyJson().extractingPath("$.clientsCreatedThisMonth").isEqualTo(1);
        assertThat(result).bodyJson().extractingPath("$.listCount").isEqualTo(1);
        assertThat(result).bodyJson().extractingPath("$.completedListCount").isEqualTo(0);
        assertThat(result).bodyJson().extractingPath("$.listsWithPendingProductsCount").isEqualTo(1);
        assertThat(result).bodyJson().extractingPath("$.totalProductCount").isEqualTo(1);
        assertThat(result).bodyJson().extractingPath("$.pendingProductCount").isEqualTo(1);
        assertThat(result).bodyJson().extractingPath("$.recentClients[*].name").asArray().containsExactly(SERGIO_NAME);
        assertThat(result).bodyJson().extractingPath("$.recentLists[*].name").asArray().containsExactly(LIST_NAME);
    }

    private void markBought(TestSession session, UUID productId) {
        var result = mvc.patch().uri("/api/products/{productId}", productId)
                .header(HttpHeaders.AUTHORIZATION, bearer(session))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("bought", true)))
                .exchange();
        assertThat(result).hasStatus(HttpStatus.OK);
    }

    /** Product writes also update their list, so the tests set the final update times only after them. */
    private void storeListUpdatedAt(UUID listId, Instant updatedAt) {
        jdbc.update("update shopping_lists set updated_at = ? where id = ?",
                OffsetDateTime.ofInstant(updatedAt, ZoneOffset.UTC), listId);
    }

    private void storeClientCreatedAt(UUID clientId, Instant createdAt) {
        jdbc.update("update clients set created_at = ? where id = ?",
                OffsetDateTime.ofInstant(createdAt, ZoneOffset.UTC), clientId);
    }

    private void storeClientUpdatedAt(UUID clientId, Instant updatedAt) {
        jdbc.update("update clients set updated_at = ? where id = ?",
                OffsetDateTime.ofInstant(updatedAt, ZoneOffset.UTC), clientId);
    }

    private MvcTestResult requestDashboard(TestSession session) {
        return mvc.get().uri("/api/dashboard").header(HttpHeaders.AUTHORIZATION, bearer(session)).exchange();
    }
}
