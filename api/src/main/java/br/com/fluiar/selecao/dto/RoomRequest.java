package br.com.fluiar.selecao.dto;

import br.com.fluiar.selecao.model.Room;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RoomRequest(@NotBlank @Size(max = Room.NAME_MAX_LENGTH) String name) {

    public RoomRequest {
        name = Inputs.text(name);
    }
}
