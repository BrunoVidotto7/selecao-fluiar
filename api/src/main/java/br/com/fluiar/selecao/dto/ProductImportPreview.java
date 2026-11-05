package br.com.fluiar.selecao.dto;

import java.math.BigDecimal;
import java.util.List;

public record ProductImportPreview(String sourceUrl, String store, String productId, String variantId,
        List<Variant> variants, String name, BigDecimal unitPrice, String imageUrl, String resolution) {
    public record Variant(String id, String label) {}
}
