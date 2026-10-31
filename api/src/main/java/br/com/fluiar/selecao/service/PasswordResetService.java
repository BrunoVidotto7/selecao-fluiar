package br.com.fluiar.selecao.service;

import br.com.fluiar.selecao.config.AppProperties;
import br.com.fluiar.selecao.dto.PasswordResetConfirmRequest;
import br.com.fluiar.selecao.dto.PasswordResetInfoResponse;
import br.com.fluiar.selecao.dto.PasswordResetRequest;
import br.com.fluiar.selecao.exception.ApiException;
import br.com.fluiar.selecao.model.PasswordResetToken;
import br.com.fluiar.selecao.model.User;
import br.com.fluiar.selecao.repository.PasswordResetTokenRepository;
import br.com.fluiar.selecao.repository.UserRepository;
import br.com.fluiar.selecao.security.AttemptLimiter;
import br.com.fluiar.selecao.security.AttemptLimiter.Action;
import br.com.fluiar.selecao.security.SecureTokens;
import java.time.Clock;
import java.time.Duration;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class PasswordResetService {

    private static final Duration RESET_TOKEN_VALIDITY = Duration.ofHours(1);
    private static final String RESET_PATH = "/nova-senha?token=";

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository resetTokenRepository;
    private final EmailService emailService;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;
    private final AttemptLimiter attemptLimiter;
    private final String frontendUrl;

    public PasswordResetService(
            UserRepository userRepository,
            PasswordResetTokenRepository resetTokenRepository,
            EmailService emailService,
            PasswordEncoder passwordEncoder,
            Clock clock,
            AttemptLimiter attemptLimiter,
            AppProperties appProperties) {
        this.userRepository = userRepository;
        this.resetTokenRepository = resetTokenRepository;
        this.emailService = emailService;
        this.passwordEncoder = passwordEncoder;
        this.clock = clock;
        this.attemptLimiter = attemptLimiter;
        this.frontendUrl = appProperties.frontendUrl();
    }

    /**
     * Answers the same way whether or not the e-mail has an account, and the attempt limit counts every e-mail, so
     * the response does not reveal accounts either. The user stays locked until the link is saved, so a concurrent
     * e-mail change cannot leave a link sent to the old address.
     */
    @Transactional
    public void requestReset(PasswordResetRequest request) {
        if (!attemptLimiter.tryAcquire(Action.REQUEST_PASSWORD_RESET, request.email())) {
            throw ApiException.tooManyAttempts();
        }

        userRepository.findByEmailForUpdate(request.email()).ifPresent(this::sendResetLink);
    }

    public PasswordResetInfoResponse inspect(String token) {
        PasswordResetToken resetToken = findValidToken(token);
        User user = userRepository.findById(resetToken.getUserId()).orElseThrow();

        return PasswordResetInfoResponse.of(user);
    }

    /**
     * Changing the password revokes every login token of the user. Deleting all of the user's links makes this one
     * single-use.
     */
    @Transactional
    public void resetPassword(PasswordResetConfirmRequest request) {
        UUID userId = findValidToken(request.token()).getUserId();
        User user = userRepository.findByIdForUpdate(userId).orElseThrow();
        // Another reset or an e-mail change may have deleted the link while this one waited for the lock.
        findValidToken(request.token());

        user.changePassword(passwordEncoder.encode(request.newPassword()));
        resetTokenRepository.deleteByUserId(user.getId());
    }

    private void sendResetLink(User user) {
        String token = SecureTokens.generate();
        resetTokenRepository.save(new PasswordResetToken(
                user.getId(), SecureTokens.hash(token), clock.instant().plus(RESET_TOKEN_VALIDITY)));

        emailService.sendPasswordReset(user.getEmail(), user.getName(), frontendUrl + RESET_PATH + token);
    }

    private PasswordResetToken findValidToken(String token) {
        return resetTokenRepository.findByTokenHash(SecureTokens.hash(token))
                .filter(resetToken -> !resetToken.isExpired(clock.instant()))
                .orElseThrow(ApiException::invalidLink);
    }
}
