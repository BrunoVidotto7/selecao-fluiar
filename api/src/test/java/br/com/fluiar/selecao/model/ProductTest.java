package br.com.fluiar.selecao.model;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class ProductTest {

    @Test
    void lineTotalMultipliesUnitPriceByQuantity() {
        Product product = new Product(null, null, "Cadeira", 3, new BigDecimal("5.50"), null, false, List.of());

        assertThat(product.lineTotal()).isEqualByComparingTo("16.50");
    }

    @Test
    void lineTotalOfProductWithoutPriceIsZero() {
        Product product = new Product(null, null, "Cadeira", 2, null, null, false, List.of());

        assertThat(product.lineTotal()).isEqualByComparingTo("0");
    }
}
