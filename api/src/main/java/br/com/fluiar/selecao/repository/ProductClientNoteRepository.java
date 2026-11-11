package br.com.fluiar.selecao.repository;

import br.com.fluiar.selecao.model.ProductClientNote;
import java.util.Collection;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface ProductClientNoteRepository extends JpaRepository<ProductClientNote, UUID> {

    @Modifying
    @Query("""
            delete from ProductClientNote n where n.client.id in :clientIds
                and n.product in (select p from Product p where p.room in (select r from Room r where r.list.id = :listId))
            """)
    int deleteInList(UUID listId, Collection<UUID> clientIds);

    @Modifying
    @Query("""
            delete from ProductClientNote n where n.client.id = :clientId and n.product in
                (select p from Product p where p.id = :productId
                    and p.room in (select r from Room r where r.list.client.officeId = :officeId))
            """)
    int deleteInOffice(UUID productId, UUID clientId, UUID officeId);
}
