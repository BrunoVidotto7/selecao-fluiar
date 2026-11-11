package br.com.fluiar.selecao.service;

import br.com.fluiar.selecao.dto.*;
import br.com.fluiar.selecao.dto.ClientListDetailResponse.ClientProduct;
import br.com.fluiar.selecao.exception.ApiException;
import br.com.fluiar.selecao.exception.ErrorMessages;
import br.com.fluiar.selecao.model.ListRole;
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

    private final java.time.Clock clock;
    private final ListActivityService activity;
    private final ShoppingListRepository lists;
    private final ProductRepository products;
    private final ProductClientNoteRepository noteRepository;
    private final OfficeRepository offices;
    private final UserRepository users;

    public ClientShoppingListService(ShoppingListRepository lists, ProductRepository products,
            ProductClientNoteRepository noteRepository, OfficeRepository offices, UserRepository users, ListActivityService activity, java.time.Clock clock) {
        this.clock = clock;
        this.activity = activity;
        this.lists = lists;
        this.products = products;
        this.noteRepository = noteRepository;
        this.offices = offices;
        this.users = users;
    }

    public List<ClientListSummaryResponse> list(UUID officeId, UUID clientId) {
        return lists.findClientSummaries(officeId, clientId);
    }

    public ClientListDetailResponse get(UUID officeId, UUID clientId, UUID listId) {
        ShoppingList list = lists.findInOffice(listId, officeId).orElseThrow(ApiException::notFound);
        list.roleOf(clientId).orElseThrow(ApiException::notFound);
        var office = offices.findById(officeId).orElseThrow(ApiException::notFound);
        var admins = users.findByOfficeIdAndRoleOrderByNameAsc(officeId, UserRole.ADMIN);
        return ClientListDetailResponse.of(list, office, admins, clientId);
    }

    @Transactional
    public ClientProduct setPurchase(UUID officeId, UUID clientId, UUID listId, UUID productId, ProductPurchaseRequest request) {
        ShoppingList list = lockEditableList(officeId, clientId, listId);
        Product product = productInList(officeId, listId, productId);
        if (product.isBought() != request.bought()) {
            product.recordClientPurchase(list.nextClientChangeRevision(), clock.instant(), request.bought(), list.profileOf(clientId).orElseThrow(ApiException::notFound));
        }
        product.markBought(request.bought());
        activity.recordHumanChange(list);
        return ClientProduct.of(product);
    }

    @Transactional
    public ClientProduct setClientNotes(UUID officeId, UUID clientId, UUID listId, UUID productId, ProductClientNotesRequest request) {
        ShoppingList list = lockEditableList(officeId, clientId, listId);
        Product product = productInList(officeId, listId, productId);
        var note = product.clientNoteOf(clientId).orElse(null);
        String current = note == null ? null : note.getText();
        if (!java.util.Objects.equals(current, request.clientNotes())) {
            if (note == null) {
                note = noteRepository.save(product.addClientNote(list.profileOf(clientId).orElseThrow(ApiException::notFound)));
            }
            note.change(request.clientNotes(), list.nextClientChangeRevision(), clock.instant());
        }
        activity.recordHumanChange(list);
        // Hibernate fills the note's updatedAt only when the insert or update runs; the response needs it now.
        noteRepository.flush();
        return ClientProduct.of(product);
    }

    private ShoppingList lockEditableList(UUID officeId, UUID clientId, UUID listId) {
        ShoppingList list = lists.findInOfficeForUpdate(listId, officeId).orElseThrow(ApiException::notFound);
        if (list.roleOf(clientId).orElseThrow(ApiException::notFound) == ListRole.READER) {
            throw ApiException.forbidden(ErrorMessages.LIST_READ_ONLY);
        }
        return list;
    }

    private Product productInList(UUID officeId, UUID listId, UUID productId) {
        return products.findInOfficeForUpdate(productId, officeId)
                .filter(product -> product.getRoom().getList().getId().equals(listId)).orElseThrow(ApiException::notFound);
    }
}
