package br.com.fluiar.selecao.dto;

import br.com.fluiar.selecao.model.Product;
import br.com.fluiar.selecao.model.ProductUnit;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record ProductResponse(
        UUID id,
        UUID roomId,
        ProductCategoryRef category,
        String name,
        BigDecimal quantity,
        ProductUnit unit,
        BigDecimal unitPrice,
        String notes,
        List<ClientNoteResponse> clientNotes,
        boolean bought,
        String imageUrl,
        List<ProductLinkDto> links, ProductStoreSyncResponse storeSync) {

    public static ProductResponse of(Product product) {
        return new ProductResponse(product.getId(), product.getRoom().getId(),
                ProductCategoryRef.of(product.getCategory()), product.getName(),
                product.getQuantity(), product.getUnit(), product.getUnitPrice(), product.getNotes(), ClientNoteResponse.of(product), product.isBought(),
                ImageUrls.of(product.getImageId()), product.getLinks().stream().map(ProductLinkDto::of).toList(), ProductStoreSyncResponse.of(product.getStoreSync()));
    }
}
