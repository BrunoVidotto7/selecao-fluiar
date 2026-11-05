package br.com.fluiar.selecao.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import tools.jackson.databind.JsonNode;

public record InvitationAcceptRequest(@ValidPassword String password) {
    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static InvitationAcceptRequest from(JsonNode body) {
        if (body == null || !body.isObject() || body.size() != 1 || !body.has("password")
                || !body.get("password").isTextual()) {
            throw new IllegalArgumentException("Expected only a password string.");
        }
        return new InvitationAcceptRequest(body.get("password").textValue());
    }
}
