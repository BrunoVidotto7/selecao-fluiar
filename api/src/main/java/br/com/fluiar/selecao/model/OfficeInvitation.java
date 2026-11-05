package br.com.fluiar.selecao.model;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;

/**
 * A pending invitation to activate a client account. Only the hash of its token is stored; the token itself goes only in the
 * e-mail.
 */
@Entity
@Table(name = "office_invitations")
public class OfficeInvitation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private UUID officeId;

    private UUID clientId;

    private String email;

    private UUID invitedByUserId;

    private String tokenHash;

    private Instant expiresAt;

    @CreationTimestamp
    private Instant createdAt;

    protected OfficeInvitation() {
    }

    public OfficeInvitation(UUID officeId, UUID clientId, String email, UUID invitedByUserId, String tokenHash, Instant expiresAt) {
        this.officeId = officeId;
        this.clientId = clientId;
        this.email = email;
        this.invitedByUserId = invitedByUserId;
        this.tokenHash = tokenHash;
        this.expiresAt = expiresAt;
    }

    public UUID getId() {
        return id;
    }

    public UUID getClientId() {
        return clientId;
    }

    public UUID getOfficeId() {
        return officeId;
    }

    public String getEmail() {
        return email;
    }

    public UUID getInvitedByUserId() {
        return invitedByUserId;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public boolean isExpired(Instant now) {
        return !now.isBefore(expiresAt);
    }
}
