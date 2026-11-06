package br.com.fluiar.selecao.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.mail.MailException;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Sends the reset link after the link is committed and outside the request, so the SMTP server never holds the
 * user's row lock or a database connection, and the answer is the same whether or not the e-mail has an account.
 */
@Component
class PasswordResetMailSender {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetMailSender.class);

    private final EmailService emailService;

    PasswordResetMailSender(EmailService emailService) {
        this.emailService = emailService;
    }

    @Async
    @TransactionalEventListener
    void send(PasswordResetLinkCreated event) {
        try {
            emailService.sendPasswordReset(event.email(), event.name(), event.link());
        } catch (MailException exception) {
            // The SMTP server's message can repeat the recipient's address, so only the class names are logged.
            log.error("Password reset e-mail not sent: {} caused by {}", exception.getClass().getSimpleName(),
                    NestedExceptionUtils.getMostSpecificCause(exception).getClass().getSimpleName());
        }
    }
}
