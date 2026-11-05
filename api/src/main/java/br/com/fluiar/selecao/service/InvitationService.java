package br.com.fluiar.selecao.service;

import br.com.fluiar.selecao.config.AppProperties;
import br.com.fluiar.selecao.dto.*;
import br.com.fluiar.selecao.dto.ClientAccessResponse.Status;
import br.com.fluiar.selecao.exception.ApiException;
import br.com.fluiar.selecao.exception.ErrorMessages;
import br.com.fluiar.selecao.model.Client;
import br.com.fluiar.selecao.model.Office;
import br.com.fluiar.selecao.model.OfficeInvitation;
import br.com.fluiar.selecao.model.User;
import br.com.fluiar.selecao.repository.*;
import br.com.fluiar.selecao.security.SecureTokens;
import br.com.fluiar.selecao.security.TokenService;
import java.time.Clock;
import java.time.Duration;
import java.util.Optional;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class InvitationService {
    private static final Duration INVITATION_VALIDITY = Duration.ofDays(7);
    private static final String INVITATION_PATH = "/invitation?token=";
    private static final String CLIENT_ID_FIELD = "clientId";
    private static final String EMAIL_FIELD = "email";

    private final OfficeInvitationRepository invitations;
    private final ClientRepository clients;
    private final UserRepository users;
    private final OfficeRepository offices;
    private final EmailService emailService;
    private final PasswordEncoder passwordEncoder;
    private final TokenService tokenService;
    private final Clock clock;
    private final String frontendUrl;

    public InvitationService(OfficeInvitationRepository invitations, ClientRepository clients, UserRepository users,
            OfficeRepository offices, EmailService emailService, PasswordEncoder passwordEncoder,
            TokenService tokenService, Clock clock, AppProperties properties) {
        this.invitations = invitations;
        this.clients = clients;
        this.users = users;
        this.offices = offices;
        this.emailService = emailService;
        this.passwordEncoder = passwordEncoder;
        this.tokenService = tokenService;
        this.clock = clock;
        this.frontendUrl = properties.frontendUrl();
    }

    public ClientAccessResponse getAccess(UUID officeId, UUID clientId) {
        Client client = clients.findByIdAndOfficeId(clientId, officeId).orElseThrow(ApiException::notFound);
        Optional<User> account = users.findByClientId(clientId);
        if (account.isPresent()) {
            return new ClientAccessResponse(Status.ACTIVE, account.get().getEmail(), null, null);
        }
        return invitations.findByClientId(clientId)
                .map(invitation -> new ClientAccessResponse(invitation.isExpired(clock.instant()) ? Status.EXPIRED : Status.PENDING,
                        client.getEmail(), invitation.getId(), invitation.getExpiresAt()))
                .orElseGet(() -> new ClientAccessResponse(Status.NOT_INVITED, client.getEmail(), null, null));
    }

    @Transactional
    public InvitationResponse invite(UUID adminId, UUID officeId, UUID clientId) {
        Client client = lockClient(officeId, clientId);
        rejectActiveClient(clientId);
        rejectEmailWithAccount(client.getEmail());
        invitations.findByOfficeIdAndEmail(officeId, client.getEmail()).ifPresent(invitation -> {
            if (!invitation.getClientId().equals(clientId)) {
                throw ApiException.conflict(EMAIL_FIELD, ErrorMessages.INVITATION_EMAIL_IN_USE);
            }
        });
        invitations.deleteByClientId(clientId);
        String token = SecureTokens.generate();
        OfficeInvitation invitation = invitations.saveAndFlush(new OfficeInvitation(officeId, clientId,
                client.getEmail(), adminId, SecureTokens.hash(token), clock.instant().plus(INVITATION_VALIDITY)));
        Office office = offices.findById(officeId).orElseThrow(ApiException::notFound);
        User inviter = users.findById(adminId).orElseThrow(ApiException::notFound);
        emailService.sendInvitation(client.getEmail(), office.getName(), inviter.getName(), frontendUrl + INVITATION_PATH + token);
        return InvitationResponse.of(invitation);
    }

    @Transactional
    public void revoke(UUID officeId, UUID clientId, UUID invitationId) {
        lockClient(officeId, clientId);
        if (invitations.deleteForClient(invitationId, officeId, clientId) == 0) {
            throw ApiException.notFound();
        }
    }

    public InvitationInfoResponse inspect(String token) {
        OfficeInvitation invitation = requireValid(invitations.findByTokenHash(SecureTokens.hash(token)));
        Client client = clients.findByIdAndOfficeId(invitation.getClientId(), invitation.getOfficeId())
                .orElseThrow(ApiException::invalidLink);
        requireCurrentRecipient(invitation, client);
        Office office = offices.findById(invitation.getOfficeId()).orElseThrow(ApiException::invalidLink);
        User inviter = users.findById(invitation.getInvitedByUserId()).orElseThrow(ApiException::invalidLink);
        return InvitationInfoResponse.of(invitation, client, office, inviter);
    }

    @Transactional
    public AuthResponse accept(String token, InvitationAcceptRequest request) {
        String hash = SecureTokens.hash(token);
        var context = invitations.findClientContextByTokenHash(hash).orElseThrow(ApiException::invalidLink);
        // Read only IDs first: the invitation must enter the persistence context after its lock is acquired.
        Client client = clients.findByIdAndOfficeIdForUpdate(context.getClientId(), context.getOfficeId())
                .orElseThrow(ApiException::invalidLink);
        OfficeInvitation invitation = requireValid(invitations.findByTokenHashForUpdate(hash));
        requireCurrentRecipient(invitation, client);
        rejectActiveClient(client.getId());
        rejectEmailWithAccount(invitation.getEmail());

        User user = users.save(User.client(invitation.getOfficeId(), client.getId(), client.getName(),
                invitation.getEmail(), passwordEncoder.encode(request.password())));
        invitations.delete(invitation);
        Office office = offices.findById(invitation.getOfficeId()).orElseThrow(ApiException::invalidLink);
        return AuthResponse.of(tokenService.issue(user, false), user, office);
    }

    private Client lockClient(UUID officeId, UUID clientId) {
        return clients.findByIdAndOfficeIdForUpdate(clientId, officeId).orElseThrow(ApiException::notFound);
    }

    private void rejectActiveClient(UUID clientId) {
        if (users.findByClientId(clientId).isPresent()) {
            throw ApiException.conflict(CLIENT_ID_FIELD, ErrorMessages.CLIENT_ALREADY_ACTIVE);
        }
    }

    private void rejectEmailWithAccount(String email) {
        if (users.existsByEmail(email)) {
            throw ApiException.emailInUse();
        }
    }

    private OfficeInvitation requireValid(Optional<OfficeInvitation> invitation) {
        return invitation.filter(value -> !value.isExpired(clock.instant())).orElseThrow(ApiException::invalidLink);
    }

    private static void requireCurrentRecipient(OfficeInvitation invitation, Client client) {
        if (!invitation.getClientId().equals(client.getId()) || !invitation.getEmail().equals(client.getEmail())) {
            throw ApiException.invalidLink();
        }
    }
}
