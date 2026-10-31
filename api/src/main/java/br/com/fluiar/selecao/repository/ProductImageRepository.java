package br.com.fluiar.selecao.repository;

import br.com.fluiar.selecao.model.ProductImage;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface ProductImageRepository extends JpaRepository<ProductImage, UUID> {

    /**
     * The bulk delete runs right away; with {@code delete(entity)}, Hibernate would insert the new image before
     * deleting the old one at flush time and violate {@code uk_product_images_product}.
     */
    @Modifying
    @Query("delete from ProductImage i where i.productId = :productId")
    void deleteByProductId(UUID productId);
}
