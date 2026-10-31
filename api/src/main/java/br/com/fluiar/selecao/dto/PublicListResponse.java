package br.com.fluiar.selecao.dto;

import br.com.fluiar.selecao.model.Office;
import br.com.fluiar.selecao.model.Product;
import br.com.fluiar.selecao.model.Room;
import br.com.fluiar.selecao.model.ShoppingList;
import br.com.fluiar.selecao.model.User;
import java.util.List;

/** What the client sees through the shared link: no ids, prices or internal notes. */
public record PublicListResponse(String name, String description, List<PublicRoom> rooms, Signature signature) {

    public record PublicRoom(String name, List<PublicProduct> products) {

        public static PublicRoom of(Room room) {
            return new PublicRoom(room.getName(), room.getProducts().stream().map(PublicProduct::of).toList());
        }
    }

    public record PublicProduct(String name, int quantity, boolean bought, List<ProductLinkDto> links) {

        public static PublicProduct of(Product product) {
            return new PublicProduct(product.getName(), product.getQuantity(), product.isBought(),
                    product.getLinks().stream().map(ProductLinkDto::of).toList());
        }
    }

    public record Signature(String officeName, List<String> architectNames) {
    }

    /**
     * Omits the rooms without products, like the client view of the frontend. Loads the rooms, products and links
     * lazily; {@code default_batch_fetch_size} keeps the number of queries from growing with the list.
     */
    public static PublicListResponse of(ShoppingList list, Office office, List<User> members) {
        List<PublicRoom> rooms = list.getRooms().stream()
                .filter(room -> !room.getProducts().isEmpty())
                .map(PublicRoom::of)
                .toList();
        List<String> architectNames = members.stream().map(User::getName).toList();

        return new PublicListResponse(list.getName(), list.getDescription(), rooms,
                new Signature(office.getName(), architectNames));
    }
}
