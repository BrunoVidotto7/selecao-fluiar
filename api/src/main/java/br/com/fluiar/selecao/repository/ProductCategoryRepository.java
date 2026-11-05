package br.com.fluiar.selecao.repository;

import br.com.fluiar.selecao.dto.ProductCategoryResponse;
import br.com.fluiar.selecao.model.ProductCategory;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface ProductCategoryRepository extends JpaRepository<ProductCategory, UUID> {

    Optional<ProductCategory> findByIdAndOfficeId(UUID id, UUID officeId);

    Optional<ProductCategory> findByIdAndOfficeIdAndDeletedAtIsNull(UUID id, UUID officeId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from ProductCategory c where c.id = :id and c.officeId = :officeId and c.deletedAt is null")
    Optional<ProductCategory> findActiveForUpdate(UUID id, UUID officeId);

    Optional<ProductCategory> findByOfficeIdAndNameKey(UUID officeId, String nameKey);

    /** The service sorts the result, so the query has no {@code order by}. */
    @Query("""
            select new br.com.fluiar.selecao.dto.ProductCategoryResponse(c.id, c.name, count(p.id))
            from ProductCategory c
            left join Product p on p.category = c
            where c.officeId = :officeId and c.deletedAt is null
            group by c.id, c.name
            """)
    List<ProductCategoryResponse> findActiveSummaries(UUID officeId);
}
