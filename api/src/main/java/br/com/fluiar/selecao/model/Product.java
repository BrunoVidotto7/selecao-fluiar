package br.com.fluiar.selecao.model;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.Formula;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "products")
public class Product {

    public static final int NAME_MAX_LENGTH = 120;
    public static final int NOTES_MAX_LENGTH = 1000;
    public static final int CLIENT_NOTES_MAX_LENGTH = 1000;
    public static final int MIN_QUANTITY = 1;
    public static final int MAX_QUANTITY = 999;
    public static final int MAX_LINKS = 10;
    /** The unit price column is {@code numeric(12, 2)}: 10 digits before the decimal point and 2 after it. */
    public static final int PRICE_INTEGER_DIGITS = 10;
    public static final int PRICE_FRACTION_DIGITS = 2;
    /** The unit price column only accepts values from zero up. */
    public static final String MIN_UNIT_PRICE = "0.00";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    private Room room;

    @jakarta.persistence.Embedded
    private ProductStoreSync storeSync = new ProductStoreSync();

    @jakarta.persistence.Embedded
    private ProductClientChanges clientChanges = new ProductClientChanges();

    private String name;

    private int quantity;

    private BigDecimal unitPrice;

    private String notes;

    private String clientNotes;

    private boolean bought;

    @ElementCollection
    @CollectionTable(name = "product_links", joinColumns = @JoinColumn(name = "product_id"))
    @OrderColumn(name = "position")
    private List<ProductLink> links = new ArrayList<>();

    /** Reads the image id together with the product, without loading the image bytes. */
    @Formula("(select pi.id from product_images pi where pi.product_id = id)")
    private UUID imageId;

    @CreationTimestamp
    private Instant createdAt;

    @UpdateTimestamp
    private Instant updatedAt;

    protected Product() {
    }

    public Product(Room room, String name, int quantity, BigDecimal unitPrice, String notes, boolean bought,
            List<ProductLink> links) {
        this.room = room;
        this.name = name;
        this.quantity = quantity;
        this.unitPrice = unitPrice;
        this.notes = notes;
        this.bought = bought;
        this.links.addAll(links);
    }

    public ProductClientChanges getClientChanges() { return clientChanges; }

    public void recordClientPurchase(long revision, Instant changedAt, boolean value) {
        clientChanges.recordPurchase(revision, changedAt, value);
    }

    public void recordClientNotes(long revision, Instant changedAt, String value) {
        clientChanges.recordNotes(revision, changedAt, value);
    }

    public ProductStoreSync getStoreSync() {
        return storeSync == null || storeSync.getSourceUrl() == null ? null : storeSync;
    }
    public void bindStore(ProductStoreSync binding) { this.storeSync = binding; }
    public void disableStoreSync() { if (getStoreSync() != null) storeSync.disable(); }
    public void synchronize(String name, BigDecimal price) {
        if (name != null) this.name=name;
        if (price != null) this.unitPrice=price;
    }
    public void imageSaved(UUID imageId) { this.imageId=imageId; }

    public UUID getId() {
        return id;
    }

    public Room getRoom() {
        return room;
    }

    public String getName() {
        return name;
    }

    public int getQuantity() {
        return quantity;
    }

    public BigDecimal getUnitPrice() {
        return unitPrice;
    }

    public String getNotes() {
        return notes;
    }

    public String getClientNotes() {
        return clientNotes;
    }

    public void changeClientNotes(String notes) {
        this.clientNotes = notes;
    }

    public boolean isBought() {
        return bought;
    }

    public List<ProductLink> getLinks() {
        return links;
    }

    public UUID getImageId() {
        return imageId;
    }

    public void update(Room room, String name, int quantity, BigDecimal unitPrice, String notes, boolean bought,
            List<ProductLink> links) {
        this.room = room;
        this.name = name;
        this.quantity = quantity;
        this.unitPrice = unitPrice;
        this.notes = notes;
        markBought(bought);
        this.links.clear();
        this.links.addAll(links);
    }

    public void markBought(boolean bought) {
        if (this.bought != bought && getStoreSync() != null) storeSync.invalidateAttempt();
        this.bought = bought;
    }

    public void changeQuantity(int quantity) {
        this.quantity = quantity;
    }

    /** A product without a price adds nothing to the totals. */
    public BigDecimal lineTotal() {
        if (unitPrice == null) {
            return BigDecimal.ZERO;
        }
        return unitPrice.multiply(BigDecimal.valueOf(quantity));
    }
}
