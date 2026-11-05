package br.com.fluiar.selecao.repository;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.fluiar.selecao.support.ApiIntegrationTest;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.support.TransactionTemplate;

class ProductRepositoryLockTest extends ApiIntegrationTest {

    @Autowired
    private ProductRepository products;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private TransactionTemplate transaction;

    @Test
    void findInOfficeForUpdateLocksTheProductRow() {
        var paula = createAdmin("Paula", "paula@example.com");
        var listId = createList(paula, createClient(paula, "Sergio"), "Lista");
        var productId = createProduct(paula, listId, createRoom(paula, listId, "Sala"), "Mesa");

        transaction.executeWithoutResult(status -> {
            var product = products.findInOfficeForUpdate(productId, paula.officeId()).orElseThrow();

            assertThat(entityManager.getLockMode(product)).isEqualTo(LockModeType.PESSIMISTIC_WRITE);
        });
    }
}
