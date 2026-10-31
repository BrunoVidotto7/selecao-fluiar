package br.com.fluiar.selecao.dto;

import jakarta.validation.constraints.NotBlank;

public record PasswordResetConfirmRequest(@NotBlank String token, @ValidPassword String newPassword) {
}
