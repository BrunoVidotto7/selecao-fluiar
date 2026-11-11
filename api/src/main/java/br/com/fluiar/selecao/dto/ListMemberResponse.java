package br.com.fluiar.selecao.dto;

import br.com.fluiar.selecao.model.ListMember;
import br.com.fluiar.selecao.model.ListRole;
import java.util.UUID;

public record ListMemberResponse(UUID clientId, String clientName, ListRole role) {

    public static ListMemberResponse of(ListMember member) {
        return new ListMemberResponse(member.getClient().getId(), member.getClient().getName(), member.getRole());
    }
}
