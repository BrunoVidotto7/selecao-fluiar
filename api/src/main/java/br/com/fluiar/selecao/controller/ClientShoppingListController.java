package br.com.fluiar.selecao.controller;

import br.com.fluiar.selecao.dto.*;
import br.com.fluiar.selecao.dto.ClientListDetailResponse.ClientProduct;
import br.com.fluiar.selecao.security.CurrentClientId;
import br.com.fluiar.selecao.security.CurrentOfficeId;
import br.com.fluiar.selecao.service.ClientShoppingListService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/client/lists")
public class ClientShoppingListController {
    private final ClientShoppingListService lists;

    public ClientShoppingListController(ClientShoppingListService lists) {
        this.lists = lists;
    }

    @GetMapping
    public List<ClientListSummaryResponse> list(@CurrentOfficeId UUID officeId, @CurrentClientId UUID clientId) {
        return lists.list(officeId, clientId);
    }

    @GetMapping("/{listId}")
    public ClientListDetailResponse get(@CurrentOfficeId UUID officeId, @CurrentClientId UUID clientId, @PathVariable UUID listId) {
        return lists.get(officeId, clientId, listId);
    }

    @PatchMapping("/{listId}/products/{productId}")
    public ClientProduct setPurchase(@CurrentOfficeId UUID officeId, @CurrentClientId UUID clientId,
            @PathVariable UUID listId, @PathVariable UUID productId, @Valid @RequestBody ProductPurchaseRequest request) {
        return lists.setPurchase(officeId, clientId, listId, productId, request);
    }

    @PutMapping("/{listId}/products/{productId}/client-notes")
    public ClientProduct setNotes(@CurrentOfficeId UUID officeId, @CurrentClientId UUID clientId,
            @PathVariable UUID listId, @PathVariable UUID productId, @Valid @RequestBody ProductClientNotesRequest request) {
        return lists.setClientNotes(officeId, clientId, listId, productId, request);
    }
}
