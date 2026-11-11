package br.com.fluiar.selecao.service;

import br.com.fluiar.selecao.dto.ClientDetailResponse;
import br.com.fluiar.selecao.dto.ClientRequest;
import br.com.fluiar.selecao.dto.ClientResponse;
import br.com.fluiar.selecao.dto.ClientSummaryResponse;
import br.com.fluiar.selecao.exception.ApiException;
import br.com.fluiar.selecao.exception.ErrorMessages;
import br.com.fluiar.selecao.model.Client;
import br.com.fluiar.selecao.repository.ClientRepository;
import br.com.fluiar.selecao.repository.ListMemberRepository;
import br.com.fluiar.selecao.repository.ShoppingListRepository;
import br.com.fluiar.selecao.repository.OfficeInvitationRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ClientService {

    private final ClientRepository clientRepository;
    private final ShoppingListRepository listRepository;

    private final OfficeInvitationRepository invitationRepository;
    private final ListMemberRepository memberRepository;
    private final Clock clock;

    public ClientService(ClientRepository clientRepository, ShoppingListRepository listRepository,
            OfficeInvitationRepository invitationRepository, ListMemberRepository memberRepository, Clock clock) {
        this.clock = clock;
        this.memberRepository = memberRepository;
        this.invitationRepository = invitationRepository;
        this.clientRepository = clientRepository;
        this.listRepository = listRepository;
    }

    public List<ClientSummaryResponse> list(UUID officeId) {
        return clientRepository.findSummaries(officeId);
    }

    public ClientDetailResponse get(UUID officeId, UUID clientId) {
        Client client = loadClient(officeId, clientId);

        return ClientDetailResponse.of(client, listRepository.findSummariesByClient(officeId, clientId),
                memberRepository.findMemberLists(clientId, officeId));
    }

    @Transactional
    public ClientResponse create(UUID officeId, ClientRequest request) {
        requireValidBirthDate(request.birthDate());
        // Hibernate fills the timestamps only when the insert runs; the response needs them now.
        Client client = clientRepository.saveAndFlush(new Client(officeId, request.name(), request.email(),
                request.phone(), request.birthDate(), request.cpf()));

        return ClientResponse.of(client);
    }

    @Transactional
    public ClientResponse update(UUID officeId, UUID clientId, ClientRequest request) {
        requireValidBirthDate(request.birthDate());
        Client client = clientRepository.findByIdAndOfficeIdForUpdate(clientId, officeId).orElseThrow(ApiException::notFound);
        if (!client.getEmail().equals(request.email())) {
            invitationRepository.deleteByClientId(clientId);
        }
        client.update(request.name(), request.email(), request.phone(), request.birthDate(), request.cpf());
        // Hibernate refreshes updatedAt only when the update runs; the response needs the new value.
        clientRepository.flush();

        return ClientResponse.of(client);
    }

    /**
     * Answers 404 for a client of another office, and for one already deleted. The database deletes the client's
     * lists, rooms, products and images with it.
     */
    @Transactional
    public void delete(UUID officeId, UUID clientId) {
        int deleted = clientRepository.deleteByIdAndOfficeId(clientId, officeId);
        if (deleted == 0) {
            throw ApiException.notFound();
        }
    }

    private void requireValidBirthDate(LocalDate birthDate) {
        if (birthDate != null && (birthDate.isBefore(Client.BIRTH_DATE_MIN) || birthDate.isAfter(LocalDate.now(clock)))) {
            throw ApiException.invalidField("birthDate", ErrorMessages.BIRTH_DATE_INVALID);
        }
    }

    private Client loadClient(UUID officeId, UUID clientId) {
        return clientRepository.findByIdAndOfficeId(clientId, officeId).orElseThrow(ApiException::notFound);
    }
}
