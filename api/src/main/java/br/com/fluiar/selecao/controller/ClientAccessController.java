package br.com.fluiar.selecao.controller;

import br.com.fluiar.selecao.dto.ClientAccessResponse;
import br.com.fluiar.selecao.dto.InvitationResponse;
import br.com.fluiar.selecao.security.CurrentOfficeId;
import br.com.fluiar.selecao.security.CurrentUserId;
import br.com.fluiar.selecao.service.InvitationService;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/clients/{clientId}")
public class ClientAccessController {
    private final InvitationService invitations;

    public ClientAccessController(InvitationService invitations) {
        this.invitations = invitations;
    }

    @GetMapping("/access")
    public ClientAccessResponse getAccess(@CurrentOfficeId UUID officeId, @PathVariable UUID clientId) {
        return invitations.getAccess(officeId, clientId);
    }

    @PostMapping("/invitations")
    @ResponseStatus(HttpStatus.CREATED)
    public InvitationResponse invite(@CurrentUserId UUID adminId, @CurrentOfficeId UUID officeId, @PathVariable UUID clientId) {
        return invitations.invite(adminId, officeId, clientId);
    }

    @DeleteMapping("/invitations/{invitationId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revoke(@CurrentOfficeId UUID officeId, @PathVariable UUID clientId, @PathVariable UUID invitationId) {
        invitations.revoke(officeId, clientId, invitationId);
    }
}
