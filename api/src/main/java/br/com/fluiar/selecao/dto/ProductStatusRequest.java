package br.com.fluiar.selecao.dto;

import br.com.fluiar.selecao.model.Product;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/** Both fields are optional: a field sent as null (or left out) keeps its current value. */
public record ProductStatusRequest(
        Boolean bought,
        @Min(Product.MIN_QUANTITY) @Max(Product.MAX_QUANTITY) Integer quantity) {
}
