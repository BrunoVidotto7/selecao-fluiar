package br.com.fluiar.selecao.repository;

import br.com.fluiar.selecao.model.Product;
import br.com.fluiar.selecao.model.ShoppingList;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface ProductRepository extends JpaRepository<Product, UUID> {

    @Query("""
            select p from Product p
            join fetch p.room r
            join fetch r.list l
            join fetch l.client c
            where p.id = :id and c.officeId = :officeId
            """)
    Optional<Product> findInOffice(UUID id, UUID officeId);

    /**
     * Deletes in one statement and returns how many products it deleted: 0 when the product is already gone, for
     * example because a concurrent request deleted it first.
     */
    @Modifying
    @Query("delete from Product p where p.id = :id and p.room in (select r from Room r where r.list = :list)")
    int deleteInList(UUID id, ShoppingList list);
}
