package br.com.fluiar.selecao.dto;

import java.math.BigDecimal;

/** Both fields are optional: a field sent as null (or left out) keeps its current value. */
public record ProductStatusRequest(
        Boolean bought,
        BigDecimal quantity) {
}
