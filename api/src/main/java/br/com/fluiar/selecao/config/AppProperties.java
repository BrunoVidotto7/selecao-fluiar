package br.com.fluiar.selecao.config;

import java.time.Duration;
import java.time.ZoneId;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("app")
public record AppProperties(
        Jwt jwt,
        String frontendUrl,
        List<String> corsAllowedOrigins,
        ZoneId timeZone,
        String mailFrom) {

    public record Jwt(String secret, Duration ttl, Duration rememberMeTtl) {
    }
}
