package br.com.fluiar.selecao.controller;

import br.com.fluiar.selecao.dto.RoomOrderRequest;
import br.com.fluiar.selecao.dto.RoomRequest;
import br.com.fluiar.selecao.dto.RoomResponse;
import br.com.fluiar.selecao.security.CurrentOfficeId;
import br.com.fluiar.selecao.service.RoomService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class RoomController {

    private final RoomService roomService;

    public RoomController(RoomService roomService) {
        this.roomService = roomService;
    }

    @PostMapping("/lists/{listId}/rooms")
    @ResponseStatus(HttpStatus.CREATED)
    public RoomResponse createRoom(
            @CurrentOfficeId UUID officeId, @PathVariable UUID listId, @Valid @RequestBody RoomRequest request) {
        return roomService.create(officeId, listId, request);
    }

    @PutMapping("/lists/{listId}/room-order")
    public List<RoomResponse> reorderRooms(
            @CurrentOfficeId UUID officeId, @PathVariable UUID listId, @Valid @RequestBody RoomOrderRequest request) {
        return roomService.reorder(officeId, listId, request);
    }

    @PutMapping("/rooms/{roomId}")
    public RoomResponse renameRoom(
            @CurrentOfficeId UUID officeId, @PathVariable UUID roomId, @Valid @RequestBody RoomRequest request) {
        return roomService.rename(officeId, roomId, request);
    }

    @DeleteMapping("/rooms/{roomId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteRoom(@CurrentOfficeId UUID officeId, @PathVariable UUID roomId) {
        roomService.delete(officeId, roomId);
    }
}
