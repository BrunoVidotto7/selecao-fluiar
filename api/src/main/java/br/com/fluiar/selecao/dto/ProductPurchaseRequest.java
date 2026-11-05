package br.com.fluiar.selecao.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import jakarta.validation.constraints.NotNull;
import tools.jackson.databind.JsonNode;

public record ProductPurchaseRequest(@NotNull Boolean bought) {
    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static ProductPurchaseRequest from(JsonNode body) {
        if (body == null || !body.isObject() || body.size() != 1 || !body.has("bought")
                || !body.get("bought").isBoolean()) {
            throw new IllegalArgumentException("Expected only a bought boolean.");
        }
        return new ProductPurchaseRequest(body.get("bought").booleanValue());
    }
}
