package br.com.fluiar.selecao.dto;

import java.time.Instant;
import java.util.UUID;

public record ClientChangeSummaryResponse(UUID listId, String listName, UUID clientId, String clientName,
        long changedProductCount, long purchaseMarkedCount, long purchaseUnmarkedCount,
        long notesChangedCount, long notesRemovedCount, Instant lastChangedAt) {}
