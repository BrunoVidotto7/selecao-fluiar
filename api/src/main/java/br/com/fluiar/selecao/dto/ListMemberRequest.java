package br.com.fluiar.selecao.dto;

import br.com.fluiar.selecao.model.ListRole;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record ListMemberRequest(@NotNull UUID clientId, @NotNull ListRole role) {
}
