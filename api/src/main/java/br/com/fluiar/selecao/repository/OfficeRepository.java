package br.com.fluiar.selecao.repository;

import br.com.fluiar.selecao.model.Office;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OfficeRepository extends JpaRepository<Office, UUID> {
}
