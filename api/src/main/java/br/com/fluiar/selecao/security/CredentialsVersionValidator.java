package br.com.fluiar.selecao.security;

import br.com.fluiar.selecao.repository.UserRepository;
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
        UUID userId = UUID.fromString(jwt.getSubject());
        int tokenVersion = ((Number) jwt.getClaim(TokenService.CREDENTIALS_VERSION_CLAIM)).intValue();

        boolean tokenIsCurrent = userRepository.findCredentialsVersion(userId)
                .map(currentVersion -> currentVersion == tokenVersion)
                .orElse(false);
        if (tokenIsCurrent) {
            return OAuth2TokenValidatorResult.success();
        }
        return OAuth2TokenValidatorResult.failure(new OAuth2Error(OAuth2ErrorCodes.INVALID_TOKEN));
    }
}
