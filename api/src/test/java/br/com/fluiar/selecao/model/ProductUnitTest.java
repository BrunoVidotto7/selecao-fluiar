package br.com.fluiar.selecao.model;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.fluiar.selecao.exception.ErrorMessages;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class ProductUnitTest {

    @Test
    void unitAcceptsWholeNumbersFromOneTo999() {
        assertThat(ProductUnit.UNIT.accepts(new BigDecimal("1"))).isTrue();
        assertThat(ProductUnit.UNIT.accepts(new BigDecimal("999"))).isTrue();
        assertThat(ProductUnit.UNIT.accepts(new BigDecimal("2.00"))).isTrue();
        assertThat(ProductUnit.UNIT.accepts(new BigDecimal("0"))).isFalse();
        assertThat(ProductUnit.UNIT.accepts(new BigDecimal("1000"))).isFalse();
        assertThat(ProductUnit.UNIT.accepts(new BigDecimal("1.5"))).isFalse();
    }

    @Test
    void squareMeterAcceptsUpTo999Point99WithTwoDecimals() {
        assertThat(ProductUnit.SQUARE_METER.accepts(new BigDecimal("0.01"))).isTrue();
        assertThat(ProductUnit.SQUARE_METER.accepts(new BigDecimal("12.5"))).isTrue();
        assertThat(ProductUnit.SQUARE_METER.accepts(new BigDecimal("999.99"))).isTrue();
        assertThat(ProductUnit.SQUARE_METER.accepts(new BigDecimal("0"))).isFalse();
        assertThat(ProductUnit.SQUARE_METER.accepts(new BigDecimal("0.001"))).isFalse();
        assertThat(ProductUnit.SQUARE_METER.accepts(new BigDecimal("1000.00"))).isFalse();
    }

    @Test
    void invalidQuantityMessagesDependOnTheUnit() {
        assertThat(ProductUnit.UNIT.invalidQuantityMessage()).isEqualTo(ErrorMessages.QUANTITY_UNIT_INVALID);
        assertThat(ProductUnit.SQUARE_METER.invalidQuantityMessage()).isEqualTo(ErrorMessages.QUANTITY_AREA_INVALID);
    }
}
