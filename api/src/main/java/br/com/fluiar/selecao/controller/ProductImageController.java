package br.com.fluiar.selecao.controller;

import br.com.fluiar.selecao.dto.ImageContent;
import br.com.fluiar.selecao.dto.ProductImageResponse;
import br.com.fluiar.selecao.security.CurrentOfficeId;
import br.com.fluiar.selecao.service.ProductImageService;
import java.time.Duration;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api")
public class ProductImageController {

    /** The cache can be long because every upload gets a new image id, so a URL never shows another image. */
    private static final Duration IMAGE_CACHE_MAX_AGE = Duration.ofDays(365);

    private final ProductImageService productImageService;

    public ProductImageController(ProductImageService productImageService) {
        this.productImageService = productImageService;
    }

    @PutMapping("/products/{productId}/image")
    public ProductImageResponse replaceImage(
            @CurrentOfficeId UUID officeId, @PathVariable UUID productId, @RequestParam("file") MultipartFile file) {
        return productImageService.replace(officeId, productId, file);
    }

    @DeleteMapping("/products/{productId}/image")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteImage(@CurrentOfficeId UUID officeId, @PathVariable UUID productId) {
        productImageService.delete(officeId, productId);
    }

    /** Public: an {@code <img src>} does not send the Authorization header. */
    @GetMapping("/images/{imageId}")
    public ResponseEntity<byte[]> getImage(@PathVariable UUID imageId) {
        ImageContent image = productImageService.load(imageId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(image.contentType()))
                .cacheControl(CacheControl.maxAge(IMAGE_CACHE_MAX_AGE).cachePublic())
                .body(image.data());
    }
}
