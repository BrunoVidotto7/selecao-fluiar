package br.com.fluiar.selecao.controller;

import br.com.fluiar.selecao.dto.ProductRequest;
import br.com.fluiar.selecao.dto.ProductResponse;
import br.com.fluiar.selecao.dto.ProductStatusRequest;
import br.com.fluiar.selecao.security.CurrentOfficeId;
import br.com.fluiar.selecao.service.ProductService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class ProductController {

    private final ProductService productService;

    public ProductController(ProductService productService) {
        this.productService = productService;
    }

    @PostMapping("/lists/{listId}/products")
    @ResponseStatus(HttpStatus.CREATED)
    public ProductResponse createProduct(
            @CurrentOfficeId UUID officeId, @PathVariable UUID listId, @Valid @RequestBody ProductRequest request) {
        return productService.create(officeId, listId, request);
    }

    @GetMapping("/products/{productId}")
    public ProductResponse getProduct(@CurrentOfficeId UUID officeId, @PathVariable UUID productId) {
        return productService.get(officeId, productId);
    }

    @PutMapping("/products/{productId}")
    public ProductResponse updateProduct(
            @CurrentOfficeId UUID officeId, @PathVariable UUID productId, @Valid @RequestBody ProductRequest request) {
        return productService.update(officeId, productId, request);
    }

    @PatchMapping("/products/{productId}")
    public ProductResponse updateProductStatus(@CurrentOfficeId UUID officeId, @PathVariable UUID productId,
            @Valid @RequestBody ProductStatusRequest request) {
        return productService.updateStatus(officeId, productId, request);
    }

    @DeleteMapping("/products/{productId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteProduct(@CurrentOfficeId UUID officeId, @PathVariable UUID productId) {
        productService.delete(officeId, productId);
    }
}
