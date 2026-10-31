package br.com.fluiar.selecao.service;

import br.com.fluiar.selecao.dto.ClientSummaryResponse;
import br.com.fluiar.selecao.dto.DashboardResponse;
import br.com.fluiar.selecao.dto.ListSummaryResponse;
import br.com.fluiar.selecao.repository.ClientRepository;
import br.com.fluiar.selecao.repository.ShoppingListRepository;
import java.time.Clock;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class DashboardService {

    private static final int RECENT_LIMIT = 5;

    private final ClientRepository clientRepository;
    private final ShoppingListRepository listRepository;
    private final Clock clock;

    public DashboardService(ClientRepository clientRepository, ShoppingListRepository listRepository, Clock clock) {
        this.clientRepository = clientRepository;
        this.listRepository = listRepository;
        this.clock = clock;
    }

    /** Both summaries come ordered by last update, newest first, so their first items are the recent ones. */
    public DashboardResponse get(UUID officeId) {
        List<ClientSummaryResponse> clients = clientRepository.findSummaries(officeId);
        List<ListSummaryResponse> lists = listRepository.findSummaries(officeId);

        return new DashboardResponse(
                clients.size(),
                countCreatedThisMonth(clients),
                lists.size(),
                lists.stream().filter(ListSummaryResponse::isCompleted).count(),
                lists.stream().filter(list -> pendingProducts(list) > 0).count(),
                lists.stream().mapToLong(ListSummaryResponse::totalProducts).sum(),
                lists.stream().mapToLong(DashboardService::pendingProducts).sum(),
                mostRecent(clients),
                mostRecent(lists));
    }

    /** The month is the one of the app's time zone, not UTC. */
    private long countCreatedThisMonth(List<ClientSummaryResponse> clients) {
        YearMonth thisMonth = YearMonth.now(clock);

        return clients.stream()
                .filter(client -> YearMonth.from(client.createdAt().atZone(clock.getZone())).equals(thisMonth))
                .count();
    }

    private static long pendingProducts(ListSummaryResponse list) {
        return list.totalProducts() - list.boughtProducts();
    }

    private static <T> List<T> mostRecent(List<T> summaries) {
        return summaries.stream().limit(RECENT_LIMIT).toList();
    }
}
