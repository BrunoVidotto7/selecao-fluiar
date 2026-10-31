package br.com.fluiar.selecao.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** The summary queries of {@code ShoppingListRepository} call this constructor, so its order and types must match. */
public record ListSummaryResponse(
        UUID id,
        String name,
        String description,
        UUID clientId,
        String clientName,
        long totalProducts,
        long boughtProducts,
        BigDecimal estimatedTotal,
        Instant updatedAt) {

    /** SQL {@code sum} gives null when the list has no priced product. */
    public ListSummaryResponse {
        if (estimatedTotal == null) {
            estimatedTotal = BigDecimal.ZERO;
        }
    }

    /** A list without products is not completed. */
    @JsonProperty("completed")
    public boolean isCompleted() {
        return totalProducts > 0 && boughtProducts == totalProducts;
    }
}
