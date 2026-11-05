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

    interface ClientContext {
        UUID getClientId();
        UUID getOfficeId();
    }

    @Query("select i.clientId as clientId, i.officeId as officeId from OfficeInvitation i where i.tokenHash = :tokenHash")
    Optional<ClientContext> findClientContextByTokenHash(String tokenHash);

    /**
     * Loads the invitation and locks its row until the transaction ends. When a concurrent transaction holds the
     * lock, this waits and then reads the row as that transaction left it: nothing if it deleted the invitation, the
     * new expiry if it changed it.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from OfficeInvitation i where i.tokenHash = :tokenHash")
    Optional<OfficeInvitation> findByTokenHashForUpdate(String tokenHash);

    Optional<OfficeInvitation> findByClientId(UUID clientId);

    Optional<OfficeInvitation> findByOfficeIdAndEmail(UUID officeId, String email);

    @Modifying
    @Query("delete from OfficeInvitation i where i.clientId = :clientId")
    void deleteByClientId(UUID clientId);

    @Modifying
    @Query("delete from OfficeInvitation i where i.id = :id and i.officeId = :officeId and i.clientId = :clientId")
    int deleteForClient(UUID id, UUID officeId, UUID clientId);
}
