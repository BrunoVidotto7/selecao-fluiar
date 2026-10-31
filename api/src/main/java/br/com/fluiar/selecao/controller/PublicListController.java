package br.com.fluiar.selecao.controller;

import br.com.fluiar.selecao.dto.PublicListResponse;
import br.com.fluiar.selecao.service.ShoppingListService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Public: the client opens the shared link without an account. */
@RestController
@RequestMapping("/api/public")
public class PublicListController {

    private final ShoppingListService shoppingListService;

    public PublicListController(ShoppingListService shoppingListService) {
        this.shoppingListService = shoppingListService;
    }

    @GetMapping("/lists/{shareToken}")
    public PublicListResponse getPublicList(@PathVariable String shareToken) {
        return shoppingListService.getPublic(shareToken);
    }
}
