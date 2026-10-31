package br.com.fluiar.selecao.config;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.fluiar.selecao.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class OpenApiConfigTest extends ApiIntegrationTest {

    @Test
    void apiDocsDeclareTheBearerTokenScheme() {
        var result = mvc.get().uri("/v3/api-docs");

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(result).bodyJson().extractingPath("$.components.securitySchemes.bearer.scheme").isEqualTo("bearer");
        assertThat(result).bodyJson().extractingPath("$.components.securitySchemes.bearer.bearerFormat")
                .isEqualTo("JWT");
    }
}
