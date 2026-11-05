package br.com.fluiar.selecao.dto;

import br.com.fluiar.selecao.model.Product;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record ProductResponse(
        UUID id,
        UUID roomId,
        String name,
        int quantity,
        BigDecimal unitPrice,
        String notes,
        String clientNotes,
        boolean bought,
        String imageUrl,
        List<ProductLinkDto> links, ProductStoreSyncResponse storeSync) {

    public static ProductResponse of(Product product) {
        return new ProductResponse(product.getId(), product.getRoom().getId(), product.getName(),
                product.getQuantity(), product.getUnitPrice(), product.getNotes(), product.getClientNotes(), product.isBought(),
                ImageUrls.of(product.getImageId()), product.getLinks().stream().map(ProductLinkDto::of).toList(), ProductStoreSyncResponse.of(product.getStoreSync()));
    }
}
