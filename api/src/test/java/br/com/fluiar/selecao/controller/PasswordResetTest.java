package br.com.fluiar.selecao.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import br.com.fluiar.selecao.model.User;
import br.com.fluiar.selecao.support.ApiIntegrationTest;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.assertj.MvcTestResult;

class PasswordResetTest extends ApiIntegrationTest {

    private static final String PAULA_NAME = "Paula Hooper";
    private static final String PAULA_EMAIL = "paula@fluiar.com.br";
    private static final String PAULA_NEW_NAME = "Paula H.";
    private static final String PAULA_NEW_EMAIL = "paula.h@fluiar.com.br";
    private static final String UNKNOWN_EMAIL = "ninguem@fluiar.com.br";
    private static final String NEW_PASSWORD = "novasenha1";
    private static final String CONCURRENT_PASSWORD = "outrasenha1";
    private static final String RESET_LINK_PASSWORD = "senhadolink1";
    private static final String RESET_LINK_PREFIX = "http://localhost:3000/nova-senha?token=";
    private static final String INVALID_LINK_MESSAGE = "Este link expirou ou já foi usado. Peça um novo.";
    private static final String TOO_MANY_ATTEMPTS_MESSAGE = "Muitas tentativas. Tente novamente em alguns minutos.";
    private static final String EMAIL_TOO_LONG_MESSAGE = "Use no máximo 254 caracteres.";
    /** Valid local part and labels, so only the 254-character limit fails. */
    private static final String EMAIL_OVER_LIMIT = "i".repeat(64) + "@" + ("d".repeat(63) + ".").repeat(3) + "com.br";
    private static final int MAX_ATTEMPTS = 5;
    private static final Duration LINK_VALIDITY = Duration.ofHours(1);
    private static final String SMTP_REJECTION = "550 5.1.1 <paula@fluiar.com.br>: Recipient address rejected";
    /** The other transaction only holds the user's lock, so the requests queue up behind it and overlap. */
    private static final Consumer<User> NO_CHANGE = user -> {
    };

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Test
    void requestSendsLinkToExistingAccount() {
        createAdmin(PAULA_NAME, PAULA_EMAIL);

        var result = requestReset(PAULA_EMAIL);

        assertThat(result).hasStatus(HttpStatus.ACCEPTED);
        SimpleMailMessage email = lastEmailTo(PAULA_EMAIL);
        assertThat(email.getFrom()).isEqualTo("nao-responda@fluiar.com.br");
        assertThat(email.getSubject()).isEqualTo("Redefinição de senha — Seleção Fluiar");
        assertThat(email.getText()).startsWith("Olá, Paula Hooper.").contains(RESET_LINK_PREFIX);
    }

    @Test
    void requestIgnoresEmailCaseAndSpaces() {
        createAdmin(PAULA_NAME, PAULA_EMAIL);

        var result = requestReset(" Paula@Fluiar.com.br ");

        assertThat(result).hasStatus(HttpStatus.ACCEPTED);
        assertThat(lastEmailTo(PAULA_EMAIL).getText()).contains(RESET_LINK_PREFIX);
    }

    @Test
    void requestForUnknownEmailSendsNothing() {
        createAdmin(PAULA_NAME, PAULA_EMAIL);

        var result = requestReset(UNKNOWN_EMAIL);

        assertThat(result).hasStatus(HttpStatus.ACCEPTED);
        verify(mailSender, never()).send(any(SimpleMailMessage.class));
    }

    @Test
    @ExtendWith(OutputCaptureExtension.class)
    void failedEmailDeliveryAnswersGenericErrorAndKeepsNoLink(CapturedOutput output) {
        createAdmin(PAULA_NAME, PAULA_EMAIL);
        doThrow(new MailSendException(SMTP_REJECTION)).when(mailSender).send(any(SimpleMailMessage.class));

        var result = requestReset(PAULA_EMAIL);

        assertThat(result).hasStatus(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(result).bodyJson().extractingPath("$.detail")
                .isEqualTo("Não conseguimos enviar o e-mail agora. Tente novamente em alguns minutos.");
        assertThat(result).bodyText().doesNotContain(SMTP_REJECTION, PAULA_EMAIL);
        assertThat(storedResetLinks()).isZero();
        List<String> mailFailureLogs =
                output.getOut().lines().filter(line -> line.contains("MailSendException")).toList();
        assertThat(mailFailureLogs).singleElement().asString().contains("ERROR");
        assertThat(output.getOut()).doesNotContain(SMTP_REJECTION, PAULA_EMAIL);
    }

    @Test
    void requestReportsInvalidEmail() {
        var result = requestReset("paula@");

        assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(result).bodyJson().extractingPath("$.errors.email")
                .isEqualTo("Digite um e-mail válido, como nome@email.com.");
    }

    @Test
    void linkExpiresOneHourAfterTheRequest() {
        createAdmin(PAULA_NAME, PAULA_EMAIL);
        Instant requestedAfter = Instant.now();

        resetTokenSentTo(PAULA_EMAIL);

        Instant requestedBefore = Instant.now();
        Instant expiresAt = jdbc.queryForObject("select expires_at from password_reset_tokens", Timestamp.class)
                .toInstant();
        assertThat(expiresAt).isBetween(requestedAfter.plus(LINK_VALIDITY), requestedBefore.plus(LINK_VALIDITY));
    }

    @Test
    void inspectReturnsAccountEmail() {
        createAdmin(PAULA_NAME, PAULA_EMAIL);
        String token = resetTokenSentTo(PAULA_EMAIL);

        var result = inspect(token);

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(result).bodyJson().extractingPath("$.email").isEqualTo(PAULA_EMAIL);
    }

    @Test
    void resetChangesPasswordAndRevokesSessions() {
        var session = createAdmin(PAULA_NAME, PAULA_EMAIL);
        String token = resetTokenSentTo(PAULA_EMAIL);

        var result = resetPassword(token, NEW_PASSWORD);

        assertThat(result).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(requestLogIn(PAULA_EMAIL, NEW_PASSWORD)).hasStatus(HttpStatus.OK);
        assertThat(requestLogIn(PAULA_EMAIL, DEFAULT_PASSWORD)).hasStatus(HttpStatus.UNAUTHORIZED);
        assertThat(requestMe(session.token())).hasStatus(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void resetDuringPasswordChangeDoesNotRollBackTheVersion() throws Exception {
        var session = createAdmin(PAULA_NAME, PAULA_EMAIL);
        String token = resetTokenSentTo(PAULA_EMAIL);
        String concurrentPasswordHash = passwordEncoder.encode(CONCURRENT_PASSWORD);

        var result = requestDuringConcurrentUserChange(session,
                user -> user.changePassword(concurrentPasswordHash),
                () -> resetPassword(token, NEW_PASSWORD));

        assertThat(result).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(storedCredentialsVersion(session)).isEqualTo(2);
        assertThat(requestLogIn(PAULA_EMAIL, NEW_PASSWORD)).hasStatus(HttpStatus.OK);
    }

    @Test
    void overlappingResetsWithTheSameLinkChangeThePasswordOnce() throws Exception {
        var session = createAdmin(PAULA_NAME, PAULA_EMAIL);
        String token = resetTokenSentTo(PAULA_EMAIL);

        var results = requestsDuringConcurrentUserChange(session, NO_CHANGE, List.of(
                () -> resetPassword(token, NEW_PASSWORD),
                () -> resetPassword(token, CONCURRENT_PASSWORD)));

        assertOnlyOneResetApplied(session, results, List.of(NEW_PASSWORD, CONCURRENT_PASSWORD));
    }

    @Test
    void overlappingResetsWithTwoPendingLinksChangeThePasswordOnce() throws Exception {
        var session = createAdmin(PAULA_NAME, PAULA_EMAIL);
        String firstToken = resetTokenSentTo(PAULA_EMAIL);
        String secondToken = resetTokenSentTo(PAULA_EMAIL);

        var results = requestsDuringConcurrentUserChange(session, NO_CHANGE, List.of(
                () -> resetPassword(firstToken, NEW_PASSWORD),
                () -> resetPassword(secondToken, CONCURRENT_PASSWORD)));

        assertOnlyOneResetApplied(session, results, List.of(NEW_PASSWORD, CONCURRENT_PASSWORD));
    }

    @Test
    void emailChangeInvalidatesPendingLinks() {
        var session = createAdmin(PAULA_NAME, PAULA_EMAIL);
        String token = resetTokenSentTo(PAULA_EMAIL);
        assertThat(requestProfileUpdate(session, PAULA_NAME, PAULA_NEW_EMAIL, DEFAULT_PASSWORD)).hasStatus(HttpStatus.OK);

        var inspection = inspect(token);
        var confirmation = resetPassword(token, NEW_PASSWORD);

        assertThat(inspection).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(inspection).bodyJson().extractingPath("$.detail").isEqualTo(INVALID_LINK_MESSAGE);
        assertThat(confirmation).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(confirmation).bodyJson().extractingPath("$.detail").isEqualTo(INVALID_LINK_MESSAGE);
    }

    @Test
    void passwordChangeInvalidatesPendingLinks() {
        var session = createAdmin(PAULA_NAME, PAULA_EMAIL);
        String token = resetTokenSentTo(PAULA_EMAIL);
        assertThat(requestPasswordChange(session, DEFAULT_PASSWORD, NEW_PASSWORD)).hasStatus(HttpStatus.OK);

        var result = resetPassword(token, RESET_LINK_PASSWORD);

        assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(result).bodyJson().extractingPath("$.detail").isEqualTo(INVALID_LINK_MESSAGE);
        assertThat(requestLogIn(PAULA_EMAIL, NEW_PASSWORD)).hasStatus(HttpStatus.OK);
    }

    @Test
    void profileUpdateWithoutEmailChangeKeepsPendingLinks() {
        var session = createAdmin(PAULA_NAME, PAULA_EMAIL);
        String token = resetTokenSentTo(PAULA_EMAIL);
        assertThat(requestProfileUpdate(session, PAULA_NEW_NAME, "PAULA@fluiar.com.br")).hasStatus(HttpStatus.OK);

        var result = inspect(token);

        assertThat(result).hasStatus(HttpStatus.OK);
    }

    @Test
    void requestDuringEmailChangeSendsNoLinkToTheOldAddress() throws Exception {
        var session = createAdmin(PAULA_NAME, PAULA_EMAIL);

        var result = requestDuringConcurrentUserChange(session,
                user -> user.changeEmail(PAULA_NEW_EMAIL),
                () -> requestReset(PAULA_EMAIL));

        assertThat(result).hasStatus(HttpStatus.ACCEPTED);
        verify(mailSender, never()).send(any(SimpleMailMessage.class));
        assertThat(storedResetLinks()).isZero();
    }

    @Test
    void resetReportsEachInvalidField() {
        var result = resetPassword("", "curta");

        assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(result).bodyJson().extractingPath("$.errors.token").isEqualTo("Preencha este campo.");
        assertThat(result).bodyJson().extractingPath("$.errors.newPassword").isEqualTo("Use entre 8 e 72 caracteres.");
    }

    @Test
    void resetLinkWorksOnlyOnce() {
        createAdmin(PAULA_NAME, PAULA_EMAIL);
        String token = resetTokenSentTo(PAULA_EMAIL);
        assertThat(resetPassword(token, NEW_PASSWORD)).hasStatus(HttpStatus.NO_CONTENT);

        var result = resetPassword(token, NEW_PASSWORD);

        assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(result).bodyJson().extractingPath("$.detail").isEqualTo(INVALID_LINK_MESSAGE);
    }

    @Test
    void resetInvalidatesOtherPendingLinks() {
        createAdmin(PAULA_NAME, PAULA_EMAIL);
        String olderToken = resetTokenSentTo(PAULA_EMAIL);
        String newerToken = resetTokenSentTo(PAULA_EMAIL);
        assertThat(resetPassword(newerToken, NEW_PASSWORD)).hasStatus(HttpStatus.NO_CONTENT);

        var result = inspect(olderToken);

        assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(result).bodyJson().extractingPath("$.detail").isEqualTo(INVALID_LINK_MESSAGE);
    }

    @Test
    void expiredLinkIsRejected() {
        createAdmin(PAULA_NAME, PAULA_EMAIL);
        String token = resetTokenSentTo(PAULA_EMAIL);
        jdbc.update("update password_reset_tokens set expires_at = now() - interval '1 minute'");

        var result = inspect(token);

        assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(result).bodyJson().extractingPath("$.detail").isEqualTo(INVALID_LINK_MESSAGE);
    }

    @Test
    void requestRejectsEmailLongerThanTheLimit() {
        var result = requestReset(EMAIL_OVER_LIMIT);

        assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(result).bodyJson().extractingPath("$.errors.email").isEqualTo(EMAIL_TOO_LONG_MESSAGE);
    }

    @Test
    void requestBlocksTheEmailAfterTooManyAttempts() {
        createAdmin(PAULA_NAME, PAULA_EMAIL);

        for (int attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            assertThat(requestReset(PAULA_EMAIL)).hasStatus(HttpStatus.ACCEPTED);
        }

        var result = requestReset(PAULA_EMAIL);

        assertThat(result).hasStatus(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(result).bodyJson().extractingPath("$.detail").isEqualTo(TOO_MANY_ATTEMPTS_MESSAGE);
        verify(mailSender, times(MAX_ATTEMPTS)).send(any(SimpleMailMessage.class));
    }

    @Test
    void requestCountsAttemptsOfUnknownEmails() {
        for (int attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            assertThat(requestReset(UNKNOWN_EMAIL)).hasStatus(HttpStatus.ACCEPTED);
        }

        var result = requestReset(UNKNOWN_EMAIL);

        assertThat(result).hasStatus(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(result).bodyJson().extractingPath("$.detail").isEqualTo(TOO_MANY_ATTEMPTS_MESSAGE);
    }

    /**
     * Exactly one of two overlapping resets is applied: the other one finds its link already gone, and only the
     * password of the applied reset works.
     */
    private void assertOnlyOneResetApplied(TestSession session, List<MvcTestResult> results, List<String> passwords) {
        List<Integer> statuses = results.stream().map(result -> result.getResponse().getStatus()).toList();
        assertThat(statuses).containsExactlyInAnyOrder(HttpStatus.NO_CONTENT.value(), HttpStatus.BAD_REQUEST.value());

        int applied = statuses.indexOf(HttpStatus.NO_CONTENT.value());
        int rejected = 1 - applied;
        assertThat(results.get(rejected)).bodyJson().extractingPath("$.detail").isEqualTo(INVALID_LINK_MESSAGE);
        assertThat(storedCredentialsVersion(session)).isEqualTo(1);
        assertThat(requestLogIn(PAULA_EMAIL, passwords.get(applied))).hasStatus(HttpStatus.OK);
        assertThat(requestLogIn(PAULA_EMAIL, passwords.get(rejected))).hasStatus(HttpStatus.UNAUTHORIZED);
    }

    private int storedResetLinks() {
        return jdbc.queryForObject("select count(*) from password_reset_tokens", Integer.class);
    }

    /** Requests a reset link and returns the token of the link sent by e-mail. */
    private String resetTokenSentTo(String email) {
        assertThat(requestReset(email)).hasStatus(HttpStatus.ACCEPTED);
        return extractToken(lastEmailTo(email).getText());
    }

    private MvcTestResult requestReset(String email) {
        return mvc.post().uri("/api/auth/password-reset-requests")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("email", email)))
                .exchange();
    }

    private MvcTestResult inspect(String token) {
        return mvc.get().uri("/api/auth/password-resets/{token}", token).exchange();
    }

    private MvcTestResult resetPassword(String token, String newPassword) {
        return mvc.post().uri("/api/auth/password-resets")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("token", token, "newPassword", newPassword)))
                .exchange();
    }

    private MvcTestResult requestProfileUpdate(TestSession session, String name, String email) {
        return mvc.put().uri("/api/me")
                .header(HttpHeaders.AUTHORIZATION, bearer(session))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("name", name, "email", email)))
                .exchange();
    }

    private MvcTestResult requestProfileUpdate(
            TestSession session, String name, String email, String currentPassword) {
        Map<String, String> body = new HashMap<>();
        body.put("name", name);
        body.put("email", email);
        body.put("currentPassword", currentPassword);
        return mvc.put().uri("/api/me")
                .header(HttpHeaders.AUTHORIZATION, bearer(session))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(body))
                .exchange();
    }

    private MvcTestResult requestPasswordChange(TestSession session, String currentPassword, String newPassword) {
        return mvc.put().uri("/api/me/password")
                .header(HttpHeaders.AUTHORIZATION, bearer(session))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("currentPassword", currentPassword, "newPassword", newPassword)))
                .exchange();
    }

    private MvcTestResult requestLogIn(String email, String password) {
        return mvc.post().uri("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("email", email, "password", password)))
                .exchange();
    }

    private MvcTestResult requestMe(String token) {
        return mvc.get().uri("/api/me").header(HttpHeaders.AUTHORIZATION, bearer(token)).exchange();
    }
}
