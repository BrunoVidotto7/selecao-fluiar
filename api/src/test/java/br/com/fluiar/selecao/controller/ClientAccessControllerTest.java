package br.com.fluiar.selecao.controller;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.fluiar.selecao.support.ApiIntegrationTest;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;

class ClientAccessControllerTest extends ApiIntegrationTest {
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
    void clientsAndOtherOfficesCannotIssueOrRevokeInvitations() {
        var admin = createAdmin("Admin", "admin@example.com");
        UUID client = createClient(admin, "Client", "client@example.com");
        var owner = inviteClient(admin, client);
        var remote = createAdmin("Remote", "remote@example.com");
        assertThat(requestClientInvitation(owner, client)).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(requestClientInvitation(remote, client)).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(mvc.get().uri("/api/clients/{id}/access", client).header(HttpHeaders.AUTHORIZATION, bearer(remote)).exchange())
                .hasStatus(HttpStatus.NOT_FOUND);
        assertThat(mvc.delete().uri("/api/clients/{id}/invitations/{invitation}", client, UUID.randomUUID())
                .header(HttpHeaders.AUTHORIZATION, bearer(remote)).exchange()).hasStatus(HttpStatus.NOT_FOUND);
    }
}
