package br.com.fluiar.selecao.service;

import br.com.fluiar.selecao.dto.ListAccessResponse;
import br.com.fluiar.selecao.exception.ApiException;
import br.com.fluiar.selecao.repository.ShoppingListRepository;
import br.com.fluiar.selecao.repository.UserRepository;
import br.com.fluiar.selecao.security.ListAccessPolicy;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ListAccessService {
    private final ShoppingListRepository lists;
    private final UserRepository users;

    public ListAccessService(ShoppingListRepository lists, UserRepository users) {
        this.lists = lists;
        this.users = users;
    }

    public ListAccessResponse resolve(UUID userId, String token) {
        var user = users.findById(userId).orElseThrow(ApiException::notFound);
        var list = lists.findByShareToken(token).orElseThrow(ApiException::notFound);
        if (!ListAccessPolicy.permits(user, list.getClient())) {
            throw ApiException.notFound();
        }
        return new ListAccessResponse(list.getId(), user.getRole());
    }
}
