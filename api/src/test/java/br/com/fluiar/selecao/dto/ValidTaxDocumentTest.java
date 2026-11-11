package br.com.fluiar.selecao.dto;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.api.Test;

class ValidTaxDocumentTest {

    @ParameterizedTest
    @ValueSource(strings = {"52998224725", "11222333000181", "12ABC34501DE35"})
    void acceptsValidCpfAndCnpj(String document) {
        assertThat(ValidTaxDocument.Validator.isValid(document)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"52998224724", "11111111111", "11222333000180", "12ABC34501DE36", "00000000000000",
            "1234567890", "12ABC3450IDE35"})
    void rejectsInvalidDocuments(String document) {
        assertThat(ValidTaxDocument.Validator.isValid(document)).isFalse();
    }

    @Test
    void cpfCheckAcceptsOnlyAValidCpf() {
        assertThat(ValidTaxDocument.Validator.isValidCpf("52998224725")).isTrue();
        assertThat(ValidTaxDocument.Validator.isValidCpf("52998224724")).isFalse();
        assertThat(ValidTaxDocument.Validator.isValidCpf("11111111111")).isFalse();
        assertThat(ValidTaxDocument.Validator.isValidCpf("5299822472A")).isFalse();
        assertThat(ValidTaxDocument.Validator.isValidCpf("11222333000181")).isFalse();
        assertThat(ValidTaxDocument.Validator.isValidCpf(null)).isFalse();
    }

    @Test
    void compactCodeRemovesPunctuationAndUppercases() {
        assertThat(Inputs.compactCode(" 12.abc.345/01de-35 ")).isEqualTo("12ABC34501DE35");
    }

    @Test
    void compactCodeOfBlankIsNull() {
        assertThat(Inputs.compactCode("  ")).isNull();
        assertThat(Inputs.compactCode(null)).isNull();
    }
}
