package br.com.fluiar.selecao.dto;

import br.com.fluiar.selecao.model.User;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ProfileUpdateRequest(
        @NotBlank @Size(max = User.NAME_MAX_LENGTH) String name,
        @NotBlank @Email(regexp = Inputs.EMAIL_PATTERN) @Size(max = User.EMAIL_MAX_LENGTH) String email,
        /** Required only when the e-mail changes; the service checks it. */
        String currentPassword) {

    public ProfileUpdateRequest {
        name = Inputs.text(name);
        email = Inputs.email(email);
    }
}
