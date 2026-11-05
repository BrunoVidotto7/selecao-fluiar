package br.com.fluiar.selecao.service;

import static org.assertj.core.api.Assertions.assertThat;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class StoreProductExtractorTest {
    private final StoreProductExtractor extractor = new StoreProductExtractor();

    @Test void importsAllFiveStoreSamplesWithoutSelectingRecommendations() throws IOException {
        String[][] samples = {
            {"moveca", "https://moveca.com.br/products/banqueta-ocean", "ocean", "blue", "Banqueta Ocean", "999.90"},
            {"fonte-do-sofa", "https://fontedosofa.com.br/produtos/sofa-libano/", "libano", "linen", "Sofá Líbano", "2500.00"},
            {"westwing", "https://www.westwing.com.br/p/mesa/123.html", "WW123", "", "Mesa Greyz", "750.00"},
            {"abra-casa", "https://www.abracasa.com.br/poltrona/p?skuId=2009498", "2009498", "2009498", "Poltrona Orbe", "1999.00"},
            {"casavee", "https://www.casavee.com.br/mesa-lateral", "CV123", "", "Mesa Cantik", "1099.00"}
        };
        for (String[] sample : samples) {
            String fixture = new String(getClass().getResourceAsStream("/stores/" + sample[0] + ".html").readAllBytes(), StandardCharsets.UTF_8);
            var preview = extractor.extract(sample[1], sample[0], sample[3].isEmpty() ? null : sample[3], fixture);
            assertThat(preview.productId()).as(sample[0]).isEqualTo(sample[2]);
            assertThat(preview.name()).isEqualTo(sample[4]);
            assertThat(preview.unitPrice()).isEqualByComparingTo(new BigDecimal(sample[5]));
            assertThat(preview.resolution()).isEqualTo("resolved");
        }
    }

    @Test void importsCapturedLiveExamplesWithFullRegularPriceAndExactVariant() throws IOException {
        String[][] samples = {
            {"moveca", "https://moveca.com.br/products/banqueta-ocean", "44766492360981", "2999.00"},
            {"fonte-do-sofa", "https://fontedosofa.com.br/produtos/sofa-retratil-libano-linho-ou-veludo/", "1297999119", "3240.00"},
            {"westwing", "https://www.westwing.com.br/p/mesa-de-cabeceira-greyz-castanho-e-champanhe/AP430CP46ZYQWW-1898884.html", "", "2899.00"},
            {"abra-casa", "https://www.abracasa.com.br/poltrona-orbe-giratoria-duna-botone/p?skuId=2009498", "2009498", "2199.88"},
            {"casavee", "https://www.casavee.com.br/mesa-lateral-cantik-79-5-cm-x-30-cm-mel-escuro-dourado", "", "735.29"}
        };
        for (String[] sample : samples) {
            String html = new String(getClass().getResourceAsStream("/stores/" + sample[0] + "-live.html").readAllBytes(), StandardCharsets.UTF_8);
            var preview = extractor.extract(sample[1], sample[0], sample[2].isEmpty() ? null : sample[2], html);
            assertThat(preview.unitPrice()).as(sample[0]).isEqualByComparingTo(sample[3]);
            assertThat(preview.resolution()).as(sample[0]).isEqualTo("resolved");
            if (sample[0].equals("fonte-do-sofa")) {
                assertThat(preview.imageUrl()).endsWith(".jpg");
                var unselected = extractor.extract(sample[1], sample[0], null, html);
                assertThat(unselected.resolution()).isEqualTo("variant_required");
                assertThat(unselected.variants()).hasSize(60);
            }
        }
    }

    @Test void casaveeDoesNotMistakeJsonLdPixForTheCardTotal() throws IOException {
        String html = new String(getClass().getResourceAsStream("/stores/casavee-live.html").readAllBytes(), StandardCharsets.UTF_8);
        var result = extractor.extract("https://www.casavee.com.br/mesa-lateral-cantik-79-5-cm-x-30-cm-mel-escuro-dourado", "casavee", null, html);
        assertThat(result.unitPrice()).isEqualByComparingTo("735.29");
    }

    @Test void wrongSingleSkuCannotResolve() throws IOException {
        String html = new String(getClass().getResourceAsStream("/stores/abra-casa-live.html").readAllBytes(), StandardCharsets.UTF_8);
        var result = extractor.extract("https://www.abracasa.com.br/poltrona-orbe-giratoria-duna-botone/p?skuId=999", "abra-casa", "999", html);
        assertThat(result.unitPrice()).isNull();
        assertThat(result.resolution()).isEqualTo("unresolved");
    }

    @Test void requiresExplicitVariantInsteadOfChoosingCheapest() throws IOException {
        String html = new String(getClass().getResourceAsStream("/stores/moveca.html").readAllBytes(), StandardCharsets.UTF_8);
        var result = extractor.extract("https://moveca.com.br/products/banqueta-ocean", "moveca", null, html);
        assertThat(result.resolution()).isEqualTo("variant_required");
        assertThat(result.variants()).extracting("id").containsExactly("blue", "red");
        assertThat(result.unitPrice()).isNull();
    }

    @Test void rejectsPixInstallmentsCurrenciesAndConflictingRegularPrices() {
        String template = "<script type='application/ld+json'>{\"@type\":\"Product\",\"url\":\"https://www.westwing.com.br/mesa\",\"sku\":\"123\",\"name\":\"Mesa\",\"image\":\"https://cdn.example.com/photo.jpg\",\"offers\":%s}</script>";
        String regular = "{\"price\":\"99.90\",\"priceCurrency\":\"BRL\"}";
        var control = extractor.extract("https://www.westwing.com.br/mesa", "westwing", null, template.formatted(regular));
        assertThat(control.unitPrice()).isEqualByComparingTo("99.90");
        assertThat(control.resolution()).isEqualTo("resolved");
        for (String offers : new String[] {
                "{\"price\":\"99.90\",\"priceCurrency\":\"USD\"}",
                "{\"price\":\"99.90\",\"priceCurrency\":\"BRL\",\"name\":\"Pix\"}",
                "{\"price\":\"99.90\",\"priceCurrency\":\"BRL\",\"name\":\"10 parcelas\"}",
                "[{\"price\":\"99.90\",\"priceCurrency\":\"BRL\"},{\"price\":\"100.00\",\"priceCurrency\":\"BRL\"}]"}) {
            var result = extractor.extract("https://www.westwing.com.br/mesa", "westwing", null, template.formatted(offers));
            assertThat(result.name()).isEqualTo("Mesa");
            assertThat(result.unitPrice()).isNull();
            assertThat(result.resolution()).isEqualTo("unresolved");
        }
    }

    @Test void preservesIndependentFieldsWhenPriceCannotResolveAndRejectsRecommendedOnlyPages() throws IOException {
        String html = new String(getClass().getResourceAsStream("/stores/westwing-live.html").readAllBytes(), StandardCharsets.UTF_8);
        String url = "https://www.westwing.com.br/p/mesa-de-cabeceira-greyz-castanho-e-champanhe/AP430CP46ZYQWW-1898884.html";
        var result = extractor.extract(url, "westwing", null, html.replace("\"2899.00\"", "\"10x de 289.90\""));
        assertThat(result.name()).isEqualTo("Mesa de Cabeceira Greyz Castanho e Champanhe");
        assertThat(result.imageUrl()).startsWith("https://www.westwing.com.br/");
        assertThat(result.unitPrice()).isNull();
        assertThat(result.resolution()).isEqualTo("unresolved");
        var recommended = extractor.extract("https://www.westwing.com.br/other-page", "westwing", null, html);
        assertThat(recommended.productId()).isNull();
        assertThat(recommended.name()).isNull();
    }

    @Test void readsActualStoreDataAssignmentAfterEarlierJavascriptReferences() throws IOException {
        String html = new String(getClass().getResourceAsStream("/stores/moveca-live.html").readAllBytes(), StandardCharsets.UTF_8);
        html = "<script>if(ymq_option.product.tags.includes('ymq')){other = 'value';}</script>" + html;
        var result = extractor.extract("https://moveca.com.br/products/banqueta-ocean", "moveca", null, html);
        assertThat(result.resolution()).isEqualTo("resolved");
        assertThat(result.variantId()).isEqualTo("44766492360981");
        assertThat(result.unitPrice()).isEqualByComparingTo("2999.00");
    }

}
