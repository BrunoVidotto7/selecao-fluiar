package br.com.fluiar.selecao.model;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "users")
public class User {

    public static final int NAME_MAX_LENGTH = 120;
    public static final int EMAIL_MAX_LENGTH = 254;
    public static final int PASSWORD_MIN_LENGTH = 8;
    public static final int PASSWORD_MAX_LENGTH = 72;
    /** BCrypt accepts at most 72 bytes; in UTF-8, accented letters and emojis take more than one byte each. */
    public static final int PASSWORD_MAX_BYTES = 72;

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private UUID officeId;

    private String name;

    private String email;

    private String passwordHash;

    private int credentialsVersion;

    @CreationTimestamp
    private Instant createdAt;

    @UpdateTimestamp
    private Instant updatedAt;

    protected User() {
    }

    public User(UUID officeId, String name, String email, String passwordHash) {
        this.officeId = officeId;
        this.name = name;
        this.email = email;
        this.passwordHash = passwordHash;
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

    public String getEmail() {
        return email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public int getCredentialsVersion() {
        return credentialsVersion;
    }

    public void rename(String name) {
        this.name = name;
    }

    public void changeEmail(String email) {
        this.email = email;
    }

    /** Also increments the credentials version, which every issued token carries. */
    public void changePassword(String newHash) {
        this.passwordHash = newHash;
        this.credentialsVersion++;
    }
}
