package br.com.fluiar.selecao.dto;

import br.com.fluiar.selecao.model.User;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SignupRequest(
        @NotBlank @Size(max = User.NAME_MAX_LENGTH) String name,
        @NotBlank @Email(regexp = Inputs.EMAIL_PATTERN) @Size(max = User.EMAIL_MAX_LENGTH) String email,
        @ValidPassword String password) {

    public SignupRequest {
        name = Inputs.text(name);
        email = Inputs.email(email);
    }
}
