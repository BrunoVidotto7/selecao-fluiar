package br.com.fluiar.selecao.dto;

import java.util.Locale;
import java.util.regex.Pattern;

/** Normalizes user input in the compact constructors of the request records. Every method accepts null. */
public final class Inputs {

    /** The frontend e-mail rule. It also accepts an empty value, so a blank e-mail fails only {@code @NotBlank}. */
    public static final String EMAIL_PATTERN = "^$|^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$";
    /**
     * Accepts only http and https links, so a {@code javascript:} link never reaches the public list page. The part
     * before the first dot cannot contain a dot, so a long invalid link is checked in linear time.
     */
    public static final String URL_PATTERN = "^https?://[^\\s.]+\\.\\S+$";

    private static final Pattern NON_DIGIT = Pattern.compile("\\D");
    private static final Pattern CODE_SEPARATORS = Pattern.compile("[\\s.\\-/]");

    private Inputs() {
    }

    public static String email(String value) {
        return value == null ? null : value.strip().toLowerCase(Locale.ROOT);
    }

    public static String text(String value) {
        return value == null ? null : value.strip();
    }

    public static String optionalText(String value) {
        String text = text(value);
        return text == null || text.isEmpty() ? null : text;
    }

    /** Keeps only the digits, so a masked phone like {@code (31) 98842-1170} becomes {@code 31988421170}. */
    public static String digits(String value) {
        return value == null ? null : NON_DIGIT.matcher(value).replaceAll("");
    }

    /** Removes spaces, dots, dashes and slashes and uses capital letters, so a masked CNPJ is stored compact. Blank becomes null. */
    public static String compactCode(String value) {
        if (value == null) {
            return null;
        }
        String code = CODE_SEPARATORS.matcher(value).replaceAll("").toUpperCase(Locale.ROOT);
        return code.isEmpty() ? null : code;
    }
}
