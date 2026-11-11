package br.com.fluiar.selecao.dto;

import br.com.fluiar.selecao.model.Client;
import br.com.fluiar.selecao.model.Product;
import br.com.fluiar.selecao.model.ProjectInfo;
import br.com.fluiar.selecao.model.Room;
import br.com.fluiar.selecao.model.ShoppingList;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

public record ListDetailResponse(
        UUID id,
        String name,
        String description,
        UUID clientId,
        String clientName,
        String shareToken,
        Instant updatedAt,
        ListStatsResponse stats,
        List<RoomResponse> rooms,
        ClientChangesResponse clientChanges,
        List<ListMemberResponse> members,
        String projectCode,
        String contract,
        String contractorName,
        String contractorDocument,
        String siteZipCode,
        String siteAddress) {

    /**
     * Loads the rooms, their products and the products' links lazily. The {@code default_batch_fetch_size} setting
     * loads each level for many parents in one query, so the number of queries does not grow with the list.
     */
    public static ListDetailResponse of(ShoppingList list) {
        return of(list, new ClientChangesResponse(list.getClientChangeRevision(), List.of()));
    }

    public static ListDetailResponse of(ShoppingList list, ClientChangesResponse clientChanges) {
        Client client = list.getClient();
        List<Room> rooms = list.getRooms();
        List<Product> products = rooms.stream().flatMap(room -> room.getProducts().stream()).toList();

        ProjectInfo info = list.getProjectInfo();
        List<ListMemberResponse> members = list.getMembers().stream().map(ListMemberResponse::of)
                .sorted(Comparator.comparing(ListMemberResponse::clientName)).toList();

        return new ListDetailResponse(list.getId(), list.getName(), list.getDescription(), client.getId(),
                client.getName(), list.getShareToken(), list.getUpdatedAt(), ListStatsResponse.of(products),
                rooms.stream().map(RoomResponse::of).toList(), clientChanges, members, info.projectCode(), info.contract(),
                info.contractorName(), info.contractorDocument(), info.siteZipCode(), info.siteAddress());
    }
}
