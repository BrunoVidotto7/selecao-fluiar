package br.com.fluiar.selecao.controller;

import br.com.fluiar.selecao.dto.ListAccessResponse;
import br.com.fluiar.selecao.security.CurrentUserId;
import br.com.fluiar.selecao.service.ListAccessService;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/public")
public class PublicListController {
    private final ListAccessService access;

    public PublicListController(ListAccessService access) { this.access = access; }

    @GetMapping("/lists/{shareToken}")
    public ListAccessResponse resolve(@CurrentUserId UUID userId, @PathVariable String shareToken) {
        return access.resolve(userId, shareToken);
    }
}
