package br.com.fluiar.selecao.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.Map;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;

class StoreProductCollectorTest {
    @Test void validatesRealImageBytesAndRejectsSpoofedOrOversizedImages() throws Exception {
        var http = mock(SafeStoreHttpClient.class);
        var collector = new StoreProductCollector(http, new StoreProductExtractor());
        var output = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(1, 1, BufferedImage.TYPE_INT_RGB), "png", output);
        when(http.get(anyString(), anyBoolean(), anyInt())).thenReturn(new SafeStoreHttpClient.Response(200, Map.of("content-type", "text/plain"), output.toByteArray()));
        var image = collector.downloadImage("https://cdn.example.com/photo.png");
        assertThat(image).isNotNull();
        assertThat(image.contentType()).isEqualTo("image/png");
        assertThat(image.data()).containsExactly(output.toByteArray());
        for (byte[] data : new byte[][] {new byte[] {(byte) 0xff, (byte) 0xd8, (byte) 0xff}, new byte[5 * 1024 * 1024 + 1], "<html>bad</html>".getBytes()}) {
            when(http.get(anyString(), anyBoolean(), anyInt())).thenReturn(new SafeStoreHttpClient.Response(200, Map.of(), data));
            assertThatThrownBy(() -> collector.downloadImage("https://cdn.example.com/photo.jpg")).isInstanceOf(br.com.fluiar.selecao.exception.ApiException.class);
        }
    }

    @Test void rejectsImagesAboveThePixelLimitFromTheHeaderAlone() throws Exception {
        var http = mock(SafeStoreHttpClient.class);
        var collector = new StoreProductCollector(http, new StoreProductExtractor());
        var output = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(5000, 5000, BufferedImage.TYPE_BYTE_GRAY), "png", output);
        when(http.get(anyString(), anyBoolean(), anyInt())).thenReturn(new SafeStoreHttpClient.Response(200, Map.of(), output.toByteArray()));
        assertThatThrownBy(() -> collector.downloadImage("https://cdn.example.com/big.png")).isInstanceOf(br.com.fluiar.selecao.exception.ApiException.class);
    }

    @Test void validatesDimensionsWithoutDecodingThePixels() throws Exception {
        var http = mock(SafeStoreHttpClient.class);
        var collector = new StoreProductCollector(http, new StoreProductExtractor());
        var output = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(50, 50, BufferedImage.TYPE_INT_RGB), "png", output);
        byte[] truncated = java.util.Arrays.copyOf(output.toByteArray(), output.size() - 30);
        when(http.get(anyString(), anyBoolean(), anyInt())).thenReturn(new SafeStoreHttpClient.Response(200, Map.of(), truncated));
        assertThat(collector.downloadImage("https://cdn.example.com/photo.png").contentType()).isEqualTo("image/png");
    }

    @Test void storeHttpStatusIsKeptAsTheCauseOfTheCollectionFailure() throws Exception {
        var publicIp = java.net.InetAddress.getByName("8.8.8.8");
        var client = new SafeStoreHttpClient(host -> new java.net.InetAddress[] {publicIp}, (uri, address, limit, deadline) -> new SafeStoreHttpClient.Response(503, Map.of(), new byte[0]));
        var collector = new StoreProductCollector(client, new StoreProductExtractor());
        assertThatThrownBy(() -> collector.preview("https://moveca.com.br/products/chair", null))
                .isInstanceOf(br.com.fluiar.selecao.exception.ApiException.class)
                .hasRootCauseMessage("Store unavailable status=503");
    }

    @Test void previewRejectsUnsupportedStoreBeforeNetwork() {
        var collector = new StoreProductCollector(mock(SafeStoreHttpClient.class), new StoreProductExtractor());
        assertThatThrownBy(() -> collector.preview("https://evil.example/a", null)).isInstanceOf(br.com.fluiar.selecao.exception.ApiException.class);
    }
    @Test void canonicalRedirectRetainsChosenVariantAndUsesFinalPageForRelativeImages() throws Exception {
        var publicIp = java.net.InetAddress.getByName("8.8.8.8");
        String original = "https://moveca.com.br/old?variant=blue";
        String canonical = "https://moveca.com.br/products/new";
        String html = new String(getClass().getResourceAsStream("/stores/moveca.html").readAllBytes(), java.nio.charset.StandardCharsets.UTF_8)
                .replace("https://moveca.com.br/products/banqueta-ocean", canonical)
                .replace("https://cdn.shopify.com/ocean.png", "images/photo.png");
        var client = new SafeStoreHttpClient(host -> new java.net.InetAddress[] {publicIp}, (uri, address, limit, deadline) -> {
            if (uri.getPath().equals("/old")) return new SafeStoreHttpClient.Response(302, Map.of("location", canonical), new byte[0]);
            return new SafeStoreHttpClient.Response(200, Map.of(), html.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        });
        var preview = new StoreProductCollector(client, new StoreProductExtractor()).preview(original, null);
        assertThat(preview.sourceUrl()).isEqualTo(canonical);
        assertThat(preview.variantId()).isEqualTo("blue");
        assertThat(preview.unitPrice()).isEqualByComparingTo("999.90");
        assertThat(preview.imageUrl()).isEqualTo("https://moveca.com.br/products/images/photo.png");
        assertThat(preview.resolution()).isEqualTo(br.com.fluiar.selecao.dto.ProductImportPreview.Resolution.RESOLVED);
    }

}
