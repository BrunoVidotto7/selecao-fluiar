package br.com.fluiar.selecao.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import br.com.fluiar.selecao.dto.InvitationAcceptRequest;
import br.com.fluiar.selecao.service.InvitationService;
import br.com.fluiar.selecao.support.ApiIntegrationTest;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.test.web.servlet.assertj.MvcTestResult;

class InvitationAcceptanceTest extends ApiIntegrationTest {

    private static final String PAULA_NAME = "Paula Hooper";
    private static final String PAULA_EMAIL = "paula@fluiar.com.br";
    private static final String OFFICE_NAME = "Fluiar";
    private static final String ISABELA_NAME = "Isabela Machado";
    private static final String ISABELA_EMAIL = "isabela@fluiar.com.br";
    private static final String ISABELA_PASSWORD = "senhaforte2";
    private static final String CONCURRENT_PASSWORD = "outrasenha1";
    private static final String INVALID_LINK_MESSAGE = "Este link expirou ou já foi usado. Peça um novo.";
    private static final String LOCK_INVITATIONS = "select id from office_invitations for update";
    private static final String DELETE_INVITATIONS = "delete from office_invitations";
    private static final String EXPIRE_INVITATIONS =
            "update office_invitations set expires_at = now() - interval '1 minute'";

    @Autowired
    private InvitationService invitationService;

    private TestSession paula;
    private UUID clientId;
    private String invitationId;
    private String token;

    @BeforeEach
    void paulaRenamesHerOfficeAndInvitesIsabela() {
        paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        assertThat(requestRename(paula, OFFICE_NAME)).hasStatus(HttpStatus.OK);
        clientId = createClient(paula, ISABELA_NAME, ISABELA_EMAIL);
        var invitation = requestClientInvitation(paula, clientId);
        assertThat(invitation).hasStatus(HttpStatus.CREATED);
        invitationId = readJson(invitation, "$.id");
        token = extractToken(lastEmailTo(ISABELA_EMAIL).getText());
    }

    @Test
    void inspectShowsOfficeAndInviter() {
        var result = requestInspection(token);

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(result).bodyJson().extractingPath("$.email").isEqualTo(ISABELA_EMAIL);
        assertThat(result).bodyJson().extractingPath("$.officeName").isEqualTo(OFFICE_NAME);
        assertThat(result).bodyJson().extractingPath("$.invitedByName").isEqualTo(PAULA_NAME);
    }

    @Test
    void acceptCreatesMemberOfSameOffice() {
        var result = requestInvitationAcceptance(token, ISABELA_PASSWORD);

        assertThat(result).hasStatus(HttpStatus.CREATED);
        assertThat(result).bodyJson().extractingPath("$.user.officeId").isEqualTo(paula.officeId().toString());
        assertThat(result).bodyJson().extractingPath("$.user.name").isEqualTo(ISABELA_NAME);
        assertThat(result).bodyJson().extractingPath("$.user.email").isEqualTo(ISABELA_EMAIL);
        assertThat(requestOffice(paula)).bodyJson().extractingPath("$.members[*].name").asArray()
                .containsExactly(PAULA_NAME);
        assertThat(requestInvitations(paula)).bodyJson().extractingPath("$.status").isEqualTo("ACTIVE");
        assertThat(requestLogIn(ISABELA_EMAIL, ISABELA_PASSWORD)).hasStatus(HttpStatus.OK);
    }

    @Test
    void acceptFailsWhenEmailGotAnAccountMeanwhile() {
        createAdmin(ISABELA_NAME, ISABELA_EMAIL);

        var result = requestInvitationAcceptance(token, ISABELA_PASSWORD);

        assertThat(result).hasStatus(HttpStatus.CONFLICT);
        assertThat(result).bodyJson().extractingPath("$.errors.email").isEqualTo("Este e-mail já tem uma conta.");
    }

    @Test
    void acceptReportsEachInvalidField() {
        var result = requestInvitationAcceptance(token, "curta");

        assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(result).bodyJson().extractingPath("$.errors.password").isEqualTo("Use entre 8 e 72 caracteres.");
    }

    @Test
    void expiredInvitationIsRejected() {
        jdbc.update("update office_invitations set expires_at = now() - interval '1 minute'");

        var inspection = requestInspection(token);
        var acceptance = requestInvitationAcceptance(token, ISABELA_PASSWORD);

        assertThat(inspection).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(inspection).bodyJson().extractingPath("$.detail").isEqualTo(INVALID_LINK_MESSAGE);
        assertThat(acceptance).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(acceptance).bodyJson().extractingPath("$.detail").isEqualTo(INVALID_LINK_MESSAGE);
        assertThat(accountsWithEmail(ISABELA_EMAIL)).isZero();
    }

    /**
     * Both acceptances wait together for another transaction's lock on the invitation. Only one creates the account;
     * the other finds the invitation already used.
     */
    @Test
    void overlappingAcceptancesOfTheSameInvitationCreateOneAccount() throws Exception {
        var results = requestsDuringConcurrentTransaction(() -> jdbc.queryForList(LOCK_INVITATIONS), List.of(
                () -> requestInvitationAcceptance(token, ISABELA_PASSWORD),
                () -> requestInvitationAcceptance(token, CONCURRENT_PASSWORD)));

        List<HttpStatus> statuses = statusesOf(results);
        assertThat(statuses).containsExactlyInAnyOrder(HttpStatus.CREATED, HttpStatus.BAD_REQUEST);
        int accepted = statuses.indexOf(HttpStatus.CREATED);
        int rejected = 1 - accepted;
        assertThat(results.get(rejected)).bodyJson().extractingPath("$.detail").isEqualTo(INVALID_LINK_MESSAGE);
        assertThat(accountsWithEmail(ISABELA_EMAIL)).isEqualTo(1);
        String acceptedPassword = List.of(ISABELA_PASSWORD, CONCURRENT_PASSWORD).get(accepted);
        assertThat(requestLogIn(ISABELA_EMAIL, acceptedPassword)).hasStatus(HttpStatus.OK);
    }

    /** The acceptance waits for a concurrent revoke that has deleted the invitation but not committed yet. */
    @Test
    void acceptanceDuringRevokeIsRejected() throws Exception {
        var result = requestsDuringConcurrentTransaction(() -> jdbc.update(DELETE_INVITATIONS), List.of(
                () -> requestInvitationAcceptance(token, ISABELA_PASSWORD))).getFirst();

        assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(result).bodyJson().extractingPath("$.detail").isEqualTo(INVALID_LINK_MESSAGE);
        assertThat(accountsWithEmail(ISABELA_EMAIL)).isZero();
    }

    /**
     * A concurrent transaction locks the invitation and moves its expiry into the past, as if time passed while the
     * acceptance waited for the lock.
     */
    @Test
    void invitationThatExpiresWhileTheAcceptanceWaitsIsRejected() throws Exception {
        var result = requestsDuringConcurrentTransaction(() -> jdbc.update(EXPIRE_INVITATIONS), List.of(
                () -> requestInvitationAcceptance(token, ISABELA_PASSWORD))).getFirst();

        assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(result).bodyJson().extractingPath("$.detail").isEqualTo(INVALID_LINK_MESSAGE);
        assertThat(accountsWithEmail(ISABELA_EMAIL)).isZero();
    }

    @Test
    void revokeWaitingForAnAcceptanceIsNotFound() throws Exception {
        var result = requestsDuringConcurrentTransaction(this::acceptIsabelasInvitation, List.of(
                () -> requestRevoke(paula, invitationId))).getFirst();

        assertThat(result).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(accountsWithEmail(ISABELA_EMAIL)).isEqualTo(1);
    }

    @Test
    void invitingAgainWhileTheInvitationIsAcceptedIsRejected() throws Exception {
        var result = requestsDuringConcurrentTransaction(this::acceptIsabelasInvitation, List.of(
                () -> requestClientInvitation(paula, clientId))).getFirst();

        assertThat(result).hasStatus(HttpStatus.CONFLICT);
        assertThat(result).bodyJson().extractingPath("$.errors.clientId").isEqualTo("Este perfil já tem acesso ativo.");
        assertThat(pendingInvitationsFor(ISABELA_EMAIL)).isZero();
        verify(mailSender, times(1)).send(any(SimpleMailMessage.class));
    }

    /**
     * The real acceptance, run inside the concurrent transaction of the helper: it holds the invitation's lock and
     * commits only after the request waits for that lock.
     */
    private void acceptIsabelasInvitation() {
        invitationService.accept(token, new InvitationAcceptRequest(ISABELA_PASSWORD));
    }

    private int accountsWithEmail(String email) {
        return jdbc.queryForObject("select count(*) from users where email = ?", Integer.class, email);
    }

    private int pendingInvitationsFor(String email) {
        return jdbc.queryForObject("select count(*) from office_invitations where email = ?", Integer.class, email);
    }

    private MvcTestResult requestRevoke(TestSession session, String invitationId) {
        return mvc.delete().uri("/api/clients/{clientId}/invitations/{id}", clientId, invitationId)
                .header(HttpHeaders.AUTHORIZATION, bearer(session))
                .exchange();
    }

    private MvcTestResult requestInspection(String token) {
        return mvc.get().uri("/api/auth/invitations/{token}", token).exchange();
    }

    private MvcTestResult requestRename(TestSession session, String name) {
        return mvc.put().uri("/api/office")
                .header(HttpHeaders.AUTHORIZATION, bearer(session))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("name", name)))
                .exchange();
    }

    private MvcTestResult requestOffice(TestSession session) {
        return mvc.get().uri("/api/office").header(HttpHeaders.AUTHORIZATION, bearer(session)).exchange();
    }

    private MvcTestResult requestInvitations(TestSession session) {
        return mvc.get().uri("/api/clients/{clientId}/access", clientId).header(HttpHeaders.AUTHORIZATION, bearer(session)).exchange();
    }

    private MvcTestResult requestLogIn(String email, String password) {
        return mvc.post().uri("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("email", email, "password", password)))
                .exchange();
    }
}
