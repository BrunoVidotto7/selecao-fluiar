package br.com.fluiar.selecao.security;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

@Target(ElementType.PARAMETER)
@Retention(RetentionPolicy.RUNTIME)
@AuthenticationPrincipal(expression = "T(java.util.UUID).fromString(getClaimAsString('" + TokenService.CLIENT_ID_CLAIM + "'))")
public @interface CurrentClientId {
}
