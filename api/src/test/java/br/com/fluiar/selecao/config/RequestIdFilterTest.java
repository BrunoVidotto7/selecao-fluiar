package br.com.fluiar.selecao.config;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.fluiar.selecao.support.ApiIntegrationTest;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;

class RequestIdFilterTest extends ApiIntegrationTest {

    private static final String REQUEST_ID = "X-Request-Id";

    @Test
    void validRequestIdIsEchoed() {
        var result = mvc.get().uri("/v3/api-docs").header(REQUEST_ID, "abc-123-DEF").exchange();

        assertThat(result.getResponse().getHeader(REQUEST_ID)).isEqualTo("abc-123-DEF");
    }

    @Test
    void missingRequestIdIsGenerated() {
        var result = mvc.get().uri("/v3/api-docs").exchange();

        assertThat(UUID.fromString(result.getResponse().getHeader(REQUEST_ID))).isNotNull();
    }

    @Test
    void invalidRequestIdIsReplaced() {
        for (String invalid : new String[] {"bad id\\n", "a".repeat(65), "<script>", ""}) {
            var result = mvc.get().uri("/v3/api-docs").header(REQUEST_ID, invalid).exchange();

            assertThat(UUID.fromString(result.getResponse().getHeader(REQUEST_ID))).isNotNull();
        }
    }

    @Test
    void rejectedRequestsAlsoCarryTheRequestId() {
        var result = mvc.get().uri("/api/dashboard").header(REQUEST_ID, "trace-1").exchange();

        assertThat(result.getResponse().getStatus()).isEqualTo(401);
        assertThat(result.getResponse().getHeader(REQUEST_ID)).isEqualTo("trace-1");
    }

    @Test
    void requestIdIsRemovedFromTheLogContextAfterTheRequest() {
        mvc.get().uri("/v3/api-docs").header(REQUEST_ID, "trace-2").exchange();

        assertThat(MDC.get("requestId")).isNull();
    }
}
