package br.com.fluiar.selecao.dto;

import br.com.fluiar.selecao.exception.ErrorMessages;
import br.com.fluiar.selecao.model.ProductCategory;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ProductCategoryRequest(
        @NotBlank(message = ErrorMessages.CATEGORY_NAME_REQUIRED)
        @Size(max = ProductCategory.NAME_MAX_LENGTH, message = ErrorMessages.CATEGORY_NAME_TOO_LONG) String name) {

    public ProductCategoryRequest {
        name = Inputs.text(name);
    }
}
