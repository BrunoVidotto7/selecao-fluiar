package br.com.fluiar.selecao.security;

import br.com.fluiar.selecao.config.AppProperties;
import br.com.fluiar.selecao.model.User;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

@Service
public class TokenService {

    public static final String OFFICE_ID_CLAIM = "office_id";
    public static final String CREDENTIALS_VERSION_CLAIM = "cv";

    private final JwtEncoder jwtEncoder;
    private final Clock clock;
    private final AppProperties.Jwt jwtProperties;

    public TokenService(JwtEncoder jwtEncoder, Clock clock, AppProperties appProperties) {
        this.jwtEncoder = jwtEncoder;
        this.clock = clock;
        this.jwtProperties = appProperties.jwt();
    }

    public IssuedToken issue(User user, boolean rememberMe) {
        Duration lifetime = rememberMe ? jwtProperties.rememberMeTtl() : jwtProperties.ttl();
        // JWT times have whole-second precision; truncating keeps the reported expiry equal to the signed one.
        Instant issuedAt = clock.instant().truncatedTo(ChronoUnit.SECONDS);
        Instant expiresAt = issuedAt.plus(lifetime);

        JwtClaimsSet claims = JwtClaimsSet.builder()
                .subject(user.getId().toString())
                .claim(OFFICE_ID_CLAIM, user.getOfficeId().toString())
                .claim(CREDENTIALS_VERSION_CLAIM, user.getCredentialsVersion())
                .issuedAt(issuedAt)
                .expiresAt(expiresAt)
                .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        String token = jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();

        return new IssuedToken(token, expiresAt);
    }
}
