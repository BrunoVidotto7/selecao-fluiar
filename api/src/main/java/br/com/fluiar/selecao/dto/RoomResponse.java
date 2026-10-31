package br.com.fluiar.selecao.dto;

import br.com.fluiar.selecao.model.Room;
import java.util.List;
import java.util.UUID;

public record RoomResponse(UUID id, String name, int position, List<ProductResponse> products) {

    public static RoomResponse of(Room room) {
        return new RoomResponse(room.getId(), room.getName(), room.getPosition(),
                room.getProducts().stream().map(ProductResponse::of).toList());
    }
}
