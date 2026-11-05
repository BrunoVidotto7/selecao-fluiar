package br.com.fluiar.selecao.service;

import br.com.fluiar.selecao.dto.ListDetailResponse;
import br.com.fluiar.selecao.dto.ListSummaryResponse;
import br.com.fluiar.selecao.dto.ShareTokenResponse;
import br.com.fluiar.selecao.dto.ShoppingListRequest;
import br.com.fluiar.selecao.exception.ApiException;
import br.com.fluiar.selecao.exception.ErrorMessages;
import br.com.fluiar.selecao.model.Client;
import br.com.fluiar.selecao.model.ShoppingList;
import br.com.fluiar.selecao.repository.ClientRepository;
import br.com.fluiar.selecao.repository.ShoppingListRepository;
import br.com.fluiar.selecao.security.SecureTokens;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ShoppingListService {

    private final ClientChangeService changes;
    private final ListActivityService activity;

    private static final String CLIENT_ID_FIELD = "clientId";

    private final ShoppingListRepository listRepository;
    private final ClientRepository clientRepository;

    public ShoppingListService(ShoppingListRepository listRepository, ClientRepository clientRepository, ListActivityService activity, ClientChangeService changes) {
        this.changes = changes;
        this.activity = activity;
        this.listRepository = listRepository;
        this.clientRepository = clientRepository;
    }

    public List<ListSummaryResponse> list(UUID officeId) {
        return listRepository.findSummaries(officeId);
    }

    @Transactional(readOnly = true, isolation = org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
    public ListDetailResponse get(UUID officeId, UUID userId, UUID listId) {
        ShoppingList list = loadList(officeId, listId);
        return ListDetailResponse.of(list, changes.changesFor(list, userId));
    }

    @Transactional
    public ListDetailResponse create(UUID officeId, ShoppingListRequest request) {
        Client client = findClientForList(officeId, request.clientId());

        // Hibernate fills the timestamps only when the insert runs; the response needs them now.
        ShoppingList list = listRepository.saveAndFlush(
                new ShoppingList(client, request.name(), request.description(), SecureTokens.generate()));

        activity.record(list.getId());
        return ListDetailResponse.of(list);
    }

    @Transactional
    public ListDetailResponse update(UUID officeId, UUID listId, ShoppingListRequest request) {
        ShoppingList list = lockList(officeId, listId);
        Client client = findClientForList(officeId, request.clientId());

        list.update(request.name(), request.description(), client);
        // Hibernate refreshes updatedAt only when the update runs; the response needs the new value.
        listRepository.flush();

        activity.record(list.getId());
        return ListDetailResponse.of(list);
    }

    /**
     * Answers 404 for a list of another office, and for one already deleted. The database deletes the list's rooms,
     * products and images with it.
     */
    @Transactional
    public void delete(UUID officeId, UUID listId) {
        int deleted = listRepository.deleteInOffice(listId, officeId);
        if (deleted == 0) {
            throw ApiException.notFound();
        }
    }

    /** Gives the list a new link; the old link stops working. */
    @Transactional
    public ShareTokenResponse rotateShareToken(UUID officeId, UUID listId) {
        ShoppingList list = lockList(officeId, listId);
        list.replaceShareToken(SecureTokens.generate());
        activity.record(list.getId());

        return new ShareTokenResponse(list.getShareToken());
    }

    private ShoppingList loadList(UUID officeId, UUID listId) {
        return listRepository.findInOffice(listId, officeId).orElseThrow(ApiException::notFound);
    }

    /**
     * Loads the list to change its fields, locking its row. Hibernate writes every column, so a change that loaded the
     * list before a concurrent change committed would undo it (for example, bring back a link that was just replaced).
     */
    private ShoppingList lockList(UUID officeId, UUID listId) {
        return listRepository.findInOfficeForUpdate(listId, officeId).orElseThrow(ApiException::notFound);
    }

    /** The client id comes in the request body, so a client outside the office is a field error (400), not a 404. */
    private Client findClientForList(UUID officeId, UUID clientId) {
        return clientRepository.findByIdAndOfficeId(clientId, officeId)
                .orElseThrow(() -> ApiException.invalidField(CLIENT_ID_FIELD, ErrorMessages.LIST_CLIENT_REQUIRED));
    }
}
