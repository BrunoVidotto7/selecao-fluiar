package br.com.fluiar.selecao.service;

import br.com.fluiar.selecao.dto.ProductCategoryRequest;
import br.com.fluiar.selecao.dto.ProductCategoryResponse;
import br.com.fluiar.selecao.exception.ApiException;
import br.com.fluiar.selecao.exception.ErrorMessages;
import br.com.fluiar.selecao.model.ProductCategory;
import br.com.fluiar.selecao.repository.OfficeRepository;
import br.com.fluiar.selecao.repository.ProductCategoryRepository;
import br.com.fluiar.selecao.repository.ProductRepository;
import java.text.Collator;
import java.time.Clock;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ProductCategoryService {

    private static final String NAME_FIELD = "name";

    private final ProductCategoryRepository categoryRepository;
    private final ProductRepository productRepository;
    private final OfficeRepository officeRepository;
    private final Clock clock;

    public ProductCategoryService(ProductCategoryRepository categoryRepository, ProductRepository productRepository,
            OfficeRepository officeRepository, Clock clock) {
        this.categoryRepository = categoryRepository;
        this.productRepository = productRepository;
        this.officeRepository = officeRepository;
        this.clock = clock;
    }

    public List<ProductCategoryResponse> list(UUID officeId) {
        Collator collator = Collator.getInstance(Locale.forLanguageTag("pt-BR"));
        collator.setStrength(Collator.PRIMARY);
        return categoryRepository.findActiveSummaries(officeId).stream()
                .sorted(Comparator.comparing(ProductCategoryResponse::name, collator))
                .toList();
    }

    /** A name that belonged to a deleted category brings that category back, with its products. */
    @Transactional
    public ProductCategoryResponse create(UUID officeId, ProductCategoryRequest request) {
        // The office-row lock serializes name races; the unique key on name_key stays as the safety net.
        officeRepository.lockById(officeId);
        String key = ProductCategory.keyOf(request.name());
        ProductCategory category = categoryRepository.findByOfficeIdAndNameKey(officeId, key).orElse(null);
        if (category == null) {
            category = categoryRepository.saveAndFlush(new ProductCategory(officeId, request.name()));
        } else if (category.isDeleted()) {
            category.restore(request.name());
            categoryRepository.flush();
        } else {
            throw nameInUse();
        }
        return respond(category);
    }

    @Transactional
    public ProductCategoryResponse rename(UUID officeId, UUID id, ProductCategoryRequest request) {
        officeRepository.lockById(officeId);
        ProductCategory category = categoryRepository.findActiveForUpdate(id, officeId)
                .orElseThrow(ApiException::notFound);
        boolean keyTaken = categoryRepository
                .findByOfficeIdAndNameKey(officeId, ProductCategory.keyOf(request.name()))
                .filter(other -> !other.getId().equals(id))
                .isPresent();
        if (keyTaken) {
            throw nameInUse();
        }
        category.rename(request.name());
        categoryRepository.flush();
        return respond(category);
    }

    @Transactional
    public void delete(UUID officeId, UUID id) {
        ProductCategory category = categoryRepository.findActiveForUpdate(id, officeId)
                .orElseThrow(ApiException::notFound);
        category.delete(Instant.now(clock));
    }

    private ProductCategoryResponse respond(ProductCategory category) {
        return new ProductCategoryResponse(
                category.getId(), category.getName(), productRepository.countByCategoryId(category.getId()));
    }

    private static ApiException nameInUse() {
        return ApiException.conflict(NAME_FIELD, ErrorMessages.CATEGORY_NAME_IN_USE);
    }
}
