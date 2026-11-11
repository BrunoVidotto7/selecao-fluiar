package br.com.fluiar.selecao.model;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Embedded;
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
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
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

    @Embedded
    private ProjectInfo projectInfo;

    @OneToMany(mappedBy = "list")
    @OrderBy("position")
    private List<Room> rooms = new ArrayList<>();

    @OneToMany(mappedBy = "list", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ListMember> members = new ArrayList<>();

    @CreationTimestamp
    private Instant createdAt;

    @UpdateTimestamp
    private Instant updatedAt;

    protected ShoppingList() {
    }

    public ShoppingList(Client client, String name, String description, String shareToken, ProjectInfo projectInfo) {
        this.client = client;
        this.name = name;
        this.description = description;
        this.shareToken = shareToken;
        this.projectInfo = projectInfo;
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

    public ProjectInfo getProjectInfo() {
        return projectInfo == null ? ProjectInfo.EMPTY : projectInfo;
    }

    public List<Room> getRooms() {
        return rooms;
    }

    public List<ListMember> getMembers() {
        return members;
    }

    /** The principal or a member's client; empty when the profile has no access to the list. */
    public Optional<Client> profileOf(UUID clientId) {
        if (client.getId().equals(clientId)) {
            return Optional.of(client);
        }
        return memberOf(clientId).map(ListMember::getClient);
    }

    public Optional<ListRole> roleOf(UUID clientId) {
        if (client.getId().equals(clientId)) {
            return Optional.of(ListRole.EDITOR);
        }
        return memberOf(clientId).map(ListMember::getRole);
    }

    private Optional<ListMember> memberOf(UUID clientId) {
        return members.stream().filter(member -> member.getClient().getId().equals(clientId)).findFirst();
    }

    /** Returns the ids of the profiles that lost access. */
    public Set<UUID> replaceMembers(Map<Client, ListRole> wanted) {
        Map<UUID, ListRole> toKeep = new HashMap<>();
        wanted.forEach((member, role) -> toKeep.put(member.getId(), role));
        Set<UUID> removed = new HashSet<>();
        Iterator<ListMember> existing = members.iterator();
        while (existing.hasNext()) {
            ListMember member = existing.next();
            UUID memberId = member.getClient().getId();
            ListRole role = toKeep.remove(memberId);
            if (role == null) {
                existing.remove();
                removed.add(memberId);
            } else {
                member.changeRole(role);
            }
        }
        wanted.forEach((member, role) -> {
            if (toKeep.containsKey(member.getId())) {
                members.add(new ListMember(this, member, role));
            }
        });
        return removed;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void update(String name, String description, Client client, ProjectInfo projectInfo) {
        this.name = name;
        this.description = description;
        this.client = client;
        this.projectInfo = projectInfo;
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
