package br.com.fluiar.selecao.model;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "list_members")
public class ListMember {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private ShoppingList list;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private Client client;

    @Enumerated(EnumType.STRING)
    private ListRole role;

    @CreationTimestamp
    private Instant createdAt;

    protected ListMember() {
    }

    public ListMember(ShoppingList list, Client client, ListRole role) {
        this.list = list;
        this.client = client;
        this.role = role;
    }

    public Client getClient() {
        return client;
    }

    public ListRole getRole() {
        return role;
    }

    public void changeRole(ListRole role) {
        this.role = role;
    }
}
