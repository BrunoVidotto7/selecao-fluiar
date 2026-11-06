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
import br.com.fluiar.selecao.security.ClientAddress;
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
    private static final String NO_USER = "none";

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

    /**
     * Only failed logins count. The address limit counts every e-mail from one address, which stops guessing across
     * accounts. The e-mail limit counts every address, which stops guessing from many addresses. The address and
     * e-mail limit counts both together, so a stranger cannot lock the owner out from another address. A private
     * client address is our own Next server, so the address limit is skipped and the last limit counts by e-mail.
     */
    public AuthResponse logIn(LoginRequest request, String clientIp) {
        boolean publicAddress = ClientAddress.isPublic(clientIp);
        String ipAndEmailKey = publicAddress ? clientIp + "|" + request.email() : request.email();
        if ((publicAddress && !attemptLimiter.tryAcquire(Action.LOG_IN_FROM_IP, clientIp))
                || !attemptLimiter.tryAcquire(Action.LOG_IN_FOR_EMAIL, request.email())
                || !attemptLimiter.tryAcquire(Action.LOG_IN_FROM_IP_FOR_EMAIL, ipAndEmailKey)) {
            log.info("auth.login result=blocked userId={}", NO_USER);
            throw ApiException.tooManyAttempts();
        }

        User user = authenticate(request.email(), request.password());
        attemptLimiter.reset(Action.LOG_IN_FROM_IP_FOR_EMAIL, ipAndEmailKey);
        if (publicAddress) {
            attemptLimiter.refund(Action.LOG_IN_FROM_IP, clientIp);
        }
        attemptLimiter.refund(Action.LOG_IN_FOR_EMAIL, request.email());
        log.info("auth.login result=ok userId={}", user.getId());

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
            log.info("auth.login result=rejected userId={}",
                    user.map(found -> found.getId().toString()).orElse(NO_USER));
            throw ApiException.invalidCredentials();
        }
        return user.get();
    }
}
