package br.com.fluiar.selecao.service;

import br.com.fluiar.selecao.dto.ProductImportPreview;
import br.com.fluiar.selecao.dto.ProductRequest;
import br.com.fluiar.selecao.dto.StoreSyncRequest;
import br.com.fluiar.selecao.exception.ApiException;
import br.com.fluiar.selecao.model.Product;
import br.com.fluiar.selecao.model.ProductImage;
import br.com.fluiar.selecao.model.ProductStoreSync;
import br.com.fluiar.selecao.repository.ProductImageRepository;
import java.time.Clock;
import java.util.Objects;
import org.springframework.stereotype.Service;

@Service
public class StoreBindingService {
    private static final String STORE_SYNC_FIELD = "storeSync";
    private final StoreProductCollector collector;
    private final ProductImageRepository images;
    private final Clock clock;
    public StoreBindingService(StoreProductCollector collector, ProductImageRepository images, Clock clock) {
        this.collector=collector; this.images=images; this.clock=clock;
    }

    public record Confirmation(ProductImportPreview preview, StoreProductCollector.DownloadedImage image) {}

    public Confirmation confirm(ProductRequest request) {
        if (!(request.storeSync() instanceof StoreSyncRequest.Bind bind)) return null;
        var preview=collector.preview(bind.sourceUrl(),bind.variantId());
        if (preview.resolution()!=ProductImportPreview.Resolution.RESOLVED || preview.productId()==null
                || !Objects.equals(request.name(),preview.name()) || request.unitPrice()==null
                || preview.unitPrice()==null || request.unitPrice().compareTo(preview.unitPrice())!=0
                || preview.imageUrl()==null) throw invalid();
        return new Confirmation(preview,collector.downloadImage(preview.imageUrl()));
    }

    public void apply(Product product, ProductRequest request, Confirmation confirmation) {
        if (confirmation!=null) {
            var preview=confirmation.preview();
            persistImage(product,confirmation.image());
            product.bindStore(new ProductStoreSync(preview.sourceUrl(),preview.store(),preview.productId(),preview.variantId(),clock.instant()));
        } else if (request.storeSync() instanceof StoreSyncRequest.Unlink) {
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
