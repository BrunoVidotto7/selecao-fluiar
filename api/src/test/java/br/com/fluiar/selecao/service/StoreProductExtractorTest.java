package br.com.fluiar.selecao.service;

import static org.assertj.core.api.Assertions.assertThat;
import br.com.fluiar.selecao.dto.ProductImportPreview.Resolution;
import br.com.fluiar.selecao.model.Store;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class StoreProductExtractorTest {
    private final StoreProductExtractor extractor = new StoreProductExtractor();

    @Test void importsAllFiveStoreSamplesWithoutSelectingRecommendations() throws IOException {
        String[][] samples = {
            {"MOVECA", "https://moveca.com.br/products/banqueta-ocean", "ocean", "blue", "Banqueta Ocean", "999.90"},
            {"FONTE_DO_SOFA", "https://fontedosofa.com.br/produtos/sofa-libano/", "libano", "linen", "Sofá Líbano", "2500.00"},
            {"WESTWING", "https://www.westwing.com.br/p/mesa/123.html", "WW123", "", "Mesa Greyz", "750.00"},
            {"ABRA_CASA", "https://www.abracasa.com.br/poltrona/p?skuId=2009498", "2009498", "2009498", "Poltrona Orbe", "1999.00"},
            {"CASAVEE", "https://www.casavee.com.br/mesa-lateral", "CV123", "", "Mesa Cantik", "1099.00"}
        };
        for (String[] sample : samples) {
            String fixture = new String(getClass().getResourceAsStream("/stores/" + Store.valueOf(sample[0]).id() + ".html").readAllBytes(), StandardCharsets.UTF_8);
            var preview = extractor.extract(sample[1], Store.valueOf(sample[0]), sample[3].isEmpty() ? null : sample[3], fixture);
            assertThat(preview.productId()).as(sample[0]).isEqualTo(sample[2]);
            assertThat(preview.name()).isEqualTo(sample[4]);
            assertThat(preview.unitPrice()).isEqualByComparingTo(new BigDecimal(sample[5]));
            assertThat(preview.resolution()).isEqualTo(Resolution.RESOLVED);
        }
    }

    @Test void importsCapturedLiveExamplesWithFullRegularPriceAndExactVariant() throws IOException {
        String[][] samples = {
            {"MOVECA", "https://moveca.com.br/products/banqueta-ocean", "44766492360981", "2999.00"},
            {"FONTE_DO_SOFA", "https://fontedosofa.com.br/produtos/sofa-retratil-libano-linho-ou-veludo/", "1297999119", "3240.00"},
            {"WESTWING", "https://www.westwing.com.br/p/mesa-de-cabeceira-greyz-castanho-e-champanhe/AP430CP46ZYQWW-1898884.html", "", "2899.00"},
            {"ABRA_CASA", "https://www.abracasa.com.br/poltrona-orbe-giratoria-duna-botone/p?skuId=2009498", "2009498", "2199.88"},
            {"CASAVEE", "https://www.casavee.com.br/mesa-lateral-cantik-79-5-cm-x-30-cm-mel-escuro-dourado", "", "735.29"}
        };
        for (String[] sample : samples) {
            String html = new String(getClass().getResourceAsStream("/stores/" + Store.valueOf(sample[0]).id() + "-live.html").readAllBytes(), StandardCharsets.UTF_8);
            var preview = extractor.extract(sample[1], Store.valueOf(sample[0]), sample[2].isEmpty() ? null : sample[2], html);
            assertThat(preview.unitPrice()).as(sample[0]).isEqualByComparingTo(sample[3]);
            assertThat(preview.resolution()).as(sample[0]).isEqualTo(Resolution.RESOLVED);
            if (sample[0].equals(Store.FONTE_DO_SOFA.name())) {
                assertThat(preview.imageUrl()).endsWith(".jpg");
                var unselected = extractor.extract(sample[1], Store.valueOf(sample[0]), null, html);
                assertThat(unselected.resolution()).isEqualTo(Resolution.VARIANT_REQUIRED);
                assertThat(unselected.variants()).hasSize(60);
            }
        }
    }

    @Test void casaveeDoesNotMistakeJsonLdPixForTheCardTotal() throws IOException {
        String html = new String(getClass().getResourceAsStream("/stores/casavee-live.html").readAllBytes(), StandardCharsets.UTF_8);
        var result = extractor.extract("https://www.casavee.com.br/mesa-lateral-cantik-79-5-cm-x-30-cm-mel-escuro-dourado", Store.CASAVEE, null, html);
        assertThat(result.unitPrice()).isEqualByComparingTo("735.29");
    }

    @Test void wrongSingleSkuCannotResolve() throws IOException {
        String html = new String(getClass().getResourceAsStream("/stores/abra-casa-live.html").readAllBytes(), StandardCharsets.UTF_8);
        var result = extractor.extract("https://www.abracasa.com.br/poltrona-orbe-giratoria-duna-botone/p?skuId=999", Store.ABRA_CASA, "999", html);
        assertThat(result.unitPrice()).isNull();
        assertThat(result.resolution()).isEqualTo(Resolution.UNRESOLVED);
    }

    @Test void requiresExplicitVariantInsteadOfChoosingCheapest() throws IOException {
        String html = new String(getClass().getResourceAsStream("/stores/moveca.html").readAllBytes(), StandardCharsets.UTF_8);
        var result = extractor.extract("https://moveca.com.br/products/banqueta-ocean", Store.MOVECA, null, html);
        assertThat(result.resolution()).isEqualTo(Resolution.VARIANT_REQUIRED);
        assertThat(result.variants()).extracting("id").containsExactly("blue", "red");
        assertThat(result.unitPrice()).isNull();
    }

    @Test void rejectsPixInstallmentsCurrenciesAndConflictingRegularPrices() {
        String template = "<script type='application/ld+json'>{\"@type\":\"Product\",\"url\":\"https://www.westwing.com.br/mesa\",\"sku\":\"123\",\"name\":\"Mesa\",\"image\":\"https://cdn.example.com/photo.jpg\",\"offers\":%s}</script>";
        String regular = "{\"price\":\"99.90\",\"priceCurrency\":\"BRL\"}";
        var control = extractor.extract("https://www.westwing.com.br/mesa", Store.WESTWING, null, template.formatted(regular));
        assertThat(control.unitPrice()).isEqualByComparingTo("99.90");
        assertThat(control.resolution()).isEqualTo(Resolution.RESOLVED);
        for (String offers : new String[] {
                "{\"price\":\"99.90\",\"priceCurrency\":\"USD\"}",
                "{\"price\":\"99.90\",\"priceCurrency\":\"BRL\",\"name\":\"Pix\"}",
                "{\"price\":\"99.90\",\"priceCurrency\":\"BRL\",\"name\":\"10 parcelas\"}",
                "[{\"price\":\"99.90\",\"priceCurrency\":\"BRL\"},{\"price\":\"100.00\",\"priceCurrency\":\"BRL\"}]"}) {
            var result = extractor.extract("https://www.westwing.com.br/mesa", Store.WESTWING, null, template.formatted(offers));
            assertThat(result.name()).isEqualTo("Mesa");
            assertThat(result.unitPrice()).isNull();
            assertThat(result.resolution()).isEqualTo(Resolution.UNRESOLVED);
        }
    }

    @Test void preservesIndependentFieldsWhenPriceCannotResolveAndRejectsRecommendedOnlyPages() throws IOException {
        String html = new String(getClass().getResourceAsStream("/stores/westwing-live.html").readAllBytes(), StandardCharsets.UTF_8);
        String url = "https://www.westwing.com.br/p/mesa-de-cabeceira-greyz-castanho-e-champanhe/AP430CP46ZYQWW-1898884.html";
        var result = extractor.extract(url, Store.WESTWING, null, html.replace("\"2899.00\"", "\"10x de 289.90\""));
        assertThat(result.name()).isEqualTo("Mesa de Cabeceira Greyz Castanho e Champanhe");
        assertThat(result.imageUrl()).startsWith("https://www.westwing.com.br/");
        assertThat(result.unitPrice()).isNull();
        assertThat(result.resolution()).isEqualTo(Resolution.UNRESOLVED);
        var recommended = extractor.extract("https://www.westwing.com.br/other-page", Store.WESTWING, null, html);
        assertThat(recommended.productId()).isNull();
        assertThat(recommended.name()).isNull();
    }

    @Test void readsActualStoreDataAssignmentAfterEarlierJavascriptReferences() throws IOException {
        String html = new String(getClass().getResourceAsStream("/stores/moveca-live.html").readAllBytes(), StandardCharsets.UTF_8);
        html = "<script>if(ymq_option.product.tags.includes('ymq')){other = 'value';}</script>" + html;
        var result = extractor.extract("https://moveca.com.br/products/banqueta-ocean", Store.MOVECA, null, html);
        assertThat(result.resolution()).isEqualTo(Resolution.RESOLVED);
        assertThat(result.variantId()).isEqualTo("44766492360981");
        assertThat(result.unitPrice()).isEqualByComparingTo("2999.00");
    }

    @Test void oversizedVariantIdIsDroppedWithoutLosingTheProductId() {
        String sku = "v".repeat(513);
        String html = "<script type='application/ld+json'>{\"@type\":\"Product\",\"url\":\"https://www.westwing.com.br/mesa\",\"productID\":\"p1\",\"sku\":\"" + sku
                + "\",\"name\":\"Mesa\",\"image\":\"https://cdn.example.com/photo.jpg\",\"offers\":{\"price\":\"99.90\",\"priceCurrency\":\"BRL\"}}</script>";
        var result = extractor.extract("https://www.westwing.com.br/mesa", Store.WESTWING, sku, html);
        assertThat(result.productId()).isEqualTo("p1");
        assertThat(result.variantId()).isNull();
    }

    @Test void dropsNamesAndIdsAboveTheirLimits() {
        String template = "<script type='application/ld+json'>{\"@type\":\"Product\",\"url\":\"https://www.westwing.com.br/mesa\",\"productID\":\"%s\",\"name\":\"%s\",\"image\":\"https://cdn.example.com/photo.jpg\",\"offers\":{\"price\":\"99.90\",\"priceCurrency\":\"BRL\"}}</script>";
        var longName = extractor.extract("https://www.westwing.com.br/mesa", Store.WESTWING, null,
                template.formatted("p1", "n".repeat(br.com.fluiar.selecao.model.Product.NAME_MAX_LENGTH + 1)));
        assertThat(longName.name()).isNull();
        assertThat(longName.resolution()).isEqualTo(Resolution.UNRESOLVED);
        var longId = extractor.extract("https://www.westwing.com.br/mesa", Store.WESTWING, null, template.formatted("i".repeat(513), "Mesa"));
        assertThat(longId.productId()).isNull();
        assertThat(longId.resolution()).isEqualTo(Resolution.UNRESOLVED);
        var atLimit = extractor.extract("https://www.westwing.com.br/mesa", Store.WESTWING, null, template.formatted("i".repeat(512), "Mesa"));
        assertThat(atLimit.resolution()).isEqualTo(Resolution.RESOLVED);
    }

    @Test void rejectsPricesAboveTheMaximum() {
        String template = "<script type='application/ld+json'>{\"@type\":\"Product\",\"url\":\"https://www.westwing.com.br/mesa\",\"productID\":\"p1\",\"name\":\"Mesa\",\"image\":\"https://cdn.example.com/photo.jpg\",\"offers\":{\"price\":\"%s\",\"priceCurrency\":\"BRL\"}}</script>";
        assertThat(extractor.extract("https://www.westwing.com.br/mesa", Store.WESTWING, null, template.formatted("9999999999.99")).unitPrice()).isEqualByComparingTo("9999999999.99");
        assertThat(extractor.extract("https://www.westwing.com.br/mesa", Store.WESTWING, null, template.formatted("10000000000.00")).unitPrice()).isNull();
    }
}
