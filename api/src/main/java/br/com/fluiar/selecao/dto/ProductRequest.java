package br.com.fluiar.selecao.dto;

import br.com.fluiar.selecao.exception.ErrorMessages;
import br.com.fluiar.selecao.model.Product;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * {@code quantity} and {@code bought} are wrapper types because Jackson 3 rejects a missing primitive field with a
 * generic error: a missing quantity gets the field message instead, and a missing {@code bought} becomes false.
 */
public record ProductRequest(
        @NotNull(message = ErrorMessages.ROOM_REQUIRED) UUID roomId,
        @NotBlank @Size(max = Product.NAME_MAX_LENGTH) String name,
        @NotNull @Min(Product.MIN_QUANTITY) @Max(Product.MAX_QUANTITY) Integer quantity,
        @DecimalMin(Product.MIN_UNIT_PRICE)
        @Digits(integer = Product.PRICE_INTEGER_DIGITS, fraction = Product.PRICE_FRACTION_DIGITS) BigDecimal unitPrice,
        @Size(max = Product.NOTES_MAX_LENGTH) String notes,
        Boolean bought,
        @Size(max = Product.MAX_LINKS, message = ErrorMessages.LINKS_TOO_MANY)
        List<@NotNull @Valid ProductLinkDto> links, tools.jackson.databind.JsonNode storeSync) {

    public ProductRequest {
        name = Inputs.text(name);
        notes = Inputs.optionalText(notes);
        bought = Boolean.TRUE.equals(bought);
        links = links == null ? List.of() : links;
    }
}
