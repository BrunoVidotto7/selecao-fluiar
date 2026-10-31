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

@Entity
@Table(name = "rooms")
public class Room {

    public static final int NAME_MAX_LENGTH = 60;

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    private ShoppingList list;

    private String name;

    private int position;

    @OneToMany(mappedBy = "room")
    @OrderBy("createdAt, id")
    private List<Product> products = new ArrayList<>();

    @CreationTimestamp
    private Instant createdAt;

    protected Room() {
    }

    public Room(ShoppingList list, String name, int position) {
        this.list = list;
        this.name = name;
        this.position = position;
    }

    public UUID getId() {
        return id;
    }

    public ShoppingList getList() {
        return list;
    }

    public String getName() {
        return name;
    }

    public int getPosition() {
        return position;
    }

    public List<Product> getProducts() {
        return products;
    }

    public void rename(String name) {
        this.name = name;
    }

    public void moveTo(int position) {
        this.position = position;
    }
}
