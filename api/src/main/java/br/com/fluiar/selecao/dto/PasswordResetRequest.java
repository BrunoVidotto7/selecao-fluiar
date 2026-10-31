package br.com.fluiar.selecao.dto;

import br.com.fluiar.selecao.model.User;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PasswordResetRequest(
        @NotBlank @Email(regexp = Inputs.EMAIL_PATTERN) @Size(max = User.EMAIL_MAX_LENGTH) String email) {

    public PasswordResetRequest {
        email = Inputs.email(email);
    }
}
