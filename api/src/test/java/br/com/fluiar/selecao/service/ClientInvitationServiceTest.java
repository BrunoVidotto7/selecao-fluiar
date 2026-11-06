package br.com.fluiar.selecao.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

import br.com.fluiar.selecao.config.AppProperties;
import br.com.fluiar.selecao.dto.ClientAccessResponse.Status;
import br.com.fluiar.selecao.dto.InvitationAcceptRequest;
import br.com.fluiar.selecao.exception.ApiException;
import br.com.fluiar.selecao.model.*;
import br.com.fluiar.selecao.repository.*;
import br.com.fluiar.selecao.security.IssuedToken;
import br.com.fluiar.selecao.security.SecureTokens;
import br.com.fluiar.selecao.security.TokenService;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

class ClientInvitationServiceTest {
    private static final UUID OFFICE_ID = UUID.randomUUID();
    private static final UUID CLIENT_ID = UUID.randomUUID();
    private static final UUID USER_ID = UUID.randomUUID();
    private static final Instant NOW = Instant.parse("2026-11-04T12:00:00Z");
    private final OfficeInvitationRepository invitations = mock(OfficeInvitationRepository.class);
    private final ClientRepository clients = mock(ClientRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final OfficeRepository offices = mock(OfficeRepository.class);
    private final PasswordEncoder encoder = mock(PasswordEncoder.class);
    private final TokenService tokens = mock(TokenService.class);
    private final EmailService email = mock(EmailService.class);
    private final Client client = new Client(OFFICE_ID, "Stored name", "client@example.com", "31999999999");
    private final OfficeInvitation invitation = new OfficeInvitation(OFFICE_ID, CLIENT_ID, "client@example.com", USER_ID,
            SecureTokens.hash("token"), NOW.plus(Duration.ofDays(7)));
    private InvitationService service;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(client, "id", CLIENT_ID);
        ReflectionTestUtils.setField(invitation, "id", UUID.randomUUID());
        when(clients.findByIdAndOfficeIdForUpdate(CLIENT_ID, OFFICE_ID)).thenReturn(Optional.of(client));
        when(clients.findByIdAndOfficeId(CLIENT_ID, OFFICE_ID)).thenReturn(Optional.of(client));
        var context = mock(OfficeInvitationRepository.ClientContext.class);
        when(context.getClientId()).thenReturn(CLIENT_ID);
        when(context.getOfficeId()).thenReturn(OFFICE_ID);
        when(invitations.findClientContextByTokenHash(SecureTokens.hash("token"))).thenReturn(Optional.of(context));
        when(invitations.findByTokenHashForUpdate(SecureTokens.hash("token"))).thenReturn(Optional.of(invitation));
        when(users.save(any(User.class))).thenAnswer(call -> {
            User user = call.getArgument(0);
            ReflectionTestUtils.setField(user, "id", UUID.randomUUID());
            return user;
        });
        Office office = new Office("Office");
        ReflectionTestUtils.setField(office, "id", OFFICE_ID);
        when(offices.findById(OFFICE_ID)).thenReturn(Optional.of(office));
        when(users.findById(USER_ID)).thenReturn(Optional.of(User.admin(OFFICE_ID, "Admin", "admin@example.com", "hash")));
        when(encoder.encode("clientPassword1")).thenReturn("encoded");
        when(tokens.issue(any(User.class), eq(false))).thenReturn(new IssuedToken("test-token", NOW.plusSeconds(60)));
        var properties = new AppProperties(null, "http://localhost:3000", List.of(), ZoneOffset.UTC, "test@example.com");
        service = new InvitationService(invitations, clients, users, offices, email, encoder, tokens,
                Clock.fixed(NOW, ZoneOffset.UTC), new TransactionTemplate(mock(PlatformTransactionManager.class)), properties);
    }

    @Test
    void acceptingAnInvitationCreatesOnlyTheStoredClientAccount() {
        var result = service.accept("token", new InvitationAcceptRequest("clientPassword1"));
        assertThat(result.user().role()).isEqualTo(UserRole.CLIENT);
        assertThat(result.user().clientId()).isEqualTo(CLIENT_ID);
        assertThat(result.user().name()).isEqualTo("Stored name");
    }

    @Test
    void accessStatesUseTheActiveLoginEmailInsteadOfTheContactEmail() {
        assertThat(service.getAccess(OFFICE_ID, CLIENT_ID).status()).isEqualTo(Status.NOT_INVITED);
        when(invitations.findByClientId(CLIENT_ID)).thenReturn(Optional.of(invitation));
        assertThat(service.getAccess(OFFICE_ID, CLIENT_ID).status()).isEqualTo(Status.PENDING);
        var expired = new OfficeInvitation(OFFICE_ID, CLIENT_ID, "client@example.com", USER_ID, "hash", NOW);
        when(invitations.findByClientId(CLIENT_ID)).thenReturn(Optional.of(expired));
        assertThat(service.getAccess(OFFICE_ID, CLIENT_ID).status()).isEqualTo(Status.EXPIRED);
        when(users.findByClientId(CLIENT_ID)).thenReturn(Optional.of(User.client(OFFICE_ID, CLIENT_ID, "Client", "login@example.com", "hash")));
        var active = service.getAccess(OFFICE_ID, CLIENT_ID);
        assertThat(active.status()).isEqualTo(Status.ACTIVE);
        assertThat(active.email()).isEqualTo("login@example.com");
        assertThat(active.invitationId()).isNull();
    }

    @Test
    void changingTheContactPreventsAcceptanceOfTheOldRecipientInvitation() {
        client.update("Stored name", "new@example.com", "31999999999");
        assertThatThrownBy(() -> service.accept("token", new InvitationAcceptRequest("clientPassword1"))).isInstanceOf(ApiException.class);
        verify(users, never()).save(any());
    }

    @Test
    void activeAccountsAndOtherClientsPendingEmailsCannotBeReinvited() {
        when(users.findByClientId(CLIENT_ID)).thenReturn(Optional.of(User.client(OFFICE_ID, CLIENT_ID, "Client", "login@example.com", "hash")));
        assertThatThrownBy(() -> service.invite(USER_ID, OFFICE_ID, CLIENT_ID))
                .isInstanceOfSatisfying(ApiException.class, failure -> assertThat(failure.status()).isEqualTo(HttpStatus.CONFLICT));
        when(users.findByClientId(CLIENT_ID)).thenReturn(Optional.empty());
        when(invitations.findByOfficeIdAndEmail(OFFICE_ID, "client@example.com"))
                .thenReturn(Optional.of(new OfficeInvitation(OFFICE_ID, UUID.randomUUID(), "client@example.com", USER_ID, "hash", NOW.plusSeconds(60))));
        assertThatThrownBy(() -> service.invite(USER_ID, OFFICE_ID, CLIENT_ID)).isInstanceOf(ApiException.class);
        verify(invitations, never()).saveAndFlush(any());
        verifyNoInteractions(email);
    }
}
