package br.com.fluiar.selecao.dto;

import br.com.fluiar.selecao.model.User;

public record PasswordResetInfoResponse(String email) {

    public static PasswordResetInfoResponse of(User user) {
        return new PasswordResetInfoResponse(user.getEmail());
    }
}
