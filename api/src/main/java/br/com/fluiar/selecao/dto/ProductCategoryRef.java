package br.com.fluiar.selecao.dto;

import br.com.fluiar.selecao.model.ProductCategory;
import java.util.UUID;

/** A product keeps its category after the office deletes it, so the response says whether it is deleted. */
public record ProductCategoryRef(UUID id, String name, boolean deleted) {

    public static ProductCategoryRef of(ProductCategory category) {
        return new ProductCategoryRef(category.getId(), category.getName(), category.isDeleted());
    }
}
