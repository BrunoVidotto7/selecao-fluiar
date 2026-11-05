package br.com.fluiar.selecao.service;

import br.com.fluiar.selecao.dto.ProductLinkDto;
import br.com.fluiar.selecao.dto.ProductClientNotesRequest;
import br.com.fluiar.selecao.dto.ProductRequest;
import br.com.fluiar.selecao.dto.ProductResponse;
import br.com.fluiar.selecao.dto.ProductStatusRequest;
import br.com.fluiar.selecao.exception.ApiException;
import br.com.fluiar.selecao.exception.ErrorMessages;
import br.com.fluiar.selecao.model.Product;
import br.com.fluiar.selecao.model.ProductCategory;
import br.com.fluiar.selecao.model.ProductLink;
import br.com.fluiar.selecao.model.Room;
import br.com.fluiar.selecao.model.ShoppingList;
import br.com.fluiar.selecao.repository.ProductCategoryRepository;
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

    private final ListActivityService activity;
    private final StoreBindingService bindings;
    @jakarta.persistence.PersistenceContext
    private jakarta.persistence.EntityManager entityManager;

    private static final String ROOM_ID_FIELD = "roomId";
    private static final String CATEGORY_ID_FIELD = "categoryId";

    private final ProductRepository productRepository;
    private final RoomRepository roomRepository;
    private final ProductCategoryRepository categoryRepository;
    private final ShoppingListRepository listRepository;

    public ProductService(
            ProductRepository productRepository, RoomRepository roomRepository, ShoppingListRepository listRepository, ListActivityService activity, StoreBindingService bindings,
            ProductCategoryRepository categoryRepository) {
        this.categoryRepository = categoryRepository;
        this.bindings = bindings;
        this.activity = activity;
        this.productRepository = productRepository;
        this.roomRepository = roomRepository;
        this.listRepository = listRepository;
    }

    @Transactional
    public ProductResponse create(UUID officeId, UUID listId, ProductRequest request) {
        listRepository.findInOffice(listId, officeId).orElseThrow(ApiException::notFound);
        var confirmation = bindings.confirm(request);
        entityManager.clear();
        ShoppingList list = lockList(officeId, listId);
        Room room = roomOfList(request.roomId(), list);

        Product product = productRepository.save(new Product(room, categoryFor(officeId, request.categoryId(), null), request.name(), request.quantity(),
                request.unitPrice(), request.notes(), request.bought(), linksOf(request)));
        bindings.apply(product, request, confirmation, false);
        list.touch();
        activity.record(list.getId());

        return ProductResponse.of(product);
    }

    public ProductResponse get(UUID officeId, UUID productId) {
        return ProductResponse.of(loadProduct(officeId, productId));
    }

    /** The product only moves between rooms of its own list. */
    @Transactional
    public ProductResponse update(UUID officeId, UUID productId, ProductRequest request) {
        loadProduct(officeId, productId);
        var confirmation = bindings.confirm(request);
        entityManager.clear();
        ShoppingList list = lockListOfProduct(officeId, productId);
        Product product = productRepository.findInOfficeForUpdate(productId, officeId).orElseThrow(ApiException::notFound);
        Room room = roomOfList(request.roomId(), list);
        boolean manualChange = !java.util.Objects.equals(product.getName(), request.name())
                || !samePrice(product.getUnitPrice(), request.unitPrice());
        bindings.apply(product, request, confirmation, manualChange);

        product.update(room, categoryFor(officeId, request.categoryId(), product), request.name(), request.quantity(), request.unitPrice(), request.notes(),
                request.bought(), linksOf(request));
        list.touch();
        activity.record(list.getId());

        return ProductResponse.of(product);
    }

    @Transactional
    public ProductResponse updateStatus(UUID officeId, UUID productId, ProductStatusRequest request) {
        ShoppingList list = lockListOfProduct(officeId, productId);
        Product product = productRepository.findInOfficeForUpdate(productId, officeId).orElseThrow(ApiException::notFound);

        if (request.bought() != null) {
            product.markBought(request.bought());
        }
        if (request.quantity() != null) {
            product.changeQuantity(request.quantity());
        }
        list.touch();
        activity.record(list.getId());

        return ProductResponse.of(product);
    }

    @Transactional
    public ProductResponse updateClientNotes(UUID officeId, UUID productId, ProductClientNotesRequest request) {
        ShoppingList list = lockListOfProduct(officeId, productId);
        Product product = productRepository.findInOfficeForUpdate(productId, officeId).orElseThrow(ApiException::notFound);
        product.changeClientNotes(request.clientNotes());
        list.touch();
        activity.record(list.getId());
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
        activity.record(list.getId());
    }

    private static boolean samePrice(java.math.BigDecimal first, java.math.BigDecimal second) {
        return first == null ? second == null : second != null && first.compareTo(second) == 0;
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

    /** Keeping the current category is always allowed, even deleted; choosing another needs an active one of the office. */
    private ProductCategory categoryFor(UUID officeId, UUID categoryId, Product current) {
        if (current != null && current.getCategory().getId().equals(categoryId)) {
            return current.getCategory();
        }
        return categoryRepository.findByIdAndOfficeIdAndDeletedAtIsNull(categoryId, officeId)
                .orElseThrow(() -> ApiException.invalidField(CATEGORY_ID_FIELD, ErrorMessages.CATEGORY_NOT_IN_OFFICE));
    }

    private static List<ProductLink> linksOf(ProductRequest request) {
        return request.links().stream().map(ProductLinkDto::toModel).toList();
    }
}
