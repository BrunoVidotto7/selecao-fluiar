package br.com.fluiar.selecao.service;

import br.com.fluiar.selecao.dto.AuthResponse;
import br.com.fluiar.selecao.dto.MeResponse;
import br.com.fluiar.selecao.dto.PasswordChangeRequest;
import br.com.fluiar.selecao.dto.ProfileUpdateRequest;
import br.com.fluiar.selecao.exception.ApiException;
import br.com.fluiar.selecao.exception.ErrorMessages;
import br.com.fluiar.selecao.model.Office;
import br.com.fluiar.selecao.model.User;
import br.com.fluiar.selecao.repository.OfficeRepository;
import br.com.fluiar.selecao.repository.PasswordResetTokenRepository;
import br.com.fluiar.selecao.repository.UserRepository;
import br.com.fluiar.selecao.security.AttemptLimiter;
import br.com.fluiar.selecao.security.AttemptLimiter.Action;
import br.com.fluiar.selecao.security.TokenService;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class AccountService {

    private static final Logger log = LoggerFactory.getLogger(AccountService.class);
    private static final String CURRENT_PASSWORD_FIELD = "currentPassword";

    private final UserRepository userRepository;
    private final OfficeRepository officeRepository;
    private final PasswordResetTokenRepository resetTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final TokenService tokenService;
    private final AttemptLimiter attemptLimiter;

    public AccountService(
            UserRepository userRepository,
            OfficeRepository officeRepository,
            PasswordResetTokenRepository resetTokenRepository,
            PasswordEncoder passwordEncoder,
            TokenService tokenService,
            AttemptLimiter attemptLimiter) {
        this.userRepository = userRepository;
        this.officeRepository = officeRepository;
        this.resetTokenRepository = resetTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.tokenService = tokenService;
        this.attemptLimiter = attemptLimiter;
    }

    public MeResponse getMe(UUID userId) {
        User user = loadUser(userId);

        return MeResponse.of(user, officeOf(user));
    }

    @Transactional
    public MeResponse updateProfile(UUID userId, ProfileUpdateRequest request) {
        User user = lockUser(userId);
        boolean emailChanged = !request.email().equals(user.getEmail());
        if (emailChanged) {
            // A login token alone must not be enough to move the account, and its reset links, to another address.
            requirePasswordForEmailChange(user, request.currentPassword());
            if (userRepository.existsByEmail(request.email())) {
                throw ApiException.emailInUse();
            }
        }

        user.rename(request.name());
        user.changeEmail(request.email());
        if (emailChanged) {
            // Pending reset links went to the old address, so they must stop working.
            resetTokenRepository.deleteByUserId(userId);
            log.info("auth.email_changed userId={}", userId);
        }

        return MeResponse.of(user, officeOf(user));
    }

    /** The new token carries the incremented credentials version, so every token issued before stops working. */
    @Transactional
    public AuthResponse changePassword(UUID userId, PasswordChangeRequest request) {
        User user = lockUser(userId);
        verifyCurrentPassword(user, request.currentPassword());

        user.changePassword(passwordEncoder.encode(request.newPassword()));
        // A pending reset link would let its holder replace the password that was just chosen.
        resetTokenRepository.deleteByUserId(userId);
        log.info("auth.password_changed userId={}", userId);

        return AuthResponse.of(tokenService.issue(user, false), user, officeOf(user));
    }

    private void requirePasswordForEmailChange(User user, String currentPassword) {
        if (currentPassword == null || currentPassword.isBlank()) {
            throw ApiException.invalidField(
                    CURRENT_PASSWORD_FIELD, ErrorMessages.CURRENT_PASSWORD_REQUIRED_FOR_EMAIL);
        }
        verifyCurrentPassword(user, currentPassword);
    }

    /** Guesses are limited per account, so a stolen login token cannot be used to find out the password. */
    private void verifyCurrentPassword(User user, String currentPassword) {
        if (!attemptLimiter.tryAcquire(Action.CONFIRM_CURRENT_PASSWORD, user.getId().toString())) {
            throw ApiException.tooManyAttempts();
        }

        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw ApiException.invalidField(CURRENT_PASSWORD_FIELD, ErrorMessages.WRONG_CURRENT_PASSWORD);
        }

        attemptLimiter.reset(Action.CONFIRM_CURRENT_PASSWORD, user.getId().toString());
    }

    private User loadUser(UUID userId) {
        return userRepository.findById(userId).orElseThrow(ApiException::notFound);
    }

    /** Loads the user for a write; other account writes wait until this transaction ends. */
    private User lockUser(UUID userId) {
        return userRepository.findByIdForUpdate(userId).orElseThrow(ApiException::notFound);
    }

    private Office officeOf(User user) {
        return officeRepository.findById(user.getOfficeId()).orElseThrow();
    }
}
