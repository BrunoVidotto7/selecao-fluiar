package br.com.fluiar.selecao.dto;

import java.util.UUID;

public record ProductCategoryResponse(UUID id, String name, long productCount) {
}
