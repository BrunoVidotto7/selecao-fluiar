package br.com.fluiar.selecao.dto;

import br.com.fluiar.selecao.exception.ApiException;
import br.com.fluiar.selecao.exception.ErrorMessages;
import br.com.fluiar.selecao.model.ProductStoreSync;
import tools.jackson.core.JsonParser;
import tools.jackson.databind.DeserializationContext;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.annotation.JsonDeserialize;
import tools.jackson.databind.deser.std.StdDeserializer;

/**
 * The {@code storeSync} field of a product write. An absent field keeps the current binding, {@code null} unlinks
 * the product and an object {@code {sourceUrl, variantId}} binds it to the store page.
 */
@JsonDeserialize(using = StoreSyncRequest.Reader.class)
public sealed interface StoreSyncRequest {

    record Keep() implements StoreSyncRequest {
    }

    record Unlink() implements StoreSyncRequest {
    }

    record Bind(String sourceUrl, String variantId) implements StoreSyncRequest {
    }

    /** A malformed value answers 400 on {@code storeSync} instead of a generic invalid body. */
    class Reader extends StdDeserializer<StoreSyncRequest> {

        private static final String FIELD = "storeSync";
        private static final String SOURCE_URL = "sourceUrl";
        private static final String VARIANT_ID = "variantId";

        public Reader() {
            super(StoreSyncRequest.class);
        }

        @Override
        public StoreSyncRequest deserialize(JsonParser parser, DeserializationContext context) {
            JsonNode node = context.readTree(parser);
            JsonNode sourceUrl = node.path(SOURCE_URL);
            JsonNode variantId = node.path(VARIANT_ID);
            boolean noVariant = variantId.isMissingNode() || variantId.isNull();
            if (!node.isObject() || !isText(sourceUrl, ProductStoreSync.SOURCE_URL_MAX_LENGTH)
                    || !(noVariant || isText(variantId, ProductStoreSync.VARIANT_ID_MAX_LENGTH))) {
                throw ApiException.invalidField(FIELD, ErrorMessages.PRODUCT_STORE_SYNC_MISMATCH);
            }
            return new Bind(sourceUrl.asString(), noVariant ? null : variantId.asString());
        }

        @Override
        public Object getNullValue(DeserializationContext context) {
            return new Unlink();
        }

        /** Jackson would otherwise use the null value for an absent field too. */
        @Override
        public Object getAbsentValue(DeserializationContext context) {
            return new Keep();
        }

        private static boolean isText(JsonNode value, int maxLength) {
            return value.isString() && value.asString().length() <= maxLength;
        }
    }
}
