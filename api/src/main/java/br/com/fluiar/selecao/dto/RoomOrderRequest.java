package br.com.fluiar.selecao.dto;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;
import java.util.UUID;

public record RoomOrderRequest(@NotEmpty List<UUID> roomIds) {
}
