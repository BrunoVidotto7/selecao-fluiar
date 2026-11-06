package br.com.fluiar.selecao.service;

import br.com.fluiar.selecao.dto.ProductImportPreview;
import br.com.fluiar.selecao.dto.ProductImportPreview.Resolution;
import br.com.fluiar.selecao.exception.ApiException;
import br.com.fluiar.selecao.exception.ErrorMessages;
import br.com.fluiar.selecao.model.Store;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import javax.imageio.ImageIO;
import org.springframework.stereotype.Service;

@Service
public class StoreProductCollector {
    private static final int MAX_PAGE_BYTES = 8 * 1024 * 1024;
    private static final int MAX_IMAGE_BYTES = 5 * 1024 * 1024;
    private static final long MAX_IMAGE_PIXELS = 20_000_000;
    public record DownloadedImage(byte[] data, String contentType) {}
    private final SafeStoreHttpClient client;
    private final StoreProductExtractor extractor;

    public StoreProductCollector(SafeStoreHttpClient client, StoreProductExtractor extractor) {
        this.client = client;
        this.extractor = extractor;
    }

    public ProductImportPreview preview(String url, String variantId) {
        try {
            SafeStoreHttpClient.store(url);
            String selectedVariant = variantId == null ? StoreProductExtractor.queryVariant(url) : variantId;
            var response = client.get(url, true, MAX_PAGE_BYTES);
            String sourceUrl = response.finalUrl() == null ? url : response.finalUrl();
            Store store = SafeStoreHttpClient.store(sourceUrl);
            ProductImportPreview preview = extractor.extract(sourceUrl, store, selectedVariant, new String(response.body(), StandardCharsets.UTF_8));
            if (preview.imageUrl() != null) {
                try { client.validateImageDestination(preview.imageUrl()); }
                catch (IOException | IllegalArgumentException exception) {
                    return new ProductImportPreview(preview.sourceUrl(), preview.store(), preview.productId(), preview.variantId(), preview.variants(), preview.name(), preview.unitPrice(), null,
                            preview.resolution() == Resolution.VARIANT_REQUIRED ? Resolution.VARIANT_REQUIRED : Resolution.UNRESOLVED);
                }
            }
            return preview;
        } catch (IOException | IllegalArgumentException exception) {
            throw ApiException.invalidField("url", ErrorMessages.PRODUCT_COLLECTION_FAILED).causedBy(exception);
        }
    }

    public DownloadedImage downloadImage(String url) {
        try {
            byte[] data = client.get(url, false, MAX_IMAGE_BYTES).body();
            if (data.length == 0 || data.length > MAX_IMAGE_BYTES) throw ApiException.invalidImage();
            try (var input = ImageIO.createImageInputStream(new ByteArrayInputStream(data))) {
                var readers = ImageIO.getImageReaders(input);
                if (!readers.hasNext()) throw ApiException.invalidImage();
                var reader = readers.next();
                try {
                    String format = reader.getFormatName().toLowerCase(Locale.ROOT);
                    if (!format.equals("jpeg") && !format.equals("png")) throw ApiException.invalidImage();
                    reader.setInput(input, true, true);
                    long pixels = (long) reader.getWidth(0) * reader.getHeight(0);
                    if (pixels <= 0 || pixels > MAX_IMAGE_PIXELS) throw ApiException.invalidImage();
                    return new DownloadedImage(data, format.equals("jpeg") ? "image/jpeg" : "image/png");
                } finally { reader.dispose(); }
            }
        } catch (IOException | IllegalArgumentException exception) {
            throw ApiException.invalidImage().causedBy(exception);
        }
    }
}
