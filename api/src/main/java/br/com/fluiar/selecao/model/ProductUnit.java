package br.com.fluiar.selecao.model;

import br.com.fluiar.selecao.exception.ErrorMessages;
import java.math.BigDecimal;

public enum ProductUnit {
    UNIT("1", "999", 0, ErrorMessages.QUANTITY_UNIT_INVALID),
    SQUARE_METER("0.01", "999.99", 2, ErrorMessages.QUANTITY_AREA_INVALID);

    private final BigDecimal min;
    private final BigDecimal max;
    private final int maxScale;
    private final String invalidQuantityMessage;

    ProductUnit(String min, String max, int maxScale, String invalidQuantityMessage) {
        this.min = new BigDecimal(min);
        this.max = new BigDecimal(max);
        this.maxScale = maxScale;
        this.invalidQuantityMessage = invalidQuantityMessage;
    }

    public boolean accepts(BigDecimal quantity) {
        return quantity != null
                && quantity.compareTo(min) >= 0
                && quantity.compareTo(max) <= 0
                && quantity.stripTrailingZeros().scale() <= maxScale;
    }

    public String invalidQuantityMessage() {
        return invalidQuantityMessage;
    }
}
