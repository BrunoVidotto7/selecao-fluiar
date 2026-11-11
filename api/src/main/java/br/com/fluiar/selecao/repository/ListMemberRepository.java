package br.com.fluiar.selecao.repository;

import br.com.fluiar.selecao.dto.ClientMemberListResponse;
import br.com.fluiar.selecao.model.ListMember;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ListMemberRepository extends JpaRepository<ListMember, UUID> {

    @Query("""
            select new br.com.fluiar.selecao.dto.ClientMemberListResponse(l.id, l.name, m.role)
            from ListMember m join m.list l
            where m.client.id = :clientId and l.client.officeId = :officeId
            order by l.name, l.id
            """)
    List<ClientMemberListResponse> findMemberLists(@Param("clientId") UUID clientId, @Param("officeId") UUID officeId);
}
