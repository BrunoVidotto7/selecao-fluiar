package br.com.fluiar.selecao.dto;

import br.com.fluiar.selecao.exception.ErrorMessages;
import br.com.fluiar.selecao.model.Client;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Validation runs after the compact constructor, so the phone pattern checks the digits left after cleaning. */
public record ClientRequest(
        @NotBlank @Size(max = Client.NAME_MAX_LENGTH) String name,
        @NotBlank @Email(regexp = Inputs.EMAIL_PATTERN) @Size(max = Client.EMAIL_MAX_LENGTH) String email,
        @NotNull @Pattern(regexp = Client.PHONE_DIGITS_PATTERN, message = ErrorMessages.PHONE_INVALID) String phone) {

    public ClientRequest {
        name = Inputs.text(name);
        email = Inputs.email(email);
        phone = Inputs.digits(phone);
    }
}
