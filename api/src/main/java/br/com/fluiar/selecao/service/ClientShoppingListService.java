package br.com.fluiar.selecao.service;

import br.com.fluiar.selecao.dto.*;
import br.com.fluiar.selecao.dto.ClientListDetailResponse.ClientProduct;
import br.com.fluiar.selecao.exception.ApiException;
import br.com.fluiar.selecao.model.Product;
import br.com.fluiar.selecao.model.ShoppingList;
import br.com.fluiar.selecao.model.UserRole;
import br.com.fluiar.selecao.repository.*;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ClientShoppingListService {

    private final ListActivityService activity;
    private final ShoppingListRepository lists;
    private final ProductRepository products;
    private final OfficeRepository offices;
    private final UserRepository users;

    public ClientShoppingListService(ShoppingListRepository lists, ProductRepository products,
            OfficeRepository offices, UserRepository users, ListActivityService activity) {
        this.activity = activity;
        this.lists = lists;
        this.products = products;
        this.offices = offices;
        this.users = users;
    }

    public List<ClientListSummaryResponse> list(UUID officeId, UUID clientId) {
        return lists.findClientSummaries(officeId, clientId);
    }

    public ClientListDetailResponse get(UUID officeId, UUID clientId, UUID listId) {
        ShoppingList list = requireOwner(lists.findInOffice(listId, officeId).orElseThrow(ApiException::notFound), clientId);
        var office = offices.findById(officeId).orElseThrow(ApiException::notFound);
        var admins = users.findByOfficeIdAndRoleOrderByNameAsc(officeId, UserRole.ADMIN);
        return ClientListDetailResponse.of(list, office, admins);
    }

    @Transactional
    public ClientProduct setPurchase(UUID officeId, UUID clientId, UUID listId, UUID productId, ProductPurchaseRequest request) {
        ShoppingList list = lockOwnedList(officeId, clientId, listId);
        Product product = productInList(officeId, listId, productId);
        product.markBought(request.bought());
        list.touch();
        activity.record(list.getId());
        return ClientProduct.of(product);
    }

    @Transactional
    public ClientProduct setClientNotes(UUID officeId, UUID clientId, UUID listId, UUID productId, ProductClientNotesRequest request) {
        ShoppingList list = lockOwnedList(officeId, clientId, listId);
        Product product = productInList(officeId, listId, productId);
        product.changeClientNotes(request.clientNotes());
        list.touch();
        activity.record(list.getId());
        return ClientProduct.of(product);
    }

    private ShoppingList lockOwnedList(UUID officeId, UUID clientId, UUID listId) {
        ShoppingList list = lists.findInOfficeForUpdate(listId, officeId).orElseThrow(ApiException::notFound);
        return requireOwner(list, clientId);
    }

    private static ShoppingList requireOwner(ShoppingList list, UUID clientId) {
        if (!list.getClient().getId().equals(clientId)) {
            throw ApiException.notFound();
        }
        return list;
    }

    private Product productInList(UUID officeId, UUID listId, UUID productId) {
        return products.findInOfficeForUpdate(productId, officeId)
                .filter(product -> product.getRoom().getList().getId().equals(listId)).orElseThrow(ApiException::notFound);
    }
}
