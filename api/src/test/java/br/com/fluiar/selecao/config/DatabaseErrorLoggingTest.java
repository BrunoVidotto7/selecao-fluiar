package br.com.fluiar.selecao.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.com.fluiar.selecao.model.User;
import br.com.fluiar.selecao.repository.UserRepository;
import br.com.fluiar.selecao.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.dao.DataIntegrityViolationException;

/** The services check e-mails before saving, so only two simultaneous signups make the database refuse one. */
class DatabaseErrorLoggingTest extends ApiIntegrationTest {

    private static final String PAULA_NAME = "Paula Hooper";
    private static final String PAULA_EMAIL = "paula@fluiar.com.br";
    private static final String PASSWORD_HASH = "not-a-real-hash";
    private static final String EMAIL_CONSTRAINT = "uk_users_email";

    @Autowired
    private UserRepository userRepository;

    @Test
    @ExtendWith(OutputCaptureExtension.class)
    void duplicateEmailErrorIsLoggedWithoutTheEmail(CapturedOutput output) {
        var paula = signUp(PAULA_NAME, PAULA_EMAIL);
        User sameEmail = new User(paula.officeId(), PAULA_NAME, PAULA_EMAIL, PASSWORD_HASH);

        assertThatThrownBy(() -> userRepository.saveAndFlush(sameEmail))
                .isInstanceOf(DataIntegrityViolationException.class);

        assertThat(output.getOut()).contains(EMAIL_CONSTRAINT).doesNotContain(PAULA_EMAIL);
    }
}
