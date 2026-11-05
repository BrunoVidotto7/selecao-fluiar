package br.com.fluiar.selecao.controller;

import br.com.fluiar.selecao.dto.ProductCategoryRequest;
import br.com.fluiar.selecao.dto.ProductCategoryResponse;
import br.com.fluiar.selecao.security.CurrentOfficeId;
import br.com.fluiar.selecao.service.ProductCategoryService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/office/categories")
public class ProductCategoryController {

    private final ProductCategoryService categoryService;

    public ProductCategoryController(ProductCategoryService categoryService) {
        this.categoryService = categoryService;
    }

    @GetMapping
    public List<ProductCategoryResponse> listCategories(@CurrentOfficeId UUID officeId) {
        return categoryService.list(officeId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProductCategoryResponse createCategory(
            @CurrentOfficeId UUID officeId, @Valid @RequestBody ProductCategoryRequest request) {
        return categoryService.create(officeId, request);
    }

    @PutMapping("/{id}")
    public ProductCategoryResponse renameCategory(
            @CurrentOfficeId UUID officeId, @PathVariable UUID id, @Valid @RequestBody ProductCategoryRequest request) {
        return categoryService.rename(officeId, id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCategory(@CurrentOfficeId UUID officeId, @PathVariable UUID id) {
        categoryService.delete(officeId, id);
    }
}
