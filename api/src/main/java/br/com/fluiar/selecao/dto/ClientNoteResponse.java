package br.com.fluiar.selecao.dto;

import br.com.fluiar.selecao.model.Product;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ClientNoteResponse(UUID clientId, String clientName, String text, Instant updatedAt) {

    public static List<ClientNoteResponse> of(Product product) {
        return product.getClientNotes().stream().filter(note -> note.getText() != null)
                .map(note -> new ClientNoteResponse(note.getClient().getId(), note.getClient().getName(), note.getText(),
                        note.getUpdatedAt()))
                .toList();
    }
}
