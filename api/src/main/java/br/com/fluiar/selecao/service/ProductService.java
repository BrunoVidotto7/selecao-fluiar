package br.com.fluiar.selecao.service;

import br.com.fluiar.selecao.dto.ProductLinkDto;
import br.com.fluiar.selecao.dto.ProductRequest;
import br.com.fluiar.selecao.dto.ProductResponse;
import br.com.fluiar.selecao.dto.ProductStatusRequest;
import br.com.fluiar.selecao.exception.ApiException;
import br.com.fluiar.selecao.exception.ErrorMessages;
import br.com.fluiar.selecao.model.Product;
import br.com.fluiar.selecao.model.ProductLink;
import br.com.fluiar.selecao.model.Room;
import br.com.fluiar.selecao.model.ShoppingList;
import br.com.fluiar.selecao.repository.ProductRepository;
import br.com.fluiar.selecao.repository.RoomRepository;
import br.com.fluiar.selecao.repository.ShoppingListRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Every write first locks the product's list, like the room writes, and only then reads the rooms and products. So it
 * never writes back a product read before another write committed (Hibernate writes every column), never uses a room
 * that a concurrent delete removed, and takes its locks in the same order as the room writes (no deadlock).
 */
@Service
@Transactional(readOnly = true)
public class ProductService {

    private static final String ROOM_ID_FIELD = "roomId";

    private final ProductRepository productRepository;
    private final RoomRepository roomRepository;
    private final ShoppingListRepository listRepository;

    public ProductService(
            ProductRepository productRepository, RoomRepository roomRepository, ShoppingListRepository listRepository) {
        this.productRepository = productRepository;
        this.roomRepository = roomRepository;
        this.listRepository = listRepository;
    }

    @Transactional
    public ProductResponse create(UUID officeId, UUID listId, ProductRequest request) {
        ShoppingList list = lockList(officeId, listId);
        Room room = roomOfList(request.roomId(), list);

        Product product = productRepository.save(new Product(room, request.name(), request.quantity(),
                request.unitPrice(), request.notes(), request.bought(), linksOf(request)));
        list.touch();

        return ProductResponse.of(product);
    }

    public ProductResponse get(UUID officeId, UUID productId) {
        return ProductResponse.of(loadProduct(officeId, productId));
    }

    /** The product only moves between rooms of its own list. */
    @Transactional
    public ProductResponse update(UUID officeId, UUID productId, ProductRequest request) {
        ShoppingList list = lockListOfProduct(officeId, productId);
        Product product = loadProduct(officeId, productId);
        Room room = roomOfList(request.roomId(), list);

        product.update(room, request.name(), request.quantity(), request.unitPrice(), request.notes(),
                request.bought(), linksOf(request));
        list.touch();

        return ProductResponse.of(product);
    }

    @Transactional
    public ProductResponse updateStatus(UUID officeId, UUID productId, ProductStatusRequest request) {
        ShoppingList list = lockListOfProduct(officeId, productId);
        Product product = loadProduct(officeId, productId);

        if (request.bought() != null) {
            product.markBought(request.bought());
        }
        if (request.quantity() != null) {
            product.changeQuantity(request.quantity());
        }
        list.touch();

        return ProductResponse.of(product);
    }

    /** The database deletes the product's links and image with it. */
    @Transactional
    public void delete(UUID officeId, UUID productId) {
        ShoppingList list = lockListOfProduct(officeId, productId);

        int deleted = productRepository.deleteInList(productId, list);
        if (deleted == 0) {
            throw ApiException.notFound();
        }

        list.touch();
    }

    private ShoppingList lockList(UUID officeId, UUID listId) {
        return listRepository.findInOfficeForUpdate(listId, officeId).orElseThrow(ApiException::notFound);
    }

    private ShoppingList lockListOfProduct(UUID officeId, UUID productId) {
        return listRepository.findByProductInOfficeForUpdate(productId, officeId).orElseThrow(ApiException::notFound);
    }

    private Product loadProduct(UUID officeId, UUID productId) {
        return productRepository.findInOffice(productId, officeId).orElseThrow(ApiException::notFound);
    }

    /** The room id comes in the request body, so a room outside the list is a field error (400), not a 404. */
    private Room roomOfList(UUID roomId, ShoppingList list) {
        return roomRepository.findById(roomId)
                .filter(room -> room.getList().getId().equals(list.getId()))
                .orElseThrow(() -> ApiException.invalidField(ROOM_ID_FIELD, ErrorMessages.ROOM_NOT_IN_LIST));
    }

    private static List<ProductLink> linksOf(ProductRequest request) {
        return request.links().stream().map(ProductLinkDto::toModel).toList();
    }
}
