package br.com.fluiar.selecao.security;

import br.com.fluiar.selecao.repository.UserRepository;
import java.util.Objects;
import java.util.UUID;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

/**
 * Accepts a token only while its account exists and its credentials version is the current one, so a password
 * change revokes every token issued before it. Costs one primary-key lookup per authenticated request.
 */
@Component
public class CredentialsVersionValidator implements OAuth2TokenValidator<Jwt> {

    private final UserRepository userRepository;

    public CredentialsVersionValidator(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public OAuth2TokenValidatorResult validate(Jwt jwt) {
        try {
            Object subject = jwt.getClaims().get("sub");
            if (!(subject instanceof String value)) {
                return invalidToken();
            }
            UUID userId = UUID.fromString(value);
            Object version = jwt.getClaim(TokenService.CREDENTIALS_VERSION_CLAIM);
            boolean current = userRepository.findById(userId).map(user ->
                    version instanceof Number number && number.longValue() == user.getCredentialsVersion()
                    && number.doubleValue() == user.getCredentialsVersion()
                    && Objects.equals(jwt.getClaims().get(TokenService.OFFICE_ID_CLAIM), user.getOfficeId().toString())
                    && Objects.equals(jwt.getClaims().get(TokenService.ROLE_CLAIM), user.getRole().name())
                    && Objects.equals(jwt.getClaims().get(TokenService.CLIENT_ID_CLAIM),
                            user.getClientId() == null ? null : user.getClientId().toString()))
                    .orElse(false);
            if (current) {
                return OAuth2TokenValidatorResult.success();
            }
        } catch (IllegalArgumentException | ClassCastException exception) {
            return invalidToken();
        }
        return invalidToken();
    }

    private static OAuth2TokenValidatorResult invalidToken() {
        return OAuth2TokenValidatorResult.failure(new OAuth2Error(OAuth2ErrorCodes.INVALID_TOKEN));
    }
}
