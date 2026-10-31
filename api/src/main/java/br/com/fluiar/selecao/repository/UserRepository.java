package br.com.fluiar.selecao.repository;

import br.com.fluiar.selecao.model.User;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    List<User> findByOfficeIdOrderByNameAsc(UUID officeId);

    @Query("select u.credentialsVersion from User u where u.id = :id")
    Optional<Integer> findCredentialsVersion(UUID id);

    /**
     * Loads the user and locks its row until the transaction ends. Every flow that writes the account uses it, so
     * two writes never start from the same old state: Hibernate saves the whole row, and the later write would
     * otherwise restore an old password hash or credentials version.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.id = :id")
    Optional<User> findByIdForUpdate(UUID id);

    /**
     * The same row lock as {@link #findByIdForUpdate}, found by e-mail. When a concurrent write changes the e-mail,
     * this waits for it and then finds nothing, because the database checks the condition again on the new row.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.email = :email")
    Optional<User> findByEmailForUpdate(String email);
}
