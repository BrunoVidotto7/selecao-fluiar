package br.com.fluiar.selecao.exception;

import java.util.Map;
import org.springframework.http.HttpStatus;

/** A failure the user can act on. Its message becomes the response detail. */
public class ApiException extends RuntimeException {

    private static final String EMAIL_FIELD = "email";

    private final HttpStatus status;
    private final Map<String, String> fieldErrors;

    private ApiException(HttpStatus status, String message, Map<String, String> fieldErrors) {
        super(message);
        this.status = status;
        this.fieldErrors = fieldErrors;
    }

    /** Keeps the internal cause for logs; it never reaches the response. */
    public ApiException causedBy(Throwable cause) {
        initCause(cause);
        return this;
    }

    public HttpStatus status() {
        return status;
    }

    public Map<String, String> fieldErrors() {
        return fieldErrors;
    }

    public static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, ErrorMessages.NOT_FOUND, Map.of());
    }

    public static ApiException forbidden(String message) {
        return new ApiException(HttpStatus.FORBIDDEN, message, Map.of());
    }

    public static ApiException invalidCredentials() {
        return new ApiException(HttpStatus.UNAUTHORIZED, ErrorMessages.INVALID_CREDENTIALS, Map.of());
    }

    public static ApiException tooManyAttempts() {
        return new ApiException(HttpStatus.TOO_MANY_REQUESTS, ErrorMessages.TOO_MANY_ATTEMPTS, Map.of());
    }

    public static ApiException invalidLink() {
        return new ApiException(HttpStatus.BAD_REQUEST, ErrorMessages.INVALID_LINK, Map.of());
    }

    public static ApiException invalidImage() {
        return new ApiException(HttpStatus.BAD_REQUEST, ErrorMessages.INVALID_IMAGE, Map.of());
    }

    public static ApiException imageTooLarge() {
        return new ApiException(HttpStatus.CONTENT_TOO_LARGE, ErrorMessages.IMAGE_TOO_LARGE, Map.of());
    }

    public static ApiException emailInUse() {
        return conflict(EMAIL_FIELD, ErrorMessages.EMAIL_IN_USE);
    }

    public static ApiException invalidField(String field, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, message, Map.of(field, message));
    }

    public static ApiException conflict(String field, String message) {
        return new ApiException(HttpStatus.CONFLICT, message, Map.of(field, message));
    }
}
