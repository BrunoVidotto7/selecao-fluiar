package br.com.fluiar.selecao.dto;

import jakarta.validation.constraints.NotBlank;

public record PasswordChangeRequest(@NotBlank String currentPassword, @ValidPassword String newPassword) {
}
