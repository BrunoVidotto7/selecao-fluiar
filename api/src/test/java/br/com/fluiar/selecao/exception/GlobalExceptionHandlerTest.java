package br.com.fluiar.selecao.exception;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

/**
 * Covers the handlers that no API request can trigger on demand: a duplicate needs two simultaneous writes, MockMvc
 * does not apply the server's multipart size limit, reading an uploaded file only fails on a server-side error, and
 * an unexpected error needs a bug.
 */
class GlobalExceptionHandlerTest {

    private static final long SERVER_UPLOAD_LIMIT_BYTES = 5 * 1024 * 1024;
    private static final String UPLOAD_TEMP_FILE_PATH = "/tmp/upload_123.tmp";
    private static final String INTERNAL_DETAIL = "internal detail";

    private final MockMvcTester mvc = MockMvcTester.of(
            List.of(new DuplicateWritingController(), new OversizedUploadController(),
                    new UnreadableUploadController(), new FailingController()),
            builder -> builder.setControllerAdvice(new GlobalExceptionHandler()).build());

    @Test
    void dataIntegrityViolationIsReportedAsDuplicateRecord() {
        var result = mvc.post().uri("/duplicate");

        assertThat(result).hasStatus(HttpStatus.CONFLICT);
        assertThat(result).bodyJson().extractingPath("$.detail").isEqualTo("Este registro já existe.");
    }

    @Test
    void uploadOverTheServerLimitIsReportedAsImageTooLarge() {
        var result = mvc.post().uri("/oversized-upload");

        assertThat(result).hasStatus(HttpStatus.CONTENT_TOO_LARGE);
        assertThat(result).bodyJson().extractingPath("$.detail").isEqualTo("A imagem deve ter até 5 MB.");
    }

    @Test
    @ExtendWith(OutputCaptureExtension.class)
    void unreadableUploadIsReportedAsFileNotRead(CapturedOutput output) {
        var result = mvc.post().uri("/unreadable-upload");

        assertThat(result).hasStatus(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(result).bodyJson().extractingPath("$.detail")
                .isEqualTo("Não conseguimos ler o arquivo. Tente enviar de novo.");
        assertThat(result).bodyText().doesNotContain(UPLOAD_TEMP_FILE_PATH);
        assertThat(output.getOut()).doesNotContain(UPLOAD_TEMP_FILE_PATH);
    }

    @Test
    @ExtendWith(OutputCaptureExtension.class)
    void unexpectedErrorIsReportedWithoutItsInternalDetail(CapturedOutput output) {
        var result = mvc.post().uri("/failing").exchange();

        assertThat(result).hasStatus(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(result).bodyJson().extractingPath("$.detail")
                .isEqualTo("Algo deu errado do nosso lado. Tente novamente em alguns minutos.");
        assertThat(result).bodyText().doesNotContain(INTERNAL_DETAIL);
        List<String> unexpectedErrorLogs =
                output.getOut().lines().filter(line -> line.contains("Unexpected error")).toList();
        assertThat(unexpectedErrorLogs).singleElement().asString().contains("ERROR");
        assertThat(output.getOut()).contains(INTERNAL_DETAIL);
    }

    @RestController
    static class DuplicateWritingController {

        @PostMapping("/duplicate")
        void write() {
            throw new DataIntegrityViolationException("duplicate key value violates unique constraint");
        }
    }

    /** Throws what the servlet container's multipart parsing throws for a file over the configured limit. */
    @RestController
    static class OversizedUploadController {

        @PostMapping("/oversized-upload")
        void upload() {
            throw new MaxUploadSizeExceededException(SERVER_UPLOAD_LIMIT_BYTES);
        }
    }

    /** Throws what the image service throws when it cannot read the upload's temporary file. */
    @RestController
    static class UnreadableUploadController {

        @PostMapping("/unreadable-upload")
        void upload() {
            throw new UncheckedIOException(new IOException(UPLOAD_TEMP_FILE_PATH));
        }
    }

    /** Throws an exception that no specific handler knows, like a bug would. */
    @RestController
    static class FailingController {

        @PostMapping("/failing")
        void fail() {
            throw new IllegalStateException(INTERNAL_DETAIL);
        }
    }
}
