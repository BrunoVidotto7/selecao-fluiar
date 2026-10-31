package br.com.fluiar.selecao.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import br.com.fluiar.selecao.support.ApiIntegrationTest;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.test.web.servlet.assertj.MvcTestResult;

class OfficeControllerTest extends ApiIntegrationTest {

    private static final String PAULA_NAME = "Paula Hooper";
    private static final String PAULA_EMAIL = "paula@fluiar.com.br";
    private static final String PAULA_OFFICE_NAME = "Escritório de Paula Hooper";
    private static final String NEW_OFFICE_NAME = "Fluiar";
    private static final String MARINA_NAME = "Marina Costa";
    private static final String MARINA_EMAIL = "marina@fluiar.com.br";
    private static final String ANA_NAME = "Ana Souza";
    private static final String ANA_EMAIL = "ana@fluiar.com.br";
    private static final String ISABELA_NAME = "Isabela Machado";
    private static final String ISABELA_EMAIL = "isabela@fluiar.com.br";
    private static final String ISABELA_EMAIL_AS_TYPED = " Isabela@Fluiar.com.br ";
    private static final String INVITATION_LINK_PREFIX = "http://localhost:3000/convite?token=";
    private static final Duration INVITATION_VALIDITY = Duration.ofDays(7);
    private static final String LOCK_INVITATIONS = "select id from office_invitations for update";

    private record SentInvitation(String id, String token) {
    }

    @Test
    void getOfficeListsMembers() {
        signUp(MARINA_NAME, MARINA_EMAIL);
        var paula = signUp(PAULA_NAME, PAULA_EMAIL);

        var result = requestOffice(paula);

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(result).bodyJson().extractingPath("$.id").isEqualTo(paula.officeId().toString());
        assertThat(result).bodyJson().extractingPath("$.name").isEqualTo(PAULA_OFFICE_NAME);
        assertThat(result).bodyJson().extractingPath("$.members[*].name").asArray().containsExactly(PAULA_NAME);
        assertThat(result).bodyJson().extractingPath("$.members[0].email").isEqualTo(PAULA_EMAIL);
    }

    @Test
    void getOfficeListsMembersByName() {
        var paula = signUp(PAULA_NAME, PAULA_EMAIL);
        inviteMember(paula, ANA_NAME, ANA_EMAIL);

        var result = requestOffice(paula);

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(result).bodyJson().extractingPath("$.members[*].name").asArray()
                .containsExactly(ANA_NAME, PAULA_NAME);
    }

    @Test
    void renameOffice() {
        var paula = signUp(PAULA_NAME, PAULA_EMAIL);

        var result = requestRename(paula, NEW_OFFICE_NAME);

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(result).bodyJson().extractingPath("$.name").isEqualTo(NEW_OFFICE_NAME);
        assertThat(requestOffice(paula)).bodyJson().extractingPath("$.name").isEqualTo(NEW_OFFICE_NAME);
    }

    static Stream<Arguments> invalidOfficeNames() {
        return Stream.of(
                Arguments.of("  ", "Preencha este campo."),
                Arguments.of("F".repeat(121), "Use no máximo 120 caracteres."));
    }

    @ParameterizedTest
    @MethodSource("invalidOfficeNames")
    void renameReportsInvalidName(String name, String expectedMessage) {
        var paula = signUp(PAULA_NAME, PAULA_EMAIL);

        var result = requestRename(paula, name);

        assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(result).bodyJson().extractingPath("$.errors.name").isEqualTo(expectedMessage);
    }

    @Test
    void inviteSendsEmailAndShowsPendingInvitation() {
        var paula = signUp(PAULA_NAME, PAULA_EMAIL);

        var result = requestInvitation(paula, ISABELA_EMAIL_AS_TYPED);

        assertThat(result).hasStatus(HttpStatus.CREATED);
        assertThat(result).bodyJson().extractingPath("$.email").isEqualTo(ISABELA_EMAIL);
        assertThat(result).bodyJson().extractingPath("$.createdAt").asString().isNotBlank();
        SimpleMailMessage email = lastEmailTo(ISABELA_EMAIL);
        assertThat(email.getFrom()).isEqualTo("nao-responda@fluiar.com.br");
        assertThat(email.getSubject())
                .isEqualTo("Convite para o escritório Escritório de Paula Hooper — Seleção Fluiar");
        assertThat(email.getText())
                .startsWith("Paula Hooper convidou você para participar do escritório Escritório de Paula Hooper"
                        + " na Seleção Fluiar.")
                .contains(INVITATION_LINK_PREFIX);
        var invitations = requestInvitations(paula);
        assertThat(invitations).hasStatus(HttpStatus.OK);
        assertThat(invitations).bodyJson().extractingPath("$[*].id").asArray()
                .containsExactly(readJson(result, "$.id"));
    }

    @Test
    void invitationExpiresSevenDaysAfterItIsSent() {
        var paula = signUp(PAULA_NAME, PAULA_EMAIL);
        Instant sentAfter = Instant.now();

        var result = requestInvitation(paula, ISABELA_EMAIL);

        Instant sentBefore = Instant.now();
        assertThat(result).hasStatus(HttpStatus.CREATED);
        Instant expiresAt = Instant.parse(readJson(result, "$.expiresAt"));
        assertThat(expiresAt).isBetween(sentAfter.plus(INVITATION_VALIDITY), sentBefore.plus(INVITATION_VALIDITY));
    }

    /**
     * The long e-mail keeps every part within the e-mail format limits (64-character local part, 63-character domain
     * labels), so only the 254-character limit fails.
     */
    static Stream<Arguments> invalidInvitationEmails() {
        String longEmail = "i".repeat(64) + "@" + ("d".repeat(63) + ".").repeat(3) + "com.br";
        return Stream.of(
                Arguments.of(" ", "Preencha este campo."),
                Arguments.of("isabela@", "Digite um e-mail válido, como nome@email.com."),
                Arguments.of(longEmail, "Use no máximo 254 caracteres."));
    }

    @ParameterizedTest
    @MethodSource("invalidInvitationEmails")
    void inviteReportsInvalidEmail(String email, String expectedMessage) {
        var paula = signUp(PAULA_NAME, PAULA_EMAIL);

        var result = requestInvitation(paula, email);

        assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(result).bodyJson().extractingPath("$.errors.email").isEqualTo(expectedMessage);
    }

    @Test
    void inviteRejectsEmailThatAlreadyHasAccount() {
        signUp(ISABELA_NAME, ISABELA_EMAIL);
        var paula = signUp(PAULA_NAME, PAULA_EMAIL);

        var result = requestInvitation(paula, ISABELA_EMAIL_AS_TYPED);

        assertThat(result).hasStatus(HttpStatus.CONFLICT);
        assertThat(result).bodyJson().extractingPath("$.errors.email").isEqualTo("Este e-mail já tem uma conta.");
        verify(mailSender, never()).send(any(SimpleMailMessage.class));
    }

    @Test
    void invitingAgainReplacesPreviousInvitation() {
        var paula = signUp(PAULA_NAME, PAULA_EMAIL);
        var firstInvitation = invite(paula, ISABELA_EMAIL);
        var secondInvitation = invite(paula, ISABELA_EMAIL);

        var invitations = requestInvitations(paula);

        assertThat(invitations).hasStatus(HttpStatus.OK);
        assertThat(invitations).bodyJson().extractingPath("$[*].id").asArray().containsExactly(secondInvitation.id());
        assertThat(requestInspection(firstInvitation.token())).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(requestInspection(secondInvitation.token())).hasStatus(HttpStatus.OK);
    }

    @Test
    void revokeInvalidatesInvitation() {
        var paula = signUp(PAULA_NAME, PAULA_EMAIL);
        var invitation = invite(paula, ISABELA_EMAIL);

        var result = requestRevoke(paula, invitation.id());

        assertThat(result).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(requestInspection(invitation.token())).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(requestInvitations(paula)).bodyJson().extractingPath("$").asArray().isEmpty();
    }

    @Test
    void revokeInvitationOfAnotherOfficeIsNotFound() {
        var paula = signUp(PAULA_NAME, PAULA_EMAIL);
        var marina = signUp(MARINA_NAME, MARINA_EMAIL);
        var invitation = invite(paula, ISABELA_EMAIL);

        var result = requestRevoke(marina, invitation.id());

        assertThat(result).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(requestInspection(invitation.token())).hasStatus(HttpStatus.OK);
    }

    /** Both revokes wait for another transaction's lock on the invitation, so they reach the delete together. */
    @Test
    void overlappingRevokesOfTheSameInvitationDeleteItOnce() throws Exception {
        var paula = signUp(PAULA_NAME, PAULA_EMAIL);
        var invitation = invite(paula, ISABELA_EMAIL);

        var results = requestsDuringConcurrentTransaction(() -> jdbc.queryForList(LOCK_INVITATIONS), List.of(
                () -> requestRevoke(paula, invitation.id()),
                () -> requestRevoke(paula, invitation.id())));

        assertThat(statusesOf(results)).containsExactlyInAnyOrder(HttpStatus.NO_CONTENT, HttpStatus.NOT_FOUND);
        assertThat(requestInspection(invitation.token())).hasStatus(HttpStatus.BAD_REQUEST);
    }

    @Test
    void invitationsOfAnotherOfficeAreNotListed() {
        var paula = signUp(PAULA_NAME, PAULA_EMAIL);
        var marina = signUp(MARINA_NAME, MARINA_EMAIL);
        invite(paula, ISABELA_EMAIL);

        var result = requestInvitations(marina);

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(result).bodyJson().extractingPath("$").asArray().isEmpty();
    }

    /** Invites the e-mail and returns the id of the invitation and the token of the link sent by e-mail. */
    private SentInvitation invite(TestSession owner, String email) {
        var result = requestInvitation(owner, email);
        assertThat(result).hasStatus(HttpStatus.CREATED);

        return new SentInvitation(readJson(result, "$.id"), extractToken(lastEmailTo(email).getText()));
    }

    private MvcTestResult requestOffice(TestSession session) {
        return mvc.get().uri("/api/office").header(HttpHeaders.AUTHORIZATION, bearer(session)).exchange();
    }

    private MvcTestResult requestRename(TestSession session, String name) {
        return mvc.put().uri("/api/office")
                .header(HttpHeaders.AUTHORIZATION, bearer(session))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("name", name)))
                .exchange();
    }

    private MvcTestResult requestInvitations(TestSession session) {
        return mvc.get().uri("/api/office/invitations").header(HttpHeaders.AUTHORIZATION, bearer(session)).exchange();
    }

    private MvcTestResult requestRevoke(TestSession session, String invitationId) {
        return mvc.delete().uri("/api/office/invitations/{id}", invitationId)
                .header(HttpHeaders.AUTHORIZATION, bearer(session))
                .exchange();
    }

    private MvcTestResult requestInspection(String token) {
        return mvc.get().uri("/api/auth/invitations/{token}", token).exchange();
    }
}
