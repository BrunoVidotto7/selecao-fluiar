package br.com.fluiar.selecao.repository;

import br.com.fluiar.selecao.dto.ClientSummaryResponse;
import br.com.fluiar.selecao.model.Client;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface ClientRepository extends JpaRepository<Client, UUID> {

    Optional<Client> findByIdAndOfficeId(UUID id, UUID officeId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Client c where c.id = :id and c.officeId = :officeId")
    Optional<Client> findByIdAndOfficeIdForUpdate(UUID id, UUID officeId);

    String SUMMARY_QUERY = """
            select new br.com.fluiar.selecao.dto.ClientSummaryResponse(
                c.id, c.name, c.email, c.phone, count(l.id), c.createdAt, c.updatedAt)
            from Client c
            left join ShoppingList l on l.client = c
            where c.officeId = :officeId
            group by c.id, c.name, c.email, c.phone, c.createdAt, c.updatedAt
            order by c.updatedAt desc
            """;

    @Query(SUMMARY_QUERY)
    List<ClientSummaryResponse> findSummaries(UUID officeId);

    /** Only the first page of the summaries, newest update first. */
    @Query(SUMMARY_QUERY)
    List<ClientSummaryResponse> findSummaries(UUID officeId, Pageable pageable);

    long countByOfficeId(UUID officeId);

    long countByOfficeIdAndCreatedAtGreaterThanEqual(UUID officeId, Instant createdAt);

    /**
     * Deletes in one statement and returns how many clients it deleted. When a concurrent transaction deletes the same
     * client first, this waits for it and deletes nothing, instead of failing on a row that is already gone.
     */
    @Modifying
    @Query("delete from Client c where c.id = :id and c.officeId = :officeId")
    int deleteByIdAndOfficeId(UUID id, UUID officeId);
}
