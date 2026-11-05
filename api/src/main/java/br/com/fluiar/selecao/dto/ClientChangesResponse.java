package br.com.fluiar.selecao.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ClientChangesResponse(long observedRevision, List<ChangedProduct> products) {
    public record ChangedProduct(UUID productId,
            @JsonInclude(JsonInclude.Include.NON_NULL) PurchaseChange purchase,
            @JsonInclude(JsonInclude.Include.NON_NULL) NotesChange notes) {}
    public record PurchaseChange(long revision, Instant changedAt, boolean value) {}
    public record NotesChange(long revision, Instant changedAt, String value) {}
}
