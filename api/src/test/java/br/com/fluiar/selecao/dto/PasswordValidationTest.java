package br.com.fluiar.selecao.dto;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * The API shows only the first message of each field, and Bean Validation reports violations in no fixed
 * order. So these tests check every violation directly with the validator.
 */
class PasswordValidationTest {

    private record PasswordInput(@ValidPassword String password) { }

    private static final Validator VALIDATOR = Validation.buildDefaultValidatorFactory().getValidator();
    private static final String REQUIRED = "Preencha este campo.";
    private static final String PASSWORD_SIZE = "Use entre 8 e 72 caracteres.";
    private static final String PASSWORD_TOO_LONG =
            "Senha longa demais: letras com acento e emojis ocupam mais de um caractere.";

    @Test
    void blankEmailFailsOnlyTheRequiredRule() {
        var request = new ClientRequest("Client", "", "31999999999", null, null);

        var violations = VALIDATOR.validateProperty(request, "email");

        assertThat(violations).extracting(ConstraintViolation::getMessage).containsOnly(REQUIRED);
    }

    static Stream<Arguments> invalidPasswords() {
        return Stream.of(
                Arguments.of(null, REQUIRED),
                Arguments.of("", REQUIRED),
                Arguments.of("   ", REQUIRED),
                Arguments.of(" ".repeat(8), REQUIRED),
                Arguments.of("curta", PASSWORD_SIZE),
                Arguments.of("a".repeat(73), PASSWORD_SIZE),
                Arguments.of("ç".repeat(73), PASSWORD_SIZE),
                Arguments.of("ç".repeat(37), PASSWORD_TOO_LONG),
                Arguments.of("\uD83D\uDE00".repeat(19), PASSWORD_TOO_LONG));
    }

    @ParameterizedTest
    @MethodSource("invalidPasswords")
    void invalidPasswordGetsExactlyOneMessage(String password, String expectedMessage) {
        var request = new PasswordInput(password);

        var violations = VALIDATOR.validateProperty(request, "password");

        assertThat(violations).extracting(ConstraintViolation::getMessage).containsExactly(expectedMessage);
    }

    @ParameterizedTest
    @ValueSource(strings = {"senhaforte1", " senha com espaços "})
    void validPasswordIsAcceptedAsTyped(String password) {
        var request = new PasswordInput(password);

        var violations = VALIDATOR.validateProperty(request, "password");

        assertThat(violations).isEmpty();
        assertThat(request.password()).isEqualTo(password);
    }
}
