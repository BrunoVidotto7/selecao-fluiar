package br.com.fluiar.selecao.model;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.text.Normalizer;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "product_categories")
public class ProductCategory {

    public static final int NAME_MAX_LENGTH = 60;
    public static final String DEFAULT_NAME = "Outros";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private UUID officeId;

    private String name;

    private String nameKey;

    private Instant deletedAt;

    @CreationTimestamp
    private Instant createdAt;

    @UpdateTimestamp
    private Instant updatedAt;

    protected ProductCategory() {
    }

    public ProductCategory(UUID officeId, String name) {
        this.officeId = officeId;
        this.name = name;
        this.nameKey = keyOf(name);
    }

    /** Lowercase, without accents, with single spaces: two names with the same key are the same category. */
    public static String keyOf(String name) {
        String withoutAccents = Normalizer.normalize(name, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return withoutAccents.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").strip();
    }

    public UUID getId() {
        return id;
    }

    public UUID getOfficeId() {
        return officeId;
    }

    public String getName() {
        return name;
    }

    public boolean isDeleted() {
        return deletedAt != null;
    }

    public void rename(String name) {
        this.name = name;
        this.nameKey = keyOf(name);
    }

    public void delete(Instant at) {
        this.deletedAt = at;
    }

    public void restore(String name) {
        rename(name);
        this.deletedAt = null;
    }
}
