package br.com.fluiar.selecao.dto;

import br.com.fluiar.selecao.model.Office;
import br.com.fluiar.selecao.model.User;
import br.com.fluiar.selecao.security.IssuedToken;
import java.time.Instant;

public record AuthResponse(String accessToken, Instant expiresAt, MeResponse user) {

    public static AuthResponse of(IssuedToken token, User user, Office office) {
        return new AuthResponse(token.value(), token.expiresAt(), MeResponse.of(user, office));
    }
}
