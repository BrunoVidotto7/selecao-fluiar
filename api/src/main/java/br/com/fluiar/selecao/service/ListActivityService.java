package br.com.fluiar.selecao.service;

import br.com.fluiar.selecao.exception.ApiException;
import br.com.fluiar.selecao.model.ShoppingList;
import br.com.fluiar.selecao.repository.ListActivityRepository;
import br.com.fluiar.selecao.repository.ShoppingListRepository;
import java.time.Clock;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ListActivityService {
    private final ListActivityRepository activities;
    private final ShoppingListRepository lists;
    private final Clock clock;
    public ListActivityService(ListActivityRepository activities, ShoppingListRepository lists, Clock clock) {
        this.activities = activities;
        this.lists = lists;
        this.clock = clock;
    }

    @Transactional
    public void open(UUID officeId, UUID clientId, UUID listId) {
        var list = lists.findInOfficeForUpdate(listId, officeId).orElseThrow(ApiException::notFound);
        if (clientId != null && !list.getClient().getId().equals(clientId)) throw ApiException.notFound();
        record(listId);
    }

    @Transactional
    public void record(UUID listId) { activities.record(listId, clock.instant()); }

    /** A person changed the list's rooms or products: the list gets a new updatedAt and the change counts as activity. */
    @Transactional
    public void recordHumanChange(ShoppingList list) {
        list.touch();
        record(list.getId());
    }
}
