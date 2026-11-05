package br.com.fluiar.selecao.dto;
import br.com.fluiar.selecao.model.ProductStoreSync;
import java.time.Instant;
public record ProductStoreSyncResponse(String sourceUrl, String store, String productId, String variantId,
        boolean enabled, Instant lastAttemptAt, Instant lastSyncedAt, String status) {
    public static ProductStoreSyncResponse of(ProductStoreSync sync) {
        return sync == null ? null : new ProductStoreSyncResponse(sync.getSourceUrl(),sync.getStore(),
            sync.getProductId(),sync.getVariantId(),sync.isEnabled(),sync.getLastAttemptAt(),sync.getLastSyncedAt(),sync.getStatus());
    }
}
