package br.com.fluiar.selecao.dto;

import br.com.fluiar.selecao.model.Client;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record ClientDetailResponse(
        UUID id,
        String name,
        String email,
        String phone,
        LocalDate birthDate,
        String cpf,
        Instant createdAt,
        Instant updatedAt,
        List<ListSummaryResponse> lists,
        List<ClientMemberListResponse> memberLists) {

    public static ClientDetailResponse of(Client client, List<ListSummaryResponse> lists,
            List<ClientMemberListResponse> memberLists) {
        return new ClientDetailResponse(client.getId(), client.getName(), client.getEmail(), client.getPhone(),
                client.getBirthDate(), client.getCpf(), client.getCreatedAt(), client.getUpdatedAt(), lists, memberLists);
    }
}
