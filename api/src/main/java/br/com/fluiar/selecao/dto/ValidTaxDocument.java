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

/**
 * A CPF (11 digits) or a CNPJ (14 characters, numeric or alphanumeric) without punctuation and in capital letters,
 * as {@link Inputs#compactCode} leaves it. A null value is accepted, so the field stays optional.
 */
@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = ValidTaxDocument.Validator.class)
public @interface ValidTaxDocument {

    String message() default ErrorMessages.TAX_DOCUMENT_INVALID;

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};

    class Validator implements ConstraintValidator<ValidTaxDocument, String> {

        private static final int CPF_LENGTH = 11;
        private static final int CNPJ_LENGTH = 14;
        private static final int CHECK_DIGITS = 2;
        private static final int MODULUS = 11;
        private static final int CNPJ_MIN_WEIGHT = 2;
        private static final int CNPJ_MAX_WEIGHT = 9;
        private static final int ASCII_ZERO = '0';

        @Override
        public boolean isValid(String value, ConstraintValidatorContext context) {
            return value == null || isValid(value);
        }

        public static boolean isValid(String compact) {
            if (compact == null || allCharactersEqual(compact)) {
                return false;
            }
            if (compact.length() == CPF_LENGTH) {
                return isValidCpf(compact);
            }
            if (compact.length() == CNPJ_LENGTH) {
                return hasValidCnpjShape(compact) && hasValidCnpjDigits(compact);
            }
            return false;
        }

        public static boolean isValidCpf(String compact) {
            return compact != null && compact.length() == CPF_LENGTH && !allCharactersEqual(compact)
                    && compact.chars().allMatch(Validator::isDigit) && hasValidCpfDigits(compact);
        }

        private static boolean allCharactersEqual(String value) {
            return !value.isEmpty() && value.chars().allMatch(character -> character == value.charAt(0));
        }

        private static boolean isDigit(int character) {
            return character >= '0' && character <= '9';
        }

        private static boolean isDigitOrCapitalLetter(int character) {
            return isDigit(character) || (character >= 'A' && character <= 'Z');
        }

        private static boolean hasValidCpfDigits(String cpf) {
            int firstDigitIndex = CPF_LENGTH - CHECK_DIGITS;
            return checkDigit(cpf, firstDigitIndex) == valueOf(cpf.charAt(firstDigitIndex))
                    && checkDigit(cpf, firstDigitIndex + 1) == valueOf(cpf.charAt(firstDigitIndex + 1));
        }

        /** The weights go from {@code count + 1} down to 2, from the left. */
        private static int checkDigit(String cpf, int count) {
            int sum = 0;
            for (int i = 0; i < count; i++) {
                sum += valueOf(cpf.charAt(i)) * (count + 1 - i);
            }
            return remainderToDigit(sum);
        }

        private static boolean hasValidCnpjShape(String cnpj) {
            int baseLength = CNPJ_LENGTH - CHECK_DIGITS;
            return cnpj.substring(0, baseLength).chars().allMatch(Validator::isDigitOrCapitalLetter)
                    && cnpj.substring(baseLength).chars().allMatch(Validator::isDigit);
        }

        private static boolean hasValidCnpjDigits(String cnpj) {
            int firstDigitIndex = CNPJ_LENGTH - CHECK_DIGITS;
            return cnpjCheckDigit(cnpj, firstDigitIndex) == valueOf(cnpj.charAt(firstDigitIndex))
                    && cnpjCheckDigit(cnpj, firstDigitIndex + 1) == valueOf(cnpj.charAt(firstDigitIndex + 1));
        }

        /** The weights go from 2 to 9 and repeat, starting at the last of the first {@code count} characters. */
        private static int cnpjCheckDigit(String cnpj, int count) {
            int weightCount = CNPJ_MAX_WEIGHT - CNPJ_MIN_WEIGHT + 1;
            int sum = 0;
            for (int i = 0; i < count; i++) {
                int weight = CNPJ_MIN_WEIGHT + (count - 1 - i) % weightCount;
                sum += valueOf(cnpj.charAt(i)) * weight;
            }
            return remainderToDigit(sum);
        }

        private static int remainderToDigit(int sum) {
            int remainder = sum % MODULUS;
            return remainder < CHECK_DIGITS ? 0 : MODULUS - remainder;
        }

        /** '0' is 0, '9' is 9 and 'A' is 17. */
        private static int valueOf(char character) {
            return character - ASCII_ZERO;
        }
    }
}
