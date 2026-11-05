package br.com.fluiar.selecao.controller;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.fluiar.selecao.model.Product;
import br.com.fluiar.selecao.repository.ProductRepository;
import br.com.fluiar.selecao.repository.RoomRepository;
import br.com.fluiar.selecao.service.RoomService;
import br.com.fluiar.selecao.support.ApiIntegrationTest;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MvcTestResult;

class RoomControllerTest extends ApiIntegrationTest {

    private static final String PAULA_NAME = "Paula Hooper";
    private static final String PAULA_EMAIL = "paula@fluiar.com.br";
    private static final String MARINA_NAME = "Marina Costa";
    private static final String MARINA_EMAIL = "marina@fluiar.com.br";
    private static final String SERGIO_NAME = "Sérgio Hooper";
    private static final String LIST_NAME = "Lista de compras da casa";
    private static final String OTHER_LIST_NAME = "Lista do apartamento";
    private static final String KITCHEN = "Cozinha";
    private static final String LAUNDRY = "Lavanderia";
    private static final String BEDROOM = "Quarto";
    private static final String GOURMET_KITCHEN = "Cozinha gourmet";
    private static final String MIXER = "Batedeira";
    private static final String NAME_OVER_LIMIT = "a".repeat(61);
    private static final String NAME_IN_USE = "Já existe um ambiente com esse nome nesta lista.";
    private static final String ORDER_INCOMPLETE = "Envie todos os ambientes da lista, sem repetir.";
    private static final String REQUIRED = "Preencha este campo.";
    private static final String TOO_LONG = "Use no máximo 60 caracteres.";
    private static final Instant OLDER_UPDATE = Instant.parse("2020-01-01T00:00:00Z");
    private static final String STORE_LIST_UPDATED_AT = "update shopping_lists set updated_at = ? where id = ?";
    private static final String LOCK_LISTS = "select id from shopping_lists for update";
    private static final String LOCK_ROOM = "select id from rooms where id = ? for update";
    private static final String SWAP_TWO_ROOM_POSITIONS = "update rooms set position = 1 - position where list_id = ?";

    @Autowired
    private RoomService roomService;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private ProductRepository productRepository;

    @Test
    void createRoomAppendsAtTheEnd() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);

        var kitchen = requestCreateRoom(paula, listId, KITCHEN);
        var laundry = requestCreateRoom(paula, listId, LAUNDRY);

        assertThat(kitchen).hasStatus(HttpStatus.CREATED);
        assertThat(kitchen).bodyJson().extractingPath("$.name").isEqualTo(KITCHEN);
        assertThat(kitchen).bodyJson().extractingPath("$.position").isEqualTo(0);
        assertThat(laundry).hasStatus(HttpStatus.CREATED);
        assertThat(laundry).bodyJson().extractingPath("$.position").isEqualTo(1);
        var list = requestList(paula, listId);
        assertThat(list).hasStatus(HttpStatus.OK);
        assertThat(list).bodyJson().extractingPath("$.rooms[*].name").asArray().containsExactly(KITCHEN, LAUNDRY);
    }

    @Test
    void createRoomRejectsDuplicateNameIgnoringCase() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        createRoom(paula, listId, KITCHEN);

        var result = requestCreateRoom(paula, listId, " cozinha ");

        assertThat(result).hasStatus(HttpStatus.CONFLICT);
        assertThat(result).bodyJson().extractingPath("$.errors.name").isEqualTo(NAME_IN_USE);
    }

    @Test
    void sameRoomNameIsAllowedInAnotherList() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID clientId = createClient(paula, SERGIO_NAME);
        UUID listId = createList(paula, clientId, LIST_NAME);
        UUID otherListId = createList(paula, clientId, OTHER_LIST_NAME);

        assertThat(requestCreateRoom(paula, listId, KITCHEN)).hasStatus(HttpStatus.CREATED);
        assertThat(requestCreateRoom(paula, otherListId, KITCHEN)).hasStatus(HttpStatus.CREATED);
    }

    @Test
    void createRoomReportsABlankName() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);

        var result = requestCreateRoom(paula, listId, "  ");

        assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(result).bodyJson().extractingPath("$.errors.name").isEqualTo(REQUIRED);
    }

    @Test
    void renameRoom() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        UUID kitchenId = createRoom(paula, listId, KITCHEN);

        var result = requestRename(paula, kitchenId, GOURMET_KITCHEN);

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(result).bodyJson().extractingPath("$.name").isEqualTo(GOURMET_KITCHEN);
        var list = requestList(paula, listId);
        assertThat(list).hasStatus(HttpStatus.OK);
        assertThat(list).bodyJson().extractingPath("$.rooms[*].name").asArray().containsExactly(GOURMET_KITCHEN);
    }

    @Test
    void renameRoomToNameOfAnotherRoomFails() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        createRoom(paula, listId, KITCHEN);
        UUID laundryId = createRoom(paula, listId, LAUNDRY);

        var result = requestRename(paula, laundryId, "COZINHA");

        assertThat(result).hasStatus(HttpStatus.CONFLICT);
        assertThat(result).bodyJson().extractingPath("$.errors.name").isEqualTo(NAME_IN_USE);
    }

    @Test
    void renameRoomKeepingItsOwnNameSucceeds() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        UUID kitchenId = createRoom(paula, listId, KITCHEN);

        var result = requestRename(paula, kitchenId, "cozinha");

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(result).bodyJson().extractingPath("$.name").isEqualTo("cozinha");
    }

    @Test
    void renameRoomReportsANameOverTheLimit() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        UUID kitchenId = createRoom(paula, listId, KITCHEN);

        var result = requestRename(paula, kitchenId, NAME_OVER_LIMIT);

        assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(result).bodyJson().extractingPath("$.errors.name").isEqualTo(TOO_LONG);
    }

    @Test
    void deleteRoomRemovesItsProducts() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        UUID kitchenId = createRoom(paula, listId, KITCHEN);
        UUID mixerId = productRepository.save(new Product(
                roomRepository.findById(kitchenId).orElseThrow(), defaultCategory(paula.officeId()), MIXER, 1, null, null, false, List.of())).getId();

        var result = requestDeleteRoom(paula, kitchenId);

        assertThat(result).hasStatus(HttpStatus.NO_CONTENT);
        var list = requestList(paula, listId);
        assertThat(list).hasStatus(HttpStatus.OK);
        assertThat(list).bodyJson().extractingPath("$.rooms").asArray().isEmpty();
        assertThat(list).bodyJson().extractingPath("$.stats.totalProducts").isEqualTo(0);
        assertThat(productRepository.existsById(mixerId)).isFalse();
    }

    @Test
    void reorderRooms() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        UUID kitchenId = createRoom(paula, listId, KITCHEN);
        UUID laundryId = createRoom(paula, listId, LAUNDRY);

        var result = requestReorder(paula, listId, List.of(laundryId, kitchenId));

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(result).bodyJson().extractingPath("$[*].id").asArray()
                .containsExactly(laundryId.toString(), kitchenId.toString());
        assertThat(result).bodyJson().extractingPath("$[*].position").asArray().containsExactly(0, 1);
        var list = requestList(paula, listId);
        assertThat(list).hasStatus(HttpStatus.OK);
        assertThat(list).bodyJson().extractingPath("$.rooms[*].name").asArray().containsExactly(LAUNDRY, KITCHEN);
        assertThat(list).bodyJson().extractingPath("$.rooms[*].position").asArray().containsExactly(0, 1);
    }

    @Test
    void reorderRejectsIncompleteOrRepeatedIds() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        UUID kitchenId = createRoom(paula, listId, KITCHEN);
        createRoom(paula, listId, LAUNDRY);

        var incomplete = requestReorder(paula, listId, List.of(kitchenId));
        var repeated = requestReorder(paula, listId, List.of(kitchenId, kitchenId));

        assertThat(incomplete).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(incomplete).bodyJson().extractingPath("$.errors.roomIds").isEqualTo(ORDER_INCOMPLETE);
        assertThat(repeated).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(repeated).bodyJson().extractingPath("$.errors.roomIds").isEqualTo(ORDER_INCOMPLETE);
    }

    /** The order has the right size and no repeats, but one id belongs to a room of another list. */
    @Test
    void reorderRejectsRoomOfAnotherList() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID clientId = createClient(paula, SERGIO_NAME);
        UUID listId = createList(paula, clientId, LIST_NAME);
        UUID kitchenId = createRoom(paula, listId, KITCHEN);
        createRoom(paula, listId, LAUNDRY);
        UUID otherListBedroomId = createRoom(paula, createList(paula, clientId, OTHER_LIST_NAME), BEDROOM);

        var result = requestReorder(paula, listId, List.of(otherListBedroomId, kitchenId));

        assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(result).bodyJson().extractingPath("$.errors.roomIds").isEqualTo(ORDER_INCOMPLETE);
    }

    @Test
    void reorderRequiresRoomIds() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        createRoom(paula, listId, KITCHEN);

        var result = requestReorder(paula, listId, List.of());

        assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(result).bodyJson().extractingPath("$.errors.roomIds").isEqualTo(REQUIRED);
    }

    @Test
    void roomChangesRefreshListUpdatedAt() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        UUID kitchenId = createRoom(paula, listId, KITCHEN);
        UUID laundryId = createRoom(paula, listId, LAUNDRY);

        assertRefreshesListUpdatedAt(paula, listId, () -> requestReorder(paula, listId, List.of(laundryId, kitchenId)));
        assertRefreshesListUpdatedAt(paula, listId, () -> requestRename(paula, kitchenId, GOURMET_KITCHEN));
        assertRefreshesListUpdatedAt(paula, listId, () -> requestDeleteRoom(paula, kitchenId));
        assertRefreshesListUpdatedAt(paula, listId, () -> requestCreateRoom(paula, listId, BEDROOM));
    }

    @Test
    void roomOfAnotherOfficeIsNotFound() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        var marina = createAdmin(MARINA_NAME, MARINA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        UUID kitchenId = createRoom(paula, listId, KITCHEN);

        assertThat(requestCreateRoom(marina, listId, LAUNDRY)).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(requestRename(marina, kitchenId, GOURMET_KITCHEN)).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(requestDeleteRoom(marina, kitchenId)).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(requestReorder(marina, listId, List.of(kitchenId))).hasStatus(HttpStatus.NOT_FOUND);

        var list = requestList(paula, listId);
        assertThat(list).hasStatus(HttpStatus.OK);
        assertThat(list).bodyJson().extractingPath("$.rooms[*].name").asArray().containsExactly(KITCHEN);
    }

    /**
     * Both deletes find the room and then wait for another transaction's lock on the list, so the one that runs second
     * finds the room already gone.
     */
    @Test
    void overlappingDeletesOfTheSameRoomDeleteItOnce() throws Exception {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        UUID kitchenId = createRoom(paula, listId, KITCHEN);

        var results = requestsDuringConcurrentTransaction(() -> jdbc.queryForList(LOCK_LISTS), List.of(
                () -> requestDeleteRoom(paula, kitchenId),
                () -> requestDeleteRoom(paula, kitchenId)));

        assertThat(statusesOf(results)).containsExactlyInAnyOrder(HttpStatus.NO_CONTENT, HttpStatus.NOT_FOUND);
        var list = requestList(paula, listId);
        assertThat(list).hasStatus(HttpStatus.OK);
        assertThat(list).bodyJson().extractingPath("$.rooms").asArray().isEmpty();
    }

    /** Another transaction deletes the room and commits only while the rename waits for it. */
    @Test
    void renameOfARoomDeletedMeanwhileIsNotFound() throws Exception {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        UUID kitchenId = createRoom(paula, listId, KITCHEN);

        var results = requestsDuringConcurrentTransaction(
                () -> roomService.delete(paula.officeId(), kitchenId),
                List.of(() -> requestRename(paula, kitchenId, GOURMET_KITCHEN)));

        assertThat(statusesOf(results)).containsExactly(HttpStatus.NOT_FOUND);
        var list = requestList(paula, listId);
        assertThat(list).hasStatus(HttpStatus.OK);
        assertThat(list).bodyJson().extractingPath("$.rooms").asArray().isEmpty();
    }

    /** Both creations start while another transaction locks the list, so they overlap. */
    @Test
    void overlappingRoomCreationsGetConsecutivePositions() throws Exception {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);

        var results = requestsDuringConcurrentTransaction(() -> jdbc.queryForList(LOCK_LISTS), List.of(
                () -> requestCreateRoom(paula, listId, KITCHEN),
                () -> requestCreateRoom(paula, listId, LAUNDRY)));

        assertThat(statusesOf(results)).containsExactly(HttpStatus.CREATED, HttpStatus.CREATED);
        var list = requestList(paula, listId);
        assertThat(list).hasStatus(HttpStatus.OK);
        assertThat(list).bodyJson().extractingPath("$.rooms[*].position").asArray().containsExactly(0, 1);
    }

    /** Both reorders start while another transaction locks the list, so they overlap. One of them wins entirely. */
    @Test
    void overlappingReordersLeaveEveryRoomInItsOwnPosition() throws Exception {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        UUID kitchenId = createRoom(paula, listId, KITCHEN);
        UUID laundryId = createRoom(paula, listId, LAUNDRY);
        UUID bedroomId = createRoom(paula, listId, BEDROOM);

        var results = requestsDuringConcurrentTransaction(() -> jdbc.queryForList(LOCK_LISTS), List.of(
                () -> requestReorder(paula, listId, List.of(bedroomId, laundryId, kitchenId)),
                () -> requestReorder(paula, listId, List.of(laundryId, kitchenId, bedroomId))));

        assertThat(statusesOf(results)).containsExactly(HttpStatus.OK, HttpStatus.OK);
        var list = requestList(paula, listId);
        assertThat(list).hasStatus(HttpStatus.OK);
        assertThat(list).bodyJson().extractingPath("$.rooms[*].position").asArray().containsExactly(0, 1, 2);
        assertThat(list).bodyJson().extractingPath("$.rooms[*].name").asArray().satisfiesAnyOf(
                names -> assertThat(names).containsExactly(BEDROOM, LAUNDRY, KITCHEN),
                names -> assertThat(names).containsExactly(LAUNDRY, KITCHEN, BEDROOM));
    }

    /**
     * Another transaction locks the list, swaps the two rooms' positions and commits only while the rename waits. The
     * rename must keep the swapped positions instead of writing back the position the kitchen had before.
     */
    @Test
    void renameDuringAReorderKeepsTheNewPositions() throws Exception {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        UUID kitchenId = createRoom(paula, listId, KITCHEN);
        createRoom(paula, listId, LAUNDRY);

        var results = requestsDuringConcurrentTransaction(() -> {
            jdbc.queryForList(LOCK_LISTS);
            jdbc.update(SWAP_TWO_ROOM_POSITIONS, listId);
        }, List.of(() -> requestRename(paula, kitchenId, GOURMET_KITCHEN)));

        assertThat(statusesOf(results)).containsExactly(HttpStatus.OK);
        var list = requestList(paula, listId);
        assertThat(list).hasStatus(HttpStatus.OK);
        assertThat(list).bodyJson().extractingPath("$.rooms[*].name").asArray()
                .containsExactly(LAUNDRY, GOURMET_KITCHEN);
        assertThat(list).bodyJson().extractingPath("$.rooms[*].position").asArray().containsExactly(0, 1);
    }

    /**
     * Another transaction locks the list and the laundry, and commits once the reorder (which moves the laundry) and
     * the delete of the laundry wait. If one of them could take the laundry before the list, each would end up waiting
     * for the other (a deadlock).
     */
    @Test
    void deleteDuringAReorderFinishesWithoutDeadlock() throws Exception {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        UUID kitchenId = createRoom(paula, listId, KITCHEN);
        UUID laundryId = createRoom(paula, listId, LAUNDRY);
        UUID bedroomId = createRoom(paula, listId, BEDROOM);

        var results = requestsDuringConcurrentTransaction(() -> {
            jdbc.queryForList(LOCK_LISTS);
            jdbc.queryForList(LOCK_ROOM, laundryId);
        }, List.of(
                () -> requestReorder(paula, listId, List.of(laundryId, bedroomId, kitchenId)),
                () -> requestDeleteRoom(paula, laundryId)));

        List<HttpStatus> statuses = statusesOf(results);
        assertThat(statuses.get(0)).as("reorder before or after the delete")
                .isIn(HttpStatus.OK, HttpStatus.BAD_REQUEST);
        assertThat(statuses.get(1)).isEqualTo(HttpStatus.NO_CONTENT);
        var list = requestList(paula, listId);
        assertThat(list).hasStatus(HttpStatus.OK);
        assertThat(list).bodyJson().extractingPath("$.rooms[*].name").asArray()
                .containsExactlyInAnyOrder(KITCHEN, BEDROOM);
    }

    /** Stores a known past update time before the change, so any later write by Hibernate is certainly newer. */
    private void assertRefreshesListUpdatedAt(TestSession session, UUID listId, Supplier<MvcTestResult> roomChange) {
        jdbc.update(STORE_LIST_UPDATED_AT, OffsetDateTime.ofInstant(OLDER_UPDATE, ZoneOffset.UTC), listId);

        assertThat(roomChange.get()).hasStatus2xxSuccessful();

        var lists = mvc.get().uri("/api/lists").header(HttpHeaders.AUTHORIZATION, bearer(session)).exchange();
        assertThat(lists).hasStatus(HttpStatus.OK);
        assertThat(Instant.parse(readJson(lists, "$[0].updatedAt"))).isAfter(OLDER_UPDATE);
    }

    private MvcTestResult requestCreateRoom(TestSession session, UUID listId, String name) {
        return mvc.post().uri("/api/lists/{listId}/rooms", listId)
                .header(HttpHeaders.AUTHORIZATION, bearer(session))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("name", name)))
                .exchange();
    }

    private MvcTestResult requestRename(TestSession session, UUID roomId, String name) {
        return mvc.put().uri("/api/rooms/{roomId}", roomId)
                .header(HttpHeaders.AUTHORIZATION, bearer(session))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("name", name)))
                .exchange();
    }

    private MvcTestResult requestDeleteRoom(TestSession session, UUID roomId) {
        return mvc.delete().uri("/api/rooms/{roomId}", roomId)
                .header(HttpHeaders.AUTHORIZATION, bearer(session))
                .exchange();
    }

    private MvcTestResult requestReorder(TestSession session, UUID listId, List<UUID> roomIds) {
        return mvc.put().uri("/api/lists/{listId}/room-order", listId)
                .header(HttpHeaders.AUTHORIZATION, bearer(session))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("roomIds", roomIds)))
                .exchange();
    }

    private MvcTestResult requestList(TestSession session, UUID listId) {
        return mvc.get().uri("/api/lists/{id}", listId).header(HttpHeaders.AUTHORIZATION, bearer(session)).exchange();
    }
}
