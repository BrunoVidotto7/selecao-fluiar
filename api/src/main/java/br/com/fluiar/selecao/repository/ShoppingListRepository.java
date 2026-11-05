package br.com.fluiar.selecao.repository;

import br.com.fluiar.selecao.dto.ListSummaryResponse;
import br.com.fluiar.selecao.dto.ClientListSummaryResponse;
import br.com.fluiar.selecao.model.ShoppingList;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface ShoppingListRepository extends JpaRepository<ShoppingList, UUID> {

    String SUMMARY_SELECT = """
            select new br.com.fluiar.selecao.dto.ListSummaryResponse(
                l.id, l.name, l.description, c.id, c.name,
                count(p.id),
                sum(case when p.bought = true then 1 else 0 end),
                sum(p.unitPrice * p.quantity),
                l.updatedAt)
            from ShoppingList l
            join l.client c
            left join Room r on r.list = l
            left join Product p on p.room = r
            """;
    String SUMMARY_GROUP_AND_ORDER = """
            group by l.id, l.name, l.description, c.id, c.name, l.updatedAt
            order by l.updatedAt desc
            """;

    @Query("select l from ShoppingList l join fetch l.client c where l.id = :id and c.officeId = :officeId")
    Optional<ShoppingList> findInOffice(UUID id, UUID officeId);

    /** Reads the client in the same statement, so a client deleted meanwhile cannot fail the public read. */
    @Query("select l from ShoppingList l join fetch l.client where l.shareToken = :shareToken")
    Optional<ShoppingList> findByShareToken(String shareToken);

    /**
     * Loads the list and locks its row until the transaction ends. Every room and product write takes this lock first,
     * so the writes of one list run one at a time (positions stay unique) and always lock the list before its rooms
     * and products (no deadlock between them).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select l from ShoppingList l where l.id = :id and l.client.officeId = :officeId")
    Optional<ShoppingList> findInOfficeForUpdate(UUID id, UUID officeId);

    /** The same lock as {@link #findInOfficeForUpdate}, for the list of the given room. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select l from ShoppingList l
            where l.id = (select r.list.id from Room r where r.id = :roomId) and l.client.officeId = :officeId
            """)
    Optional<ShoppingList> findByRoomInOfficeForUpdate(UUID roomId, UUID officeId);

    /** The same lock as {@link #findInOfficeForUpdate}, for the list of the given product. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select l from ShoppingList l
            where l.id = (select p.room.list.id from Product p where p.id = :productId)
                and l.client.officeId = :officeId
            """)
    Optional<ShoppingList> findByProductInOfficeForUpdate(UUID productId, UUID officeId);

    @Query(SUMMARY_SELECT + "where c.officeId = :officeId " + SUMMARY_GROUP_AND_ORDER)
    List<ListSummaryResponse> findSummaries(UUID officeId);

    @Query(SUMMARY_SELECT + "where c.officeId = :officeId and c.id = :clientId " + SUMMARY_GROUP_AND_ORDER)
    List<ListSummaryResponse> findSummariesByClient(UUID officeId, UUID clientId);

    @Query("""
            select new br.com.fluiar.selecao.dto.ClientListSummaryResponse(
                l.id, l.name, l.description, count(p.id),
                sum(case when p.bought = true then 1 else 0 end), l.updatedAt)
            from ShoppingList l join l.client c
            left join Room r on r.list = l left join Product p on p.room = r
            where c.officeId = :officeId and c.id = :clientId
            group by l.id, l.name, l.description, l.updatedAt
            order by l.updatedAt desc
            """)
    List<ClientListSummaryResponse> findClientSummaries(UUID officeId, UUID clientId);

    /**
     * Deletes in one statement and returns how many lists it deleted. When a concurrent transaction deletes the same
     * list first, this waits for it and deletes nothing, instead of failing on a row that is already gone.
     */
    @Modifying
    @Query("""
            delete from ShoppingList l
            where l.id = :id and l.client in (select c from Client c where c.officeId = :officeId)
            """)
    int deleteInOffice(UUID id, UUID officeId);
}
