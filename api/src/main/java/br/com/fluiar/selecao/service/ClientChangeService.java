package br.com.fluiar.selecao.service;

import br.com.fluiar.selecao.dto.ClientChangesResponse;
import br.com.fluiar.selecao.dto.ClientChangePageResponse;
import br.com.fluiar.selecao.exception.ApiException;
import br.com.fluiar.selecao.exception.ErrorMessages;
import br.com.fluiar.selecao.repository.ShoppingListRepository;
import br.com.fluiar.selecao.dto.ClientChangesResponse.*;
import br.com.fluiar.selecao.model.ShoppingList;
import br.com.fluiar.selecao.repository.ClientChangeRepository;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ClientChangeService {
    private static final int PAGE_SIZE = 20;
    private static final String REVISION_FIELD = "observedRevision";
    private final ShoppingListRepository lists;
    private final ClientChangeRepository changes;

    public ClientChangeService(ClientChangeRepository changes, ShoppingListRepository lists) {
        this.changes = changes;
        this.lists = lists;
    }

    @Transactional
    public void markRead(UUID officeId, UUID userId, UUID listId, long observedRevision) {
        ShoppingList list = lists.findInOfficeForUpdate(listId, officeId).orElseThrow(ApiException::notFound);
        if (observedRevision > list.getClientChangeRevision()) {
            throw ApiException.invalidField(REVISION_FIELD, ErrorMessages.CLIENT_CHANGE_REVISION_INVALID);
        }
        changes.advanceRead(userId, listId, observedRevision);
    }

    @Transactional(readOnly = true, isolation = org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
    public ClientChangePageResponse list(UUID officeId, UUID userId, int page) {
        return new ClientChangePageResponse(changes.pendingListCount(officeId, userId), page, PAGE_SIZE,
                changes.summaries(officeId, userId, page, PAGE_SIZE));
    }

    public ClientChangesResponse changesFor(ShoppingList list, UUID userId) {
        long seen = changes.seenRevision(userId, list.getId());
        var products = list.getRooms().stream().flatMap(room -> room.getProducts().stream())
                .map(product -> {
                    var latest = product.getClientChanges();
                    var purchase = latest.getPurchaseRevision() > seen
                            ? new PurchaseChange(latest.getPurchaseRevision(), latest.getPurchaseChangedAt(), latest.getPurchaseValue()) : null;
                    var notes = latest.getNotesRevision() > seen
                            ? new NotesChange(latest.getNotesRevision(), latest.getNotesChangedAt(), latest.getNotesValue()) : null;
                    return new ChangedProduct(product.getId(), purchase, notes);
                }).filter(product -> product.purchase() != null || product.notes() != null).toList();
        return new ClientChangesResponse(list.getClientChangeRevision(), products);
    }
}
