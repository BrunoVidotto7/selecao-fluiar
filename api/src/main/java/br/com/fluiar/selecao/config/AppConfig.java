package br.com.fluiar.selecao.config;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class AppConfig {

    @Bean
    Clock clock(AppProperties appProperties) {
        return Clock.system(appProperties.timeZone());
    }
}
