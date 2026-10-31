package br.com.fluiar.selecao.dto;

import br.com.fluiar.selecao.model.User;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** {@code rememberMe} is optional: when it is omitted, the token gets the regular lifetime. */
public record LoginRequest(
        @NotBlank @Size(max = User.EMAIL_MAX_LENGTH) String email,
        @NotBlank String password,
        Boolean rememberMe) {

    public LoginRequest {
        email = Inputs.email(email);
        rememberMe = Boolean.TRUE.equals(rememberMe);
    }
}
