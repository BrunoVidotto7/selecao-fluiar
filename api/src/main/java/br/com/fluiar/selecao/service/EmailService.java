package br.com.fluiar.selecao.service;

import br.com.fluiar.selecao.config.AppProperties;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    private static final String PASSWORD_RESET_SUBJECT = "Redefinição de senha — Seleção Fluiar";
    private static final String PASSWORD_RESET_TEXT = """
            Olá, %s.

            Recebemos um pedido para redefinir a senha da sua conta na Seleção Fluiar.
            Crie uma senha nova neste link (vale por 1 hora):
            %s

            Se não foi você, ignore este e-mail.""";
    private static final String INVITATION_SUBJECT = "Convite para suas listas — %s";
    private static final String INVITATION_TEXT = """
            %s convidou você para acessar suas listas de compras do escritório %s na Seleção Fluiar.

            Crie sua conta neste link (vale por 7 dias):
            %s""";

    private final JavaMailSender mailSender;
    private final String mailFrom;

    public EmailService(JavaMailSender mailSender, AppProperties appProperties) {
        this.mailSender = mailSender;
        this.mailFrom = appProperties.mailFrom();
    }

    public void sendPasswordReset(String to, String name, String resetLink) {
        send(to, PASSWORD_RESET_SUBJECT, PASSWORD_RESET_TEXT.formatted(name, resetLink));
    }

    public void sendInvitation(String to, String officeName, String inviterName, String invitationLink) {
        send(to,
                INVITATION_SUBJECT.formatted(officeName),
                INVITATION_TEXT.formatted(inviterName, officeName, invitationLink));
    }

    private void send(String to, String subject, String text) {
        SimpleMailMessage email = new SimpleMailMessage();
        email.setFrom(mailFrom);
        email.setTo(to);
        email.setSubject(subject);
        email.setText(text);

        mailSender.send(email);
    }
}
