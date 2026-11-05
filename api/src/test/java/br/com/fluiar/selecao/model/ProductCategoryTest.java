package br.com.fluiar.selecao.model;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ProductCategoryTest {

    @Test
    void keyOfNormalizesCaseAccentsAndSpaces() {
        assertThat(ProductCategory.keyOf("  Louças   e METAIS ")).isEqualTo("loucas e metais");
        assertThat(ProductCategory.keyOf("Têxteis")).isEqualTo("texteis");
    }

    @Test
    void renameChangesNameAndKey() {
        var category = new ProductCategory(UUID.randomUUID(), "Pedras");

        category.rename("Têxteis Finos");

        assertThat(category.getName()).isEqualTo("Têxteis Finos");
        assertThat(ProductCategory.keyOf(category.getName())).isEqualTo("texteis finos");
    }

    @Test
    void deleteMarksDeletedAndRestoreBringsItBackWithNewName() {
        var category = new ProductCategory(UUID.randomUUID(), "Pedras");

        category.delete(Instant.parse("2026-01-01T00:00:00Z"));
        assertThat(category.isDeleted()).isTrue();

        category.restore("pedras");
        assertThat(category.isDeleted()).isFalse();
        assertThat(category.getName()).isEqualTo("pedras");
    }
}
