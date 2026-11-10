package br.com.fluiar.selecao.dto;
import br.com.fluiar.selecao.model.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
public record ClientListDetailResponse(UUID id, String name, String description, Instant updatedAt,
        Stats stats, List<ClientRoom> rooms, Signature signature) {
    public static ClientListDetailResponse of(ShoppingList list, Office office, List<User> admins) {
        var products = list.getRooms().stream().flatMap(room -> room.getProducts().stream()).toList();
        int bought = (int) products.stream().filter(Product::isBought).count();
        var rooms = list.getRooms().stream().map(room -> new ClientRoom(room.getId(), room.getName(), room.getPosition(),
                room.getProducts().stream().map(ClientProduct::of).toList())).toList();
        return new ClientListDetailResponse(list.getId(), list.getName(), list.getDescription(), list.getUpdatedAt(),
                new Stats(products.size(), bought, products.size() - bought), rooms,
                new Signature(office.getName(), admins.stream().map(User::getName).toList()));
    }

    public record Stats(int totalProducts, int boughtProducts, int pendingProducts) { }
    public record ClientRoom(UUID id, String name, int position, List<ClientProduct> products) { }
    public record ClientProduct(UUID id, String name, ProductCategoryRef category, BigDecimal quantity,
            ProductUnit unit, boolean bought,
            String imageUrl, String clientNotes, List<ProductLinkDto> links) {
        public static ClientProduct of(Product product) {
            return new ClientProduct(product.getId(), product.getName(), ProductCategoryRef.of(product.getCategory()),
                    product.getQuantity(), product.getUnit(), product.isBought(),
                    ImageUrls.of(product.getImageId()), product.getClientNotes(), product.getLinks().stream().map(ProductLinkDto::of).toList());
        }
    }
    public record Signature(String officeName, List<String> architectNames) { }
}
