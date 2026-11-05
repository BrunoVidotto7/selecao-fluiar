package br.com.fluiar.selecao.controller;

import br.com.fluiar.selecao.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import static org.assertj.core.api.Assertions.assertThat;

class ListActivityControllerTest extends ApiIntegrationTest {
    @Test
    void openingRequiresExplicitAuthorizedAction() {
        var admin = createAdmin("Ana", "ana@test.com");
        var list = createList(admin, createClient(admin, "Cliente"), "Lista");
        var other = createAdmin("Outra", "outra@test.com");
        assertThat(mvc.post().uri("/api/lists/{id}/activity", list)
                .header(HttpHeaders.AUTHORIZATION, bearer(other)).exchange()).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(mvc.post().uri("/api/lists/{id}/activity", list)
                .header(HttpHeaders.AUTHORIZATION, bearer(admin)).exchange()).hasStatus(HttpStatus.NO_CONTENT);
    }
    @Test
    void readsDoNotCountAndClientMustOwnTheList() {
        var admin=createAdmin("Ana","ana@test.com");
        var client=createClient(admin,"Cliente");
        var list=createList(admin,client,"Lista");
        var owner=createClientAccount(admin,client,"client@test.com");
        var otherClient=createClient(admin,"Outro","other@test.com");
        var other=createClientAccount(admin,otherClient,"other@test.com");
        jdbc.update("delete from list_human_activity where list_id=?",list);
        var updated=jdbc.queryForObject("select updated_at from shopping_lists where id=?",java.sql.Timestamp.class,list);
        assertThat(mvc.get().uri("/api/lists/{id}",list).header(HttpHeaders.AUTHORIZATION,bearer(admin)).exchange()).hasStatus(HttpStatus.OK);
        assertThat(mvc.get().uri("/api/client/lists/{id}",list).header(HttpHeaders.AUTHORIZATION,bearer(owner)).exchange()).hasStatus(HttpStatus.OK);
        assertThat(jdbc.queryForObject("select count(*) from list_human_activity where list_id=?",Integer.class,list)).isZero();
        assertThat(mvc.post().uri("/api/client/lists/{id}/activity",list).header(HttpHeaders.AUTHORIZATION,bearer(other)).exchange()).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(jdbc.queryForObject("select count(*) from list_human_activity where list_id=?",Integer.class,list)).isZero();
        assertThat(mvc.post().uri("/api/client/lists/{id}/activity",list).header(HttpHeaders.AUTHORIZATION,bearer(owner)).exchange()).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(jdbc.queryForObject("select updated_at from shopping_lists where id=?",java.sql.Timestamp.class,list)).isEqualTo(updated);
        var future=java.time.Instant.now().plusSeconds(60);
        jdbc.update("update list_human_activity set last_human_activity_at=? where list_id=?",java.sql.Timestamp.from(future),list);
        assertThat(mvc.post().uri("/api/lists/{id}/activity",list).header(HttpHeaders.AUTHORIZATION,bearer(admin)).exchange()).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(jdbc.queryForObject("select last_human_activity_at from list_human_activity where list_id=?",java.sql.Timestamp.class,list).toInstant())
                .isCloseTo(future,org.assertj.core.api.Assertions.within(1,java.time.temporal.ChronoUnit.MILLIS));
    }
}

