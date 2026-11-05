package br.com.fluiar.selecao.model;

import br.com.fluiar.selecao.dto.ProductImportPreview;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.time.Instant;
import java.util.UUID;

@Embeddable
public class ProductStoreSync {
    public static final String PENDING = "pending";
    public static final String OK = "ok";
    public static final String PARTIAL = "partial";
    public static final String FAILED = "failed";
    private String sourceUrl;
    private String store;
    private String storeProductId;
    private String variantId;
    @Column(name="sync_enabled")
    private boolean enabled;
    private UUID bindingVersion;
    private Instant lastAttemptAt;
    private Instant lastSyncedAt;
    private Instant nextAttemptAt;
    @Column(name="sync_status")
    private String status;
    private UUID leaseToken;
    private Instant leaseExpiresAt;

    protected ProductStoreSync() {}
    public ProductStoreSync(ProductImportPreview preview, Instant now) {
        sourceUrl=preview.sourceUrl(); store=preview.store(); storeProductId=preview.productId();
        variantId=preview.variantId(); enabled=true; bindingVersion=UUID.randomUUID();
        nextAttemptAt=now; status=PENDING;
    }
    public void disable() { enabled=false; invalidateAttempt(); }
    public void invalidateAttempt() {
        bindingVersion=UUID.randomUUID(); leaseToken=null; leaseExpiresAt=null;
    }
    public void finish(String status, Instant now) {
        this.status=status;
        if (OK.equals(status)) lastSyncedAt=now;
        leaseToken=null; leaseExpiresAt=null;
    }
    public String getSourceUrl() { return sourceUrl; }
    public String getStore() { return store; }
    public String getProductId() { return storeProductId; }
    public String getVariantId() { return variantId; }
    public boolean isEnabled() { return enabled; }
    public UUID getBindingVersion() { return bindingVersion; }
    public UUID getLeaseToken() { return leaseToken; }
    public Instant getLeaseExpiresAt() { return leaseExpiresAt; }
    public Instant getLastAttemptAt() { return lastAttemptAt; }
    public Instant getLastSyncedAt() { return lastSyncedAt; }
    public String getStatus() { return status; }
}
