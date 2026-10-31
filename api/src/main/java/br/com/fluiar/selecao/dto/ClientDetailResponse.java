package br.com.fluiar.selecao.dto;

import br.com.fluiar.selecao.model.Client;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ClientDetailResponse(
        UUID id,
        String name,
        String email,
        String phone,
        Instant createdAt,
        Instant updatedAt,
        List<ListSummaryResponse> lists) {

    public static ClientDetailResponse of(Client client, List<ListSummaryResponse> lists) {
        return new ClientDetailResponse(client.getId(), client.getName(), client.getEmail(), client.getPhone(),
                client.getCreatedAt(), client.getUpdatedAt(), lists);
    }
}
