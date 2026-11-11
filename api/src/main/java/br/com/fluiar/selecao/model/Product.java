package br.com.fluiar.selecao.model;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.Formula;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "products")
public class Product {

    public static final int NAME_MAX_LENGTH = 120;
    public static final int NOTES_MAX_LENGTH = 1000;
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

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private ProductCategory category;

    @jakarta.persistence.Embedded
    private ProductStoreSync storeSync = new ProductStoreSync();

    @jakarta.persistence.Embedded
    private ProductClientChanges clientChanges = new ProductClientChanges();

    private String name;

    private BigDecimal quantity;

    @Enumerated(EnumType.STRING)
    private ProductUnit unit;

    private BigDecimal unitPrice;

    private String notes;

    @OneToMany(mappedBy = "product")
    @OrderBy("updatedAt")
    private List<ProductClientNote> clientNotes = new ArrayList<>();

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

    public Product(Room room, ProductCategory category, String name, BigDecimal quantity, ProductUnit unit, BigDecimal unitPrice, String notes, boolean bought,
            List<ProductLink> links) {
        this.room = room;
        this.category = category;
        this.name = name;
        this.quantity = quantity;
        this.unit = unit;
        this.unitPrice = unitPrice;
        this.notes = notes;
        this.bought = bought;
        this.links.addAll(links);
    }

    public ProductClientChanges getClientChanges() { return clientChanges; }

    public void recordClientPurchase(long revision, Instant changedAt, boolean value, Client author) {
        clientChanges.recordPurchase(revision, changedAt, value, author);
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

    public ProductCategory getCategory() {
        return category;
    }

    public String getName() {
        return name;
    }

    public BigDecimal getQuantity() {
        return quantity;
    }

    public ProductUnit getUnit() {
        return unit;
    }

    public BigDecimal getUnitPrice() {
        return unitPrice;
    }

    public String getNotes() {
        return notes;
    }

    public List<ProductClientNote> getClientNotes() {
        return clientNotes;
    }

    public ProductClientNote addClientNote(Client author) {
        ProductClientNote note = new ProductClientNote(this, author);
        clientNotes.add(note);
        return note;
    }

    public Optional<ProductClientNote> clientNoteOf(UUID clientId) {
        return clientNotes.stream().filter(note -> note.getClient().getId().equals(clientId)).findFirst();
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

    public void update(Room room, ProductCategory category, String name, BigDecimal quantity, ProductUnit unit, BigDecimal unitPrice, String notes, boolean bought,
            List<ProductLink> links) {
        this.room = room;
        this.category = category;
        this.name = name;
        this.quantity = quantity;
        this.unit = unit;
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

    public void changeQuantity(BigDecimal quantity) {
        this.quantity = quantity;
    }

    /** A product without a price adds nothing to the totals. */
    public BigDecimal lineTotal() {
        if (unitPrice == null) {
            return BigDecimal.ZERO;
        }
        return unitPrice.multiply(quantity).setScale(PRICE_FRACTION_DIGITS, RoundingMode.HALF_UP);
    }
}
