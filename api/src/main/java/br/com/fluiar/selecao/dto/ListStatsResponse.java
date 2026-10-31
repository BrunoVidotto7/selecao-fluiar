package br.com.fluiar.selecao.dto;

import br.com.fluiar.selecao.model.Product;
import java.math.BigDecimal;
import java.util.List;

public record ListStatsResponse(
        int totalProducts,
        int boughtProducts,
        int pendingProducts,
        BigDecimal estimatedTotal,
        BigDecimal remainingTotal) {

    /** The remaining total counts only the products not bought yet. */
    public static ListStatsResponse of(List<Product> products) {
        List<Product> pending = products.stream().filter(product -> !product.isBought()).toList();
        int boughtCount = products.size() - pending.size();

        return new ListStatsResponse(products.size(), boughtCount, pending.size(), totalOf(products),
                totalOf(pending));
    }

    private static BigDecimal totalOf(List<Product> products) {
        return products.stream().map(Product::lineTotal).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
