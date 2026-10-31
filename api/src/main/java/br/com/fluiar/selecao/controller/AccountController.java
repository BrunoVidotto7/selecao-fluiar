package br.com.fluiar.selecao.controller;

import br.com.fluiar.selecao.dto.AuthResponse;
import br.com.fluiar.selecao.dto.MeResponse;
import br.com.fluiar.selecao.dto.PasswordChangeRequest;
import br.com.fluiar.selecao.dto.ProfileUpdateRequest;
import br.com.fluiar.selecao.security.CurrentUserId;
import br.com.fluiar.selecao.service.AccountService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/me")
public class AccountController {

    private final AccountService accountService;

    public AccountController(AccountService accountService) {
        this.accountService = accountService;
    }

    @GetMapping
    public MeResponse getMe(@CurrentUserId UUID userId) {
        return accountService.getMe(userId);
    }

    @PutMapping
    public MeResponse updateProfile(@CurrentUserId UUID userId, @Valid @RequestBody ProfileUpdateRequest request) {
        return accountService.updateProfile(userId, request);
    }

    @PutMapping("/password")
    public AuthResponse changePassword(@CurrentUserId UUID userId, @Valid @RequestBody PasswordChangeRequest request) {
        return accountService.changePassword(userId, request);
    }
}
