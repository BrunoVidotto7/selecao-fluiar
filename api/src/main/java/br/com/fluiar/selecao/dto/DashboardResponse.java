package br.com.fluiar.selecao.dto;

import java.util.List;

public record DashboardResponse(
        long clientCount,
        long clientsCreatedThisMonth,
        long listCount,
        long completedListCount,
        long listsWithPendingProductsCount,
        long totalProductCount,
        long pendingProductCount,
        List<ClientSummaryResponse> recentClients,
        List<ListSummaryResponse> recentLists) {
}
