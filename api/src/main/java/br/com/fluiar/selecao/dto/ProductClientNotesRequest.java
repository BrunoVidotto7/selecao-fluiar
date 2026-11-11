package br.com.fluiar.selecao.dto;

import br.com.fluiar.selecao.model.ProductClientNote;
import com.fasterxml.jackson.annotation.JsonCreator;
import jakarta.validation.constraints.Size;
import tools.jackson.databind.JsonNode;

public record ProductClientNotesRequest(@Size(max = ProductClientNote.TEXT_MAX_LENGTH) String clientNotes) {
    public ProductClientNotesRequest {
        clientNotes = Inputs.optionalText(clientNotes);
    }

    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static ProductClientNotesRequest from(JsonNode body) {
        if (body == null || !body.isObject() || body.size() != 1 || !body.has("clientNotes")
                || (!body.get("clientNotes").isTextual() && !body.get("clientNotes").isNull())) {
            throw new IllegalArgumentException("Expected only nullable clientNotes text.");
        }
        return new ProductClientNotesRequest(body.get("clientNotes").isNull() ? null : body.get("clientNotes").textValue());
    }
}
