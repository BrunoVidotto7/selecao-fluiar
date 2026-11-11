package br.com.fluiar.selecao.dto;

import br.com.fluiar.selecao.exception.ErrorMessages;
import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** A CPF without punctuation, as {@link Inputs#compactCode} leaves it. A null value is accepted. */
@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = ValidCpf.Validator.class)
public @interface ValidCpf {

    String message() default ErrorMessages.CPF_INVALID;

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};

    class Validator implements ConstraintValidator<ValidCpf, String> {

        @Override
        public boolean isValid(String value, ConstraintValidatorContext context) {
            return value == null || ValidTaxDocument.Validator.isValidCpf(value);
        }
    }
}
