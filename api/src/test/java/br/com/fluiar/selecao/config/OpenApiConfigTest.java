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

    @Test
    void publicOperationsDeclareNoSecurityAndPrivateOnesRequireTheToken() {
        var result = mvc.get().uri("/v3/api-docs");

        assertThat(result).bodyJson().extractingPath("$.paths['/api/auth/login'].post.security").asArray().isEmpty();
        assertThat(result).bodyJson().extractingPath("$.paths['/api/auth/invitations/{token}'].get.security")
                .asArray().isEmpty();
        assertThat(result).bodyJson().doesNotHavePath("$.paths['/api/dashboard'].get.security");
    }

    @Test
    void operationsDescribeTheirErrorsWithTheProblemDetailSchema() {
        var result = mvc.get().uri("/v3/api-docs");

        for (String status : new String[] {"400", "401", "500"}) {
            assertThat(result).bodyJson().extractingPath(responseSchema("/api/dashboard", "get", status))
                    .isEqualTo("#/components/schemas/ProblemDetail");
        }
        assertThat(result).bodyJson().extractingPath("$.components.schemas.ProblemDetail.properties.detail")
                .isNotNull();
    }

    @Test
    void operationsOnlyDescribeTheErrorsTheyCanReturn() {
        var result = mvc.get().uri("/v3/api-docs");

        assertThat(result).bodyJson().doesNotHavePath("$.paths['/api/dashboard'].get.responses['404']");
        assertThat(result).bodyJson().doesNotHavePath("$.paths['/api/dashboard'].get.responses['429']");
        assertThat(result).bodyJson().hasPath("$.paths['/api/rooms/{roomId}'].put.responses['404']");
        assertThat(result).bodyJson().doesNotHavePath("$.paths['/api/auth/password-resets'].post.responses['401']");
        assertThat(result).bodyJson().hasPath("$.paths['/api/auth/login'].post.responses['429']");
        assertThat(result).bodyJson().hasPath("$.paths['/api/auth/password-reset-requests'].post.responses['429']");
        assertThat(result).bodyJson().hasPath("$.paths['/api/me/password'].put.responses['429']");
        assertThat(result).bodyJson().doesNotHavePath("$.paths['/api/auth/login'].post.responses['404']");
    }

    private static String responseSchema(String path, String method, String status) {
        return "$.paths['" + path + "']." + method + ".responses['" + status
                + "'].content['application/problem+json'].schema.$ref";
    }
}
