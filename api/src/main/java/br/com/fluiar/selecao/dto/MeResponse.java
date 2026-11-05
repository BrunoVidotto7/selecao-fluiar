package br.com.fluiar.selecao.dto;

import br.com.fluiar.selecao.model.Office;
import br.com.fluiar.selecao.model.User;
import br.com.fluiar.selecao.model.UserRole;
import java.util.UUID;

public record MeResponse(UUID id, String name, String email, UUID officeId, String officeName,
        UserRole role, UUID clientId) {

    public static MeResponse of(User user, Office office) {
        return new MeResponse(user.getId(), user.getName(), user.getEmail(), office.getId(), office.getName(),
                user.getRole(), user.getClientId());
    }
}
