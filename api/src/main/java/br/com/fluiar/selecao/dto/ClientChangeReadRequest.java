package br.com.fluiar.selecao.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import tools.jackson.databind.JsonNode;

public record ClientChangeReadRequest(@NotNull @PositiveOrZero Long observedRevision) {
    private static final String REVISION_FIELD = "observedRevision";

    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static ClientChangeReadRequest from(JsonNode body) {
        if (body == null || !body.isObject() || body.size() != 1 || !body.has(REVISION_FIELD)) {
            throw new IllegalArgumentException("Expected only observedRevision.");
        }
        JsonNode revision = body.get(REVISION_FIELD);
        if (!revision.isIntegralNumber() || !revision.canConvertToLong() || revision.longValue() < 0) {
            throw new IllegalArgumentException("Expected a nonnegative long revision.");
        }
        return new ClientChangeReadRequest(revision.longValue());
    }
}
