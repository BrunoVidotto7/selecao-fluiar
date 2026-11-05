package br.com.fluiar.selecao.dto;

import br.com.fluiar.selecao.model.Client;
import br.com.fluiar.selecao.model.Office;
import br.com.fluiar.selecao.model.OfficeInvitation;
import br.com.fluiar.selecao.model.User;

public record InvitationInfoResponse(String email, String clientName, String officeName, String invitedByName) {
    public static InvitationInfoResponse of(OfficeInvitation invitation, Client client, Office office, User inviter) {
        return new InvitationInfoResponse(invitation.getEmail(), client.getName(), office.getName(), inviter.getName());
    }
}
