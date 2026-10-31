package br.com.fluiar.selecao.dto;

import br.com.fluiar.selecao.model.User;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** The e-mail is not part of the request: the new account uses the invited e-mail. */
public record InvitationAcceptRequest(
        @NotBlank @Size(max = User.NAME_MAX_LENGTH) String name,
        @ValidPassword String password) {

    public InvitationAcceptRequest {
        name = Inputs.text(name);
    }
}
