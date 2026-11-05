package br.com.fluiar.selecao.model;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ProductCategoryTest {

    @Test
    void keyOfNormalizesCaseAccentsAndSpaces() {
        assertThat(ProductCategory.keyOf("  Louças   e METAIS ")).isEqualTo("loucas e metais");
        assertThat(ProductCategory.keyOf("Têxteis")).isEqualTo("texteis");
    }
}
