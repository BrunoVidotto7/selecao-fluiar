package br.com.fluiar.selecao.controller;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.fluiar.selecao.config.AppProperties;
import br.com.fluiar.selecao.model.User;
import br.com.fluiar.selecao.repository.UserRepository;
import br.com.fluiar.selecao.security.TokenService;
import br.com.fluiar.selecao.support.ApiIntegrationTest;
import java.time.Clock;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.test.web.servlet.assertj.MvcTestResult;

class AccountControllerTest extends ApiIntegrationTest {

    private static final String PAULA_NAME = "Paula Hooper";
    private static final String PAULA_EMAIL = "paula@fluiar.com.br";
    private static final String PAULA_NEW_NAME = "Paula H.";
    private static final String PAULA_NEW_EMAIL = "paula.h@fluiar.com.br";
    private static final String ISABELA_NAME = "Isabela Lima";
    private static final String ISABELA_EMAIL = "isabela@fluiar.com.br";
    private static final String WRONG_PASSWORD = "errada123";
    private static final String NEW_PASSWORD = "novasenha1";
    private static final int MAX_ATTEMPTS = 5;
    private static final String WRONG_CURRENT_PASSWORD_MESSAGE = "Senha atual incorreta.";
    private static final String EMAIL_PASSWORD_REQUIRED_MESSAGE = "Informe a senha atual para trocar o e-mail.";
    private static final String TOO_MANY_ATTEMPTS_MESSAGE = "Muitas tentativas. Tente novamente em alguns minutos.";

    @Autowired
    private JwtDecoder jwtDecoder;

    @Autowired
    private JwtEncoder jwtEncoder;

    @Autowired
    private AppProperties appProperties;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Test
    void meReturnsAuthenticatedUser() {
        createAdmin(ISABELA_NAME, ISABELA_EMAIL);
        var session = createAdmin(PAULA_NAME, PAULA_EMAIL);

        var result = mvc.get().uri("/api/me").header(HttpHeaders.AUTHORIZATION, bearer(session));

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(result).bodyJson().extractingPath("$.email").isEqualTo(PAULA_EMAIL);
        assertThat(result).bodyJson().extractingPath("$.officeId").isEqualTo(session.officeId().toString());
    }

    @Test
    void meWithoutTokenIsUnauthorized() {
        var result = mvc.get().uri("/api/me");

        assertThat(result).hasStatus(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void meWithTamperedTokenIsUnauthorized() {
        var session = createAdmin(PAULA_NAME, PAULA_EMAIL);

        var result = mvc.get().uri("/api/me").header(HttpHeaders.AUTHORIZATION, bearer(session) + "x");

        assertThat(result).hasStatus(HttpStatus.UNAUTHORIZED);
    }

    @ParameterizedTest
    @CsvSource({"PT11H, OK", "PT13H, UNAUTHORIZED"})
    void meAcceptsTokenOnlyUntilItExpires(Duration tokenAge, HttpStatus expectedStatus) {
        var session = createAdmin(PAULA_NAME, PAULA_EMAIL);

        var result = requestMe(regularTokenIssuedAgo(session, tokenAge));

        assertThat(result).hasStatus(expectedStatus);
    }

    @Test
    void meWithTokenOfDeletedAccountIsUnauthorized() {
        var session = createAdmin(PAULA_NAME, PAULA_EMAIL);
        jdbc.update("DELETE FROM users WHERE id = ?", session.userId());

        var result = requestMe(session.token());

        assertThat(result).hasStatus(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void updateProfileChangesNameAndEmail() {
        var session = createAdmin(PAULA_NAME, PAULA_EMAIL);

        var result = requestProfileUpdate(session, PAULA_NEW_NAME, PAULA_NEW_EMAIL, DEFAULT_PASSWORD);

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(result).bodyJson().extractingPath("$.name").isEqualTo(PAULA_NEW_NAME);
        assertThat(result).bodyJson().extractingPath("$.email").isEqualTo(PAULA_NEW_EMAIL);
        assertThat(requestLogIn(PAULA_NEW_EMAIL, DEFAULT_PASSWORD)).hasStatus(HttpStatus.OK);
    }

    @Test
    void updateProfileRejectsEmailOfAnotherAccount() {
        createAdmin(ISABELA_NAME, ISABELA_EMAIL);
        var session = createAdmin(PAULA_NAME, PAULA_EMAIL);

        var result = requestProfileUpdate(session, PAULA_NAME, " ISABELA@fluiar.com.br", DEFAULT_PASSWORD);

        assertThat(result).hasStatus(HttpStatus.CONFLICT);
        assertThat(result).bodyJson().extractingPath("$.errors.email").isEqualTo("Este e-mail já tem uma conta.");
    }

    @Test
    void updateProfileAcceptsOwnEmailInAnotherCase() {
        var session = createAdmin(PAULA_NAME, PAULA_EMAIL);

        var result = requestProfileUpdate(session, PAULA_NAME, "PAULA@fluiar.com.br");

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(result).bodyJson().extractingPath("$.email").isEqualTo(PAULA_EMAIL);
    }

    @Test
    void updateProfileReportsEachInvalidField() {
        var session = createAdmin(PAULA_NAME, PAULA_EMAIL);

        var result = requestProfileUpdate(session, "", "paula@");

        assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(result).bodyJson().extractingPath("$.errors.name").isEqualTo("Preencha este campo.");
        assertThat(result).bodyJson().extractingPath("$.errors.email")
                .isEqualTo("Digite um e-mail válido, como nome@email.com.");
    }

    @Test
    void changePasswordRequiresCurrentPassword() {
        var session = createAdmin(PAULA_NAME, PAULA_EMAIL);

        var result = requestPasswordChange(session, WRONG_PASSWORD, NEW_PASSWORD);

        assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(result).bodyJson().extractingPath("$.errors.currentPassword")
                .isEqualTo(WRONG_CURRENT_PASSWORD_MESSAGE);
    }

    @Test
    void changePasswordReportsEachInvalidField() {
        var session = createAdmin(PAULA_NAME, PAULA_EMAIL);

        var result = requestPasswordChange(session, "", "curta");

        assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(result).bodyJson().extractingPath("$.errors.currentPassword").isEqualTo("Preencha este campo.");
        assertThat(result).bodyJson().extractingPath("$.errors.newPassword").isEqualTo("Use entre 8 e 72 caracteres.");
    }

    @Test
    void changePasswordRevokesOldTokens() {
        var session = createAdmin(PAULA_NAME, PAULA_EMAIL);

        var result = requestPasswordChange(session, DEFAULT_PASSWORD, NEW_PASSWORD);

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(requestMe(session.token())).hasStatus(HttpStatus.UNAUTHORIZED);
        assertThat(requestMe(readJson(result, "$.accessToken"))).hasStatus(HttpStatus.OK);
        assertThat(requestLogIn(PAULA_EMAIL, NEW_PASSWORD)).hasStatus(HttpStatus.OK);
    }

    @Test
    void changePasswordIssuesRegularToken() {
        var session = createAdmin(PAULA_NAME, PAULA_EMAIL);

        var result = requestPasswordChange(session, DEFAULT_PASSWORD, NEW_PASSWORD);

        assertThat(result).hasStatus(HttpStatus.OK);
        Jwt token = jwtDecoder.decode(readJson(result, "$.accessToken"));
        assertThat(Duration.between(token.getIssuedAt(), token.getExpiresAt())).isEqualTo(Duration.ofHours(12));
    }

    @Test
    void profileUpdateDuringPasswordChangeKeepsTheNewPassword() throws Exception {
        var session = createAdmin(PAULA_NAME, PAULA_EMAIL);
        String newPasswordHash = passwordEncoder.encode(NEW_PASSWORD);

        var result = requestDuringConcurrentUserChange(session,
                user -> user.changePassword(newPasswordHash),
                () -> requestProfileUpdate(session, PAULA_NEW_NAME, PAULA_EMAIL));

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(storedCredentialsVersion(session)).isEqualTo(1);
        assertThat(requestMe(session.token())).hasStatus(HttpStatus.UNAUTHORIZED);
        var logIn = requestLogIn(PAULA_EMAIL, NEW_PASSWORD);
        assertThat(logIn).hasStatus(HttpStatus.OK);
        assertThat(logIn).bodyJson().extractingPath("$.user.name").isEqualTo(PAULA_NEW_NAME);
    }

    @Test
    void passwordChangeDuringProfileUpdateKeepsTheNewName() throws Exception {
        var session = createAdmin(PAULA_NAME, PAULA_EMAIL);

        var result = requestDuringConcurrentUserChange(session,
                user -> user.rename(PAULA_NEW_NAME),
                () -> requestPasswordChange(session, DEFAULT_PASSWORD, NEW_PASSWORD));

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(storedCredentialsVersion(session)).isEqualTo(1);
        assertThat(requestMe(session.token())).hasStatus(HttpStatus.UNAUTHORIZED);
        assertThat(requestMe(readJson(result, "$.accessToken"))).hasStatus(HttpStatus.OK);
        var logIn = requestLogIn(PAULA_EMAIL, NEW_PASSWORD);
        assertThat(logIn).hasStatus(HttpStatus.OK);
        assertThat(logIn).bodyJson().extractingPath("$.user.name").isEqualTo(PAULA_NEW_NAME);
    }

    @Test
    void updateProfileRequiresCurrentPasswordToChangeEmail() {
        var session = createAdmin(PAULA_NAME, PAULA_EMAIL);

        var result = requestProfileUpdate(session, PAULA_NAME, PAULA_NEW_EMAIL);

        assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(result).bodyJson().extractingPath("$.errors.currentPassword")
                .isEqualTo(EMAIL_PASSWORD_REQUIRED_MESSAGE);
        assertThat(requestMe(session.token())).bodyJson().extractingPath("$.email").isEqualTo(PAULA_EMAIL);
    }

    @Test
    void updateProfileChecksThePasswordBeforeTellingTheEmailIsInUse() {
        createAdmin(ISABELA_NAME, ISABELA_EMAIL);
        var session = createAdmin(PAULA_NAME, PAULA_EMAIL);

        var result = requestProfileUpdate(session, PAULA_NAME, ISABELA_EMAIL, WRONG_PASSWORD);

        assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(result).bodyJson().extractingPath("$.errors.currentPassword")
                .isEqualTo(WRONG_CURRENT_PASSWORD_MESSAGE);
        assertThat(requestMe(session.token())).bodyJson().extractingPath("$.email").isEqualTo(PAULA_EMAIL);
    }

    @Test
    void updateProfileChangingOnlyTheNameNeedsNoPassword() {
        var session = createAdmin(PAULA_NAME, PAULA_EMAIL);

        var result = requestProfileUpdate(session, PAULA_NEW_NAME, PAULA_EMAIL);

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(result).bodyJson().extractingPath("$.name").isEqualTo(PAULA_NEW_NAME);
    }

    @Test
    void changePasswordBlocksAfterTooManyGuesses() {
        var session = createAdmin(PAULA_NAME, PAULA_EMAIL);

        for (int attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            assertThat(requestPasswordChange(session, WRONG_PASSWORD, NEW_PASSWORD))
                    .hasStatus(HttpStatus.BAD_REQUEST);
        }

        var result = requestPasswordChange(session, DEFAULT_PASSWORD, NEW_PASSWORD);

        assertThat(result).hasStatus(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(result).bodyJson().extractingPath("$.detail").isEqualTo(TOO_MANY_ATTEMPTS_MESSAGE);
    }

    @Test
    void emailChangeAndPasswordChangeShareTheAttemptBudget() {
        var session = createAdmin(PAULA_NAME, PAULA_EMAIL);

        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            assertThat(requestProfileUpdate(session, PAULA_NAME, "paula." + attempt + "@fluiar.com.br", WRONG_PASSWORD))
                    .hasStatus(HttpStatus.BAD_REQUEST);
        }

        var blocked = requestPasswordChange(session, DEFAULT_PASSWORD, NEW_PASSWORD);

        assertThat(blocked).hasStatus(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(blocked).bodyJson().extractingPath("$.detail").isEqualTo(TOO_MANY_ATTEMPTS_MESSAGE);
        assertThat(requestMe(session.token())).bodyJson().extractingPath("$.email").isEqualTo(PAULA_EMAIL);
    }

    @Test
    void successfulCurrentPasswordCheckClearsTheAttemptCount() {
        var session = createAdmin(PAULA_NAME, PAULA_EMAIL);

        for (int attempt = 0; attempt < MAX_ATTEMPTS - 1; attempt++) {
            assertThat(requestPasswordChange(session, WRONG_PASSWORD, NEW_PASSWORD))
                    .hasStatus(HttpStatus.BAD_REQUEST);
        }
        assertThat(requestProfileUpdate(session, PAULA_NAME, PAULA_NEW_EMAIL, DEFAULT_PASSWORD))
                .hasStatus(HttpStatus.OK);

        for (int attempt = 0; attempt < MAX_ATTEMPTS - 1; attempt++) {
            assertThat(requestPasswordChange(session, WRONG_PASSWORD, NEW_PASSWORD))
                    .hasStatus(HttpStatus.BAD_REQUEST);
        }
        assertThat(requestPasswordChange(session, DEFAULT_PASSWORD, NEW_PASSWORD)).hasStatus(HttpStatus.OK);
    }

    /** A correctly signed token with the user's current credentials version, issued by a clock moved back by age. */
    private String regularTokenIssuedAgo(TestSession session, Duration age) {
        Clock pastClock = Clock.offset(Clock.systemUTC(), age.negated());
        User user = userRepository.findById(session.userId()).orElseThrow();

        return new TokenService(jwtEncoder, pastClock, appProperties).issue(user, false).value();
    }

    private MvcTestResult requestMe(String token) {
        return mvc.get().uri("/api/me").header(HttpHeaders.AUTHORIZATION, bearer(token)).exchange();
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
}
