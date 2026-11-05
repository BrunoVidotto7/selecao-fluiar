package br.com.fluiar.selecao.dto;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;
import static org.assertj.core.api.Assertions.assertThat;

class ProductStoreSyncRequestTest {
    @Test void omissionAndNullAreDistinct() {
        var mapper = JsonMapper.builder().build();
        var missing = mapper.readValue("{}", ProductRequest.class);
        var disabled = mapper.readValue("{\"storeSync\":null}", ProductRequest.class);
        assertThat(missing.storeSync()).isNull();
        assertThat(disabled.storeSync()).isNotNull();
        assertThat(disabled.storeSync().isNull()).isTrue();
    }
}
