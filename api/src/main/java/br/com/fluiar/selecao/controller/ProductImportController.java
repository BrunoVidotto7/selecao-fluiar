package br.com.fluiar.selecao.controller;
import br.com.fluiar.selecao.dto.ProductImportPreview;
import br.com.fluiar.selecao.dto.ProductImportRequest;
import br.com.fluiar.selecao.service.StoreProductCollector;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/api/product-imports")
public class ProductImportController {
    private final StoreProductCollector collector;
    public ProductImportController(StoreProductCollector collector) { this.collector=collector; }
    @PostMapping("/preview")
    public ProductImportPreview preview(@Valid @RequestBody ProductImportRequest request) {
        return collector.preview(request.url(),request.variantId());
    }
}
