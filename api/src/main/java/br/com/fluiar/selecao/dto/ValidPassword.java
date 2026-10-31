package br.com.fluiar.selecao.dto;

import br.com.fluiar.selecao.exception.ErrorMessages;
import br.com.fluiar.selecao.model.User;
import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.nio.charset.StandardCharsets;

/**
 * All rules for a new password, so a password field needs only this annotation. The rules are checked in
 * order and only the first broken one is reported, so a value never gets two messages. The password itself
 * is never trimmed or changed.
 */
@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = ValidPassword.Validator.class)
public @interface ValidPassword {

    String message() default ErrorMessages.PASSWORD_SIZE;

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};

    class Validator implements ConstraintValidator<ValidPassword, String> {

        private static final String REQUIRED_MESSAGE = "{jakarta.validation.constraints.NotBlank.message}";

        @Override
        public boolean isValid(String password, ConstraintValidatorContext context) {
            String brokenRuleMessage = brokenRuleMessage(password);
            if (brokenRuleMessage == null) {
                return true;
            }

            context.disableDefaultConstraintViolation();
            context.buildConstraintViolationWithTemplate(brokenRuleMessage).addConstraintViolation();
            return false;
        }

        /** Returns the message of the first broken rule, or null when the password follows every rule. */
        private static String brokenRuleMessage(String password) {
            if (password == null || password.isBlank()) {
                return REQUIRED_MESSAGE;
            }
            if (password.length() < User.PASSWORD_MIN_LENGTH || password.length() > User.PASSWORD_MAX_LENGTH) {
                return ErrorMessages.PASSWORD_SIZE;
            }
            if (password.getBytes(StandardCharsets.UTF_8).length > User.PASSWORD_MAX_BYTES) {
                return ErrorMessages.PASSWORD_TOO_LONG;
            }
            return null;
        }
    }
}
