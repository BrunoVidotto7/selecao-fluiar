package br.com.fluiar.selecao.dto;

import br.com.fluiar.selecao.model.Office;
import br.com.fluiar.selecao.model.OfficeInvitation;
import br.com.fluiar.selecao.model.User;

public record InvitationInfoResponse(String email, String officeName, String invitedByName) {

    public static InvitationInfoResponse of(OfficeInvitation invitation, Office office, User inviter) {
        return new InvitationInfoResponse(invitation.getEmail(), office.getName(), inviter.getName());
    }
}
