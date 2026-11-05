package br.com.fluiar.selecao.dto;

import java.util.List;

public record ClientChangePageResponse(long pendingListCount, int page, int pageSize,
        List<ClientChangeSummaryResponse> items) {}
