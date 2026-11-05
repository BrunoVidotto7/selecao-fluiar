package br.com.fluiar.selecao.controller;

import br.com.fluiar.selecao.dto.ClientChangePageResponse;
import br.com.fluiar.selecao.dto.ClientChangeReadRequest;
import br.com.fluiar.selecao.exception.ApiException;
import br.com.fluiar.selecao.exception.ErrorMessages;
import br.com.fluiar.selecao.security.CurrentOfficeId;
import br.com.fluiar.selecao.security.CurrentUserId;
import br.com.fluiar.selecao.service.ClientChangeService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
public class ClientChangeController {
    private static final String PAGE_FIELD = "page";
    private final ClientChangeService changes;

    public ClientChangeController(ClientChangeService changes) { this.changes = changes; }

    @GetMapping("/api/client-changes")
    public ClientChangePageResponse list(@CurrentOfficeId UUID officeId, @CurrentUserId UUID userId,
            @RequestParam(required = false) String page) {
        return changes.list(officeId, userId, parsePage(page));
    }

    @PostMapping("/api/lists/{id}/client-changes/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void markRead(@CurrentOfficeId UUID officeId, @CurrentUserId UUID userId, @PathVariable UUID id,
            @Valid @RequestBody ClientChangeReadRequest request) {
        changes.markRead(officeId, userId, id, request.observedRevision());
    }

    private static int parsePage(String value) {
        if (value == null) return 0;
        try {
            int page = Integer.parseInt(value);
            if (page >= 0) return page;
        } catch (NumberFormatException ignored) {
        }
        throw ApiException.invalidField(PAGE_FIELD, ErrorMessages.CLIENT_CHANGE_PAGE_INVALID);
    }
}
