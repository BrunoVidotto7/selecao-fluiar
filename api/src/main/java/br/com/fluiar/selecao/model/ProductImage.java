package br.com.fluiar.selecao.model;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "product_images")
public class ProductImage {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private UUID productId;

    private String contentType;

    /** A plain byte array maps to PostgreSQL {@code bytea}; with {@code @Lob} it would map to {@code oid}. */
    private byte[] data;

    @CreationTimestamp
    private Instant createdAt;

    protected ProductImage() {
    }

    public ProductImage(UUID productId, String contentType, byte[] data) {
        this.productId = productId;
        this.contentType = contentType;
        this.data = data;
    }

    public UUID getId() {
        return id;
    }

    public String getContentType() {
        return contentType;
    }

    public byte[] getData() {
        return data;
    }
}
