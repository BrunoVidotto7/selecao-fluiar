package br.com.fluiar.selecao.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.InstanceOfAssertFactories.BIG_DECIMAL;

import br.com.fluiar.selecao.service.RoomService;
import br.com.fluiar.selecao.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MvcTestResult;

class ProductControllerTest extends ApiIntegrationTest {

    private static final String PAULA_NAME = "Paula Hooper";
    private static final String PAULA_EMAIL = "paula@fluiar.com.br";
    private static final String MARINA_NAME = "Marina Costa";
    private static final String MARINA_EMAIL = "marina@fluiar.com.br";
    private static final String SERGIO_NAME = "Sérgio Hooper";
    private static final String HELENA_NAME = "Helena Prado";
    private static final String LIST_NAME = "Lista de compras da casa";
    private static final String OTHER_LIST_NAME = "Lista do apartamento";
    private static final String KITCHEN = "Cozinha";
    private static final String LAUNDRY = "Lavanderia";
    private static final String BEDROOM = "Quarto";
    private static final String MIXER = "Batedeira";
    private static final String MIXER_PRICE = "459.00";
    private static final String MIXER_NOTES = "Para massas pesadas, escolher a opção 3.";
    private static final String MIXER_LINK = "https://meli.la/1sNwTbN";
    private static final String MIXER_LINK_NOTE = "Massas mais leves";
    private static final String OTHER_MIXER_LINK = "https://meli.la/2az7TXp";
    private static final String CAKE_PAN = "Forma para bolo";
    private static final String CAKE_PAN_PRICE = "39.90";
    private static final String STAND_MIXER = "Batedeira planetária";
    private static final String STORE_LINK_PREFIX = "https://loja.example/produto-";
    private static final int LINK_COUNT_OVER_LIMIT = 11;
    private static final String UNSAFE_LINK = "javascript:alert(1)";
    private static final String ROOM_REQUIRED = "Escolha o ambiente do produto.";
    private static final String ROOM_NOT_IN_LIST = "Escolha um ambiente desta lista.";
    private static final String LINK_URL_INVALID = "Cole o link completo, começando com https://";
    private static final String LINKS_TOO_MANY = "Adicione no máximo 10 links.";
    private static final String REQUIRED = "Preencha este campo.";
    private static final String QUANTITY_TOO_LOW = "Use um valor a partir de 1.";
    private static final String QUANTITY_TOO_HIGH = "Use um valor até 999.";
    private static final String PRICE_TOO_LOW = "Use um valor a partir de 0.00.";
    private static final String INVALID_REQUEST = "Revise os dados enviados.";
    private static final Instant OLDER_UPDATE = Instant.parse("2020-01-01T00:00:00Z");
    private static final String STORE_LIST_UPDATED_AT = "update shopping_lists set updated_at = ? where id = ?";
    private static final String LOCK_LISTS = "select id from shopping_lists for update";

    @Autowired
    private RoomService roomService;

    @Test
    void createProductWithPriceAndLinks() {
        var paula = signUp(PAULA_NAME, PAULA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        UUID kitchenId = createRoom(paula, listId, KITCHEN);

        var result = requestCreate(paula, listId, mixer(kitchenId));

        assertThat(result).hasStatus(HttpStatus.CREATED);
        assertThat(result).bodyJson().extractingPath("$.id").asString().isNotBlank();
        assertThat(result).bodyJson().extractingPath("$.roomId").isEqualTo(kitchenId.toString());
        assertThat(result).bodyJson().extractingPath("$.name").isEqualTo(MIXER);
        assertThat(result).bodyJson().extractingPath("$.quantity").isEqualTo(1);
        assertThat(result).bodyJson().extractingPath("$.unitPrice").convertTo(BIG_DECIMAL)
                .isEqualByComparingTo(MIXER_PRICE);
        assertThat(result).bodyJson().extractingPath("$.notes").isEqualTo(MIXER_NOTES);
        assertThat(result).bodyJson().extractingPath("$.bought").isEqualTo(false);
        assertThat(result).bodyJson().extractingPath("$.imageUrl").isNull();
        assertThat(result).bodyJson().extractingPath("$.links[*].url").asArray()
                .containsExactly(MIXER_LINK, OTHER_MIXER_LINK);
        assertThat(result).bodyJson().extractingPath("$.links[0].note").isEqualTo(MIXER_LINK_NOTE);
        assertThat(result).bodyJson().extractingPath("$.links[1].note").isNull();

        var stored = requestProduct(paula, UUID.fromString(readJson(result, "$.id")));
        assertThat(stored).hasStatus(HttpStatus.OK);
        assertThat(stored).bodyJson().extractingPath("$.name").isEqualTo(MIXER);
        assertThat(stored).bodyJson().extractingPath("$.links[*].url").asArray()
                .containsExactly(MIXER_LINK, OTHER_MIXER_LINK);
    }

    @Test
    void createProductWithoutPriceKeepsNull() {
        var paula = signUp(PAULA_NAME, PAULA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        UUID kitchenId = createRoom(paula, listId, KITCHEN);

        var result = requestCreate(paula, listId, Map.of("roomId", kitchenId, "name", MIXER, "quantity", 1));

        assertThat(result).hasStatus(HttpStatus.CREATED);
        assertThat(result).bodyJson().extractingPath("$.unitPrice").isNull();
        var list = requestList(paula, listId);
        assertThat(list).hasStatus(HttpStatus.OK);
        assertThat(list).bodyJson().extractingPath("$.stats.totalProducts").isEqualTo(1);
        assertThat(list).bodyJson().extractingPath("$.stats.estimatedTotal").convertTo(BIG_DECIMAL)
                .isEqualByComparingTo("0");
    }

    @Test
    void createProductRequiresRoomOfTheSameList() {
        var paula = signUp(PAULA_NAME, PAULA_EMAIL);
        UUID clientId = createClient(paula, SERGIO_NAME);
        UUID listId = createList(paula, clientId, LIST_NAME);
        createRoom(paula, listId, KITCHEN);
        UUID otherListRoomId = createRoom(paula, createList(paula, clientId, OTHER_LIST_NAME), KITCHEN);

        var withoutRoom = requestCreate(paula, listId, Map.of("name", MIXER, "quantity", 1));
        var withRoomOfAnotherList = requestCreate(paula, listId, mixer(otherListRoomId));

        assertThat(withoutRoom).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(withoutRoom).bodyJson().extractingPath("$.errors.roomId").isEqualTo(ROOM_REQUIRED);
        assertThat(withRoomOfAnotherList).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(withRoomOfAnotherList).bodyJson().extractingPath("$.errors.roomId").isEqualTo(ROOM_NOT_IN_LIST);
    }

    @Test
    void createProductRequiresQuantity() {
        var paula = signUp(PAULA_NAME, PAULA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        UUID kitchenId = createRoom(paula, listId, KITCHEN);

        var result = requestCreate(paula, listId, Map.of("roomId", kitchenId, "name", MIXER));

        assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(result).bodyJson().extractingPath("$.errors.quantity").isEqualTo(REQUIRED);
    }

    @Test
    void createProductValidatesInput() {
        var paula = signUp(PAULA_NAME, PAULA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        UUID kitchenId = createRoom(paula, listId, KITCHEN);

        var result = requestCreate(paula, listId, Map.of("roomId", kitchenId, "name", MIXER, "quantity", 0,
                "unitPrice", -1, "links", List.of(Map.of("url", UNSAFE_LINK))));

        assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(result).bodyJson().extractingPath("$.errors.quantity").isEqualTo(QUANTITY_TOO_LOW);
        assertThat(result).bodyJson().extractingPath("$.errors.unitPrice").isEqualTo(PRICE_TOO_LOW);
        assertThat(result).bodyJson().extractingPath("$.errors['links[0].url']").isEqualTo(LINK_URL_INVALID);
    }

    @Test
    void createProductReportsAnEmptyLinkEntry() {
        var paula = signUp(PAULA_NAME, PAULA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        UUID kitchenId = createRoom(paula, listId, KITCHEN);

        var result = requestCreate(paula, listId, Map.of("roomId", kitchenId, "name", MIXER, "quantity", 1,
                "links", Collections.singletonList(null)));

        assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(result).bodyJson().extractingPath("$.errors['links[0]']").isEqualTo(REQUIRED);
    }

    @Test
    void createProductRejectsMoreThanTenLinks() {
        var paula = signUp(PAULA_NAME, PAULA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        UUID kitchenId = createRoom(paula, listId, KITCHEN);
        List<Map<String, String>> elevenLinks = IntStream.rangeClosed(1, LINK_COUNT_OVER_LIMIT)
                .mapToObj(number -> Map.of("url", STORE_LINK_PREFIX + number))
                .toList();

        var result = requestCreate(paula, listId,
                Map.of("roomId", kitchenId, "name", MIXER, "quantity", 1, "links", elevenLinks));

        assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(result).bodyJson().extractingPath("$.errors.links").isEqualTo(LINKS_TOO_MANY);
    }

    @Test
    void updateProductReplacesLinksAndMovesRoomInsideList() {
        var paula = signUp(PAULA_NAME, PAULA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        UUID kitchenId = createRoom(paula, listId, KITCHEN);
        UUID laundryId = createRoom(paula, listId, LAUNDRY);
        UUID mixerId = createMixer(paula, listId, kitchenId);

        var result = requestUpdate(paula, mixerId, Map.of("roomId", laundryId, "name", STAND_MIXER, "quantity", 2,
                "links", List.of(Map.of("url", OTHER_MIXER_LINK))));

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(result).bodyJson().extractingPath("$.roomId").isEqualTo(laundryId.toString());
        assertThat(result).bodyJson().extractingPath("$.name").isEqualTo(STAND_MIXER);
        assertThat(result).bodyJson().extractingPath("$.quantity").isEqualTo(2);
        assertThat(result).bodyJson().extractingPath("$.unitPrice").isNull();
        assertThat(result).bodyJson().extractingPath("$.links[*].url").asArray().containsExactly(OTHER_MIXER_LINK);

        var stored = requestProduct(paula, mixerId);
        assertThat(stored).hasStatus(HttpStatus.OK);
        assertThat(stored).bodyJson().extractingPath("$.roomId").isEqualTo(laundryId.toString());
        assertThat(stored).bodyJson().extractingPath("$.links[*].url").asArray().containsExactly(OTHER_MIXER_LINK);
    }

    @Test
    void updateProductRejectsRoomOfAnotherList() {
        var paula = signUp(PAULA_NAME, PAULA_EMAIL);
        UUID clientId = createClient(paula, SERGIO_NAME);
        UUID listId = createList(paula, clientId, LIST_NAME);
        UUID kitchenId = createRoom(paula, listId, KITCHEN);
        UUID otherListRoomId = createRoom(paula, createList(paula, clientId, OTHER_LIST_NAME), KITCHEN);
        UUID mixerId = createProduct(paula, listId, kitchenId, MIXER);

        var result = requestUpdate(paula, mixerId, mixer(otherListRoomId));

        assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(result).bodyJson().extractingPath("$.errors.roomId").isEqualTo(ROOM_NOT_IN_LIST);
        var stored = requestProduct(paula, mixerId);
        assertThat(stored).hasStatus(HttpStatus.OK);
        assertThat(stored).bodyJson().extractingPath("$.roomId").isEqualTo(kitchenId.toString());
    }

    @Test
    void updateProductReportsABlankName() {
        var paula = signUp(PAULA_NAME, PAULA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        UUID kitchenId = createRoom(paula, listId, KITCHEN);
        UUID mixerId = createProduct(paula, listId, kitchenId, MIXER);

        var result = requestUpdate(paula, mixerId, Map.of("roomId", kitchenId, "name", "  ", "quantity", 1));

        assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(result).bodyJson().extractingPath("$.errors.name").isEqualTo(REQUIRED);
    }

    @Test
    void patchChangesOnlyTheGivenField() {
        var paula = signUp(PAULA_NAME, PAULA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        UUID mixerId = createProduct(paula, listId, createRoom(paula, listId, KITCHEN), MIXER);

        var markedBought = requestStatusChange(paula, mixerId, Map.of("bought", true));
        var quantityChanged = requestStatusChange(paula, mixerId, Map.of("quantity", 3));

        assertThat(markedBought).hasStatus(HttpStatus.OK);
        assertThat(markedBought).bodyJson().extractingPath("$.bought").isEqualTo(true);
        assertThat(markedBought).bodyJson().extractingPath("$.quantity").isEqualTo(1);
        assertThat(quantityChanged).hasStatus(HttpStatus.OK);
        assertThat(quantityChanged).bodyJson().extractingPath("$.bought").isEqualTo(true);
        assertThat(quantityChanged).bodyJson().extractingPath("$.quantity").isEqualTo(3);
    }

    @Test
    void patchReportsAQuantityOverTheLimit() {
        var paula = signUp(PAULA_NAME, PAULA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        UUID mixerId = createProduct(paula, listId, createRoom(paula, listId, KITCHEN), MIXER);

        var result = requestStatusChange(paula, mixerId, Map.of("quantity", 1000));

        assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(result).bodyJson().extractingPath("$.errors.quantity").isEqualTo(QUANTITY_TOO_HIGH);
    }

    /** A fractional quantity is refused instead of being cut down to a whole number. */
    @Test
    void fractionalQuantityIsRejectedWithoutChanges() {
        var paula = signUp(PAULA_NAME, PAULA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        UUID kitchenId = createRoom(paula, listId, KITCHEN);
        UUID mixerId = createProduct(paula, listId, kitchenId, MIXER);

        var created = requestCreate(paula, listId, Map.of("roomId", kitchenId, "name", CAKE_PAN, "quantity", 1.9));
        var updated = requestUpdate(paula, mixerId,
                Map.of("roomId", kitchenId, "name", STAND_MIXER, "quantity", 2.9));
        var patched = requestStatusChange(paula, mixerId, Map.of("quantity", 999.9));

        assertThat(created).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(created).bodyJson().extractingPath("$.status").isEqualTo(400);
        assertThat(created).bodyJson().extractingPath("$.detail").isEqualTo(INVALID_REQUEST);
        assertThat(updated).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(updated).bodyJson().extractingPath("$.detail").isEqualTo(INVALID_REQUEST);
        assertThat(patched).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(patched).bodyJson().extractingPath("$.detail").isEqualTo(INVALID_REQUEST);
        var stored = requestProduct(paula, mixerId);
        assertThat(stored).hasStatus(HttpStatus.OK);
        assertThat(stored).bodyJson().extractingPath("$.name").isEqualTo(MIXER);
        assertThat(stored).bodyJson().extractingPath("$.quantity").isEqualTo(1);
        var list = requestList(paula, listId);
        assertThat(list).hasStatus(HttpStatus.OK);
        assertThat(list).bodyJson().extractingPath("$.stats.totalProducts").isEqualTo(1);
    }

    @Test
    void productChangesUpdateListStats() {
        var paula = signUp(PAULA_NAME, PAULA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        UUID kitchenId = createRoom(paula, listId, KITCHEN);
        UUID mixerId = createMixer(paula, listId, kitchenId);
        assertThat(requestCreate(paula, listId, Map.of("roomId", kitchenId, "name", CAKE_PAN, "quantity", 2,
                "unitPrice", new BigDecimal(CAKE_PAN_PRICE)))).hasStatus(HttpStatus.CREATED);
        var before = requestList(paula, listId);
        assertThat(before).hasStatus(HttpStatus.OK);
        assertThat(before).bodyJson().extractingPath("$.stats.boughtProducts").isEqualTo(0);
        assertThat(before).bodyJson().extractingPath("$.stats.remainingTotal").convertTo(BIG_DECIMAL)
                .isEqualByComparingTo("538.80");

        assertThat(requestStatusChange(paula, mixerId, Map.of("bought", true))).hasStatus(HttpStatus.OK);

        var after = requestList(paula, listId);
        assertThat(after).hasStatus(HttpStatus.OK);
        assertThat(after).bodyJson().extractingPath("$.stats.boughtProducts").isEqualTo(1);
        assertThat(after).bodyJson().extractingPath("$.stats.remainingTotal").convertTo(BIG_DECIMAL)
                .isEqualByComparingTo("79.80");
    }

    @Test
    void productChangesRefreshListUpdatedAt() {
        var paula = signUp(PAULA_NAME, PAULA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        UUID kitchenId = createRoom(paula, listId, KITCHEN);
        UUID mixerId = createProduct(paula, listId, kitchenId, MIXER);

        assertRefreshesListUpdatedAt(paula, listId, () -> requestCreate(paula, listId, mixer(kitchenId)));
        assertRefreshesListUpdatedAt(paula, listId, () -> requestUpdate(paula, mixerId, mixer(kitchenId)));
        assertRefreshesListUpdatedAt(paula, listId,
                () -> requestStatusChange(paula, mixerId, Map.of("bought", true)));
        assertRefreshesListUpdatedAt(paula, listId, () -> requestDelete(paula, mixerId));
    }

    @Test
    void deleteProduct() {
        var paula = signUp(PAULA_NAME, PAULA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        UUID mixerId = createProduct(paula, listId, createRoom(paula, listId, KITCHEN), MIXER);

        var result = requestDelete(paula, mixerId);

        assertThat(result).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(requestProduct(paula, mixerId)).hasStatus(HttpStatus.NOT_FOUND);
        var list = requestList(paula, listId);
        assertThat(list).hasStatus(HttpStatus.OK);
        assertThat(list).bodyJson().extractingPath("$.stats.totalProducts").isEqualTo(0);
    }

    @Test
    void productOfAnotherOfficeIsNotFound() {
        var paula = signUp(PAULA_NAME, PAULA_EMAIL);
        var marina = signUp(MARINA_NAME, MARINA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        UUID kitchenId = createRoom(paula, listId, KITCHEN);
        UUID mixerId = createProduct(paula, listId, kitchenId, MIXER);

        assertThat(requestProduct(marina, mixerId)).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(requestUpdate(marina, mixerId, mixer(kitchenId))).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(requestStatusChange(marina, mixerId, Map.of("bought", true))).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(requestDelete(marina, mixerId)).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(requestCreate(marina, listId, mixer(kitchenId))).hasStatus(HttpStatus.NOT_FOUND);

        var stored = requestProduct(paula, mixerId);
        assertThat(stored).hasStatus(HttpStatus.OK);
        assertThat(stored).bodyJson().extractingPath("$.name").isEqualTo(MIXER);
        assertThat(stored).bodyJson().extractingPath("$.bought").isEqualTo(false);
        var list = requestList(paula, listId);
        assertThat(list).hasStatus(HttpStatus.OK);
        assertThat(list).bodyJson().extractingPath("$.stats.totalProducts").isEqualTo(1);
    }

    /** The room id comes in the body, so a room of another office is a field error (400), like one of another list. */
    @Test
    void productCannotUseRoomOfAnotherOffice() {
        var paula = signUp(PAULA_NAME, PAULA_EMAIL);
        var marina = signUp(MARINA_NAME, MARINA_EMAIL);
        UUID paulaListId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        UUID paulaKitchenId = createRoom(paula, paulaListId, KITCHEN);
        UUID marinaListId = createList(marina, createClient(marina, HELENA_NAME), OTHER_LIST_NAME);
        UUID marinaMixerId = createProduct(marina, marinaListId, createRoom(marina, marinaListId, BEDROOM), MIXER);

        var created = requestCreate(marina, marinaListId, mixer(paulaKitchenId));
        var moved = requestUpdate(marina, marinaMixerId, mixer(paulaKitchenId));

        assertThat(created).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(created).bodyJson().extractingPath("$.errors.roomId").isEqualTo(ROOM_NOT_IN_LIST);
        assertThat(moved).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(moved).bodyJson().extractingPath("$.errors.roomId").isEqualTo(ROOM_NOT_IN_LIST);
        var paulaList = requestList(paula, paulaListId);
        assertThat(paulaList).hasStatus(HttpStatus.OK);
        assertThat(paulaList).bodyJson().extractingPath("$.stats.totalProducts").isEqualTo(0);
    }

    /** Another transaction deletes the laundry and commits only while the move of the mixer to it waits. */
    @Test
    void productMovedToARoomDeletedMeanwhileIsRejected() throws Exception {
        var paula = signUp(PAULA_NAME, PAULA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        UUID kitchenId = createRoom(paula, listId, KITCHEN);
        UUID laundryId = createRoom(paula, listId, LAUNDRY);
        UUID mixerId = createProduct(paula, listId, kitchenId, MIXER);

        var results = requestsDuringConcurrentTransaction(
                () -> roomService.delete(paula.officeId(), laundryId),
                List.of(() -> requestUpdate(paula, mixerId, mixer(laundryId))));

        assertThat(statusesOf(results)).containsExactly(HttpStatus.BAD_REQUEST);
        assertThat(results.getFirst()).bodyJson().extractingPath("$.errors.roomId").isEqualTo(ROOM_NOT_IN_LIST);
        var stored = requestProduct(paula, mixerId);
        assertThat(stored).hasStatus(HttpStatus.OK);
        assertThat(stored).bodyJson().extractingPath("$.roomId").isEqualTo(kitchenId.toString());
    }

    /**
     * Both changes start while another transaction locks the list, so they overlap. The one that runs second must
     * build on the first instead of writing back the mixer it read before.
     */
    @Test
    void overlappingStatusChangesKeepBothChanges() throws Exception {
        var paula = signUp(PAULA_NAME, PAULA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        UUID mixerId = createProduct(paula, listId, createRoom(paula, listId, KITCHEN), MIXER);

        var results = requestsDuringConcurrentTransaction(() -> jdbc.queryForList(LOCK_LISTS), List.of(
                () -> requestStatusChange(paula, mixerId, Map.of("bought", true)),
                () -> requestStatusChange(paula, mixerId, Map.of("quantity", 3))));

        assertThat(statusesOf(results)).containsExactly(HttpStatus.OK, HttpStatus.OK);
        var stored = requestProduct(paula, mixerId);
        assertThat(stored).hasStatus(HttpStatus.OK);
        assertThat(stored).bodyJson().extractingPath("$.bought").isEqualTo(true);
        assertThat(stored).bodyJson().extractingPath("$.quantity").isEqualTo(3);
    }

    /** Another transaction deletes the kitchen and commits only while the creation waits for it. */
    @Test
    void createProductInARoomDeletedMeanwhileIsRejected() throws Exception {
        var paula = signUp(PAULA_NAME, PAULA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        UUID kitchenId = createRoom(paula, listId, KITCHEN);

        var results = requestsDuringConcurrentTransaction(
                () -> roomService.delete(paula.officeId(), kitchenId),
                List.of(() -> requestCreate(paula, listId, mixer(kitchenId))));

        assertThat(statusesOf(results)).containsExactly(HttpStatus.BAD_REQUEST);
        assertThat(results.getFirst()).bodyJson().extractingPath("$.errors.roomId").isEqualTo(ROOM_NOT_IN_LIST);
    }

    /**
     * Both deletes find the mixer and then wait for another transaction's lock on the list, so the one that runs
     * second finds the mixer already gone.
     */
    @Test
    void overlappingDeletesOfTheSameProductDeleteItOnce() throws Exception {
        var paula = signUp(PAULA_NAME, PAULA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        UUID mixerId = createProduct(paula, listId, createRoom(paula, listId, KITCHEN), MIXER);

        var results = requestsDuringConcurrentTransaction(() -> jdbc.queryForList(LOCK_LISTS), List.of(
                () -> requestDelete(paula, mixerId),
                () -> requestDelete(paula, mixerId)));

        assertThat(statusesOf(results)).containsExactlyInAnyOrder(HttpStatus.NO_CONTENT, HttpStatus.NOT_FOUND);
        var list = requestList(paula, listId);
        assertThat(list).hasStatus(HttpStatus.OK);
        assertThat(list).bodyJson().extractingPath("$.stats.totalProducts").isEqualTo(0);
    }

    /** The mixer for 459.00, with notes and two links; the second link has an empty note. */
    private Map<String, Object> mixer(UUID roomId) {
        return Map.of("roomId", roomId, "name", MIXER, "quantity", 1, "unitPrice", new BigDecimal(MIXER_PRICE),
                "notes", MIXER_NOTES, "bought", false, "links", List.of(
                        Map.of("url", MIXER_LINK, "note", MIXER_LINK_NOTE),
                        Map.of("url", OTHER_MIXER_LINK, "note", "")));
    }

    private UUID createMixer(TestSession session, UUID listId, UUID roomId) {
        var result = requestCreate(session, listId, mixer(roomId));
        assertThat(result).hasStatus(HttpStatus.CREATED);

        return UUID.fromString(readJson(result, "$.id"));
    }

    /** Stores a known past update time before the change, so any later write by Hibernate is certainly newer. */
    private void assertRefreshesListUpdatedAt(
            TestSession session, UUID listId, Supplier<MvcTestResult> productChange) {
        jdbc.update(STORE_LIST_UPDATED_AT, OffsetDateTime.ofInstant(OLDER_UPDATE, ZoneOffset.UTC), listId);

        assertThat(productChange.get()).hasStatus2xxSuccessful();

        var list = requestList(session, listId);
        assertThat(list).hasStatus(HttpStatus.OK);
        assertThat(Instant.parse(readJson(list, "$.updatedAt"))).isAfter(OLDER_UPDATE);
    }

    private MvcTestResult requestCreate(TestSession session, UUID listId, Map<String, ?> product) {
        return mvc.post().uri("/api/lists/{listId}/products", listId)
                .header(HttpHeaders.AUTHORIZATION, bearer(session))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(product))
                .exchange();
    }

    private MvcTestResult requestProduct(TestSession session, UUID productId) {
        return mvc.get().uri("/api/products/{productId}", productId)
                .header(HttpHeaders.AUTHORIZATION, bearer(session))
                .exchange();
    }

    private MvcTestResult requestUpdate(TestSession session, UUID productId, Map<String, ?> product) {
        return mvc.put().uri("/api/products/{productId}", productId)
                .header(HttpHeaders.AUTHORIZATION, bearer(session))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(product))
                .exchange();
    }

    private MvcTestResult requestStatusChange(TestSession session, UUID productId, Map<String, ?> status) {
        return mvc.patch().uri("/api/products/{productId}", productId)
                .header(HttpHeaders.AUTHORIZATION, bearer(session))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(status))
                .exchange();
    }

    private MvcTestResult requestDelete(TestSession session, UUID productId) {
        return mvc.delete().uri("/api/products/{productId}", productId)
                .header(HttpHeaders.AUTHORIZATION, bearer(session))
                .exchange();
    }

    private MvcTestResult requestList(TestSession session, UUID listId) {
        return mvc.get().uri("/api/lists/{id}", listId).header(HttpHeaders.AUTHORIZATION, bearer(session)).exchange();
    }
}
