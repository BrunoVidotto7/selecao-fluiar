package br.com.fluiar.selecao.service;

import br.com.fluiar.selecao.dto.ProductLinkDto;
import br.com.fluiar.selecao.dto.ProductClientNotesRequest;
import br.com.fluiar.selecao.dto.ProductRequest;
import br.com.fluiar.selecao.dto.ProductResponse;
import br.com.fluiar.selecao.dto.ProductStatusRequest;
import br.com.fluiar.selecao.dto.StoreSyncRequest;
import br.com.fluiar.selecao.exception.ApiException;
import java.math.BigDecimal;
import br.com.fluiar.selecao.model.ProductUnit;
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
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

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
    private final TransactionTemplate transactions;

    private static final String ROOM_ID_FIELD = "roomId";
    private static final String CATEGORY_ID_FIELD = "categoryId";

    private final ProductRepository productRepository;
    private final RoomRepository roomRepository;
    private final ProductCategoryRepository categoryRepository;
    private final ShoppingListRepository listRepository;

    public ProductService(
            ProductRepository productRepository, RoomRepository roomRepository, ShoppingListRepository listRepository, ListActivityService activity, StoreBindingService bindings,
            ProductCategoryRepository categoryRepository, TransactionTemplate transactions) {
        this.categoryRepository = categoryRepository;
        this.transactions = transactions;
        this.bindings = bindings;
        this.activity = activity;
        this.productRepository = productRepository;
        this.roomRepository = roomRepository;
        this.listRepository = listRepository;
    }

    /**
     * Product writes that bind a store page fetch it first, outside any transaction, because the fetch can take
     * seconds and must not hold a pooled connection. A request for another office still answers 404 before the fetch.
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public ProductResponse create(UUID officeId, UUID listId, ProductRequest request) {
        requireValidQuantity(request.unit(), request.quantity());
        transactions.executeWithoutResult(status -> requireListInOffice(officeId, listId));
        var confirmation = bindings.confirm(request);
        return transactions.execute(status -> {
            ShoppingList list = lockList(officeId, listId);
            Room room = roomOfList(request.roomId(), list);

            Product product = productRepository.save(new Product(room, categoryFor(officeId, request.categoryId(), null), request.name(), request.quantity(), request.unit(),
                    request.unitPrice(), request.notes(), Boolean.TRUE.equals(request.bought()), linksOf(request)));
            bindings.apply(product, request, confirmation);
            activity.recordHumanChange(list);

            return ProductResponse.of(product);
        });
    }

    public ProductResponse get(UUID officeId, UUID productId) {
        return ProductResponse.of(loadProduct(officeId, productId));
    }

    /** The product only moves between rooms of its own list. The store page is fetched as in {@link #create}. */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public ProductResponse update(UUID officeId, UUID productId, ProductRequest request) {
        requireValidQuantity(request.unit(), request.quantity());
        transactions.executeWithoutResult(status -> requireProductInOffice(officeId, productId));
        var confirmation = bindings.confirm(request);
        return transactions.execute(status -> {
            ShoppingList list = lockListOfProduct(officeId, productId);
            Product product = productRepository.findInOfficeForUpdate(productId, officeId).orElseThrow(ApiException::notFound);
            Room room = roomOfList(request.roomId(), list);
            bindings.apply(product, request, confirmation);
            boolean bought = request.bought() == null ? product.isBought() : request.bought();
            boolean storeOwnsValues = request.storeSync() instanceof StoreSyncRequest.Keep
                    && product.getStoreSync() != null && product.getStoreSync().isEnabled();
            String name = storeOwnsValues ? product.getName() : request.name();
            BigDecimal unitPrice = storeOwnsValues ? product.getUnitPrice() : request.unitPrice();

            product.update(room, categoryFor(officeId, request.categoryId(), product), name, request.quantity(), request.unit(), unitPrice, request.notes(),
                    bought, linksOf(request));
            activity.recordHumanChange(list);

            return ProductResponse.of(product);
        });
    }

    private static void requireValidQuantity(ProductUnit unit, BigDecimal quantity) {
        if (!unit.accepts(quantity)) {
            throw ApiException.invalidField("quantity", unit.invalidQuantityMessage());
        }
    }

    @Transactional
    public ProductResponse updateStatus(UUID officeId, UUID productId, ProductStatusRequest request) {
        ShoppingList list = lockListOfProduct(officeId, productId);
        Product product = productRepository.findInOfficeForUpdate(productId, officeId).orElseThrow(ApiException::notFound);

        if (request.bought() != null) {
            product.markBought(request.bought());
        }
        if (request.quantity() != null) {
            requireValidQuantity(product.getUnit(), request.quantity());
            product.changeQuantity(request.quantity());
        }
        activity.recordHumanChange(list);

        return ProductResponse.of(product);
    }

    @Transactional
    public ProductResponse updateClientNotes(UUID officeId, UUID productId, ProductClientNotesRequest request) {
        ShoppingList list = lockListOfProduct(officeId, productId);
        Product product = productRepository.findInOfficeForUpdate(productId, officeId).orElseThrow(ApiException::notFound);
        product.changeClientNotes(request.clientNotes());
        activity.recordHumanChange(list);
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

        activity.recordHumanChange(list);
    }

    private ShoppingList lockList(UUID officeId, UUID listId) {
        return listRepository.findInOfficeForUpdate(listId, officeId).orElseThrow(ApiException::notFound);
    }

    private ShoppingList lockListOfProduct(UUID officeId, UUID productId) {
        return listRepository.findByProductInOfficeForUpdate(productId, officeId).orElseThrow(ApiException::notFound);
    }

    private void requireListInOffice(UUID officeId, UUID listId) {
        listRepository.findInOffice(listId, officeId).orElseThrow(ApiException::notFound);
    }

    private void requireProductInOffice(UUID officeId, UUID productId) {
        loadProduct(officeId, productId);
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
