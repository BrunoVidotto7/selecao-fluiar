package br.com.fluiar.selecao.controller;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.fluiar.selecao.support.ApiIntegrationTest;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.web.server.LocalManagementPort;
import org.springframework.http.HttpStatus;

/** The actuator lives only on the management port, which is internal in production, so it needs no login. */
class HealthCheckTest extends ApiIntegrationTest {

    @LocalManagementPort
    private int managementPort;

    @Test
    void reportsUpWhenDatabaseIsReachable() throws Exception {
        var response = managementGet("/actuator/health");

        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.body()).contains("\"status\":\"UP\"");
    }

    @Test
    void livenessAndReadinessProbesAreOpen() throws Exception {
        assertThat(managementGet("/actuator/health/liveness").statusCode()).isEqualTo(200);
        assertThat(managementGet("/actuator/health/readiness").statusCode()).isEqualTo(200);
    }

    @Test
    void healthDoesNotShowDetails() throws Exception {
        assertThat(managementGet("/actuator/health").body()).doesNotContain("components");
    }

    @Test
    void prometheusMetricsAreServedOnTheManagementPort() throws Exception {
        var response = managementGet("/actuator/prometheus");

        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.body()).contains("jvm_memory_used_bytes");
    }

    @Test
    void otherExposedActuatorEndpointsAreDenied() throws Exception {
        assertThat(managementGet("/actuator/info").statusCode()).isEqualTo(403);
    }

    @Test
    void actuatorIsNotServedOnTheApiPort() {
        var paula = createAdmin("Paula Hooper", "paula@fluiar.com.br");

        assertThat(mvc.get().uri("/actuator/prometheus")).hasStatus(HttpStatus.UNAUTHORIZED);
        assertThat(mvc.get().uri("/actuator/health")).hasStatus(HttpStatus.UNAUTHORIZED);
        var asAdmin = mvc.get().uri("/actuator/prometheus")
                .header(org.springframework.http.HttpHeaders.AUTHORIZATION, bearer(paula)).exchange();
        assertThat(asAdmin.getResponse().getStatus()).isNotEqualTo(200);
    }

    private HttpResponse<String> managementGet(String path) throws IOException, InterruptedException {
        var request = HttpRequest.newBuilder(URI.create("http://localhost:" + managementPort + path)).build();
        return HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
    }
}
