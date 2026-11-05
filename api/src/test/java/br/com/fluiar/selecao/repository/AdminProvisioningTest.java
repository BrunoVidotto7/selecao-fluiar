package br.com.fluiar.selecao.repository;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.fluiar.selecao.support.ApiIntegrationTest;
import java.nio.file.Path;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.MountableFile;

class AdminProvisioningTest extends ApiIntegrationTest {
    private static final String SCRIPT_PATH = "/tmp/provision-admin.sql";
    @Autowired
    private PostgreSQLContainer postgres;
    @Autowired
    private PasswordEncoder encoder;

    @Test
    void operationalScriptCreatesOneAdminAndRejectsDuplicateWithoutChangingCredentials() throws Exception {
        UUID office = UUID.randomUUID();
        UUID user = UUID.randomUUID();
        String hash = encoder.encode(DEFAULT_PASSWORD);
        postgres.copyFileToContainer(MountableFile.forHostPath(Path.of("ops/provision-admin.sql").toAbsolutePath()), SCRIPT_PATH);
        String[] command = {"psql", "-U", postgres.getUsername(), "-d", postgres.getDatabaseName(),
                "-v", "office_id=" + office, "-v", "user_id=" + user, "-v", "office_name=Provisioned office",
                "-v", "name=Provisioned admin", "-v", "email= Admin@Example.com ", "-v", "password_hash=" + hash,
                "-f", SCRIPT_PATH};

        assertThat(postgres.execInContainer(command).getExitCode()).isZero();
        assertThat(jdbc.queryForMap("select role, client_id, password_hash, email from users where id = ?", user))
                .containsEntry("role", "ADMIN").containsEntry("client_id", null)
                .containsEntry("password_hash", hash).containsEntry("email", "admin@example.com");
        assertThat(postgres.execInContainer(command).getExitCode()).isNotZero();
        assertThat(jdbc.queryForObject("select password_hash from users where id = ?", String.class, user)).isEqualTo(hash);
        assertThat(jdbc.queryForObject("select count(*) from users", Integer.class)).isEqualTo(1);
    }
}
