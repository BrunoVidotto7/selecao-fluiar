package br.com.fluiar.selecao.config;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
@Configuration(proxyBeanMethods=false)
@EnableScheduling
public class ProductSyncConfig {}
