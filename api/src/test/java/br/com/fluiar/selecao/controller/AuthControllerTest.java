package br.com.fluiar.selecao.controller;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.fluiar.selecao.support.ApiIntegrationTest;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.util.StringUtils;

class AuthControllerTest extends ApiIntegrationTest {

    private static final String PAULA_NAME = "Paula Hooper";
    private static final String PAULA_EMAIL = "paula@fluiar.com.br";
    private static final String ISABELA_NAME = "Isabela Lima";
    private static final String ISABELA_EMAIL = "isabela@fluiar.com.br";
    private static final String UNKNOWN_EMAIL = "ninguem@fluiar.com.br";
    private static final String WRONG_PASSWORD = "errada123";
    private static final int MAX_ATTEMPTS = 5;
    private static final int MAX_ATTEMPTS_PER_IP = 30;
    private static final int MAX_ATTEMPTS_PER_EMAIL = 50;
    private static final String ATTACKER_IP = "203.0.113.7";
    private static final String OWNER_IP = "198.51.100.20";
    private static final String PRIVATE_IP = "10.0.0.5";
    private static final String INVALID_CREDENTIALS_MESSAGE = "E-mail ou senha incorretos.";
    private static final String TOO_MANY_ATTEMPTS_MESSAGE = "Muitas tentativas. Tente novamente em alguns minutos.";
    private static final String EMAIL_TOO_LONG_MESSAGE = "Use no máximo 254 caracteres.";
    private static final String EMAIL_OVER_LIMIT = "a".repeat(250) + "@fluiar.com.br";

    @Autowired
    private JwtDecoder jwtDecoder;

    @LocalServerPort
    private int port;

    @Test
    void publicSignupCannotCreateAccounts() {
        var result = requestSignUp(PAULA_NAME, PAULA_EMAIL, DEFAULT_PASSWORD);
        assertThat(result).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(jdbc.queryForObject("select count(*) from users", Integer.class)).isZero();
    }

    @Test
    void logInIgnoresEmailCase() {
        createAdmin(PAULA_NAME, PAULA_EMAIL);

        var result = requestLogIn("PAULA@fluiar.com.br", DEFAULT_PASSWORD);

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(result).bodyJson().extractingPath("$.user.name").isEqualTo(PAULA_NAME);
    }

    @Test
    void logInWithWrongPasswordFails() {
        createAdmin(PAULA_NAME, PAULA_EMAIL);

        var result = requestLogIn(PAULA_EMAIL, WRONG_PASSWORD);

        assertThat(result).hasStatus(HttpStatus.UNAUTHORIZED);
        assertThat(result).bodyJson().extractingPath("$.detail").isEqualTo(INVALID_CREDENTIALS_MESSAGE);
    }

    @Test
    void logInWithUnknownEmailFailsWithSameMessage() {
        var result = requestLogIn(UNKNOWN_EMAIL, DEFAULT_PASSWORD);

        assertThat(result).hasStatus(HttpStatus.UNAUTHORIZED);
        assertThat(result).bodyJson().extractingPath("$.detail").isEqualTo(INVALID_CREDENTIALS_MESSAGE);
    }

    @Test
    @ExtendWith(OutputCaptureExtension.class)
    void logInsAreLoggedAsAuditEventsWithoutCredentials(CapturedOutput output) {
        createAdmin(PAULA_NAME, PAULA_EMAIL);

        requestLogInFrom(ATTACKER_IP, PAULA_EMAIL, WRONG_PASSWORD);
        requestLogInFrom(ATTACKER_IP, UNKNOWN_EMAIL, DEFAULT_PASSWORD);

        assertThat(output.getOut()).contains("auth.login result=rejected userId=none");
        assertThat(StringUtils.countOccurrencesOf(output.getOut(), "auth.login result=rejected")).isEqualTo(2);
        assertThat(output.getOut()).doesNotContain(PAULA_EMAIL, UNKNOWN_EMAIL, WRONG_PASSWORD, DEFAULT_PASSWORD,
                ATTACKER_IP);
    }

    @Test
    void rememberMeIssuesLongerToken() {
        createAdmin(PAULA_NAME, PAULA_EMAIL);
        Instant now = Instant.now();

        var remembered = requestLogIn(PAULA_EMAIL, DEFAULT_PASSWORD, true);
        var regular = requestLogIn(PAULA_EMAIL, DEFAULT_PASSWORD, false);

        assertThat(remembered).hasStatus(HttpStatus.OK);
        assertThat(regular).hasStatus(HttpStatus.OK);
        assertThat(Instant.parse(readJson(remembered, "$.expiresAt"))).isAfter(now.plus(Duration.ofDays(29)));
        assertThat(Instant.parse(readJson(regular, "$.expiresAt"))).isBefore(now.plus(Duration.ofHours(13)));
    }

    @ParameterizedTest
    @CsvSource({"true, P30D", "false, PT12H"})
    void signedTokenExpiresAtTheReportedInstant(boolean rememberMe, Duration lifetime) {
        createAdmin(PAULA_NAME, PAULA_EMAIL);

        var result = requestLogIn(PAULA_EMAIL, DEFAULT_PASSWORD, rememberMe);

        assertThat(result).hasStatus(HttpStatus.OK);
        Jwt token = decodeAccessToken(result);
        assertThat(token.getExpiresAt()).isEqualTo(Instant.parse(readJson(result, "$.expiresAt")));
        assertThat(Duration.between(token.getIssuedAt(), token.getExpiresAt())).isEqualTo(lifetime);
    }

    @Test
    void logInWithoutRememberMeIssuesRegularToken() {
        createAdmin(PAULA_NAME, PAULA_EMAIL);

        var result = requestLogIn(PAULA_EMAIL, DEFAULT_PASSWORD);

        assertThat(result).hasStatus(HttpStatus.OK);
        Jwt token = decodeAccessToken(result);
        assertThat(Duration.between(token.getIssuedAt(), token.getExpiresAt())).isEqualTo(Duration.ofHours(12));
    }

    @Test
    void logInRejectsEmailLongerThanTheLimit() {
        var result = requestLogIn(EMAIL_OVER_LIMIT, DEFAULT_PASSWORD);

        assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(result).bodyJson().extractingPath("$.errors.email").isEqualTo(EMAIL_TOO_LONG_MESSAGE);
    }

    @Test
    void logInBlocksTheEmailAfterTooManyAttempts() {
        createAdmin(PAULA_NAME, PAULA_EMAIL);
        createAdmin(ISABELA_NAME, ISABELA_EMAIL);

        for (int attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            assertThat(requestLogIn(PAULA_EMAIL, WRONG_PASSWORD)).hasStatus(HttpStatus.UNAUTHORIZED);
        }

        var blocked = requestLogIn(PAULA_EMAIL, DEFAULT_PASSWORD);

        assertThat(blocked).hasStatus(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(blocked).bodyJson().extractingPath("$.detail").isEqualTo(TOO_MANY_ATTEMPTS_MESSAGE);
        assertThat(requestLogIn(ISABELA_EMAIL, DEFAULT_PASSWORD)).hasStatus(HttpStatus.OK);
    }

    @Test
    void anotherAddressCanStillLogInToAnAccountLockedFromElsewhere() {
        createAdmin(PAULA_NAME, PAULA_EMAIL);
        for (int attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            assertThat(requestLogInFrom(ATTACKER_IP, PAULA_EMAIL, WRONG_PASSWORD)).hasStatus(HttpStatus.UNAUTHORIZED);
        }

        assertThat(requestLogInFrom(ATTACKER_IP, PAULA_EMAIL, DEFAULT_PASSWORD)).hasStatus(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(requestLogInFrom(OWNER_IP, PAULA_EMAIL, DEFAULT_PASSWORD)).hasStatus(HttpStatus.OK);
    }

    @Test
    void guessingOneAccountFromManyAddressesIsStopped() {
        createAdmin(PAULA_NAME, PAULA_EMAIL);
        for (int attempt = 0; attempt < MAX_ATTEMPTS_PER_EMAIL; attempt++) {
            assertThat(requestLogInFrom("203.0.113." + attempt, PAULA_EMAIL, WRONG_PASSWORD))
                    .hasStatus(HttpStatus.UNAUTHORIZED);
        }

        assertThat(requestLogInFrom("198.51.100.99", PAULA_EMAIL, DEFAULT_PASSWORD))
                .hasStatus(HttpStatus.TOO_MANY_REQUESTS);
    }

    @Test
    void oneAddressTryingManyEmailsIsThrottled() {
        for (int attempt = 0; attempt < MAX_ATTEMPTS_PER_IP; attempt++) {
            assertThat(requestLogInFrom(ATTACKER_IP, "user" + attempt + "@fluiar.com.br", WRONG_PASSWORD))
                    .hasStatus(HttpStatus.UNAUTHORIZED);
        }

        assertThat(requestLogInFrom(ATTACKER_IP, UNKNOWN_EMAIL, WRONG_PASSWORD)).hasStatus(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(requestLogInFrom(OWNER_IP, UNKNOWN_EMAIL, WRONG_PASSWORD)).hasStatus(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void theApiCountsTheForwardedAddressSentByTheNextServer() throws Exception {
        for (int attempt = 0; attempt < MAX_ATTEMPTS_PER_IP; attempt++) {
            assertThat(postLogInOverHttp(ATTACKER_IP, "user" + attempt + "@fluiar.com.br"))
                    .isEqualTo(HttpStatus.UNAUTHORIZED.value());
        }

        assertThat(postLogInOverHttp(ATTACKER_IP, UNKNOWN_EMAIL)).isEqualTo(HttpStatus.TOO_MANY_REQUESTS.value());
        assertThat(postLogInOverHttp(OWNER_IP, UNKNOWN_EMAIL)).isEqualTo(HttpStatus.UNAUTHORIZED.value());
    }

    @Test
    void theServersPrivateAddressIsNotLimitedPerAddress() {
        for (int attempt = 0; attempt <= MAX_ATTEMPTS_PER_IP; attempt++) {
            assertThat(requestLogInFrom(PRIVATE_IP, "user" + attempt + "@fluiar.com.br", WRONG_PASSWORD))
                    .hasStatus(HttpStatus.UNAUTHORIZED);
        }
    }

    @Test
    void thePrivateAddressStillLimitsEachEmail() {
        for (int attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            assertThat(requestLogInFrom(PRIVATE_IP, UNKNOWN_EMAIL, WRONG_PASSWORD)).hasStatus(HttpStatus.UNAUTHORIZED);
        }

        assertThat(requestLogInFrom(PRIVATE_IP, UNKNOWN_EMAIL, WRONG_PASSWORD)).hasStatus(HttpStatus.TOO_MANY_REQUESTS);
    }

    @Test
    void successfulLogInsAreNeverLimitedByAddressOrEmail() {
        createAdmin(PAULA_NAME, PAULA_EMAIL);

        for (int attempt = 0; attempt < MAX_ATTEMPTS_PER_EMAIL + 10; attempt++) {
            assertThat(requestLogInFrom(ATTACKER_IP, PAULA_EMAIL, DEFAULT_PASSWORD)).hasStatus(HttpStatus.OK);
        }
    }

    @Test
    void logInCountsAttemptsOfUnknownEmails() {
        for (int attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            assertThat(requestLogIn(UNKNOWN_EMAIL, DEFAULT_PASSWORD)).hasStatus(HttpStatus.UNAUTHORIZED);
        }

        var blocked = requestLogIn(UNKNOWN_EMAIL, DEFAULT_PASSWORD);

        assertThat(blocked).hasStatus(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(blocked).bodyJson().extractingPath("$.detail").isEqualTo(TOO_MANY_ATTEMPTS_MESSAGE);
    }

    @Test
    void successfulLogInClearsTheAttemptCount() {
        createAdmin(PAULA_NAME, PAULA_EMAIL);

        for (int attempt = 0; attempt < MAX_ATTEMPTS - 1; attempt++) {
            assertThat(requestLogIn(PAULA_EMAIL, WRONG_PASSWORD)).hasStatus(HttpStatus.UNAUTHORIZED);
        }
        assertThat(requestLogIn(PAULA_EMAIL, DEFAULT_PASSWORD)).hasStatus(HttpStatus.OK);

        for (int attempt = 0; attempt < MAX_ATTEMPTS - 1; attempt++) {
            assertThat(requestLogIn(PAULA_EMAIL, WRONG_PASSWORD)).hasStatus(HttpStatus.UNAUTHORIZED);
        }
        assertThat(requestLogIn(PAULA_EMAIL, DEFAULT_PASSWORD)).hasStatus(HttpStatus.OK);
    }

    private MvcTestResult requestSignUp(String name, String email, String password) {
        return mvc.post().uri("/api/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("name", name, "email", email, "password", password)))
                .exchange();
    }

    private MvcTestResult requestLogIn(String email, String password) {
        return postLogIn(Map.of("email", email, "password", password));
    }

    private MvcTestResult requestLogIn(String email, String password, boolean rememberMe) {
        return postLogIn(Map.of("email", email, "password", password, "rememberMe", rememberMe));
    }

    private MvcTestResult requestLogInFrom(String ip, String email, String password) {
        return mvc.post().uri("/api/auth/login")
                .with(request -> {
                    request.setRemoteAddr(ip);
                    return request;
                })
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("email", email, "password", password)))
                .exchange();
    }

    /** A real HTTP call from loopback, the way the Next server calls the API. */
    private int postLogInOverHttp(String forwardedFor, String email) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/auth/login"))
                .header("Content-Type", MediaType.APPLICATION_JSON_VALUE)
                .header("X-Forwarded-For", forwardedFor)
                .POST(HttpRequest.BodyPublishers.ofString(json(Map.of("email", email, "password", WRONG_PASSWORD))))
                .build();
        return HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.discarding()).statusCode();
    }

    private MvcTestResult postLogIn(Map<String, Object> body) {
        return mvc.post().uri("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(body))
                .exchange();
    }

    private Jwt decodeAccessToken(MvcTestResult result) {
        return jwtDecoder.decode(readJson(result, "$.accessToken"));
    }
}
