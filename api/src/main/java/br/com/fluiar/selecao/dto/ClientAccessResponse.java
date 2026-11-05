package br.com.fluiar.selecao.dto;

import java.time.Instant;
import java.util.UUID;

public record ClientAccessResponse(Status status, String email, UUID invitationId, Instant expiresAt) {
    public enum Status { NOT_INVITED, PENDING, EXPIRED, ACTIVE }
}
