package br.com.fluiar.selecao.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import br.com.fluiar.selecao.dto.*;
import br.com.fluiar.selecao.exception.ApiException;
import br.com.fluiar.selecao.model.*;
import br.com.fluiar.selecao.repository.*;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import tools.jackson.databind.json.JsonMapper;

class ClientShoppingListServiceTest {
    private final UUID officeId = UUID.randomUUID();
    private final UUID clientId = UUID.randomUUID();
    private final UUID listId = UUID.randomUUID();
    private final UUID productId = UUID.randomUUID();
    private final ShoppingListRepository lists = mock(ShoppingListRepository.class);
    private final ProductRepository products = mock(ProductRepository.class);
    private final OfficeRepository offices = mock(OfficeRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final ClientShoppingListService service = new ClientShoppingListService(lists, products, offices, users, org.mockito.Mockito.mock(ListActivityService.class), java.time.Clock.fixed(java.time.Instant.parse("2026-11-05T12:00:00Z"), java.time.ZoneOffset.UTC));
    private final JsonMapper mapper = JsonMapper.builder().build();
    private ShoppingList list;
    private Product product;

    @BeforeEach
    void setUp() {
        var client = new Client(officeId, "Client", "private@example.com", "31999999999");
        ReflectionTestUtils.setField(client, "id", clientId);
        list = new ShoppingList(client, "Home", null, "private-share-token");
        ReflectionTestUtils.setField(list, "id", listId);
        var room = new Room(list, "Kitchen", 0);
        ReflectionTestUtils.setField(room, "id", UUID.randomUUID());
        product = new Product(room, new ProductCategory(officeId, "Outros"), "Chair", new BigDecimal("2"), ProductUnit.UNIT, BigDecimal.TEN, "Internal instruction", false, List.of());
        ReflectionTestUtils.setField(product, "id", productId);
        list.getRooms().add(room);
        room.getProducts().add(product);
        when(lists.findInOffice(listId, officeId)).thenReturn(Optional.of(list));
        when(lists.findInOfficeForUpdate(listId, officeId)).thenReturn(Optional.of(list));
        when(products.findInOfficeForUpdate(productId, officeId)).thenReturn(Optional.of(product));
        when(offices.findById(officeId)).thenReturn(Optional.of(new Office("Office")));
        when(users.findByOfficeIdAndRoleOrderByNameAsc(officeId, UserRole.ADMIN)).thenReturn(List.of());
    }

    @Test
    void sameInstantChangesHaveDistinctRevisionsAndRepeatedValuesDoNotAdvance() {
        service.setPurchase(officeId, clientId, listId, productId, new ProductPurchaseRequest(true));
        service.setClientNotes(officeId, clientId, listId, productId, new ProductClientNotesRequest("  Preto  "));
        service.setPurchase(officeId, clientId, listId, productId, new ProductPurchaseRequest(true));
        service.setClientNotes(officeId, clientId, listId, productId, new ProductClientNotesRequest("Preto"));
        assertThat(list.getClientChangeRevision()).isEqualTo(2);
        assertThat(product.getClientChanges().getPurchaseRevision()).isEqualTo(1);
        assertThat(product.getClientChanges().getNotesRevision()).isEqualTo(2);
        assertThat(product.getClientChanges().getPurchaseChangedAt()).isEqualTo(java.time.Instant.parse("2026-11-05T12:00:00Z"));
        assertThat(product.getClientChanges().getNotesChangedAt()).isEqualTo(product.getClientChanges().getPurchaseChangedAt());
    }

    @Test
    void aClientCannotReadOrWriteAnotherClientsList() {
        UUID otherClient = UUID.randomUUID();
        assertThatThrownBy(() -> service.get(officeId, otherClient, listId)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.setPurchase(officeId, otherClient, listId, productId,
                new ProductPurchaseRequest(true))).isInstanceOf(ApiException.class);
        assertThat(product.isBought()).isFalse();
    }

    @Test
    void privateDetailsOmitAdministrativeData() {
        var detail = service.get(officeId, clientId, listId);
        assertThat(detail).isNotNull();
        var json = mapper.valueToTree(detail);
        assertThat(json.has("shareToken")).isFalse();
        assertThat(json.has("clientId")).isFalse();
        var item = json.get("rooms").get(0).get("products").get(0);
        assertThat(item.has("notes")).isFalse();
        assertThat(item.has("unitPrice")).isFalse();
        assertThat(detail.stats().pendingProducts()).isEqualTo(1);
    }

    @Test
    void purchaseAndNoteWritesPreserveEachOthersValues() {
        var note = service.setClientNotes(officeId, clientId, listId, productId,
                new ProductClientNotesRequest("  Bought locally  "));
        assertThat(note).isNotNull();
        assertThat(note.clientNotes()).isEqualTo("Bought locally");
        var bought = service.setPurchase(officeId, clientId, listId, productId, new ProductPurchaseRequest(true));
        assertThat(bought).isNotNull();
        assertThat(bought.bought()).isTrue();
        assertThat(bought.clientNotes()).isEqualTo("Bought locally");
        var cleared = service.setClientNotes(officeId, clientId, listId, productId, new ProductClientNotesRequest(null));
        assertThat(cleared.clientNotes()).isNull();
        assertThat(cleared.bought()).isTrue();
        assertThat(product.getNotes()).isEqualTo("Internal instruction");
        assertThat(product.getQuantity()).isEqualByComparingTo("2");
    }

    @Test
    void notesAreNormalizedAndPayloadsCannotEditOtherFields() {
        assertThat(new ProductClientNotesRequest("   ").clientNotes()).isNull();
        assertThatThrownBy(() -> mapper.readValue("{\"bought\":true,\"quantity\":3}", ProductPurchaseRequest.class))
                .isInstanceOf(Exception.class);
        assertThatThrownBy(() -> mapper.readValue("{\"bought\":\"true\"}", ProductPurchaseRequest.class))
                .isInstanceOf(Exception.class);
        assertThatThrownBy(() -> mapper.readValue("{}", ProductClientNotesRequest.class)).isInstanceOf(Exception.class);
    }
}
