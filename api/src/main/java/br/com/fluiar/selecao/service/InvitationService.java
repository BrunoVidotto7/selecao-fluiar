package br.com.fluiar.selecao.service;

import br.com.fluiar.selecao.config.AppProperties;
import br.com.fluiar.selecao.dto.AuthResponse;
import br.com.fluiar.selecao.dto.InvitationAcceptRequest;
import br.com.fluiar.selecao.dto.InvitationInfoResponse;
import br.com.fluiar.selecao.dto.InvitationRequest;
import br.com.fluiar.selecao.dto.InvitationResponse;
import br.com.fluiar.selecao.exception.ApiException;
import br.com.fluiar.selecao.model.Office;
import br.com.fluiar.selecao.model.OfficeInvitation;
import br.com.fluiar.selecao.model.User;
import br.com.fluiar.selecao.repository.OfficeInvitationRepository;
import br.com.fluiar.selecao.repository.OfficeRepository;
import br.com.fluiar.selecao.repository.UserRepository;
import br.com.fluiar.selecao.security.SecureTokens;
import br.com.fluiar.selecao.security.TokenService;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class InvitationService {

    private static final Duration INVITATION_VALIDITY = Duration.ofDays(7);
    private static final String INVITATION_PATH = "/convite?token=";

    private final OfficeInvitationRepository invitationRepository;
    private final UserRepository userRepository;
    private final OfficeRepository officeRepository;
    private final EmailService emailService;
    private final PasswordEncoder passwordEncoder;
    private final TokenService tokenService;
    private final Clock clock;
    private final String frontendUrl;

    public InvitationService(
            OfficeInvitationRepository invitationRepository,
            UserRepository userRepository,
            OfficeRepository officeRepository,
            EmailService emailService,
            PasswordEncoder passwordEncoder,
            TokenService tokenService,
            Clock clock,
            AppProperties appProperties) {
        this.invitationRepository = invitationRepository;
        this.userRepository = userRepository;
        this.officeRepository = officeRepository;
        this.emailService = emailService;
        this.passwordEncoder = passwordEncoder;
        this.tokenService = tokenService;
        this.clock = clock;
        this.frontendUrl = appProperties.frontendUrl();
    }

    /** A new invitation replaces the office's pending invitation for the same e-mail, so only the newest link works. */
    @Transactional
    public InvitationResponse invite(UUID userId, UUID officeId, InvitationRequest request) {
        invitationRepository.deleteByOfficeIdAndEmail(officeId, request.email());
        // Checked after the delete: it waits for an acceptance of the old invitation, which creates the account.
        rejectEmailWithAccount(request.email());

        String token = SecureTokens.generate();
        Instant expiresAt = clock.instant().plus(INVITATION_VALIDITY);
        // Hibernate fills createdAt only when the insert runs; the response needs it now.
        OfficeInvitation invitation = invitationRepository.saveAndFlush(
                new OfficeInvitation(officeId, request.email(), userId, SecureTokens.hash(token), expiresAt));
        sendInvitationEmail(invitation, token);

        return InvitationResponse.of(invitation);
    }

    /** Expired invitations are listed too; the frontend shows their expiry date. */
    public List<InvitationResponse> listPending(UUID officeId) {
        return invitationRepository.findByOfficeIdOrderByCreatedAtDesc(officeId).stream()
                .map(InvitationResponse::of)
                .toList();
    }

    /** Answers 404 for an invitation of another office, and for one already accepted or revoked. */
    @Transactional
    public void revoke(UUID officeId, UUID invitationId) {
        int revoked = invitationRepository.deleteByIdAndOfficeId(invitationId, officeId);
        if (revoked == 0) {
            throw ApiException.notFound();
        }
    }

    public InvitationInfoResponse inspect(String token) {
        OfficeInvitation invitation = findValidInvitation(token);

        return InvitationInfoResponse.of(invitation, officeOf(invitation), inviterOf(invitation));
    }

    @Transactional
    public AuthResponse accept(String token, InvitationAcceptRequest request) {
        OfficeInvitation invitation = lockValidInvitation(token);
        rejectEmailWithAccount(invitation.getEmail());

        String passwordHash = passwordEncoder.encode(request.password());
        User user = userRepository.save(
                new User(invitation.getOfficeId(), request.name(), invitation.getEmail(), passwordHash));
        invitationRepository.delete(invitation);

        return AuthResponse.of(tokenService.issue(user, false), user, officeOf(invitation));
    }

    private void rejectEmailWithAccount(String email) {
        if (userRepository.existsByEmail(email)) {
            throw ApiException.emailInUse();
        }
    }

    private void sendInvitationEmail(OfficeInvitation invitation, String token) {
        emailService.sendInvitation(invitation.getEmail(), officeOf(invitation).getName(),
                inviterOf(invitation).getName(), frontendUrl + INVITATION_PATH + token);
    }

    private OfficeInvitation findValidInvitation(String token) {
        return requireValid(invitationRepository.findByTokenHash(SecureTokens.hash(token)));
    }

    /**
     * Checks the invitation only after its lock is granted. An acceptance may wait behind another acceptance, a
     * revoke or a new invitation, which can delete the invitation, and the invitation can expire during the wait.
     */
    private OfficeInvitation lockValidInvitation(String token) {
        return requireValid(invitationRepository.findByTokenHashForUpdate(SecureTokens.hash(token)));
    }

    private OfficeInvitation requireValid(Optional<OfficeInvitation> invitation) {
        return invitation
                .filter(found -> !found.isExpired(clock.instant()))
                .orElseThrow(ApiException::invalidLink);
    }

    private Office officeOf(OfficeInvitation invitation) {
        return officeRepository.findById(invitation.getOfficeId()).orElseThrow();
    }

    private User inviterOf(OfficeInvitation invitation) {
        return userRepository.findById(invitation.getInvitedByUserId()).orElseThrow();
    }
}
