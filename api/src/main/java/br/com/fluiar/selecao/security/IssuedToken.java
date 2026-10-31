package br.com.fluiar.selecao.security;

import java.time.Instant;

public record IssuedToken(String value, Instant expiresAt) {
}
