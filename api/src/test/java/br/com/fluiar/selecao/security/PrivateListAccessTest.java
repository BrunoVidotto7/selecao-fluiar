package br.com.fluiar.selecao.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import br.com.fluiar.selecao.exception.ApiException;
import br.com.fluiar.selecao.model.*;
import br.com.fluiar.selecao.repository.ShoppingListRepository;
import br.com.fluiar.selecao.repository.UserRepository;
import br.com.fluiar.selecao.service.ListAccessService;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class PrivateListAccessTest {
    private final UUID officeId = UUID.randomUUID();
    private final UUID clientId = UUID.randomUUID();

    @Test
    void sharingNeverGrantsAccessToAnotherClientOrOffice() {
        Client client = client();
        assertThat(ListAccessPolicy.permits(User.admin(officeId, "Admin", "admin@example.com", "hash"), client)).isTrue();
        assertThat(ListAccessPolicy.permits(User.client(officeId, clientId, "Client", "client@example.com", "hash"), client)).isTrue();
        assertThat(ListAccessPolicy.permits(User.client(officeId, UUID.randomUUID(), "Other", "other@example.com", "hash"), client)).isFalse();
        assertThat(ListAccessPolicy.permits(User.admin(UUID.randomUUID(), "Other", "other@example.com", "hash"), client)).isFalse();
    }

    @Test
    void resolvingTokenReturnsOnlyAuthorizedNavigationData() {
        var lists = mock(ShoppingListRepository.class);
        var users = mock(UserRepository.class);
        UUID userId = UUID.randomUUID();
        UUID listId = UUID.randomUUID();
        var list = new ShoppingList(client(), "Home", null, "token");
        ReflectionTestUtils.setField(list, "id", listId);
        when(lists.findByShareToken("token")).thenReturn(Optional.of(list));
        when(users.findById(userId)).thenReturn(Optional.of(User.client(officeId, clientId, "Client", "client@example.com", "hash")));
        var service = new ListAccessService(lists, users);
        var resolved = service.resolve(userId, "token");
        assertThat(resolved).isNotNull();
        assertThat(resolved.listId()).isEqualTo(listId);
        assertThat(resolved.role()).isEqualTo(UserRole.CLIENT);
        when(users.findById(userId)).thenReturn(Optional.of(User.client(officeId, UUID.randomUUID(), "Other", "other@example.com", "hash")));
        assertThatThrownBy(() -> service.resolve(userId, "token")).isInstanceOf(ApiException.class);
    }

    private Client client() {
        var client = new Client(officeId, "Client", "client@example.com", "31999999999");
        ReflectionTestUtils.setField(client, "id", clientId);
        return client;
    }
}
