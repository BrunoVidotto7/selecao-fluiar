package br.com.fluiar.selecao.dto;

import br.com.fluiar.selecao.exception.ErrorMessages;
import br.com.fluiar.selecao.model.Product;
import br.com.fluiar.selecao.model.ProductUnit;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * {@code quantity} and {@code bought} are wrapper types because Jackson 3 rejects a missing primitive field with a
 * generic error: a missing quantity gets the field message instead. A missing {@code bought} is false on create and
 * keeps the current value on update, so an edit cannot undo a client's purchase.
 * <p>
 * On update, a product with store sync enabled and no {@code storeSync} in the request (a form loaded before a sync)
 * keeps the stored name and price, because the store owns them, and sync stays enabled. A manual change of them is
 * signalled by {@code storeSync: null}, which unlinks the product. Other fields always apply.
 */
public record ProductRequest(
        @NotNull(message = ErrorMessages.ROOM_REQUIRED) UUID roomId,
        @NotNull(message = ErrorMessages.CATEGORY_REQUIRED) UUID categoryId,
        @NotBlank @Size(max = Product.NAME_MAX_LENGTH) String name,
        @NotNull BigDecimal quantity,
        ProductUnit unit,
        @DecimalMin(Product.MIN_UNIT_PRICE)
        @Digits(integer = Product.PRICE_INTEGER_DIGITS, fraction = Product.PRICE_FRACTION_DIGITS) BigDecimal unitPrice,
        @Size(max = Product.NOTES_MAX_LENGTH) String notes,
        Boolean bought,
        @Size(max = Product.MAX_LINKS, message = ErrorMessages.LINKS_TOO_MANY)
        List<@NotNull @Valid ProductLinkDto> links, StoreSyncRequest storeSync) {

    public ProductRequest {
        name = Inputs.text(name);
        notes = Inputs.optionalText(notes);
        unit = unit == null ? ProductUnit.UNIT : unit;
        links = links == null ? List.of() : links;
    }
}
