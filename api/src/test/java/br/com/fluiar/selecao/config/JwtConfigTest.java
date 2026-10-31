package br.com.fluiar.selecao.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import br.com.fluiar.selecao.repository.UserRepository;
import br.com.fluiar.selecao.security.CredentialsVersionValidator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

class JwtConfigTest {

    private static final String SECRET_PROPERTY = "app.jwt.secret=";

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(AppPropertiesConfiguration.class, JwtConfig.class)
            .withBean(CredentialsVersionValidator.class,
                    () -> new CredentialsVersionValidator(mock(UserRepository.class)));

    @ParameterizedTest
    @ValueSource(strings = {"", "0123456789012345678901234567890"})
    void startupFailsWhenSecretIsMissingOrShorterThan32Bytes(String secret) {
        contextRunner.withPropertyValues(SECRET_PROPERTY + secret).run(context -> {
            assertThat(context).hasFailed();
            assertThat(context).getFailure().hasRootCauseMessage("JWT_SECRET precisa ter pelo menos 32 bytes.");
        });
    }

    @Test
    void startupAcceptsSecretOfExactly32Bytes() {
        contextRunner.withPropertyValues(SECRET_PROPERTY + "01234567890123456789012345678901")
                .run(context -> assertThat(context).hasNotFailed());
    }

    @EnableConfigurationProperties(AppProperties.class)
    static class AppPropertiesConfiguration {
    }
}
