package br.com.fluiar.selecao.model;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class ProductTest {

    @Test
    void lineTotalMultipliesUnitPriceByQuantity() {
        Product product = new Product(null, null, "Cadeira", new BigDecimal("3"), ProductUnit.UNIT, new BigDecimal("5.50"), null, false, List.of());

        assertThat(product.lineTotal()).isEqualByComparingTo("16.50");
    }

    @Test
    void lineTotalMultipliesUnitPriceByAreaQuantity() {
        Product product = new Product(null, null, "Piso", new BigDecimal("12.5"), ProductUnit.SQUARE_METER,
                new BigDecimal("100.00"), null, false, List.of());

        assertThat(product.lineTotal()).isEqualByComparingTo("1250.00");
    }

    @Test
    void lineTotalIsRoundedToCents() {
        Product product = new Product(null, null, "Piso", new BigDecimal("0.01"), ProductUnit.SQUARE_METER,
                new BigDecimal("19.99"), null, false, List.of());

        assertThat(product.lineTotal()).isEqualTo(new BigDecimal("0.20"));
    }

    @Test
    void lineTotalOfProductWithoutPriceIsZero() {
        Product product = new Product(null, null, "Cadeira", new BigDecimal("2"), ProductUnit.UNIT, null, null, false, List.of());

        assertThat(product.lineTotal()).isEqualByComparingTo("0");
    }
}
