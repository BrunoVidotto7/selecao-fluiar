package br.com.fluiar.selecao.dto;
import br.com.fluiar.selecao.model.UserRole;
import java.util.UUID;
public record ListAccessResponse(UUID listId, UserRole role) { }
