package br.com.fluiar.selecao.repository;

import br.com.fluiar.selecao.model.Office;
import jakarta.persistence.LockModeType;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface OfficeRepository extends JpaRepository<Office, UUID> {

    /** Serializes writes that must keep something unique inside the office, such as category names. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o.id from Office o where o.id = :id")
    UUID lockById(UUID id);
}
