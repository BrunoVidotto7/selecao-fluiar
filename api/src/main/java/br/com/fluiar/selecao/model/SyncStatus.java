package br.com.fluiar.selecao.model;

/** Outcome of a product synchronization. The value is what products.sync_status stores. */
public enum SyncStatus {
    PENDING("pending"),
    OK("ok"),
    PARTIAL("partial"),
    FAILED("failed"),
    /** Only a result of ProductSyncService.apply, never stored. */
    DISCARDED("discarded");

    private final String value;

    SyncStatus(String value) { this.value = value; }

    public String value() { return value; }
}
