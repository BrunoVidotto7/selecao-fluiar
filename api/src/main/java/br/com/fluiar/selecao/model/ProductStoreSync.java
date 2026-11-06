package br.com.fluiar.selecao.model;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.time.Instant;
import java.util.UUID;

@Embeddable
public class ProductStoreSync {
    public static final int SOURCE_URL_MAX_LENGTH = 2048;
    public static final int STORE_PRODUCT_ID_MAX_LENGTH = 512;
    public static final int VARIANT_ID_MAX_LENGTH = 512;
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
    public ProductStoreSync(String sourceUrl, String store, String storeProductId, String variantId, Instant now) {
        this.sourceUrl=sourceUrl; this.store=store; this.storeProductId=storeProductId;
        this.variantId=variantId; enabled=true; bindingVersion=UUID.randomUUID();
        nextAttemptAt=now; status=SyncStatus.PENDING.value();
    }
    public void disable() { enabled=false; invalidateAttempt(); }
    public void invalidateAttempt() {
        bindingVersion=UUID.randomUUID(); leaseToken=null; leaseExpiresAt=null;
    }
    public void finish(SyncStatus status, Instant now) {
        this.status=status.value();
        if (status==SyncStatus.OK) lastSyncedAt=now;
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
