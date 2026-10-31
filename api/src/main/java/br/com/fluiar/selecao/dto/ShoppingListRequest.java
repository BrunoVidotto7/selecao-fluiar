package br.com.fluiar.selecao.dto;

import br.com.fluiar.selecao.exception.ErrorMessages;
import br.com.fluiar.selecao.model.ShoppingList;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record ShoppingListRequest(
        @NotBlank @Size(max = ShoppingList.NAME_MAX_LENGTH) String name,
        @Size(max = ShoppingList.DESCRIPTION_MAX_LENGTH) String description,
        @NotNull(message = ErrorMessages.LIST_CLIENT_REQUIRED) UUID clientId) {

    public ShoppingListRequest {
        name = Inputs.text(name);
        description = Inputs.optionalText(description);
    }
}
