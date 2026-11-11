package br.com.fluiar.selecao.security;

import br.com.fluiar.selecao.model.ShoppingList;
import br.com.fluiar.selecao.model.User;
import br.com.fluiar.selecao.model.UserRole;

public final class ListAccessPolicy {
    private ListAccessPolicy() { }

    public static boolean permits(User user, ShoppingList list) {
        if (!user.getOfficeId().equals(list.getClient().getOfficeId())) {
            return false;
        }
        return user.getRole() == UserRole.ADMIN
                || (user.getRole() == UserRole.CLIENT && list.roleOf(user.getClientId()).isPresent());
    }
}
