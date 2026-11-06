package br.com.fluiar.selecao.controller;

import br.com.fluiar.selecao.dto.AuthResponse;
import br.com.fluiar.selecao.dto.InvitationAcceptRequest;
import br.com.fluiar.selecao.dto.InvitationInfoResponse;
import br.com.fluiar.selecao.dto.LoginRequest;
import br.com.fluiar.selecao.dto.PasswordResetConfirmRequest;
import br.com.fluiar.selecao.dto.PasswordResetInfoResponse;
import br.com.fluiar.selecao.dto.PasswordResetRequest;
import br.com.fluiar.selecao.service.AuthService;
import br.com.fluiar.selecao.service.InvitationService;
import br.com.fluiar.selecao.service.PasswordResetService;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@SecurityRequirements
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final PasswordResetService passwordResetService;
    private final InvitationService invitationService;

    public AuthController(
            AuthService authService, PasswordResetService passwordResetService, InvitationService invitationService) {
        this.authService = authService;
        this.passwordResetService = passwordResetService;
        this.invitationService = invitationService;
    }

    @PostMapping("/login")
    public AuthResponse logIn(@Valid @RequestBody LoginRequest request, HttpServletRequest http) {
        return authService.logIn(request, http.getRemoteAddr());
    }

    @PostMapping("/password-reset-requests")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void requestPasswordReset(@Valid @RequestBody PasswordResetRequest request, HttpServletRequest http) {
        passwordResetService.requestReset(request, http.getRemoteAddr());
    }

    @GetMapping("/password-resets/{token}")
    public PasswordResetInfoResponse inspectPasswordReset(@PathVariable String token) {
        return passwordResetService.inspect(token);
    }

    @PostMapping("/password-resets")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resetPassword(@Valid @RequestBody PasswordResetConfirmRequest request) {
        passwordResetService.resetPassword(request);
    }

    @GetMapping("/invitations/{token}")
    public InvitationInfoResponse inspectInvitation(@PathVariable String token) {
        return invitationService.inspect(token);
    }

    @PostMapping("/invitations/{token}/acceptance")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse acceptInvitation(
            @PathVariable String token, @Valid @RequestBody InvitationAcceptRequest request) {
        return invitationService.accept(token, request);
    }
}
