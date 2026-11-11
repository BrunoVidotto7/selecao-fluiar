package br.com.fluiar.selecao.controller;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.fluiar.selecao.service.ProductService;
import br.com.fluiar.selecao.support.ApiIntegrationTest;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.assertj.MvcTestResult;

class ProductImageControllerTest extends ApiIntegrationTest {

    private static final String PAULA_NAME = "Paula Hooper";
    private static final String PAULA_EMAIL = "paula@fluiar.com.br";
    private static final String MARINA_NAME = "Marina Costa";
    private static final String MARINA_EMAIL = "marina@fluiar.com.br";
    private static final String SERGIO_NAME = "Sérgio Hooper";
    private static final String LIST_NAME = "Lista de compras da casa";
    private static final String KITCHEN = "Cozinha";
    private static final String MIXER = "Batedeira";
    private static final String FILE_PART = "file";
    private static final String PNG_FILE_NAME = "foto.png";
    private static final String JPEG_FILE_NAME = "foto.jpg";
    private static final byte[] PNG_SIGNATURE = {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n'};
    private static final byte[] JPEG_SIGNATURE = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};
    private static final int SMALL_IMAGE_CONTENT_BYTES = 100;
    private static final int FIVE_MB = 5 * 1024 * 1024;
    private static final String NOT_AN_IMAGE = "hello";
    private static final String IMAGE_PATH = "/api/images/";
    private static final String PRIVATE_CACHE = "private";
    private static final String NO_STORE_CACHE = "no-store";
    private static final String IMMUTABLE_CACHE = "immutable";
    private static final String ONE_YEAR_CACHE = "max-age=31536000";
    private static final String INVALID_IMAGE = "Escolha um arquivo de imagem (JPG ou PNG).";
    private static final String IMAGE_TOO_LARGE = "A imagem deve ter até 5 MB.";
    private static final Instant OLDER_UPDATE = Instant.parse("2020-01-01T00:00:00Z");
    private static final String STORE_LIST_UPDATED_AT = "update shopping_lists set updated_at = ? where id = ?";
    private static final String LOCK_LISTS = "select id from shopping_lists for update";

    private TestSession imageReader;

    @Autowired
    private ProductService productService;

    @Test
    void uploadPngReturnsAuthenticatedImageUrl() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID mixerId = createMixer(paula);
        byte[] png = smallImage(PNG_SIGNATURE);

        var result = requestUpload(paula, mixerId, pngFile(png));

        assertThat(result).hasStatus(HttpStatus.OK);
        String imageUrl = readJson(result, "$.imageUrl");
        assertThat(imageUrl).startsWith(IMAGE_PATH);
        var image = requestImage(imageUrl);
        assertThat(image).hasStatus(HttpStatus.OK);
        assertThat(image).hasContentType(MediaType.IMAGE_PNG);
        assertThat(image.getResponse().getContentAsByteArray()).isEqualTo(png);
        assertThat(image.getResponse().getHeader(HttpHeaders.CACHE_CONTROL))
                .contains(PRIVATE_CACHE, ONE_YEAR_CACHE, IMMUTABLE_CACHE).doesNotContain(NO_STORE_CACHE);
        assertThat(storedImageUrl(paula, mixerId)).isEqualTo(imageUrl);
    }

    /** The JPEG is sent without an image content type: the stored type comes from its first bytes. */
    @Test
    void uploadReplacesPreviousImage() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID mixerId = createMixer(paula);
        String pngUrl = uploadImage(paula, mixerId);

        var result = requestUpload(paula, mixerId, new MockMultipartFile(
                FILE_PART, JPEG_FILE_NAME, MediaType.APPLICATION_OCTET_STREAM_VALUE, smallImage(JPEG_SIGNATURE)));

        assertThat(result).hasStatus(HttpStatus.OK);
        String jpegUrl = readJson(result, "$.imageUrl");
        assertThat(jpegUrl).isNotEqualTo(pngUrl);
        assertThat(requestImage(pngUrl)).hasStatus(HttpStatus.NOT_FOUND);
        var image = requestImage(jpegUrl);
        assertThat(image).hasStatus(HttpStatus.OK);
        assertThat(image).hasContentType(MediaType.IMAGE_JPEG);
        assertThat(storedImageUrl(paula, mixerId)).isEqualTo(jpegUrl);
    }

    @Test
    void uploadRejectsFileThatIsNotAnImage() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID mixerId = createMixer(paula);

        var result = requestUpload(paula, mixerId, new MockMultipartFile(FILE_PART, JPEG_FILE_NAME,
                MediaType.IMAGE_JPEG_VALUE, NOT_AN_IMAGE.getBytes(StandardCharsets.UTF_8)));

        assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(result).bodyJson().extractingPath("$.detail").isEqualTo(INVALID_IMAGE);
        assertThat(storedImageUrl(paula, mixerId)).isNull();
    }

    @Test
    void uploadWithoutFileIsRejected() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID mixerId = createMixer(paula);

        var result = mvc.put().uri("/api/products/{productId}/image", mixerId)
                .multipart()
                .header(HttpHeaders.AUTHORIZATION, bearer(paula))
                .exchange();

        assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(result).bodyJson().extractingPath("$.detail").isEqualTo(INVALID_IMAGE);
    }

    @Test
    void uploadRejectsFileOver5MB() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID mixerId = createMixer(paula);

        var result = requestUpload(paula, mixerId, pngFile(imageOfSize(PNG_SIGNATURE, FIVE_MB + 1)));

        assertThat(result).hasStatus(HttpStatus.CONTENT_TOO_LARGE);
        assertThat(result).bodyJson().extractingPath("$.detail").isEqualTo(IMAGE_TOO_LARGE);
        assertThat(storedImageUrl(paula, mixerId)).isNull();
    }

    @Test
    void readerLoadsImage() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID mixerId = createMixer(paula);
        String imageUrl = uploadImage(paula, mixerId);
        UUID listId = jdbcListOf(mixerId);
        UUID principalId = jdbc.queryForObject("select client_id from shopping_lists where id = ?", UUID.class, listId);
        UUID readerId = createClient(paula, "Reader", "reader@example.com");
        imageReader = inviteClient(paula, readerId);
        assertThat(requestImage(imageUrl)).hasStatus(HttpStatus.NOT_FOUND);

        addMember(paula, listId, principalId, readerId, "READER");

        assertThat(requestImage(imageUrl)).hasStatus(HttpStatus.OK);
    }

    private UUID jdbcListOf(UUID productId) {
        return jdbc.queryForObject("select r.list_id from products p join rooms r on r.id = p.room_id where p.id = ?",
                UUID.class, productId);
    }

    @Test
    void uploadAcceptsFileOfExactly5MB() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID mixerId = createMixer(paula);

        var result = requestUpload(paula, mixerId, pngFile(imageOfSize(PNG_SIGNATURE, FIVE_MB)));

        assertThat(result).hasStatus(HttpStatus.OK);
    }

    @Test
    void deleteImage() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID mixerId = createMixer(paula);
        String imageUrl = uploadImage(paula, mixerId);

        var result = requestImageDelete(paula, mixerId);

        assertThat(result).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(storedImageUrl(paula, mixerId)).isNull();
        assertThat(requestImage(imageUrl)).hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void deleteImageOfProductWithoutImageSucceeds() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        UUID mixerId = createProduct(paula, listId, createRoom(paula, listId, KITCHEN), MIXER);

        assertRefreshesListUpdatedAt(paula, listId, () -> {
            var result = requestImageDelete(paula, mixerId);
            assertThat(result).hasStatus(HttpStatus.NO_CONTENT);
            return result;
        });
    }

    @Test
    void imageOfAnotherOfficeCannotBeChanged() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        var marina = createAdmin(MARINA_NAME, MARINA_EMAIL);
        UUID mixerId = createMixer(paula);
        String imageUrl = uploadImage(paula, mixerId);

        var upload = requestUpload(marina, mixerId, pngFile(smallImage(PNG_SIGNATURE)));
        var delete = requestImageDelete(marina, mixerId);

        assertThat(upload).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(delete).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(requestImage(imageUrl)).hasStatus(HttpStatus.OK);
        assertThat(storedImageUrl(paula, mixerId)).isEqualTo(imageUrl);
    }

    @Test
    void imageChangesRefreshListUpdatedAt() {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID listId = createList(paula, createClient(paula, SERGIO_NAME), LIST_NAME);
        UUID mixerId = createProduct(paula, listId, createRoom(paula, listId, KITCHEN), MIXER);

        assertRefreshesListUpdatedAt(paula, listId,
                () -> requestUpload(paula, mixerId, pngFile(smallImage(PNG_SIGNATURE))));
        assertRefreshesListUpdatedAt(paula, listId, () -> requestImageDelete(paula, mixerId));
    }

    /**
     * Both uploads start while another transaction locks the list, so they overlap. The one that runs second must
     * replace the image of the first instead of breaking the one-image-per-product rule.
     */
    @Test
    void overlappingUploadsOfTheSameProductBothSucceed() throws Exception {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID mixerId = createMixer(paula);

        var results = requestsDuringConcurrentTransaction(() -> jdbc.queryForList(LOCK_LISTS), List.of(
                () -> requestUpload(paula, mixerId, pngFile(smallImage(PNG_SIGNATURE))),
                () -> requestUpload(paula, mixerId, pngFile(smallImage(PNG_SIGNATURE)))));

        assertThat(statusesOf(results)).containsExactly(HttpStatus.OK, HttpStatus.OK);
        assertThat(storedImageUrl(paula, mixerId))
                .isIn(readJson(results.get(0), "$.imageUrl"), readJson(results.get(1), "$.imageUrl"));
    }

    /** Another transaction deletes the mixer and commits only while the upload waits for it. */
    @Test
    void uploadForAProductDeletedMeanwhileIsNotFound() throws Exception {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID mixerId = createMixer(paula);

        var results = requestsDuringConcurrentTransaction(
                () -> productService.delete(paula.officeId(), mixerId),
                List.of(() -> requestUpload(paula, mixerId, pngFile(smallImage(PNG_SIGNATURE)))));

        assertThat(statusesOf(results)).containsExactly(HttpStatus.NOT_FOUND);
    }

    /** Another transaction deletes the mixer and commits only while the image delete waits for it. */
    @Test
    void deleteImageOfAProductDeletedMeanwhileIsNotFound() throws Exception {
        var paula = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID mixerId = createMixer(paula);

        var results = requestsDuringConcurrentTransaction(
                () -> productService.delete(paula.officeId(), mixerId),
                List.of(() -> requestImageDelete(paula, mixerId)));

        assertThat(statusesOf(results)).containsExactly(HttpStatus.NOT_FOUND);
    }

    @Test
    void onlyTheOwnerAndOfficeAdminCanReadAnImageAndReassignmentRevokesTheOwner() {
        var admin = createAdmin(PAULA_NAME, PAULA_EMAIL);
        UUID client = createClient(admin, "Owner", "owner@example.com");
        UUID otherClient = createClient(admin, "Other", "other@example.com");
        var owner = createClientAccount(admin, client, "owner@example.com");
        var other = createClientAccount(admin, otherClient, "other@example.com");
        var remote = createAdmin(MARINA_NAME, MARINA_EMAIL);
        UUID list = createList(admin, client, LIST_NAME);
        UUID product = createProduct(admin, list, createRoom(admin, list, KITCHEN), MIXER);
        String imageUrl = uploadImage(admin, product);

        assertThat(mvc.get().uri(imageUrl).exchange()).hasStatus(HttpStatus.UNAUTHORIZED);
        assertThat(mvc.get().uri(imageUrl).header(HttpHeaders.AUTHORIZATION, bearer(admin)).exchange()).hasStatus(HttpStatus.OK);
        assertThat(mvc.get().uri(imageUrl).header(HttpHeaders.AUTHORIZATION, bearer(owner)).exchange()).hasStatus(HttpStatus.OK);
        assertThat(mvc.get().uri(imageUrl).header(HttpHeaders.AUTHORIZATION, bearer(other)).exchange()).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(mvc.get().uri(imageUrl).header(HttpHeaders.AUTHORIZATION, bearer(remote)).exchange()).hasStatus(HttpStatus.NOT_FOUND);

        jdbc.update("update shopping_lists set client_id = ? where id = ?", otherClient, list);
        assertThat(mvc.get().uri(imageUrl).header(HttpHeaders.AUTHORIZATION, bearer(owner)).exchange()).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(mvc.get().uri(imageUrl).header(HttpHeaders.AUTHORIZATION, bearer(other)).exchange()).hasStatus(HttpStatus.OK);
    }

    private UUID createMixer(TestSession session) {
        imageReader = session;
        UUID listId = createList(session, createClient(session, SERGIO_NAME), LIST_NAME);
        return createProduct(session, listId, createRoom(session, listId, KITCHEN), MIXER);
    }

    /** Uploads a small PNG and returns its URL. */
    private String uploadImage(TestSession session, UUID productId) {
        var result = requestUpload(session, productId, pngFile(smallImage(PNG_SIGNATURE)));
        assertThat(result).hasStatus(HttpStatus.OK);

        return readJson(result, "$.imageUrl");
    }

    private String storedImageUrl(TestSession session, UUID productId) {
        var product = mvc.get().uri("/api/products/{productId}", productId)
                .header(HttpHeaders.AUTHORIZATION, bearer(session))
                .exchange();
        assertThat(product).hasStatus(HttpStatus.OK);

        return readJson(product, "$.imageUrl");
    }

    private static MockMultipartFile pngFile(byte[] content) {
        return new MockMultipartFile(FILE_PART, PNG_FILE_NAME, MediaType.IMAGE_PNG_VALUE, content);
    }

    private static byte[] smallImage(byte[] signature) {
        return imageOfSize(signature, signature.length + SMALL_IMAGE_CONTENT_BYTES);
    }

    /** The signature followed by varied bytes, so a body that comes back changed does not look equal. */
    private static byte[] imageOfSize(byte[] signature, int size) {
        byte[] image = new byte[size];
        for (int i = 0; i < size; i++) {
            image[i] = i < signature.length ? signature[i] : (byte) i;
        }
        return image;
    }

    /** Stores a known past update time before the change, so any later write by Hibernate is certainly newer. */
    private void assertRefreshesListUpdatedAt(TestSession session, UUID listId, Supplier<MvcTestResult> imageChange) {
        jdbc.update(STORE_LIST_UPDATED_AT, OffsetDateTime.ofInstant(OLDER_UPDATE, ZoneOffset.UTC), listId);

        assertThat(imageChange.get()).hasStatus2xxSuccessful();

        var list = mvc.get().uri("/api/lists/{id}", listId).header(HttpHeaders.AUTHORIZATION, bearer(session))
                .exchange();
        assertThat(list).hasStatus(HttpStatus.OK);
        assertThat(Instant.parse(readJson(list, "$.updatedAt"))).isAfter(OLDER_UPDATE);
    }

    private MvcTestResult requestUpload(TestSession session, UUID productId, MockMultipartFile file) {
        return mvc.put().uri("/api/products/{productId}/image", productId)
                .multipart()
                .file(file)
                .header(HttpHeaders.AUTHORIZATION, bearer(session))
                .exchange();
    }

    private MvcTestResult requestImageDelete(TestSession session, UUID productId) {
        return mvc.delete().uri("/api/products/{productId}/image", productId)
                .header(HttpHeaders.AUTHORIZATION, bearer(session))
                .exchange();
    }

    /** Read through the authenticated image endpoint. */
    private MvcTestResult requestImage(String imageUrl) {
        return mvc.get().uri(imageUrl).header(HttpHeaders.AUTHORIZATION, bearer(imageReader)).exchange();
    }
}
