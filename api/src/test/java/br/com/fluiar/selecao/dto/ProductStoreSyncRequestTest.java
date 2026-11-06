package br.com.fluiar.selecao.dto;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;
import static org.assertj.core.api.Assertions.assertThat;

class ProductStoreSyncRequestTest {
    @Test void omissionNullAndObjectAreDistinct() {
        var mapper = JsonMapper.builder().build();
        var missing = mapper.readValue("{}", ProductRequest.class);
        var disabled = mapper.readValue("{\"storeSync\":null}", ProductRequest.class);
        var bound = mapper.readValue("{\"storeSync\":{\"sourceUrl\":\"https://loja.example/p\",\"variantId\":\"oak\"}}", ProductRequest.class);
        assertThat(missing.storeSync()).isInstanceOf(StoreSyncRequest.Keep.class);
        assertThat(disabled.storeSync()).isInstanceOf(StoreSyncRequest.Unlink.class);
        assertThat(bound.storeSync()).isEqualTo(new StoreSyncRequest.Bind("https://loja.example/p", "oak"));
    }
}
