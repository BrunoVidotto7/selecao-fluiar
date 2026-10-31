package br.com.fluiar.selecao.repository;

import br.com.fluiar.selecao.model.OfficeInvitation;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface OfficeInvitationRepository extends JpaRepository<OfficeInvitation, UUID> {

    Optional<OfficeInvitation> findByTokenHash(String tokenHash);

    /**
     * Loads the invitation and locks its row until the transaction ends. When a concurrent transaction holds the
     * lock, this waits and then reads the row as that transaction left it: nothing if it deleted the invitation, the
     * new expiry if it changed it.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from OfficeInvitation i where i.tokenHash = :tokenHash")
    Optional<OfficeInvitation> findByTokenHashForUpdate(String tokenHash);

    List<OfficeInvitation> findByOfficeIdOrderByCreatedAtDesc(UUID officeId);

    /**
     * Deletes in one statement and returns how many invitations it deleted. When a concurrent transaction deletes the
     * same invitation first, this waits for it and deletes nothing, instead of failing on a row that is already gone.
     */
    @Modifying
    @Query("delete from OfficeInvitation i where i.id = :id and i.officeId = :officeId")
    int deleteByIdAndOfficeId(UUID id, UUID officeId);

    /**
     * A bulk JPQL delete runs at once. A {@code delete(entity)} would reach the database only at flush, after the
     * insert of the new invitation, and that insert would break the unique key {@code (office_id, email)}.
     */
    @Modifying
    @Query("delete from OfficeInvitation i where i.officeId = :officeId and i.email = :email")
    void deleteByOfficeIdAndEmail(UUID officeId, String email);
}
