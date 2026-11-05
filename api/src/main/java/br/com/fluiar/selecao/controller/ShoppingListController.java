package br.com.fluiar.selecao.controller;

import br.com.fluiar.selecao.dto.ListDetailResponse;
import br.com.fluiar.selecao.dto.ListSummaryResponse;
import br.com.fluiar.selecao.dto.ShareTokenResponse;
import br.com.fluiar.selecao.dto.ShoppingListRequest;
import br.com.fluiar.selecao.security.CurrentOfficeId;
import br.com.fluiar.selecao.service.ShoppingListService;
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
@RequestMapping("/api/lists")
public class ShoppingListController {
    private final br.com.fluiar.selecao.service.ListActivityService activity;


    private final ShoppingListService shoppingListService;

    public ShoppingListController(ShoppingListService shoppingListService, br.com.fluiar.selecao.service.ListActivityService activity) {
        this.activity = activity;
        this.shoppingListService = shoppingListService;
    }

    @GetMapping
    public List<ListSummaryResponse> listLists(@CurrentOfficeId UUID officeId) {
        return shoppingListService.list(officeId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ListDetailResponse createList(
            @CurrentOfficeId UUID officeId, @Valid @RequestBody ShoppingListRequest request) {
        return shoppingListService.create(officeId, request);
    }

    @GetMapping("/{id}")
    public ListDetailResponse getList(@CurrentOfficeId UUID officeId, @PathVariable UUID id) {
        return shoppingListService.get(officeId, id);
    }

    @PutMapping("/{id}")
    public ListDetailResponse updateList(
            @CurrentOfficeId UUID officeId, @PathVariable UUID id, @Valid @RequestBody ShoppingListRequest request) {
        return shoppingListService.update(officeId, id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteList(@CurrentOfficeId UUID officeId, @PathVariable UUID id) {
        shoppingListService.delete(officeId, id);
    }

    @PostMapping("/{id}/share-token")
    public ShareTokenResponse rotateShareToken(@CurrentOfficeId UUID officeId, @PathVariable UUID id) {
        return shoppingListService.rotateShareToken(officeId, id);
    }
    @PostMapping("/{id}/activity")
    @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void recordActivity(@CurrentOfficeId UUID officeId, @PathVariable UUID id) {
        activity.open(officeId, null, id);
    }

}
