package br.com.fluiar.selecao.config;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.fluiar.selecao.controller.AuthController;
import br.com.fluiar.selecao.service.AuthService;
import br.com.fluiar.selecao.service.InvitationService;
import br.com.fluiar.selecao.service.PasswordResetService;
import java.time.Duration;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.WebApplicationContextRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

class RoleSecurityTest {
    private final WebApplicationContextRunner runner = new WebApplicationContextRunner()
            .withUserConfiguration(WebConfig.class, SecurityConfig.class, ProbeController.class, AuthController.class)
            .withBean(AppProperties.class, () -> new AppProperties(
                    new AppProperties.Jwt("test-only-secret-at-least-32-bytes", Duration.ofHours(12), Duration.ofDays(30)),
                    "http://localhost:3000", List.of("http://localhost:3000"), ZoneOffset.UTC, "test@example.com"))
            .withBean(JwtDecoder.class, RoleSecurityTest::decoder)
            .withBean(tools.jackson.databind.json.JsonMapper.class, () -> tools.jackson.databind.json.JsonMapper.builder().build())
            .withBean(AuthService.class, () -> mock(AuthService.class))
            .withBean(PasswordResetService.class, () -> mock(PasswordResetService.class))
            .withBean(InvitationService.class, () -> mock(InvitationService.class));

    @Test
    void clientCannotUseAdministrationAndReceivesProblemDetail() {
        runner.run(context -> {
            MockMvc mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
            mvc.perform(get("/api/clients").header("Authorization", "Bearer client"))
                    .andExpect(status().isForbidden()).andExpect(content().contentTypeCompatibleWith("application/problem+json"));
            mvc.perform(get("/api/clients").header("Authorization", "Bearer admin")).andExpect(status().isOk());
        });
    }

    @Test
    void onlyClientsUseClientEndpointsAndBothRolesUseOwnAccount() {
        runner.run(context -> {
            MockMvc mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
            mvc.perform(get("/api/client/lists").header("Authorization", "Bearer admin")).andExpect(status().isForbidden());
            mvc.perform(get("/api/client/lists").header("Authorization", "Bearer client")).andExpect(status().isOk());
            for (String role : List.of("admin", "client")) {
                mvc.perform(get("/api/me").header("Authorization", "Bearer " + role)).andExpect(status().isOk());
            }
        });
    }

    @Test
    void sharedListsAndImagesAreNotPublic() {
        runner.run(context -> {
            MockMvc mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
            mvc.perform(get("/api/public/lists/token")).andExpect(status().isUnauthorized());
            mvc.perform(get("/api/images/image")).andExpect(status().isUnauthorized());
        });
    }

    @Test
    void publicSignupIsRemoved() {
        runner.run(context -> {
            MockMvc mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
            mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                    .content("{\"name\":\"Client\",\"email\":\"client@example.com\",\"password\":\"clientPassword1\"}"))
                    .andExpect(status().isNotFound());
        });
    }

    private static JwtDecoder decoder() {
        var decoder = mock(JwtDecoder.class);
        for (String role : List.of("admin", "client")) {
            when(decoder.decode(role)).thenReturn(Jwt.withTokenValue(role).header("alg", "HS256")
                    .subject("88888888-8888-4888-8888-888888888888").claim("role", role.toUpperCase()).build());
        }
        return decoder;
    }

    @Configuration
    @EnableWebSecurity
    @EnableWebMvc
    static class WebConfig {
    }

    @RestController
    static class ProbeController {
        @RequestMapping({"/api/clients", "/api/client/lists", "/api/me", "/api/images/image", "/api/public/lists/token"})
        Map<String, String> probe() {
            return Map.of("status", "ok");
        }
    }
}
