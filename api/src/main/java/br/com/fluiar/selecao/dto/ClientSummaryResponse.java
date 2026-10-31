package br.com.fluiar.selecao.dto;

import java.time.Instant;
import java.util.UUID;

/** {@code ClientRepository.findSummaries} calls this constructor, so its order and types must match that query. */
public record ClientSummaryResponse(
        UUID id, String name, String email, String phone, long listCount, Instant createdAt, Instant updatedAt) {
}
