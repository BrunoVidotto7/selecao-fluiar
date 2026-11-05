package br.com.fluiar.selecao.controller;

import br.com.fluiar.selecao.dto.ProductImportPreview;
import br.com.fluiar.selecao.service.StoreProductCollector;
import br.com.fluiar.selecao.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.http.*;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class ProductStoreSyncControllerTest extends ApiIntegrationTest {
    private static final String SOURCE="https://moveca.com.br/products/chair";
    private static final String IMAGE="https://cdn.moveca.com.br/chair.png";
    private static final byte[] PNG={(byte)137,80,78,71,13,10,26,10,1};

    private void preview() {
        when(storeCollector.preview(SOURCE,null)).thenReturn(new ProductImportPreview(SOURCE,"moveca","chair",null,
                List.of(),"Cadeira",new BigDecimal("125.00"),IMAGE,"resolved"));
        when(storeCollector.downloadImage(IMAGE)).thenReturn(new StoreProductCollector.DownloadedImage(PNG,"image/png"));
    }
    @Test void bindingSavesServerImageAndOmissionPreservesWhileNullDisables() {
        preview();
        var admin=createAdmin("Ana","ana@test.com");
        var list=createList(admin,createClient(admin,"Cliente"),"Lista");
        var room=createRoom(admin,list,"Sala");
        var body=new HashMap<String,Object>(Map.of("roomId",room,"name","Cadeira","quantity",1,"unitPrice",125,
                "storeSync",Map.of("sourceUrl",SOURCE)));
        var saved=mvc.post().uri("/api/lists/{id}/products",list).header(HttpHeaders.AUTHORIZATION,bearer(admin))
                .contentType(MediaType.APPLICATION_JSON).content(json(body)).exchange();
        assertThat(saved).hasStatus(HttpStatus.CREATED);
        assertThat(enabled(saved)).isTrue();
        assertThat(readJson(saved,"$.storeSync.status")).isEqualTo("pending");
        assertThat(readJson(saved,"$.imageUrl")).startsWith("/api/images/");
        var id=UUID.fromString(readJson(saved,"$.id"));
        body.remove("storeSync"); body.put("quantity",2);
        assertThat(enabled(update(admin,id,body))).isEqualTo(true);
        body.put("storeSync",null);
        assertThat(enabled(update(admin,id,body))).isEqualTo(false);
    }
    @Test void manualNameChangeDisablesButDoesNotEraseSource() {
        preview();
        var admin=createAdmin("Ana","ana@test.com");
        var list=createList(admin,createClient(admin,"Cliente"),"Lista");
        var room=createRoom(admin,list,"Sala");
        var body=new HashMap<String,Object>(Map.of("roomId",room,"name","Cadeira","quantity",1,"unitPrice",125,
                "storeSync",Map.of("sourceUrl",SOURCE)));
        var saved=mvc.post().uri("/api/lists/{id}/products",list).header(HttpHeaders.AUTHORIZATION,bearer(admin))
                .contentType(MediaType.APPLICATION_JSON).content(json(body)).exchange();
        assertThat(saved).hasStatus(HttpStatus.CREATED);
        body.remove("storeSync");body.put("name","Minha cadeira");
        var result=update(admin,UUID.fromString(readJson(saved,"$.id")),body);
        assertThat(enabled(result)).isEqualTo(false);
        assertThat(readJson(result,"$.storeSync.sourceUrl")).isEqualTo(SOURCE);
    }
    @Test void bindingRejectsDataFromDifferentPreview() {
        preview();
        var admin=createAdmin("Ana","ana@test.com");
        var list=createList(admin,createClient(admin,"Cliente"),"Lista");
        var room=createRoom(admin,list,"Sala");
        assertThat(mvc.post().uri("/api/lists/{id}/products",list).header(HttpHeaders.AUTHORIZATION,bearer(admin))
                .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("roomId",room,"name","Outro","quantity",1,
                "unitPrice",125,"storeSync",Map.of("sourceUrl",SOURCE)))).exchange()).hasStatus(HttpStatus.BAD_REQUEST);
        verify(storeCollector,never()).downloadImage(anyString());
    }
    private boolean enabled(MvcTestResult result) {
        return jsonMapper.readTree(result.getResponse().getContentAsByteArray()).path("storeSync").path("enabled").asBoolean();
    }
    @Test void previewIsAdminOnlyAndDoesNotCreatePersistentProducts() {
        preview();
        var admin=createAdmin("Ana","ana@test.com");
        var client=createClientAccount(admin,createClient(admin,"Cliente"),"client@test.com");
        assertThat(mvc.post().uri("/api/product-imports/preview").header(HttpHeaders.AUTHORIZATION,bearer(client))
                .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("url",SOURCE))).exchange()).hasStatus(HttpStatus.FORBIDDEN);
        var result=mvc.post().uri("/api/product-imports/preview").header(HttpHeaders.AUTHORIZATION,bearer(admin))
                .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("url",SOURCE))).exchange();
        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(readJson(result,"$.resolution")).isEqualTo("resolved");
        assertThat(jdbc.queryForObject("select count(*) from products",Integer.class)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from list_human_activity",Integer.class)).isZero();
    }
    @Test void manualPhotoRemovalDisablesBinding() {
        var admin=createAdmin("Ana","ana@test.com");
        var list=createList(admin,createClient(admin,"Cliente"),"Lista");
        var product=createProduct(admin,list,createRoom(admin,list,"Sala"),"Cadeira");
        jdbc.update("update products set source_url=?,store='moveca',sync_enabled=true,binding_version=? where id=?",SOURCE,UUID.randomUUID(),product);
        assertThat(mvc.delete().uri("/api/products/{id}/image",product).header(HttpHeaders.AUTHORIZATION,bearer(admin)).exchange()).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(jdbc.queryForObject("select sync_enabled from products where id=?",Boolean.class,product)).isFalse();
    }
    private MvcTestResult update(TestSession admin,UUID id,Map<String,Object> body) {
        var result=mvc.put().uri("/api/products/{id}",id).header(HttpHeaders.AUTHORIZATION,bearer(admin))
                .contentType(MediaType.APPLICATION_JSON).content(json(body)).exchange();
        assertThat(result).hasStatus(HttpStatus.OK);return result;
    }
}
