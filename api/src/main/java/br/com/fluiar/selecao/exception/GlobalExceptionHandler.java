package br.com.fluiar.selecao.exception;

import java.io.UncheckedIOException;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.TypeMismatchException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.mail.MailException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);
    private static final String ERRORS_PROPERTY = "errors";

    @ExceptionHandler(ApiException.class)
    ProblemDetail handleApiException(ApiException exception) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(exception.status(), exception.getMessage());
        if (!exception.fieldErrors().isEmpty()) {
            problem.setProperty(ERRORS_PROPERTY, exception.fieldErrors());
        }
        return problem;
    }

    /** Safety net for two simultaneous writes of the same unique value; services check uniqueness first. */
    @ExceptionHandler(DataIntegrityViolationException.class)
    ProblemDetail handleDataIntegrityViolation() {
        return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, ErrorMessages.DUPLICATE_RECORD);
    }

    /**
     * The schema has no version columns, so this only means the row was deleted between loading and writing it.
     * Competing edits still follow last-writer-wins.
     */
    @ExceptionHandler(OptimisticLockingFailureException.class)
    ProblemDetail handleRowDeletedDuringWrite() {
        return handleApiException(ApiException.notFound());
    }

    /** The SMTP server's message can repeat the recipient's address, so neither the log nor the response shows it. */
    @ExceptionHandler(MailException.class)
    ProblemDetail handleMailException(MailException exception) {
        log.error("E-mail delivery failed: {}", exception.getClass().getSimpleName());
        return ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR, ErrorMessages.EMAIL_NOT_SENT);
    }

    /** The cause's message can hold the upload's temporary file path, so neither the log nor the response shows it. */
    @ExceptionHandler(UncheckedIOException.class)
    ProblemDetail handleUploadReadFailure(UncheckedIOException exception) {
        log.error("Upload could not be read: {}", exception.getCause().getClass().getSimpleName());
        return ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR, ErrorMessages.FILE_NOT_READ);
    }

    /**
     * Any exception without a more specific handler, such as a bug or a database outage. Its message can hold
     * internal details, so only the log shows it.
     */
    @ExceptionHandler(Exception.class)
    ProblemDetail handleUnexpectedError(Exception exception) {
        log.error("Unexpected error", exception);
        return ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR, ErrorMessages.UNEXPECTED_ERROR);
    }

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(
            MethodArgumentNotValidException exception, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        Map<String, String> errors = new LinkedHashMap<>();
        exception.getBindingResult().getFieldErrors()
                .forEach(error -> errors.putIfAbsent(error.getField(), error.getDefaultMessage()));

        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, ErrorMessages.VALIDATION_FAILED);
        problem.setProperty(ERRORS_PROPERTY, errors);
        return handleExceptionInternal(exception, problem, headers, status, request);
    }

    /** A file over {@code spring.servlet.multipart.max-file-size} gets the same answer as the service's size check. */
    @Override
    protected ResponseEntity<Object> handleMaxUploadSizeExceededException(
            MaxUploadSizeExceededException exception, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, ErrorMessages.IMAGE_TOO_LARGE);
        return handleExceptionInternal(exception, problem, headers, status, request);
    }

    /** A body that is not valid JSON or does not fit the field types, such as a quantity of 1.9. */
    @Override
    protected ResponseEntity<Object> handleHttpMessageNotReadable(
            HttpMessageNotReadableException exception, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, ErrorMessages.INVALID_REQUEST);
        return handleExceptionInternal(exception, problem, headers, status, request);
    }

    /** A path value of the wrong type, such as an id that is not a UUID. */
    @Override
    protected ResponseEntity<Object> handleTypeMismatch(
            TypeMismatchException exception, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, ErrorMessages.INVALID_REQUEST);
        return handleExceptionInternal(exception, problem, headers, status, request);
    }

    /** The only multipart request is the image upload, so a missing part means no image was sent. */
    @Override
    protected ResponseEntity<Object> handleMissingServletRequestPart(
            MissingServletRequestPartException exception, HttpHeaders headers, HttpStatusCode status,
            WebRequest request) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, ErrorMessages.INVALID_IMAGE);
        return handleExceptionInternal(exception, problem, headers, status, request);
    }
}
