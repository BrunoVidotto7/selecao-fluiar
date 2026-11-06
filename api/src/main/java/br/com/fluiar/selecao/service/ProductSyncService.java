package br.com.fluiar.selecao.service;

import br.com.fluiar.selecao.dto.ProductImportPreview;
import br.com.fluiar.selecao.model.Product;
import br.com.fluiar.selecao.model.SyncStatus;
import br.com.fluiar.selecao.repository.*;
import java.time.Clock;
import java.math.BigDecimal;
import java.util.Objects;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly=true)
public class ProductSyncService {
    private final ShoppingListRepository lists;
    private final ProductRepository products;
    private final ListActivityRepository activity;
    private final StoreBindingService bindings;
    private final Clock clock;
    public ProductSyncService(ShoppingListRepository lists, ProductRepository products,
            ListActivityRepository activity, StoreBindingService bindings, Clock clock) {
        this.lists=lists; this.products=products; this.activity=activity; this.bindings=bindings; this.clock=clock;
    }

    @Transactional
    public SyncStatus apply(ProductSyncRepository.Claim claim, ProductImportPreview preview,
            StoreProductCollector.DownloadedImage image) {
        var list=lists.findInOfficeForUpdate(claim.listId(),claim.officeId()).orElse(null);
        if (list==null || !list.getClient().getId().equals(claim.clientId())) return SyncStatus.DISCARDED;
        Product product=products.findInOfficeForUpdate(claim.productId(),claim.officeId()).orElse(null);
        if (product==null || !product.getRoom().getList().getId().equals(claim.listId())) return SyncStatus.DISCARDED;
        var now=clock.instant();
        var sync=product.getStoreSync();
        if (sync==null || !sync.isEnabled() || !Objects.equals(sync.getBindingVersion(),claim.bindingVersion())
                || !Objects.equals(sync.getLeaseToken(),claim.leaseToken()) || sync.getLeaseExpiresAt()==null
                || !sync.getLeaseExpiresAt().isAfter(now)) return SyncStatus.DISCARDED;
        if (product.isBought() || !activity.active(claim.listId(),now.minus(ProductSyncRepository.ACTIVITY_WINDOW))) {
            sync.finish(SyncStatus.FAILED,now);
            return SyncStatus.DISCARDED;
        }
        boolean identity=preview!=null && Objects.equals(preview.productId(),claim.productIdentity())
                && Objects.equals(preview.variantId(),claim.variantId()) && Objects.equals(preview.store(),claim.store());
        String name=identity && validName(preview.name()) ? preview.name() : null;
        BigDecimal price=identity && validPrice(preview.unitPrice()) ? preview.unitPrice() : null;
        boolean imageValid=identity && image!=null;
        boolean changed=(name!=null && !name.equals(product.getName()))
                || (price!=null && (product.getUnitPrice()==null || price.compareTo(product.getUnitPrice())!=0));
        if (imageValid) changed |= bindings.persistImage(product,image);
        product.synchronize(name,price);
        SyncStatus result=name!=null && price!=null && imageValid ? SyncStatus.OK
                : name!=null || price!=null || imageValid ? SyncStatus.PARTIAL : SyncStatus.FAILED;
        sync.finish(result,now);
        if (changed) list.touch();
        return result;
    }

    private static boolean validName(String name) {
        return name!=null && !name.isBlank() && name.length()<=Product.NAME_MAX_LENGTH;
    }
    private static boolean validPrice(BigDecimal price) {
        return price!=null && price.signum()>=0 && price.scale()<=Product.PRICE_FRACTION_DIGITS
                && price.precision()-price.scale()<=Product.PRICE_INTEGER_DIGITS;
    }
}
