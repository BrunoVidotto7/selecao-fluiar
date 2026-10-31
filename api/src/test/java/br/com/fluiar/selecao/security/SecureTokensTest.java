package br.com.fluiar.selecao.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class SecureTokensTest {

    private static final String URL_SAFE_TOKEN = "[A-Za-z0-9_-]{43}";

    @Test
    void generatesUrlSafeTokensThatDoNotRepeat() {
        String first = SecureTokens.generate();
        String second = SecureTokens.generate();

        assertThat(first).matches(URL_SAFE_TOKEN);
        assertThat(second).matches(URL_SAFE_TOKEN);
        assertThat(first).isNotEqualTo(second);
    }

    @Test
    void hashIsSha256Hex() {
        assertThat(SecureTokens.hash("abc")).isEqualTo("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    }
}
