package br.com.fluiar.selecao;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class SelecaoApplication {

    public static void main(String[] args) {
        SpringApplication.run(SelecaoApplication.class, args);
    }
}
