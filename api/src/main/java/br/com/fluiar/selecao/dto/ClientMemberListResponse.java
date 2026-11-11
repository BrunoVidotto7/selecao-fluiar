package br.com.fluiar.selecao.dto;

import br.com.fluiar.selecao.model.ListRole;
import java.util.UUID;

public record ClientMemberListResponse(UUID id, String name, ListRole role) {
}
