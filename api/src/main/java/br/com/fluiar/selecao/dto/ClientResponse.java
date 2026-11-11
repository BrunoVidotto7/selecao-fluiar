package br.com.fluiar.selecao.dto;

import br.com.fluiar.selecao.model.Client;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record ClientResponse(
        UUID id, String name, String email, String phone, LocalDate birthDate, String cpf, Instant createdAt,
        Instant updatedAt) {

    public static ClientResponse of(Client client) {
        return new ClientResponse(client.getId(), client.getName(), client.getEmail(), client.getPhone(),
                client.getBirthDate(), client.getCpf(), client.getCreatedAt(), client.getUpdatedAt());
    }
}
