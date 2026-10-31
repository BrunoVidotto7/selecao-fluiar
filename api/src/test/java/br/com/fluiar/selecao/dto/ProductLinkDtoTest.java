package br.com.fluiar.selecao.dto;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertTimeout;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class ProductLinkDtoTest {

    private static final Validator VALIDATOR = Validation.buildDefaultValidatorFactory().getValidator();
    private static final String URL_FIELD = "url";
    private static final String LINK_URL_INVALID = "Cole o link completo, começando com https://";
    private static final Duration MAX_VALIDATION_TIME = Duration.ofSeconds(1);
    /** Many dots and a space at the end: a pattern that can split the text in many ways tries every split. */
    private static final String LONG_DOTTED_URL_WITH_SPACE = "https://" + "a.".repeat(50_000) + " x";

    @ParameterizedTest
    @ValueSource(strings = {"https://meli.la/1sNwTbN", "http://loja.example/produto"})
    void acceptsHttpAndHttpsLinks(String url) {
        var violations = VALIDATOR.validateProperty(new ProductLinkDto(url, null), URL_FIELD);

        assertThat(violations).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {"javascript:alert(1)", "https://loja"})
    void rejectsLinksThatAreNotCompleteWebAddresses(String url) {
        var violations = VALIDATOR.validateProperty(new ProductLinkDto(url, null), URL_FIELD);

        assertThat(violations).extracting(ConstraintViolation::getMessage).containsExactly(LINK_URL_INVALID);
    }

    @Test
    void rejectsALongMalformedLinkQuickly() {
        var link = new ProductLinkDto(LONG_DOTTED_URL_WITH_SPACE, null);

        var violations = assertTimeout(MAX_VALIDATION_TIME, () -> VALIDATOR.validateProperty(link, URL_FIELD));

        assertThat(violations).extracting(ConstraintViolation::getMessage).contains(LINK_URL_INVALID);
    }
}
