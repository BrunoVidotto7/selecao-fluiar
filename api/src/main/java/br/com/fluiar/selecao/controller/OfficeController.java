package br.com.fluiar.selecao.controller;

import br.com.fluiar.selecao.dto.OfficeResponse;
import br.com.fluiar.selecao.dto.OfficeUpdateRequest;
import br.com.fluiar.selecao.security.CurrentOfficeId;
import br.com.fluiar.selecao.service.OfficeService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/office")
public class OfficeController {
    private final OfficeService officeService;

    public OfficeController(OfficeService officeService) {
        this.officeService = officeService;
    }

    @GetMapping
    public OfficeResponse getOffice(@CurrentOfficeId UUID officeId) {
        return officeService.getOffice(officeId);
    }

    @PutMapping
    public OfficeResponse renameOffice(@CurrentOfficeId UUID officeId, @Valid @RequestBody OfficeUpdateRequest request) {
        return officeService.rename(officeId, request);
    }
}
