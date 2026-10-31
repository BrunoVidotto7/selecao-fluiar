package br.com.fluiar.selecao.controller;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.fluiar.selecao.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class HealthCheckTest extends ApiIntegrationTest {

    @Test
    void reportsUpWhenDatabaseIsReachable() {
        var result = mvc.get().uri("/actuator/health");

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(result).bodyJson().extractingPath("$.status").isEqualTo("UP");
    }
}
