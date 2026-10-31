package br.com.fluiar.selecao.config;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import org.springframework.context.annotation.Configuration;

/** Lets Swagger UI send the JWT in the Authorization header. */
@Configuration(proxyBeanMethods = false)
@SecurityScheme(name = OpenApiConfig.SECURITY_SCHEME, type = SecuritySchemeType.HTTP, scheme = "bearer",
        bearerFormat = "JWT")
@OpenAPIDefinition(info = @Info(title = "Seleção Fluiar API", version = "v1"),
        security = @SecurityRequirement(name = OpenApiConfig.SECURITY_SCHEME))
public class OpenApiConfig {

    static final String SECURITY_SCHEME = "bearer";
}
