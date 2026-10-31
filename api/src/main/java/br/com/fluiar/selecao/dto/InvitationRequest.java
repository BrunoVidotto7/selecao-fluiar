package br.com.fluiar.selecao.dto;

import br.com.fluiar.selecao.model.User;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record InvitationRequest(
        @NotBlank @Email(regexp = Inputs.EMAIL_PATTERN) @Size(max = User.EMAIL_MAX_LENGTH) String email) {

    public InvitationRequest {
        email = Inputs.email(email);
    }
}
