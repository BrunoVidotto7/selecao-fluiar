package br.com.fluiar.selecao.config;

import io.swagger.v3.core.converter.ModelConverters;
import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.responses.ApiResponse;
import io.swagger.v3.oas.models.responses.ApiResponses;
import java.util.Set;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.ProblemDetail;
import org.springdoc.core.customizers.OpenApiCustomizer;

/** Lets Swagger UI send the JWT in the Authorization header and documents the error body of every operation (only the errors that operation can return). */
@Configuration(proxyBeanMethods = false)
@SecurityScheme(name = OpenApiConfig.SECURITY_SCHEME, type = SecuritySchemeType.HTTP, scheme = "bearer",
        bearerFormat = "JWT")
@OpenAPIDefinition(info = @Info(title = "Seleção Fluiar API", version = "v1"),
        security = @SecurityRequirement(name = OpenApiConfig.SECURITY_SCHEME))
public class OpenApiConfig {

    static final String SECURITY_SCHEME = "bearer";
    private static final String PROBLEM_JSON = "application/problem+json";
    private static final String LOGIN_PATH = "/api/auth/login";
    /** Paths that count attempts in AttemptLimiter. */
    private static final Set<String> LIMITED_PATHS =
            Set.of(LOGIN_PATH, "/api/auth/password-reset-requests", "/api/me", "/api/me/password");

    @Bean
    OpenApiCustomizer problemDetailResponses() {
        return openApi -> {
            var problemSchemas = ModelConverters.getInstance().readAll(ProblemDetail.class);
            problemSchemas.forEach((name, schema) -> openApi.getComponents().addSchemas(name, schema));
            Schema<?> reference = new Schema<>().$ref("#/components/schemas/ProblemDetail");
            var content = new Content().addMediaType(PROBLEM_JSON, new MediaType().schema(reference));
            openApi.getPaths().forEach((pathName, path) -> path.readOperations().forEach(operation -> {
                addError(operation.getResponses(), "400", "Invalid request", content);
                boolean authenticated = operation.getSecurity() == null || !operation.getSecurity().isEmpty();
                if (authenticated || pathName.equals(LOGIN_PATH)) {
                    addError(operation.getResponses(), "401", "Authentication required or invalid credentials", content);
                }
                if (pathName.contains("{")) {
                    addError(operation.getResponses(), "404", "Not found", content);
                }
                if (LIMITED_PATHS.contains(pathName)) {
                    addError(operation.getResponses(), "429", "Too many attempts", content);
                }
                addError(operation.getResponses(), "500", "Unexpected error", content);
            }));
        };
    }

    private static void addError(ApiResponses responses, String status,
            String description, Content content) {
        if (!responses.containsKey(status)) {
            responses.addApiResponse(status, new ApiResponse().description(description).content(content));
        }
    }
}
