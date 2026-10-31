package br.com.fluiar.selecao.controller;

import br.com.fluiar.selecao.dto.ClientDetailResponse;
import br.com.fluiar.selecao.dto.ClientRequest;
import br.com.fluiar.selecao.dto.ClientResponse;
import br.com.fluiar.selecao.dto.ClientSummaryResponse;
import br.com.fluiar.selecao.security.CurrentOfficeId;
import br.com.fluiar.selecao.service.ClientService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/clients")
public class ClientController {

    private final ClientService clientService;

    public ClientController(ClientService clientService) {
        this.clientService = clientService;
    }

    @GetMapping
    public List<ClientSummaryResponse> listClients(@CurrentOfficeId UUID officeId) {
        return clientService.list(officeId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ClientResponse createClient(@CurrentOfficeId UUID officeId, @Valid @RequestBody ClientRequest request) {
        return clientService.create(officeId, request);
    }

    @GetMapping("/{id}")
    public ClientDetailResponse getClient(@CurrentOfficeId UUID officeId, @PathVariable UUID id) {
        return clientService.get(officeId, id);
    }

    @PutMapping("/{id}")
    public ClientResponse updateClient(
            @CurrentOfficeId UUID officeId, @PathVariable UUID id, @Valid @RequestBody ClientRequest request) {
        return clientService.update(officeId, id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteClient(@CurrentOfficeId UUID officeId, @PathVariable UUID id) {
        clientService.delete(officeId, id);
    }
}
