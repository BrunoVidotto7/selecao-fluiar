package br.com.fluiar.selecao.dto;

import br.com.fluiar.selecao.model.Office;
import br.com.fluiar.selecao.model.User;
import java.util.List;
import java.util.UUID;

public record OfficeResponse(UUID id, String name, List<MemberResponse> members) {

    public record MemberResponse(UUID id, String name, String email) {

        public static MemberResponse of(User user) {
            return new MemberResponse(user.getId(), user.getName(), user.getEmail());
        }
    }

    public static OfficeResponse of(Office office, List<User> members) {
        return new OfficeResponse(office.getId(), office.getName(), members.stream().map(MemberResponse::of).toList());
    }
}
