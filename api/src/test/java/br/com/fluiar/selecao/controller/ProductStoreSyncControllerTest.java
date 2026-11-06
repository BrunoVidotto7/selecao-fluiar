package br.com.fluiar.selecao.controller;

import br.com.fluiar.selecao.dto.ProductImportPreview;
import br.com.fluiar.selecao.exception.ApiException;
import br.com.fluiar.selecao.exception.ErrorMessages;
import br.com.fluiar.selecao.model.ProductStoreSync;
import br.com.fluiar.selecao.service.StoreProductCollector;
import br.com.fluiar.selecao.support.ApiIntegrationTest;
import com.zaxxer.hikari.HikariDataSource;
import java.math.BigDecimal;
import java.util.*;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class ProductStoreSyncControllerTest extends ApiIntegrationTest {
    private static final String SOURCE="https://moveca.com.br/products/chair";
    private static final String IMAGE="https://cdn.moveca.com.br/chair.png";
    private static final byte[] PNG={(byte)137,80,78,71,13,10,26,10,1};

    @Autowired
    private DataSource dataSource;

    private void preview() {
        when(storeCollector.preview(SOURCE,null)).thenReturn(new ProductImportPreview(SOURCE,"moveca","chair",null,
                List.of(),"Cadeira",new BigDecimal("125.00"),IMAGE,ProductImportPreview.Resolution.RESOLVED));
        when(storeCollector.downloadImage(IMAGE)).thenReturn(new StoreProductCollector.DownloadedImage(PNG,"image/png"));
    }
    @Test void bindingSavesServerImageAndOmissionPreservesWhileNullDisables() {
        preview();
        var admin=createAdmin("Ana","ana@test.com");
        var list=createList(admin,createClient(admin,"Cliente"),"Lista");
        var room=createRoom(admin,list,"Sala");
        var body=new HashMap<String,Object>(Map.of("roomId",room,"categoryId",categoryId(admin,"Outros"),"name","Cadeira","quantity",1,"unitPrice",125,
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
    @Test void manualNameChangeWithNullStoreSyncDisablesButDoesNotEraseSource() {
        preview();
        var admin=createAdmin("Ana","ana@test.com");
        var list=createList(admin,createClient(admin,"Cliente"),"Lista");
        var room=createRoom(admin,list,"Sala");
        var body=new HashMap<String,Object>(Map.of("roomId",room,"categoryId",categoryId(admin,"Outros"),"name","Cadeira","quantity",1,"unitPrice",125,
                "storeSync",Map.of("sourceUrl",SOURCE)));
        var saved=mvc.post().uri("/api/lists/{id}/products",list).header(HttpHeaders.AUTHORIZATION,bearer(admin))
                .contentType(MediaType.APPLICATION_JSON).content(json(body)).exchange();
        assertThat(saved).hasStatus(HttpStatus.CREATED);
        body.put("storeSync",null);body.put("name","Minha cadeira");
        var result=update(admin,UUID.fromString(readJson(saved,"$.id")),body);
        assertThat(enabled(result)).isEqualTo(false);
        assertThat(readJson(result,"$.storeSync.sourceUrl")).isEqualTo(SOURCE);
    }
    @Test void staleFormKeepsTheStoreValuesAndTheSync() {
        preview();
        var admin=createAdmin("Ana","ana@test.com");
        var list=createList(admin,createClient(admin,"Cliente"),"Lista");
        var body=bindBody(admin,createRoom(admin,list,"Sala"),Map.of("sourceUrl",SOURCE));
        var saved=create(admin,list,body);
        var id=UUID.fromString(readJson(saved,"$.id"));
        jdbc.update("update products set unit_price=?,name=? where id=?",new BigDecimal("140.00"),"Cadeira nova",id);
        body.remove("storeSync");body.put("notes","Entregar na sexta");
        var result=update(admin,id,body);
        assertThat(enabled(result)).isTrue();
        assertThat(readJson(result,"$.notes")).isEqualTo("Entregar na sexta");
        assertThat(readJson(result,"$.name")).isEqualTo("Cadeira nova");
        assertThat(jdbc.queryForObject("select unit_price from products where id=?",BigDecimal.class,id)).isEqualByComparingTo("140.00");
    }
    @Test void anotherOfficeCannotBindAStorePage() {
        preview();
        var admin=createAdmin("Ana","ana@test.com");
        var other=createAdmin("Bia","bia@test.com");
        var list=createList(admin,createClient(admin,"Cliente"),"Lista");
        var room=createRoom(admin,list,"Sala");
        var product=createProduct(admin,list,room,"Cadeira");
        var body=bindBody(admin,room,Map.of("sourceUrl",SOURCE));
        assertThat(mvc.post().uri("/api/lists/{id}/products",list).header(HttpHeaders.AUTHORIZATION,bearer(other))
                .contentType(MediaType.APPLICATION_JSON).content(json(body)).exchange()).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(mvc.put().uri("/api/products/{id}",product).header(HttpHeaders.AUTHORIZATION,bearer(other))
                .contentType(MediaType.APPLICATION_JSON).content(json(body)).exchange()).hasStatus(HttpStatus.NOT_FOUND);
        verify(storeCollector,never()).preview(any(),any());
    }
    @Test void bindingRejectsDataFromDifferentPreview() {
        preview();
        var admin=createAdmin("Ana","ana@test.com");
        var list=createList(admin,createClient(admin,"Cliente"),"Lista");
        var room=createRoom(admin,list,"Sala");
        assertThat(mvc.post().uri("/api/lists/{id}/products",list).header(HttpHeaders.AUTHORIZATION,bearer(admin))
                .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("roomId",room,"categoryId",categoryId(admin,"Outros"),"name","Outro","quantity",1,
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
    /** The store fetch can take seconds, so it must not hold a pooled connection that other requests need. */
    @Test void storeFetchHoldsNoTransactionOrConnection() {
        List<String> stateDuringFetch=new ArrayList<>();
        when(storeCollector.preview(SOURCE,null)).thenAnswer(invocation -> {
            stateDuringFetch.add(TransactionSynchronizationManager.isActualTransactionActive()+" "
                    +((HikariDataSource)dataSource).getHikariPoolMXBean().getActiveConnections());
            return new ProductImportPreview(SOURCE,"moveca","chair",null,List.of(),"Cadeira",new BigDecimal("125.00"),IMAGE,ProductImportPreview.Resolution.RESOLVED);
        });
        when(storeCollector.downloadImage(IMAGE)).thenReturn(new StoreProductCollector.DownloadedImage(PNG,"image/png"));
        var admin=createAdmin("Ana","ana@test.com");
        var list=createList(admin,createClient(admin,"Cliente"),"Lista");
        var body=bindBody(admin,createRoom(admin,list,"Sala"),Map.of("sourceUrl",SOURCE));
        var saved=create(admin,list,body);
        assertThat(saved).hasStatus(HttpStatus.CREATED);
        update(admin,UUID.fromString(readJson(saved,"$.id")),body);
        assertThat(stateDuringFetch).containsExactly("false 0","false 0");
    }
    @Test void malformedStoreSyncIsAFieldError() {
        var admin=createAdmin("Ana","ana@test.com");
        var list=createList(admin,createClient(admin,"Cliente"),"Lista");
        var room=createRoom(admin,list,"Sala");
        for (Object storeSync : List.of("texto",5,List.of(SOURCE),Map.of(),Map.of("sourceUrl",5),Map.of("sourceUrl",SOURCE,"variantId",5))) {
            var result=create(admin,list,bindBody(admin,room,storeSync));
            assertThat(result).as("storeSync %s",storeSync).hasStatus(HttpStatus.BAD_REQUEST);
            assertThat(readJson(result,"$.errors.storeSync")).isEqualTo(ErrorMessages.PRODUCT_STORE_SYNC_MISMATCH);
        }
        verify(storeCollector,never()).preview(any(),any());
        assertThat(jdbc.queryForObject("select count(*) from products",Integer.class)).isZero();
    }
    @Test void storeSyncOverColumnSizesIsAFieldError() {
        when(storeCollector.preview(anyString(),any())).thenAnswer(invocation -> new ProductImportPreview(invocation.getArgument(0),"moveca","chair",
                invocation.getArgument(1),List.of(),"Cadeira",new BigDecimal("125.00"),IMAGE,ProductImportPreview.Resolution.RESOLVED));
        when(storeCollector.downloadImage(IMAGE)).thenReturn(new StoreProductCollector.DownloadedImage(PNG,"image/png"));
        var admin=createAdmin("Ana","ana@test.com");
        var list=createList(admin,createClient(admin,"Cliente"),"Lista");
        var room=createRoom(admin,list,"Sala");
        String longUrl=SOURCE+"?q="+"a".repeat(ProductStoreSync.SOURCE_URL_MAX_LENGTH);
        for (Map<String,Object> storeSync : List.<Map<String,Object>>of(Map.of("sourceUrl",longUrl),
                Map.of("sourceUrl",SOURCE,"variantId","v".repeat(ProductStoreSync.VARIANT_ID_MAX_LENGTH+1)))) {
            var result=create(admin,list,bindBody(admin,room,storeSync));
            assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
            assertThat(readJson(result,"$.errors.storeSync")).isEqualTo(ErrorMessages.PRODUCT_STORE_SYNC_MISMATCH);
        }
        assertThat(jdbc.queryForObject("select count(*) from products",Integer.class)).isZero();
    }
    @Test void unresolvedPreviewOrDifferentPriceIsRejected() {
        when(storeCollector.preview(SOURCE,null)).thenReturn(new ProductImportPreview(SOURCE,"moveca","chair",null,List.of(),"Cadeira",
                new BigDecimal("125.00"),IMAGE,ProductImportPreview.Resolution.UNRESOLVED));
        var admin=createAdmin("Ana","ana@test.com");
        var list=createList(admin,createClient(admin,"Cliente"),"Lista");
        var room=createRoom(admin,list,"Sala");
        var unresolved=create(admin,list,bindBody(admin,room,Map.of("sourceUrl",SOURCE)));
        assertThat(unresolved).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(readJson(unresolved,"$.errors.storeSync")).isEqualTo(ErrorMessages.PRODUCT_STORE_SYNC_MISMATCH);
        preview();
        var body=bindBody(admin,room,Map.of("sourceUrl",SOURCE));
        body.put("unitPrice",130);
        var otherPrice=create(admin,list,body);
        assertThat(otherPrice).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(readJson(otherPrice,"$.errors.storeSync")).isEqualTo(ErrorMessages.PRODUCT_STORE_SYNC_MISMATCH);
        verify(storeCollector,never()).downloadImage(anyString());
        assertThat(jdbc.queryForObject("select count(*) from products",Integer.class)).isZero();
    }
    @Test void storePageThatCannotBeReadIsAnUrlError() {
        when(storeCollector.preview(SOURCE,null)).thenThrow(ApiException.invalidField("url",ErrorMessages.PRODUCT_COLLECTION_FAILED));
        var admin=createAdmin("Ana","ana@test.com");
        var list=createList(admin,createClient(admin,"Cliente"),"Lista");
        var result=create(admin,list,bindBody(admin,createRoom(admin,list,"Sala"),Map.of("sourceUrl",SOURCE)));
        assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(readJson(result,"$.errors.url")).isEqualTo(ErrorMessages.PRODUCT_COLLECTION_FAILED);
        assertThat(jdbc.queryForObject("select count(*) from products",Integer.class)).isZero();
    }
    private Map<String,Object> bindBody(TestSession admin,UUID room,Object storeSync) {
        return new HashMap<>(Map.of("roomId",room,"categoryId",categoryId(admin,"Outros"),"name","Cadeira","quantity",1,"unitPrice",125,
                "storeSync",storeSync));
    }
    private MvcTestResult create(TestSession admin,UUID list,Map<String,Object> body) {
        return mvc.post().uri("/api/lists/{id}/products",list).header(HttpHeaders.AUTHORIZATION,bearer(admin))
                .contentType(MediaType.APPLICATION_JSON).content(json(body)).exchange();
    }
    private MvcTestResult update(TestSession admin,UUID id,Map<String,Object> body) {
        var result=mvc.put().uri("/api/products/{id}",id).header(HttpHeaders.AUTHORIZATION,bearer(admin))
                .contentType(MediaType.APPLICATION_JSON).content(json(body)).exchange();
        assertThat(result).hasStatus(HttpStatus.OK);return result;
    }
}
