package br.com.fluiar.selecao.service;

import br.com.fluiar.selecao.dto.ListDetailResponse;
import br.com.fluiar.selecao.dto.ListMemberRequest;
import br.com.fluiar.selecao.dto.ListSummaryResponse;
import br.com.fluiar.selecao.dto.ShareTokenResponse;
import br.com.fluiar.selecao.dto.ShoppingListRequest;
import br.com.fluiar.selecao.exception.ApiException;
import br.com.fluiar.selecao.exception.ErrorMessages;
import br.com.fluiar.selecao.model.Client;
import br.com.fluiar.selecao.model.ListRole;
import br.com.fluiar.selecao.model.ShoppingList;
import br.com.fluiar.selecao.repository.ClientRepository;
import br.com.fluiar.selecao.repository.ProductClientNoteRepository;
import br.com.fluiar.selecao.repository.ShoppingListRepository;
import br.com.fluiar.selecao.security.SecureTokens;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ShoppingListService {

    private static final Logger log = LoggerFactory.getLogger(ShoppingListService.class);

    private final ClientChangeService changes;
    private final ListActivityService activity;

    private static final String CLIENT_ID_FIELD = "clientId";
    private static final String MEMBERS_FIELD = "members";

    private final ShoppingListRepository listRepository;
    private final ClientRepository clientRepository;
    private final ProductClientNoteRepository noteRepository;

    public ShoppingListService(ShoppingListRepository listRepository, ClientRepository clientRepository,
            ProductClientNoteRepository noteRepository, ListActivityService activity, ClientChangeService changes) {
        this.noteRepository = noteRepository;
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
        Map<Client, ListRole> members = findMembers(officeId, request, client);

        ShoppingList newList = new ShoppingList(client, request.name(), request.description(), SecureTokens.generate(),
                request.projectInfo());
        newList.replaceMembers(members);
        // Hibernate fills the timestamps only when the insert runs; the response needs them now.
        ShoppingList list = listRepository.saveAndFlush(newList);

        activity.record(list.getId());
        return ListDetailResponse.of(list);
    }

    @Transactional
    public ListDetailResponse update(UUID officeId, UUID listId, ShoppingListRequest request) {
        ShoppingList list = lockList(officeId, listId);
        Client previousPrincipal = list.getClient();
        Client client = findClientForList(officeId, request.clientId());
        Map<Client, ListRole> members = findMembers(officeId, request, client);

        Set<UUID> previousMembers = memberIds(list);

        list.update(request.name(), request.description(), client, request.projectInfo());
        Set<UUID> removedMembers = list.replaceMembers(members);
        logMembersChange(officeId, list, previousMembers, removedMembers, previousPrincipal);
        deleteNotesOfProfilesWithoutAccess(officeId, list, removedMembers, previousPrincipal);
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

    /**
     * The members come in the request body, so an unknown profile or a repeated one is a field error (400). The
     * principal is always an editor, so it is dropped from the members instead of being an error.
     */
    private Map<Client, ListRole> findMembers(UUID officeId, ShoppingListRequest request, Client principal) {
        Map<UUID, ListRole> rolesById = new LinkedHashMap<>();
        for (ListMemberRequest member : request.members()) {
            if (rolesById.put(member.clientId(), member.role()) != null) {
                throw ApiException.invalidField(MEMBERS_FIELD, ErrorMessages.LIST_MEMBER_DUPLICATED);
            }
        }
        rolesById.remove(principal.getId());

        Map<UUID, Client> clientsById = clientRepository.findByIdInAndOfficeId(rolesById.keySet(), officeId).stream()
                .collect(Collectors.toMap(Client::getId, Function.identity()));
        if (clientsById.size() != rolesById.size()) {
            throw ApiException.invalidField(MEMBERS_FIELD, ErrorMessages.LIST_MEMBER_NOT_IN_OFFICE);
        }

        Map<Client, ListRole> members = new LinkedHashMap<>();
        rolesById.forEach((clientId, role) -> members.put(clientsById.get(clientId), role));
        return members;
    }

    private static Set<UUID> memberIds(ShoppingList list) {
        return list.getMembers().stream().map(member -> member.getClient().getId()).collect(Collectors.toSet());
    }

    private void logMembersChange(UUID officeId, ShoppingList list, Set<UUID> previousMembers, Set<UUID> removedMembers,
            Client previousPrincipal) {
        Set<UUID> added = memberIds(list);
        added.removeAll(previousMembers);
        boolean principalChanged = !previousPrincipal.getId().equals(list.getClient().getId());
        if (!added.isEmpty() || !removedMembers.isEmpty() || principalChanged) {
            log.info("list.members result=changed officeId={} listId={} added={} removed={} principalChanged={}",
                    officeId, list.getId(), added, removedMembers, principalChanged);
        }
    }

    /** A profile that is still the principal or a member keeps its notes, even if it changed place. */
    private void deleteNotesOfProfilesWithoutAccess(UUID officeId, ShoppingList list, Set<UUID> removedMembers, Client previousPrincipal) {
        Set<UUID> withoutAccess = new HashSet<>(removedMembers);
        withoutAccess.add(previousPrincipal.getId());
        withoutAccess.removeIf(clientId -> list.roleOf(clientId).isPresent());
        if (!withoutAccess.isEmpty() && noteRepository.deleteInList(list.getId(), withoutAccess) > 0) {
            log.info("list.client_notes result=deleted officeId={} listId={} clientIds={}", officeId, list.getId(), withoutAccess);
        }
    }

    /** The client id comes in the request body, so a client outside the office is a field error (400), not a 404. */
    private Client findClientForList(UUID officeId, UUID clientId) {
        return clientRepository.findByIdAndOfficeId(clientId, officeId)
                .orElseThrow(() -> ApiException.invalidField(CLIENT_ID_FIELD, ErrorMessages.LIST_CLIENT_REQUIRED));
    }
}
