package br.com.fluiar.selecao.service;

import br.com.fluiar.selecao.dto.ProductImportPreview;
import br.com.fluiar.selecao.model.Store;
import br.com.fluiar.selecao.model.SyncStatus;
import br.com.fluiar.selecao.repository.ProductSyncRepository;
import br.com.fluiar.selecao.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import static org.assertj.core.api.Assertions.assertThat;

class ProductSynchronizationTest extends ApiIntegrationTest {
    @Autowired ProductSyncRepository jobs;
    @Autowired ProductSyncService sync;
    @Autowired ProductSyncWorker worker;
    @Autowired org.springframework.transaction.support.TransactionTemplate transactions;
    private record Fixture(UUID list, UUID product) {}
    private Fixture linked(Instant now) {
        org.mockito.Mockito.doReturn(now).when(testClock).instant();
        var admin=createAdmin("Ana","ana@test.com");
        var list=createList(admin,createClient(admin,"Cliente"),"Lista");
        var product=createProduct(admin,list,createRoom(admin,list,"Sala"),"Antigo");
        jdbc.update("""
                update products set source_url='https://moveca.com.br/products/chair',store='moveca',
                store_product_id='chair',sync_enabled=true,binding_version=?,sync_status='pending',next_attempt_at=?
                where id=?
                """,UUID.randomUUID(),Timestamp.from(now),product);
        jdbc.update("update list_human_activity set last_human_activity_at=? where list_id=?",Timestamp.from(now),list);
        return new Fixture(list,product);
    }
    private ProductImportPreview preview(String name,BigDecimal price) {
        return new ProductImportPreview("https://moveca.com.br/products/chair","moveca","chair",null,List.of(),
                name,price,"https://cdn.moveca.com.br/chair.png",ProductImportPreview.Resolution.RESOLVED);
    }
    @Test void manualEditDuringCollectionInvalidatesTheCollectedResult() {
        Instant now=Instant.now(); var fixture=linked(now);
        org.mockito.Mockito.when(storeCollector.preview(org.mockito.ArgumentMatchers.anyString(),org.mockito.ArgumentMatchers.isNull()))
                .thenAnswer(invocation -> {
                    jdbc.update("update products set name='Manual',sync_enabled=false,binding_version=? where id=?",UUID.randomUUID(),fixture.product());
                    return preview("Novo",BigDecimal.TEN);
                });
        org.mockito.Mockito.when(storeCollector.downloadImage(org.mockito.ArgumentMatchers.anyString()))
                .thenReturn(new StoreProductCollector.DownloadedImage(new byte[]{1},"image/png"));
        worker.synchronizeStore(Store.MOVECA);
        assertThat(jdbc.queryForObject("select name from products where id=?",String.class,fixture.product())).isEqualTo("Manual");
        assertThat(jdbc.queryForObject("select count(*) from product_images where product_id=?",Integer.class,fixture.product())).isZero();
    }
    @Test void failedPhotoDownloadStillPersistsValidFieldsAsPartial() {
        Instant now=Instant.now(); var fixture=linked(now);
        org.mockito.Mockito.when(storeCollector.preview(org.mockito.ArgumentMatchers.anyString(),org.mockito.ArgumentMatchers.isNull()))
                .thenReturn(preview("Novo",BigDecimal.TEN));
        org.mockito.Mockito.when(storeCollector.downloadImage(org.mockito.ArgumentMatchers.anyString()))
                .thenThrow(br.com.fluiar.selecao.exception.ApiException.invalidImage());
        worker.synchronizeStore(Store.MOVECA);
        assertThat(jdbc.queryForObject("select name from products where id=?",String.class,fixture.product())).isEqualTo("Novo");
        assertThat(jdbc.queryForObject("select sync_status from products where id=?",String.class,fixture.product())).isEqualTo("partial");
    }
    @Test void productLockedByHumanWriteIsSkippedByClaims() {
        Instant now=Instant.now();var fixture=linked(now);
        try (var executor=Executors.newSingleThreadExecutor()) {
            transactions.executeWithoutResult(status -> {
                jdbc.queryForObject("select id from products where id=? for update",UUID.class,fixture.product());
                try { assertThat(executor.submit(()->jobs.claim("moveca",now,5)).get(5,TimeUnit.SECONDS)).isEmpty(); }
                catch(Exception failure) { throw new RuntimeException(failure); }
            });
        }
        assertThat(jobs.claim("moveca",now,5)).hasSize(1);
    }
    @Test void recoveredLeaseRejectsOriginalResult() {
        Instant now=Instant.now();linked(now);
        var original=jobs.claim("moveca",now,5).getFirst();
        var recovered=jobs.claim("moveca",now.plusSeconds(600),5).getFirst();
        org.mockito.Mockito.doReturn(now.plusSeconds(600)).when(testClock).instant();
        assertThat(sync.apply(original,preview("Antigo resultado",BigDecimal.TEN),null)).isEqualTo(SyncStatus.DISCARDED);
        assertThat(sync.apply(recovered,preview("Novo",BigDecimal.TEN),null)).isEqualTo(SyncStatus.PARTIAL);
    }
    @Test void listTransferredToAnotherClientRejectsCollectedResult() {
        Instant now=Instant.now();var fixture=linked(now);
        var claim=jobs.claim("moveca",now,5).getFirst();
        UUID client=UUID.randomUUID();
        jdbc.update("""
                insert into clients(id,office_id,name,email,phone,created_at,updated_at)
                select ?,office_id,'Outro','other@test.com','31999999999',now(),now() from clients where id=
                (select client_id from shopping_lists where id=?)
                """,client,fixture.list());
        jdbc.update("update shopping_lists set client_id=? where id=?",client,fixture.list());
        assertThat(sync.apply(claim,preview("Novo",BigDecimal.TEN),null)).isEqualTo(SyncStatus.DISCARDED);
    }
    @Test void eligiblePendingBindingIsClaimed() {
        Instant now=Instant.now(); linked(now);
        assertThat(jobs.claim("moveca",now,5)).hasSize(1);
    }
    @Test void changedImageBytesAtSameSourceReplacePrivateImage() {
        Instant now=Instant.now(); var fixture=linked(now);
        byte[] before={1,2,3}; byte[] after={4,5,6}; UUID image=UUID.randomUUID();
        jdbc.update("insert into product_images(id,product_id,content_type,data,created_at) values (?,?,?, ?,now())",
                image,fixture.product(),"image/png",before);
        var claim=jobs.claim("moveca",now,5).getFirst();
        assertThat(sync.apply(claim,preview("Novo",BigDecimal.TEN),new StoreProductCollector.DownloadedImage(after,"image/png"))).isEqualTo(SyncStatus.OK);
        assertThat(jdbc.queryForObject("select id from product_images where product_id=?",UUID.class,fixture.product())).isNotEqualTo(image);
        assertThat(jdbc.queryForObject("select data from product_images where product_id=?",byte[].class,fixture.product())).containsExactly(after);
    }
    @Test void thirtyDayBoundaryAndAttemptIntervalIncludeFailures() {
        Instant now=Instant.now();var fixture=linked(now);
        jdbc.update("update list_human_activity set last_human_activity_at=? where list_id=?",
                Timestamp.from(now.minus(Duration.ofDays(30)).minusSeconds(1)),fixture.list());
        assertThat(jobs.claim("moveca",now,5)).isEmpty();
        jdbc.update("update list_human_activity set last_human_activity_at=? where list_id=?",
                Timestamp.from(now.minus(Duration.ofDays(30))),fixture.list());
        var claim=jobs.claim("moveca",now,5).getFirst();
        assertThat(sync.apply(claim,null,null)).isEqualTo(SyncStatus.FAILED);
        assertThat(jobs.claim("moveca",now.plus(Duration.ofHours(24)).minusSeconds(1),5)).isEmpty();
        jdbc.update("update list_human_activity set last_human_activity_at=? where list_id=?",Timestamp.from(now),fixture.list());
        assertThat(jobs.claim("moveca",now.plus(Duration.ofHours(24)),5)).hasSize(1);
    }
    @Test void simultaneousClaimsAreExclusiveAndExpiredLeaseCanBeRecovered() throws Exception {
        Instant now=Instant.now();linked(now);
        try(var executor=Executors.newFixedThreadPool(2)) {
            var first=executor.submit(()->jobs.claim("moveca",now,5));
            var second=executor.submit(()->jobs.claim("moveca",now,5));
            assertThat(first.get(10,TimeUnit.SECONDS).size()+second.get(10,TimeUnit.SECONDS).size()).isEqualTo(1);
        }
        assertThat(jobs.claim("moveca",now.plusSeconds(599),5)).isEmpty();
        assertThat(jobs.claim("moveca",now.plusSeconds(600),5)).hasSize(1);
    }
    @Test void boughtAndManualProductsAreExcluded() {
        Instant now=Instant.now();var fixture=linked(now);
        jdbc.update("update products set bought=true where id=?",fixture.product());
        assertThat(jobs.claim("moveca",now,5)).isEmpty();
        jdbc.update("update products set bought=false,sync_enabled=false where id=?",fixture.product());
        assertThat(jobs.claim("moveca",now,5)).isEmpty();
        jdbc.update("update products set sync_enabled=true where id=?",fixture.product());
        assertThat(jobs.claim("moveca",now,5)).hasSize(1);
    }
    @Test void partialResultPreservesInvalidFieldsAndHumanActivity() {
        Instant now=Instant.now();var fixture=linked(now);
        jdbc.update("update products set unit_price=50 where id=?",fixture.product());
        UUID image=UUID.randomUUID();byte[] original={1,2,3};
        jdbc.update("insert into product_images(id,product_id,content_type,data,created_at) values (?,?,?, ?,now())",
                image,fixture.product(),"image/png",original);
        var claim=jobs.claim("moveca",now,5).getFirst();
        assertThat(sync.apply(claim,preview("Novo",null),null)).isEqualTo(SyncStatus.PARTIAL);
        assertThat(jdbc.queryForObject("select name from products where id=?",String.class,fixture.product())).isEqualTo("Novo");
        assertThat(jdbc.queryForObject("select unit_price from products where id=?",BigDecimal.class,fixture.product())).isEqualByComparingTo("50");
        assertThat(jdbc.queryForObject("select id from product_images where product_id=?",UUID.class,fixture.product())).isEqualTo(image);
        assertThat(jdbc.queryForObject("select last_human_activity_at from list_human_activity where list_id=?",Timestamp.class,fixture.list()).toInstant())
                .isCloseTo(now,org.assertj.core.api.Assertions.within(1,java.time.temporal.ChronoUnit.MILLIS));
        assertThat(jdbc.queryForObject("select last_synced_at from products where id=?",Timestamp.class,fixture.product())).isNull();
    }
    @Test void purchaseDuringCollectionRejectsCollectedResult() {
        Instant now=Instant.now();var fixture=linked(now);
        var claim=jobs.claim("moveca",now,5).getFirst();
        jdbc.update("update products set bought=true where id=?",fixture.product());
        assertThat(sync.apply(claim,preview("Novo",BigDecimal.TEN),null)).isEqualTo(SyncStatus.DISCARDED);
        assertThat(jdbc.queryForObject("select name from products where id=?",String.class,fixture.product())).isEqualTo("Antigo");
    }
    @Test void replacementBindingRejectsCollectedResult() {
        Instant now=Instant.now();var fixture=linked(now);
        var claim=jobs.claim("moveca",now,5).getFirst();
        jdbc.update("update products set binding_version=? where id=?",UUID.randomUUID(),fixture.product());
        assertThat(sync.apply(claim,preview("Novo",BigDecimal.TEN),null)).isEqualTo(SyncStatus.DISCARDED);
        assertThat(jdbc.queryForObject("select name from products where id=?",String.class,fixture.product())).isEqualTo("Antigo");
    }
    @Test void deletedProductIsNeverRecreatedByCollectedResult() {
        Instant now=Instant.now();var fixture=linked(now);
        var claim=jobs.claim("moveca",now,5).getFirst();
        jdbc.update("delete from products where id=?",fixture.product());
        assertThat(sync.apply(claim,preview("Novo",BigDecimal.TEN),null)).isEqualTo(SyncStatus.DISCARDED);
        assertThat(jdbc.queryForObject("select count(*) from products where id=?",Integer.class,fixture.product())).isZero();
    }
    @Test void activityExpiringDuringCollectionRejectsCollectedResult() {
        Instant now=Instant.now();var fixture=linked(now);
        var claim=jobs.claim("moveca",now,5).getFirst();
        jdbc.update("update list_human_activity set last_human_activity_at=? where list_id=?",Timestamp.from(now.minus(Duration.ofDays(30)).minusSeconds(1)),fixture.list());
        assertThat(sync.apply(claim,preview("Novo",BigDecimal.TEN),null)).isEqualTo(SyncStatus.DISCARDED);
        assertThat(jdbc.queryForObject("select name from products where id=?",String.class,fixture.product())).isEqualTo("Antigo");
    }
    @Test void identicalImageBytesPreserveImageIdentityAndSuccessfulSyncTimeAdvances() {
        Instant now=Instant.now();var fixture=linked(now);
        byte[] bytes={1,2,3};UUID image=UUID.randomUUID();
        jdbc.update("insert into product_images(id,product_id,content_type,data,created_at) values (?,?,?, ?,now())",
                image,fixture.product(),"image/png",bytes);
        var claim=jobs.claim("moveca",now,5).getFirst();
        assertThat(sync.apply(claim,preview("Novo",BigDecimal.TEN),new StoreProductCollector.DownloadedImage(bytes,"image/png"))).isEqualTo(SyncStatus.OK);
        assertThat(jdbc.queryForObject("select id from product_images where product_id=?",UUID.class,fixture.product())).isEqualTo(image);
        assertThat(jdbc.queryForObject("select last_synced_at from products where id=?",Timestamp.class,fixture.product())).isNotNull();
    }
}
