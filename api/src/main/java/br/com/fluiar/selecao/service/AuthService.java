package br.com.fluiar.selecao.service;

import br.com.fluiar.selecao.dto.AuthResponse;
import br.com.fluiar.selecao.dto.LoginRequest;
import br.com.fluiar.selecao.exception.ApiException;
import br.com.fluiar.selecao.model.Office;
import br.com.fluiar.selecao.model.User;
import br.com.fluiar.selecao.repository.OfficeRepository;
import br.com.fluiar.selecao.repository.UserRepository;
import br.com.fluiar.selecao.security.AttemptLimiter;
import br.com.fluiar.selecao.security.AttemptLimiter.Action;
import br.com.fluiar.selecao.security.TokenService;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    private static final String DUMMY_PASSWORD = "dummy-password";

    private final OfficeRepository officeRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final TokenService tokenService;
    private final AttemptLimiter attemptLimiter;
    private final String dummyPasswordHash;

    public AuthService(
            OfficeRepository officeRepository,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            TokenService tokenService,
            AttemptLimiter attemptLimiter) {
        this.officeRepository = officeRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.tokenService = tokenService;
        this.attemptLimiter = attemptLimiter;
        this.dummyPasswordHash = passwordEncoder.encode(DUMMY_PASSWORD);
    }

    public AuthResponse logIn(LoginRequest request) {
        if (!attemptLimiter.tryAcquire(Action.LOG_IN, request.email())) {
            log.info("Login blocked after too many attempts");
            throw ApiException.tooManyAttempts();
        }

        User user = authenticate(request.email(), request.password());
        attemptLimiter.reset(Action.LOG_IN, request.email());

        Office office = officeRepository.findById(user.getOfficeId()).orElseThrow();

        return AuthResponse.of(tokenService.issue(user, request.rememberMe()), user, office);
    }

    private User authenticate(String email, String password) {
        Optional<User> user = userRepository.findByEmail(email);
        // An unknown e-mail is checked against a dummy hash so it takes as long as a known one,
        // and response times do not reveal which e-mails have an account.
        String passwordHash = user.map(User::getPasswordHash).orElse(dummyPasswordHash);
        boolean passwordMatches = passwordEncoder.matches(password, passwordHash);

        if (user.isEmpty() || !passwordMatches) {
            log.info("Login rejected");
            throw ApiException.invalidCredentials();
        }
        return user.get();
    }
}
