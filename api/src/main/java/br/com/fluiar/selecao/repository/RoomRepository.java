package br.com.fluiar.selecao.repository;

import br.com.fluiar.selecao.model.Room;
import br.com.fluiar.selecao.model.ShoppingList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface RoomRepository extends JpaRepository<Room, UUID> {

    @Query("""
            select r from Room r
            join fetch r.list l
            join fetch l.client c
            where r.id = :id and c.officeId = :officeId
            """)
    Optional<Room> findInOffice(UUID id, UUID officeId);

    @Query("select coalesce(max(r.position), -1) from Room r where r.list = :list")
    int findMaxPosition(ShoppingList list);

    boolean existsByListAndNameIgnoreCase(ShoppingList list, String name);

    boolean existsByListAndNameIgnoreCaseAndIdNot(ShoppingList list, String name, UUID id);

    List<Room> findByListOrderByPosition(ShoppingList list);

    /**
     * Deletes in one statement and returns how many rooms it deleted: 0 when the room is already gone, for example
     * because a concurrent request deleted it first.
     */
    @Modifying
    @Query("delete from Room r where r.id = :id and r.list = :list")
    int deleteInList(UUID id, ShoppingList list);
}
