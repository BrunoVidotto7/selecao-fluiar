package br.com.fluiar.selecao.service;

import br.com.fluiar.selecao.dto.OfficeResponse;
import br.com.fluiar.selecao.dto.OfficeUpdateRequest;
import br.com.fluiar.selecao.exception.ApiException;
import br.com.fluiar.selecao.model.Office;
import br.com.fluiar.selecao.repository.OfficeRepository;
import br.com.fluiar.selecao.repository.UserRepository;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class OfficeService {

    private final OfficeRepository officeRepository;
    private final UserRepository userRepository;

    public OfficeService(OfficeRepository officeRepository, UserRepository userRepository) {
        this.officeRepository = officeRepository;
        this.userRepository = userRepository;
    }

    public OfficeResponse getOffice(UUID officeId) {
        return responseFor(loadOffice(officeId));
    }

    @Transactional
    public OfficeResponse rename(UUID officeId, OfficeUpdateRequest request) {
        Office office = loadOffice(officeId);
        office.rename(request.name());

        return responseFor(office);
    }

    private Office loadOffice(UUID officeId) {
        return officeRepository.findById(officeId).orElseThrow(ApiException::notFound);
    }

    private OfficeResponse responseFor(Office office) {
        return OfficeResponse.of(office, userRepository.findByOfficeIdOrderByNameAsc(office.getId()));
    }
}
