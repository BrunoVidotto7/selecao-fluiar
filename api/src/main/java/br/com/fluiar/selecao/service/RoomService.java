package br.com.fluiar.selecao.service;

import br.com.fluiar.selecao.dto.RoomOrderRequest;
import br.com.fluiar.selecao.dto.RoomRequest;
import br.com.fluiar.selecao.dto.RoomResponse;
import br.com.fluiar.selecao.exception.ApiException;
import br.com.fluiar.selecao.exception.ErrorMessages;
import br.com.fluiar.selecao.model.Room;
import br.com.fluiar.selecao.model.ShoppingList;
import br.com.fluiar.selecao.repository.RoomRepository;
import br.com.fluiar.selecao.repository.ShoppingListRepository;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class RoomService {

    private final ListActivityService activity;

    private static final String NAME_FIELD = "name";
    private static final String ROOM_IDS_FIELD = "roomIds";

    private final RoomRepository roomRepository;
    private final ShoppingListRepository listRepository;

    public RoomService(RoomRepository roomRepository, ShoppingListRepository listRepository, ListActivityService activity) {
        this.activity = activity;
        this.roomRepository = roomRepository;
        this.listRepository = listRepository;
    }

    /** The unique index on the room name is the real guarantee; the check before it only gives a friendly message. */
    @Transactional
    public RoomResponse create(UUID officeId, UUID listId, RoomRequest request) {
        ShoppingList list = lockList(officeId, listId);
        if (roomRepository.existsByListAndNameIgnoreCase(list, request.name())) {
            throw nameInUse();
        }

        Room room = roomRepository.save(new Room(list, request.name(), roomRepository.findMaxPosition(list) + 1));
        list.touch();
        activity.record(list.getId());

        return RoomResponse.of(room);
    }

    @Transactional
    public RoomResponse rename(UUID officeId, UUID roomId, RoomRequest request) {
        ShoppingList list = lockListOfRoom(officeId, roomId);
        // Loaded only after the lock: Hibernate writes every column, so a copy read earlier would undo a reorder.
        Room room = loadRoom(officeId, roomId);
        if (roomRepository.existsByListAndNameIgnoreCaseAndIdNot(list, request.name(), roomId)) {
            throw nameInUse();
        }

        room.rename(request.name());
        list.touch();
        activity.record(list.getId());

        return RoomResponse.of(room);
    }

    /** The database deletes the room's products with it. */
    @Transactional
    public void delete(UUID officeId, UUID roomId) {
        ShoppingList list = lockListOfRoom(officeId, roomId);

        int deleted = roomRepository.deleteInList(roomId, list);
        if (deleted == 0) {
            throw ApiException.notFound();
        }

        list.touch();
        activity.record(list.getId());
    }

    @Transactional
    public List<RoomResponse> reorder(UUID officeId, UUID listId, RoomOrderRequest request) {
        ShoppingList list = lockList(officeId, listId);
        List<Room> rooms = roomRepository.findByListOrderByPosition(list);
        List<UUID> roomIds = request.roomIds();
        if (!namesEveryRoomOnce(roomIds, rooms)) {
            throw ApiException.invalidField(ROOM_IDS_FIELD, ErrorMessages.ROOM_ORDER_INCOMPLETE);
        }

        rooms.forEach(room -> room.moveTo(roomIds.indexOf(room.getId())));
        list.touch();
        activity.record(list.getId());

        return rooms.stream().sorted(Comparator.comparingInt(Room::getPosition)).map(RoomResponse::of).toList();
    }

    private ShoppingList lockList(UUID officeId, UUID listId) {
        return listRepository.findInOfficeForUpdate(listId, officeId).orElseThrow(ApiException::notFound);
    }

    private ShoppingList lockListOfRoom(UUID officeId, UUID roomId) {
        return listRepository.findByRoomInOfficeForUpdate(roomId, officeId).orElseThrow(ApiException::notFound);
    }

    private Room loadRoom(UUID officeId, UUID roomId) {
        return roomRepository.findInOffice(roomId, officeId).orElseThrow(ApiException::notFound);
    }

    private static ApiException nameInUse() {
        return ApiException.conflict(NAME_FIELD, ErrorMessages.ROOM_NAME_IN_USE);
    }

    /** True when the ids have no repeats and are exactly the ids of the list's rooms. */
    private static boolean namesEveryRoomOnce(List<UUID> roomIds, List<Room> rooms) {
        Set<UUID> requestedIds = new HashSet<>(roomIds);
        Set<UUID> listRoomIds = rooms.stream().map(Room::getId).collect(Collectors.toSet());
        return requestedIds.size() == roomIds.size() && requestedIds.equals(listRoomIds);
    }
}
