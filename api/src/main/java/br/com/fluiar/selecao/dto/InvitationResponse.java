package br.com.fluiar.selecao.dto;

import br.com.fluiar.selecao.model.OfficeInvitation;
import java.time.Instant;
import java.util.UUID;

public record InvitationResponse(UUID id, String email, Instant expiresAt, Instant createdAt) {

    public static InvitationResponse of(OfficeInvitation invitation) {
        return new InvitationResponse(
                invitation.getId(), invitation.getEmail(), invitation.getExpiresAt(), invitation.getCreatedAt());
    }
}
