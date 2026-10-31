package br.com.fluiar.selecao.controller;

import br.com.fluiar.selecao.dto.InvitationRequest;
import br.com.fluiar.selecao.dto.InvitationResponse;
import br.com.fluiar.selecao.dto.OfficeResponse;
import br.com.fluiar.selecao.dto.OfficeUpdateRequest;
import br.com.fluiar.selecao.security.CurrentOfficeId;
import br.com.fluiar.selecao.security.CurrentUserId;
import br.com.fluiar.selecao.service.InvitationService;
import br.com.fluiar.selecao.service.OfficeService;
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
@RequestMapping("/api/office")
public class OfficeController {

    private final OfficeService officeService;
    private final InvitationService invitationService;

    public OfficeController(OfficeService officeService, InvitationService invitationService) {
        this.officeService = officeService;
        this.invitationService = invitationService;
    }

    @GetMapping
    public OfficeResponse getOffice(@CurrentOfficeId UUID officeId) {
        return officeService.getOffice(officeId);
    }

    @PutMapping
    public OfficeResponse renameOffice(
            @CurrentOfficeId UUID officeId, @Valid @RequestBody OfficeUpdateRequest request) {
        return officeService.rename(officeId, request);
    }

    @GetMapping("/invitations")
    public List<InvitationResponse> listInvitations(@CurrentOfficeId UUID officeId) {
        return invitationService.listPending(officeId);
    }

    @PostMapping("/invitations")
    @ResponseStatus(HttpStatus.CREATED)
    public InvitationResponse invite(
            @CurrentUserId UUID userId, @CurrentOfficeId UUID officeId, @Valid @RequestBody InvitationRequest request) {
        return invitationService.invite(userId, officeId, request);
    }

    @DeleteMapping("/invitations/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revokeInvitation(@CurrentOfficeId UUID officeId, @PathVariable UUID id) {
        invitationService.revoke(officeId, id);
    }
}
