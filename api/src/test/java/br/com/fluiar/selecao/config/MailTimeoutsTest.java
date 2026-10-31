package br.com.fluiar.selecao.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Properties;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.mail.autoconfigure.MailSenderAutoConfiguration;
import org.springframework.boot.test.context.ConfigDataApplicationContextInitializer;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.ApplicationContext;
import org.springframework.mail.javamail.JavaMailSenderImpl;

/** The other tests replace the mail sender with a mock, so this one builds the real one from application.yml. */
class MailTimeoutsTest {

    private static final String FIVE_SECONDS_IN_MILLIS = "5000";
    private static final String STARTTLS_PROPERTY = "mail.smtp.starttls.enable";

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withInitializer(new ConfigDataApplicationContextInitializer())
            .withConfiguration(AutoConfigurations.of(MailSenderAutoConfiguration.class));

    @Test
    void mailSenderGivesUpOnAStalledSmtpServerAfterFiveSeconds() {
        contextRunner.run(context -> {
            assertThat(smtpProperties(context))
                    .containsEntry("mail.smtp.connectiontimeout", FIVE_SECONDS_IN_MILLIS)
                    .containsEntry("mail.smtp.timeout", FIVE_SECONDS_IN_MILLIS)
                    .containsEntry("mail.smtp.writetimeout", FIVE_SECONDS_IN_MILLIS);
        });
    }

    /** Mailpit does not offer STARTTLS, so it stays off unless MAIL_STARTTLS turns it on. */
    @Test
    void mailSenderUsesStartTlsOnlyWhenMailStartTlsIsTrue() {
        contextRunner.run(context -> assertThat(smtpProperties(context)).containsEntry(STARTTLS_PROPERTY, "false"));
        contextRunner.withPropertyValues("MAIL_STARTTLS=true")
                .run(context -> assertThat(smtpProperties(context)).containsEntry(STARTTLS_PROPERTY, "true"));
    }

    private static Properties smtpProperties(ApplicationContext context) {
        return context.getBean(JavaMailSenderImpl.class).getJavaMailProperties();
    }
}
