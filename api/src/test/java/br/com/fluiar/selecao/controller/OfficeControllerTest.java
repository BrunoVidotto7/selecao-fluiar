package br.com.fluiar.selecao.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import br.com.fluiar.selecao.support.ApiIntegrationTest;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.test.web.servlet.assertj.MvcTestResult;

class OfficeControllerTest extends ApiIntegrationTest {

    private static final String PAULA_NAME = "Paula Hooper";
    private static final String PAULA_EMAIL = "paula@fluiar.com.br";
    private static final String PAULA_OFFICE_NAME = "Escritório de Paula Hooper";
    private static final String NEW_OFFICE_NAME = "Fluiar";
    private static final String MARINA_NAME = "Marina Costa";
    private static final String MARINA_EMAIL = "marina@fluiar.com.br";
    private static final String ANA_NAME = "Ana Souza";
    private static final String ANA_EMAIL = "ana@fluiar.com.br";
    private static final String ISABELA_NAME = "Isabela Machado";
    private static final String ISABELA_EMAIL = "isabela@fluiar.com.br";
    private static final String ISABELA_EMAIL_AS_TYPED = " Isabela@Fluiar.com.br ";
    private static final String INVITATION_LINK_PREFIX = "http://localhost:3000/convite?token=";
    private static final Duration INVITATION_VALIDITY = Duration.ofDays(7);
    private static final String LOCK_INVITATIONS = "select id from office_invitations for update";

    private record SentInvitation(String id, String token) {
    }

    @Test
    void getOfficeListsMembers() {
        createAdmin(MARINA_NAME, MARINA_EMAIL);
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);

        var result = requestOffice(paula);

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(result).bodyJson().extractingPath("$.id").isEqualTo(paula.officeId().toString());
        assertThat(result).bodyJson().extractingPath("$.name").isEqualTo(PAULA_OFFICE_NAME);
        assertThat(result).bodyJson().extractingPath("$.members[*].name").asArray().containsExactly(PAULA_NAME);
        assertThat(result).bodyJson().extractingPath("$.members[0].email").isEqualTo(PAULA_EMAIL);
    }

    @Test
    void getOfficeListsMembersByName() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        createAdminInOffice(paula, ANA_NAME, ANA_EMAIL);

        var result = requestOffice(paula);

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(result).bodyJson().extractingPath("$.members[*].name").asArray()
                .containsExactly(ANA_NAME, PAULA_NAME);
    }

    @Test
    void renameOffice() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);

        var result = requestRename(paula, NEW_OFFICE_NAME);

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(result).bodyJson().extractingPath("$.name").isEqualTo(NEW_OFFICE_NAME);
        assertThat(requestOffice(paula)).bodyJson().extractingPath("$.name").isEqualTo(NEW_OFFICE_NAME);
    }

    static Stream<Arguments> invalidOfficeNames() {
        return Stream.of(
                Arguments.of("  ", "Preencha este campo."),
                Arguments.of("F".repeat(121), "Use no máximo 120 caracteres."));
    }

    @ParameterizedTest
    @MethodSource("invalidOfficeNames")
    void renameReportsInvalidName(String name, String expectedMessage) {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);

        var result = requestRename(paula, name);

        assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(result).bodyJson().extractingPath("$.errors.name").isEqualTo(expectedMessage);
    }

    @Test
    void officeMemberInvitationsAreRetired() {
        var admin = createAdmin(PAULA_NAME, PAULA_EMAIL);
        assertThat(mvc.post().uri("/api/office/invitations").header(HttpHeaders.AUTHORIZATION, bearer(admin))
                .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("email", ISABELA_EMAIL))).exchange())
                .hasStatus(HttpStatus.NOT_FOUND);
    }

    private MvcTestResult requestOffice(TestSession session) {
        return mvc.get().uri("/api/office").header(HttpHeaders.AUTHORIZATION, bearer(session)).exchange();
    }

    private MvcTestResult requestRename(TestSession session, String name) {
        return mvc.put().uri("/api/office")
                .header(HttpHeaders.AUTHORIZATION, bearer(session))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("name", name)))
                .exchange();
    }

    private MvcTestResult requestInvitations(TestSession session) {
        return mvc.get().uri("/api/office/invitations").header(HttpHeaders.AUTHORIZATION, bearer(session)).exchange();
    }

    private MvcTestResult requestRevoke(TestSession session, String invitationId) {
        return mvc.delete().uri("/api/office/invitations/{id}", invitationId)
                .header(HttpHeaders.AUTHORIZATION, bearer(session))
                .exchange();
    }

    private MvcTestResult requestInspection(String token) {
        return mvc.get().uri("/api/auth/invitations/{token}", token).exchange();
    }
}
