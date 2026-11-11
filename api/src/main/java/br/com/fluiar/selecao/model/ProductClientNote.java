package br.com.fluiar.selecao.model;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "product_client_notes")
public class ProductClientNote {

    public static final int TEXT_MAX_LENGTH = 1000;

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private Client client;

    private String text;

    private long revision;

    private Instant changedAt;

    @UpdateTimestamp
    private Instant updatedAt;

    protected ProductClientNote() {
    }

    public ProductClientNote(Product product, Client client) {
        this.product = product;
        this.client = client;
    }

    public Client getClient() {
        return client;
    }

    public String getText() {
        return text;
    }

    public long getRevision() {
        return revision;
    }

    public Instant getChangedAt() {
        return changedAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void change(String text, long revision, Instant changedAt) {
        this.text = text;
        this.revision = revision;
        this.changedAt = changedAt;
    }
}
