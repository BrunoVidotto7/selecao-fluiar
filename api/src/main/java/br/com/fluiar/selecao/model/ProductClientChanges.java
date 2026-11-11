package br.com.fluiar.selecao.model;

import jakarta.persistence.Embeddable;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import java.time.Instant;

@Embeddable
public class ProductClientChanges {
    private long clientPurchaseRevision;
    private Instant clientPurchaseChangedAt;
    private Boolean clientPurchaseValue;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_purchase_client_id")
    private Client clientPurchaseClient;

    public long getPurchaseRevision() { return clientPurchaseRevision; }
    public Instant getPurchaseChangedAt() { return clientPurchaseChangedAt; }
    public Boolean getPurchaseValue() { return clientPurchaseValue; }
    public Client getPurchaseAuthor() { return clientPurchaseClient; }

    public void recordPurchase(long revision, Instant changedAt, boolean value, Client author) {
        clientPurchaseRevision = revision;
        clientPurchaseChangedAt = changedAt;
        clientPurchaseValue = value;
        clientPurchaseClient = author;
    }
}
