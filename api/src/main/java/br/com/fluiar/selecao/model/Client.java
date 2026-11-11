package br.com.fluiar.selecao.model;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "clients")
public class Client {

    public static final int NAME_MAX_LENGTH = 120;
    public static final int EMAIL_MAX_LENGTH = 254;
    /** Brazilian phone digits: area code plus an 8-digit landline or a 9-digit mobile number. */
    public static final String PHONE_DIGITS_PATTERN = "\\d{10,11}";

    public static final LocalDate BIRTH_DATE_MIN = LocalDate.of(1900, 1, 1);

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private UUID officeId;

    private String name;

    private String email;

    private String phone;

    private LocalDate birthDate;

    private String cpf;

    @CreationTimestamp
    private Instant createdAt;

    @UpdateTimestamp
    private Instant updatedAt;

    protected Client() {
    }

    public Client(UUID officeId, String name, String email, String phone, LocalDate birthDate, String cpf) {
        this.officeId = officeId;
        this.name = name;
        this.email = email;
        this.phone = phone;
        this.birthDate = birthDate;
        this.cpf = cpf;
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

    public String getPhone() {
        return phone;
    }

    public LocalDate getBirthDate() {
        return birthDate;
    }

    public String getCpf() {
        return cpf;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void update(String name, String email, String phone, LocalDate birthDate, String cpf) {
        this.name = name;
        this.email = email;
        this.phone = phone;
        this.birthDate = birthDate;
        this.cpf = cpf;
    }
}
