package br.com.fluiar.selecao.model;

import jakarta.persistence.Embeddable;
import java.time.Instant;

@Embeddable
public class ProductClientChanges {
    private long clientPurchaseRevision;
    private Instant clientPurchaseChangedAt;
    private Boolean clientPurchaseValue;
    private long clientNotesRevision;
    private Instant clientNotesChangedAt;
    private String clientNotesValue;

    public long getPurchaseRevision() { return clientPurchaseRevision; }
    public Instant getPurchaseChangedAt() { return clientPurchaseChangedAt; }
    public Boolean getPurchaseValue() { return clientPurchaseValue; }
    public long getNotesRevision() { return clientNotesRevision; }
    public Instant getNotesChangedAt() { return clientNotesChangedAt; }
    public String getNotesValue() { return clientNotesValue; }

    public void recordPurchase(long revision, Instant changedAt, boolean value) {
        clientPurchaseRevision = revision;
        clientPurchaseChangedAt = changedAt;
        clientPurchaseValue = value;
    }

    public void recordNotes(long revision, Instant changedAt, String value) {
        clientNotesRevision = revision;
        clientNotesChangedAt = changedAt;
        clientNotesValue = value;
    }
}
