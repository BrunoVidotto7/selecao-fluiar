package br.com.fluiar.selecao.support;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;

import br.com.fluiar.selecao.model.User;
import br.com.fluiar.selecao.repository.UserRepository;
import br.com.fluiar.selecao.security.AttemptLimiter;
import com.jayway.jsonpath.JsonPath;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.function.Consumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.BeforeEach;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
public abstract class ApiIntegrationTest {

    protected static final String DEFAULT_PASSWORD = "senhaforte1";

    private static final String BEARER_PREFIX = "Bearer ";
    private static final String CLIENT_EMAIL = "cliente@email.com";
    private static final String CLIENT_PHONE = "31999999999";
    private static final int PRODUCT_QUANTITY = 1;
    private static final Pattern EMAIL_TOKEN = Pattern.compile("token=([A-Za-z0-9_-]+)");
    private static final long MAX_WAIT_SECONDS = 10;

    @MockitoBean
    protected JavaMailSender mailSender;

    @Autowired
    protected MockMvcTester mvc;

    @Autowired
    protected JdbcTemplate jdbc;

    @Autowired
    protected JsonMapper jsonMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @Autowired
    private AttemptLimiter attemptLimiter;

    protected record TestSession(String token, UUID userId, UUID officeId) {
    }

    @BeforeEach
    protected void cleanDatabase() {
        jdbc.execute("TRUNCATE offices CASCADE");
    }

    /** The context is shared by every test, so attempt counts would leak from one test into the next. */
    @BeforeEach
    void clearAttemptLimiter() {
        attemptLimiter.clear();
    }

    protected String json(Object body) {
        return jsonMapper.writeValueAsString(body);
    }

    protected TestSession signUp(String name, String email) {
        var result = mvc.post().uri("/api/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("name", name, "email", email, "password", DEFAULT_PASSWORD)))
                .exchange();
        assertThat(result).hasStatus(HttpStatus.CREATED);

        return sessionOf(result);
    }

    /** The owner invites the e-mail through the API, and the invited person accepts with the link of the e-mail. */
    protected TestSession inviteMember(TestSession owner, String name, String email) {
        assertThat(requestInvitation(owner, email)).hasStatus(HttpStatus.CREATED);
        String token = extractToken(lastEmailTo(email).getText());

        var acceptance = requestInvitationAcceptance(token, name, DEFAULT_PASSWORD);
        assertThat(acceptance).hasStatus(HttpStatus.CREATED);

        return sessionOf(acceptance);
    }

    protected MvcTestResult requestInvitation(TestSession owner, String email) {
        return mvc.post().uri("/api/office/invitations")
                .header(HttpHeaders.AUTHORIZATION, bearer(owner))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("email", email)))
                .exchange();
    }

    protected MvcTestResult requestInvitationAcceptance(String token, String name, String password) {
        return mvc.post().uri("/api/auth/invitations/{token}/acceptance", token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("name", name, "password", password)))
                .exchange();
    }

    /** Creates a client of the session's office through the API and returns its id. */
    protected UUID createClient(TestSession session, String name) {
        var result = mvc.post().uri("/api/clients")
                .header(HttpHeaders.AUTHORIZATION, bearer(session))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("name", name, "email", CLIENT_EMAIL, "phone", CLIENT_PHONE)))
                .exchange();
        assertThat(result).hasStatus(HttpStatus.CREATED);

        return UUID.fromString(readJson(result, "$.id"));
    }

    /** Creates a list for the client through the API and returns its id. */
    protected UUID createList(TestSession session, UUID clientId, String name) {
        var result = mvc.post().uri("/api/lists")
                .header(HttpHeaders.AUTHORIZATION, bearer(session))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("name", name, "clientId", clientId)))
                .exchange();
        assertThat(result).hasStatus(HttpStatus.CREATED);

        return UUID.fromString(readJson(result, "$.id"));
    }

    /** Creates a room at the end of the list through the API and returns its id. */
    protected UUID createRoom(TestSession session, UUID listId, String name) {
        var result = mvc.post().uri("/api/lists/{listId}/rooms", listId)
                .header(HttpHeaders.AUTHORIZATION, bearer(session))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("name", name)))
                .exchange();
        assertThat(result).hasStatus(HttpStatus.CREATED);

        return UUID.fromString(readJson(result, "$.id"));
    }

    /** Creates a product with quantity 1, no price and no links in the room through the API, and returns its id. */
    protected UUID createProduct(TestSession session, UUID listId, UUID roomId, String name) {
        var result = mvc.post().uri("/api/lists/{listId}/products", listId)
                .header(HttpHeaders.AUTHORIZATION, bearer(session))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("roomId", roomId, "name", name, "quantity", PRODUCT_QUANTITY)))
                .exchange();
        assertThat(result).hasStatus(HttpStatus.CREATED);

        return UUID.fromString(readJson(result, "$.id"));
    }

    protected String bearer(TestSession session) {
        return bearer(session.token());
    }

    protected String bearer(String token) {
        return BEARER_PREFIX + token;
    }

    protected String readJson(MvcTestResult result, String jsonPath) {
        String body = new String(result.getResponse().getContentAsByteArray(), StandardCharsets.UTF_8);
        return JsonPath.read(body, jsonPath);
    }

    protected SimpleMailMessage lastEmailTo(String recipient) {
        ArgumentCaptor<SimpleMailMessage> sentEmails = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mailSender, atLeastOnce()).send(sentEmails.capture());

        List<SimpleMailMessage> emailsToRecipient = sentEmails.getAllValues().stream()
                .filter(email -> List.of(email.getTo()).contains(recipient))
                .toList();
        assertThat(emailsToRecipient).isNotEmpty();
        return emailsToRecipient.getLast();
    }

    protected String extractToken(String emailText) {
        Matcher token = EMAIL_TOKEN.matcher(emailText);
        assertThat(token.find()).isTrue();
        return token.group(1);
    }

    protected MvcTestResult requestDuringConcurrentUserChange(
            TestSession session, Consumer<User> change, Callable<MvcTestResult> request) throws Exception {
        return requestsDuringConcurrentUserChange(session, change, List.of(request)).getFirst();
    }

    /** Runs the requests during a concurrent transaction that locks the user's row and changes the user. */
    protected List<MvcTestResult> requestsDuringConcurrentUserChange(
            TestSession session, Consumer<User> change, List<Callable<MvcTestResult>> requests) throws Exception {
        return requestsDuringConcurrentTransaction(
                () -> change.accept(userRepository.findByIdForUpdate(session.userId()).orElseThrow()), requests);
    }

    /**
     * Another transaction runs {@code lockingWork}, which locks rows and may change them, and does not commit yet. It
     * commits only once every request is waiting for a lock or has already finished, so a request that waits has to
     * build on that work instead of overwriting it. Requests that wait together overlap: each one has passed its
     * checks before the lock.
     */
    protected List<MvcTestResult> requestsDuringConcurrentTransaction(
            Runnable lockingWork, List<Callable<MvcTestResult>> requests) throws Exception {
        CompletableFuture<Void> rowsLocked = new CompletableFuture<>();
        CompletableFuture<Void> commitAllowed = new CompletableFuture<>();

        try (ExecutorService executor = Executors.newFixedThreadPool(requests.size() + 1)) {
            Future<?> concurrentChange = executor.submit(() -> transactionTemplate.executeWithoutResult(status -> {
                lockingWork.run();
                rowsLocked.complete(null);
                commitAllowed.orTimeout(MAX_WAIT_SECONDS, SECONDS).join();
            }));
            rowsLocked.get(MAX_WAIT_SECONDS, SECONDS);

            List<Future<MvcTestResult>> responses = requests.stream().map(executor::submit).toList();
            await().atMost(MAX_WAIT_SECONDS, SECONDS)
                    .until(() -> sessionsWaitingForLock() + finishedCount(responses) >= requests.size());
            commitAllowed.complete(null);

            concurrentChange.get(MAX_WAIT_SECONDS, SECONDS);
            List<MvcTestResult> results = new ArrayList<>();
            for (Future<MvcTestResult> response : responses) {
                results.add(response.get(MAX_WAIT_SECONDS, SECONDS));
            }
            return results;
        }
    }

    /**
     * The status of each response. A request that ended in an unhandled exception, which a real server answers with
     * 500, fails the test here.
     */
    protected List<HttpStatus> statusesOf(List<MvcTestResult> results) {
        results.forEach(result -> assertThat(result.getUnresolvedException()).as("unhandled exception").isNull());
        return results.stream().map(result -> HttpStatus.valueOf(result.getResponse().getStatus())).toList();
    }

    protected int storedCredentialsVersion(TestSession session) {
        return jdbc.queryForObject(
                "select credentials_version from users where id = ?", Integer.class, session.userId());
    }

    private TestSession sessionOf(MvcTestResult authResponse) {
        return new TestSession(
                readJson(authResponse, "$.accessToken"),
                UUID.fromString(readJson(authResponse, "$.user.id")),
                UUID.fromString(readJson(authResponse, "$.user.officeId")));
    }

    private int sessionsWaitingForLock() {
        return jdbc.queryForObject(
                "select count(*) from pg_stat_activity where wait_event_type = 'Lock'", Integer.class);
    }

    private static int finishedCount(List<Future<MvcTestResult>> responses) {
        return (int) responses.stream().filter(Future::isDone).count();
    }
}
