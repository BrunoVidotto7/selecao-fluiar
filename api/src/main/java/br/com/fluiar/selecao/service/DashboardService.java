package br.com.fluiar.selecao.service;

import br.com.fluiar.selecao.dto.DashboardResponse;
import br.com.fluiar.selecao.dto.DashboardTotals;
import br.com.fluiar.selecao.repository.ClientRepository;
import br.com.fluiar.selecao.repository.ShoppingListRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.YearMonth;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class DashboardService {

    private static final Pageable RECENT = PageRequest.ofSize(5);

    private final ClientRepository clientRepository;
    private final ShoppingListRepository listRepository;
    private final Clock clock;

    public DashboardService(ClientRepository clientRepository, ShoppingListRepository listRepository, Clock clock) {
        this.clientRepository = clientRepository;
        this.listRepository = listRepository;
        this.clock = clock;
    }

    /** Both summaries come ordered by last update, newest first, so their first page is the recent items. */
    public DashboardResponse get(UUID officeId) {
        DashboardTotals totals = listRepository.findDashboardTotals(officeId);

        return new DashboardResponse(
                clientRepository.countByOfficeId(officeId),
                clientRepository.countByOfficeIdAndCreatedAtGreaterThanEqual(officeId, startOfThisMonth()),
                totals.listCount(),
                totals.completedListCount(),
                totals.listsWithPendingProductsCount(),
                totals.totalProductCount(),
                totals.pendingProductCount(),
                clientRepository.findSummaries(officeId, RECENT),
                listRepository.findSummaries(officeId, RECENT));
    }

    /** The month is the one of the app's time zone, not UTC. */
    private Instant startOfThisMonth() {
        return YearMonth.now(clock).atDay(1).atStartOfDay(clock.getZone()).toInstant();
    }
}
