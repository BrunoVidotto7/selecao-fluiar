package br.com.fluiar.selecao.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.util.UUID;

public record ClientListSummaryResponse(UUID id, String name, String description, long totalProducts,
        long boughtProducts, Instant updatedAt) {
    @JsonProperty("pendingProducts")
    public long pendingProducts() { return totalProducts - boughtProducts; }

    @JsonProperty("completed")
    public boolean completed() { return totalProducts > 0 && totalProducts == boughtProducts; }
}
