package br.com.fluiar.selecao.dto;

/** {@code ShoppingListRepository.findDashboardTotals} calls this constructor, so its order and types must match. */
public record DashboardTotals(
        long listCount,
        long completedListCount,
        long listsWithPendingProductsCount,
        long totalProductCount,
        long pendingProductCount) {
}
