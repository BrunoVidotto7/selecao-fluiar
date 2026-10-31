package br.com.fluiar.selecao.config;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.fluiar.selecao.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

class SecurityConfigTest extends ApiIntegrationTest {

    private static final String FRONTEND_ORIGIN = "http://localhost:3000";

    @Test
    void corsPreflightAllowsTheFrontendToSendTheToken() {
        var result = mvc.options().uri("/api/me")
                .header(HttpHeaders.ORIGIN, FRONTEND_ORIGIN)
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "authorization");

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(result).headers().hasValue(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, FRONTEND_ORIGIN);
        assertThat(result).headers().hasValue(HttpHeaders.ACCESS_CONTROL_ALLOW_HEADERS, "authorization");
    }

    @Test
    void corsPreflightRejectsOtherOrigins() {
        var result = mvc.options().uri("/api/me")
                .header(HttpHeaders.ORIGIN, "https://outro-site.com.br")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET");

        assertThat(result).hasStatus(HttpStatus.FORBIDDEN);
    }
}
