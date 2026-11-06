package br.com.fluiar.selecao.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.reset;

import br.com.fluiar.selecao.support.ApiIntegrationTest;
import java.net.ConnectException;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;

class ClientAccessControllerTest extends ApiIntegrationTest {
    private String storedInvitationHash() {
        return jdbc.queryForObject("select token_hash from office_invitations", String.class);
    }

    @Test
    void accessTransitionsFromInvitationToActiveClientAccount() {
        var admin = createAdmin("Admin", "admin@example.com");
        UUID client = createClient(admin, "Stored client", " Client@Example.com ");
        Instant beforeInvitation = Instant.now();
        var invitation = requestClientInvitation(admin, client);
        assertThat(invitation).hasStatus(HttpStatus.CREATED);
        assertThat(invitation).bodyJson().extractingPath("$.clientId").isEqualTo(client.toString());
        String token = extractToken(lastEmailTo("client@example.com").getText());
        assertThat(lastEmailTo("client@example.com").getText()).contains("/invitation?token=");
        assertThat(Instant.parse(readJson(invitation, "$.expiresAt"))).isBetween(beforeInvitation.plus(Duration.ofDays(7)), Instant.now().plus(Duration.ofDays(7)));
        assertThat(mvc.get().uri("/api/clients/{id}/access", client).header(HttpHeaders.AUTHORIZATION, bearer(admin)).exchange())
                .bodyJson().extractingPath("$.status").isEqualTo("PENDING");
        var accepted = requestInvitationAcceptance(token, DEFAULT_PASSWORD);
        assertThat(accepted).hasStatus(HttpStatus.CREATED);
        assertThat(accepted).bodyJson().extractingPath("$.user.role").isEqualTo("CLIENT");
        assertThat(accepted).bodyJson().extractingPath("$.user.clientId").isEqualTo(client.toString());
        assertThat(accepted).bodyJson().extractingPath("$.user.name").isEqualTo("Stored client");
        assertThat(requestInvitationAcceptance(token, DEFAULT_PASSWORD)).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(requestClientInvitation(admin, client)).hasStatus(HttpStatus.CONFLICT);
    }

    @Test
    void reissueAndContactChangesInvalidateOlderInvitations() {
        var admin = createAdmin("Admin", "admin@example.com");
        UUID client = createClient(admin, "Client", "client@example.com");
        assertThat(requestClientInvitation(admin, client)).hasStatus(HttpStatus.CREATED);
        String first = extractToken(lastEmailTo("client@example.com").getText());
        assertThat(requestClientInvitation(admin, client)).hasStatus(HttpStatus.CREATED);
        String second = extractToken(lastEmailTo("client@example.com").getText());
        assertThat(requestInvitationAcceptance(first, DEFAULT_PASSWORD)).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(mvc.put().uri("/api/clients/{id}", client).header(HttpHeaders.AUTHORIZATION, bearer(admin))
                .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("name", "Client", "email", "new@example.com", "phone", "31999999999"))).exchange())
                .hasStatus(HttpStatus.OK);
        assertThat(requestInvitationAcceptance(second, DEFAULT_PASSWORD)).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(mvc.get().uri("/api/clients/{id}/access", client).header(HttpHeaders.AUTHORIZATION, bearer(admin)).exchange())
                .bodyJson().extractingPath("$.status").isEqualTo("NOT_INVITED");
    }

    @Test
    @ExtendWith(OutputCaptureExtension.class)
    void failedEmailDeliveryKeepsTheInvitationAndInvitingAgainReplacesItsToken(CapturedOutput output) {
        var admin = createAdmin("Admin", "admin@example.com");
        UUID client = createClient(admin, "Client", "client@example.com");
        doThrow(new MailSendException("550 rejected <client@example.com>", new ConnectException("refused")))
                .when(mailSender).send(any(SimpleMailMessage.class));

        var failed = requestClientInvitation(admin, client);

        assertThat(failed).hasStatus(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(failed).bodyJson().extractingPath("$.detail")
                .isEqualTo("Não conseguimos enviar o e-mail agora. Tente novamente em alguns minutos.");
        assertThat(output.getOut()).contains("MailSendException", "ConnectException")
                .doesNotContain("550 rejected", "client@example.com");
        String failedHash = storedInvitationHash();

        reset(mailSender);
        assertThat(requestClientInvitation(admin, client)).hasStatus(HttpStatus.CREATED);

        assertThat(storedInvitationHash()).isNotEqualTo(failedHash);
        String token = extractToken(lastEmailTo("client@example.com").getText());
        assertThat(requestInvitationAcceptance(token, DEFAULT_PASSWORD)).hasStatus(HttpStatus.CREATED);
    }

    @Test
    void noRowLockIsHeldWhileTheInvitationIsEmailed() {
        var admin = createAdmin("Admin", "admin@example.com");
        UUID client = createClient(admin, "Client", "client@example.com");
        AtomicReference<RuntimeException> lockFailure = new AtomicReference<>();
        doAnswer(invocation -> {
            // Another thread, so the query uses its own connection instead of the request's transaction.
            CompletableFuture.runAsync(() -> {
                try {
                    jdbc.queryForObject("select id from clients where id = ? for update nowait", UUID.class, client);
                } catch (RuntimeException e) {
                    lockFailure.set(e);
                }
            }).join();
            return null;
        }).when(mailSender).send(any(SimpleMailMessage.class));

        assertThat(requestClientInvitation(admin, client)).hasStatus(HttpStatus.CREATED);

        assertThat(lockFailure.get()).isNull();
    }

    @Test
    void clientsAndOtherOfficesCannotIssueOrRevokeInvitations() {
        var admin = createAdmin("Admin", "admin@example.com");
        UUID client = createClient(admin, "Client", "client@example.com");
        var owner = inviteClient(admin, client);
        var remote = createAdmin("Remote", "remote@example.com");
        assertThat(requestClientInvitation(owner, client)).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(requestClientInvitation(remote, client)).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(mvc.get().uri("/api/clients/{id}/access", client).header(HttpHeaders.AUTHORIZATION, bearer(remote)).exchange())
                .hasStatus(HttpStatus.NOT_FOUND);
        UUID invited = createClient(admin, "Invited", "invited@example.com");
        var pending = requestClientInvitation(admin, invited);
        assertThat(pending).hasStatus(HttpStatus.CREATED);
        UUID invitation = UUID.fromString(readJson(pending, "$.id"));
        assertThat(mvc.delete().uri("/api/clients/{id}/invitations/{invitation}", invited, invitation)
                .header(HttpHeaders.AUTHORIZATION, bearer(remote)).exchange()).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(jdbc.queryForObject("select count(*) from office_invitations where id = ?", Integer.class, invitation))
                .isEqualTo(1);
    }
}
