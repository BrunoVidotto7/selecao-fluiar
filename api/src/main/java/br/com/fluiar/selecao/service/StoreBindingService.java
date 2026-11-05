package br.com.fluiar.selecao.service;

import br.com.fluiar.selecao.dto.ProductImportPreview;
import br.com.fluiar.selecao.dto.ProductRequest;
import br.com.fluiar.selecao.exception.ApiException;
import br.com.fluiar.selecao.model.Product;
import br.com.fluiar.selecao.model.ProductImage;
import br.com.fluiar.selecao.model.ProductStoreSync;
import br.com.fluiar.selecao.repository.ProductImageRepository;
import java.time.Clock;
import java.util.Objects;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

@Service
public class StoreBindingService {
    private static final String STORE_SYNC_FIELD = "storeSync";
    private static final String SOURCE_URL_FIELD = "sourceUrl";
    private static final String VARIANT_ID_FIELD = "variantId";
    private static final String RESOLVED = "resolved";
    private final StoreProductCollector collector;
    private final ProductImageRepository images;
    private final Clock clock;
    public StoreBindingService(StoreProductCollector collector, ProductImageRepository images, Clock clock) {
        this.collector=collector; this.images=images; this.clock=clock;
    }

    public record Confirmation(ProductImportPreview preview, StoreProductCollector.DownloadedImage image) {}

    public Confirmation confirm(ProductRequest request) {
        JsonNode node=request.storeSync();
        if (node==null || node.isNull()) return null;
        if (!node.isObject() || !node.path(SOURCE_URL_FIELD).isString()
                || (node.hasNonNull(VARIANT_ID_FIELD) && !node.path(VARIANT_ID_FIELD).isString())) throw invalid();
        var preview=collector.preview(node.path(SOURCE_URL_FIELD).asString(),
                node.hasNonNull(VARIANT_ID_FIELD) ? node.path(VARIANT_ID_FIELD).asString() : null);
        if (!RESOLVED.equals(preview.resolution()) || preview.productId()==null
                || !Objects.equals(request.name(),preview.name()) || request.unitPrice()==null
                || preview.unitPrice()==null || request.unitPrice().compareTo(preview.unitPrice())!=0
                || preview.imageUrl()==null) throw invalid();
        return new Confirmation(preview,collector.downloadImage(preview.imageUrl()));
    }

    public void apply(Product product, ProductRequest request, Confirmation confirmation, boolean manualChange) {
        if (confirmation!=null) {
            persistImage(product,confirmation.image());
            product.bindStore(new ProductStoreSync(confirmation.preview(),clock.instant()));
        } else if ((request.storeSync()!=null && request.storeSync().isNull()) || manualChange) {
            product.disableStoreSync();
        }
    }

    public boolean persistImage(Product product, StoreProductCollector.DownloadedImage image) {
        var old=images.findByProductId(product.getId());
        if (old.isPresent() && java.util.Arrays.equals(old.get().getData(), image.data())
                && old.get().getContentType().equals(image.contentType())) return false;
        images.deleteByProductId(product.getId());
        var saved=images.saveAndFlush(new ProductImage(product.getId(),image.contentType(),image.data()));
        product.imageSaved(saved.getId());
        return true;
    }
    private static ApiException invalid() { return ApiException.invalidField(STORE_SYNC_FIELD,br.com.fluiar.selecao.exception.ErrorMessages.PRODUCT_STORE_SYNC_MISMATCH); }
}
