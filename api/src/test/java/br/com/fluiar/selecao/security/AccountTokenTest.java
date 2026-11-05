package br.com.fluiar.selecao.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import br.com.fluiar.selecao.config.AppProperties;
import br.com.fluiar.selecao.model.User;
import br.com.fluiar.selecao.repository.UserRepository;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.test.util.ReflectionTestUtils;

class AccountTokenTest {
    private static final UUID USER_ID = UUID.fromString("88888888-8888-4888-8888-888888888888");
    private static final UUID OFFICE_ID = UUID.fromString("77777777-7777-4777-8777-777777777777");
    private static final String SECRET = "test-only-account-secret-at-least-32-bytes";
    private final UserRepository users = mock(UserRepository.class);
    private final CredentialsVersionValidator validator = new CredentialsVersionValidator(users);

    @BeforeEach
    void setUp() {
        User admin = new User(OFFICE_ID, "Admin", "admin@example.com", "test-only-hash");
        ReflectionTestUtils.setField(admin, "id", USER_ID);
        when(users.findById(USER_ID)).thenReturn(Optional.of(admin));
    }

    @Test
    void validAccountContextIsAccepted() {
        assertThat(validator.validate(token(Map.of())).hasErrors()).isFalse();
    }

    @Test
    void legacyTokenWithoutRoleIsRejected() {
        Map<String, Object> claims = claims();
        claims.remove("role");
        assertThat(validator.validate(jwt(claims)).hasErrors()).isTrue();
    }

    @Test
    void tokenCannotClaimAnotherOfficeOrClient() {
        assertThat(validator.validate(token(Map.of("office_id", UUID.randomUUID().toString()))).hasErrors()).isTrue();
        assertThat(validator.validate(token(Map.of("client_id", UUID.randomUUID().toString()))).hasErrors()).isTrue();
        assertThat(validator.validate(token(Map.of("role", "CLIENT"))).hasErrors()).isTrue();
    }

    @Test
    void malformedContextIsRejectedWithoutThrowing() {
        for (Map<String, Object> patch : List.of(Map.<String, Object>of("sub", "invalid"),
                Map.<String, Object>of("cv", "invalid"), Map.<String, Object>of("role", "UNKNOWN"),
                Map.<String, Object>of("office_id", List.of("invalid")))) {
            assertThat(validator.validate(token(patch)).hasErrors()).isTrue();
        }
    }

    @Test
    void issuedTokenIncludesRoleAndKeepsRememberedLifetime() {
        var key = new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        var now = Instant.now().minusSeconds(1);
        var properties = new AppProperties(new AppProperties.Jwt(SECRET, Duration.ofHours(12), Duration.ofDays(30)),
                "http://localhost:3000", List.of(), ZoneOffset.UTC, "test@example.com");
        var service = new TokenService(new NimbusJwtEncoder(new ImmutableSecret<>(key)),
                Clock.fixed(now, ZoneOffset.UTC), properties);
        User admin = users.findById(USER_ID).orElseThrow();
        var issued = service.issue(admin, true);
        var decoded = NimbusJwtDecoder.withSecretKey(key).build().decode(issued.value());
        assertThat(decoded.getClaimAsString("role")).isEqualTo("ADMIN");
        assertThat(decoded.hasClaim("client_id")).isFalse();
        assertThat(Duration.between(decoded.getIssuedAt(), decoded.getExpiresAt())).isEqualTo(Duration.ofDays(30));
    }

    private static Map<String, Object> claims() {
        return new HashMap<>(Map.of("sub", USER_ID.toString(), "office_id", OFFICE_ID.toString(), "cv", 0, "role", "ADMIN"));
    }

    private static Jwt token(Map<String, Object> patch) {
        var claims = claims();
        claims.putAll(patch);
        return jwt(claims);
    }

    private static Jwt jwt(Map<String, Object> claims) {
        return Jwt.withTokenValue("test-token").header("alg", "HS256").claims(value -> value.putAll(claims)).build();
    }
}
