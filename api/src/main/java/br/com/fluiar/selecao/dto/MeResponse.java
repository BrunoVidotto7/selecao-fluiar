package br.com.fluiar.selecao.dto;

import br.com.fluiar.selecao.model.Office;
import br.com.fluiar.selecao.model.User;
import java.util.UUID;

public record MeResponse(UUID id, String name, String email, UUID officeId, String officeName) {

    public static MeResponse of(User user, Office office) {
        return new MeResponse(user.getId(), user.getName(), user.getEmail(), office.getId(), office.getName());
    }
}
