package br.com.fluiar.selecao.support;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

    private static final String POSTGRES_IMAGE = "postgres:18-alpine";

    @Bean
    @ServiceConnection
    PostgreSQLContainer postgresContainer() {
        PostgreSQLContainer container = new PostgreSQLContainer(DockerImageName.parse(POSTGRES_IMAGE));
        // The default waiter only reads the container log. On Rancher Desktop the published port
        // becomes reachable a moment later, so the first Flyway connection was refused.
        container.waitingFor(Wait.forListeningPort());
        return container;
    }
}
