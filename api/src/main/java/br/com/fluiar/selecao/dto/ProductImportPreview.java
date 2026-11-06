package br.com.fluiar.selecao.dto;

import com.fasterxml.jackson.annotation.JsonValue;
import java.math.BigDecimal;
import java.util.List;

public record ProductImportPreview(String sourceUrl, String store, String productId, String variantId,
        List<Variant> variants, String name, BigDecimal unitPrice, String imageUrl, Resolution resolution) {
    public record Variant(String id, String label) {}

    public enum Resolution {
        RESOLVED("resolved"), UNRESOLVED("unresolved"), VARIANT_REQUIRED("variant_required");

        private final String value;

        Resolution(String value) { this.value = value; }

        @JsonValue
        public String value() { return value; }
    }
}
