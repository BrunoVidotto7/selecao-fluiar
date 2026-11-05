package br.com.fluiar.selecao.security;

import br.com.fluiar.selecao.model.Client;
import br.com.fluiar.selecao.model.User;
import br.com.fluiar.selecao.model.UserRole;

public final class ListAccessPolicy {
    private ListAccessPolicy() { }

    public static boolean permits(User user, Client client) {
        if (!user.getOfficeId().equals(client.getOfficeId())) {
            return false;
        }
        return user.getRole() == UserRole.ADMIN
                || (user.getRole() == UserRole.CLIENT && client.getId().equals(user.getClientId()));
    }
}
