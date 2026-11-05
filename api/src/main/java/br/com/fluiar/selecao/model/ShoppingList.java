package br.com.fluiar.selecao.model;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "shopping_lists")
public class ShoppingList {

    public static final int NAME_MAX_LENGTH = 120;
    public static final int DESCRIPTION_MAX_LENGTH = 500;

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    private Client client;

    private long clientChangeRevision;

    private String name;

    private String description;

    private String shareToken;

    @OneToMany(mappedBy = "list")
    @OrderBy("position")
    private List<Room> rooms = new ArrayList<>();

    @CreationTimestamp
    private Instant createdAt;

    @UpdateTimestamp
    private Instant updatedAt;

    protected ShoppingList() {
    }

    public ShoppingList(Client client, String name, String description, String shareToken) {
        this.client = client;
        this.name = name;
        this.description = description;
        this.shareToken = shareToken;
    }

    public long nextClientChangeRevision() { return ++clientChangeRevision; }
    public long getClientChangeRevision() { return clientChangeRevision; }

    public UUID getId() {
        return id;
    }

    public Client getClient() {
        return client;
    }

    public String getName() {
        return name;
    }

    public String getDescription() {
        return description;
    }

    public String getShareToken() {
        return shareToken;
    }

    public List<Room> getRooms() {
        return rooms;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void update(String name, String description, Client client) {
        this.name = name;
        this.description = description;
        this.client = client;
    }

    public void replaceShareToken(String shareToken) {
        this.shareToken = shareToken;
    }

    /**
     * Called when the rooms, products or images of the list change. Changing the field marks the list as modified, so
     * {@code @UpdateTimestamp} writes the flush time.
     */
    public void touch() {
        this.updatedAt = Instant.now();
    }
}
