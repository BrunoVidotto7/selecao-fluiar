package br.com.fluiar.selecao.service;

import br.com.fluiar.selecao.dto.ImageContent;
import br.com.fluiar.selecao.dto.ImageUrls;
import br.com.fluiar.selecao.dto.ProductImageResponse;
import br.com.fluiar.selecao.exception.ApiException;
import br.com.fluiar.selecao.model.Product;
import br.com.fluiar.selecao.model.ProductImage;
import br.com.fluiar.selecao.model.ShoppingList;
import br.com.fluiar.selecao.repository.ProductImageRepository;
import br.com.fluiar.selecao.repository.UserRepository;
import br.com.fluiar.selecao.security.ListAccessPolicy;
import br.com.fluiar.selecao.repository.ProductRepository;
import br.com.fluiar.selecao.repository.ShoppingListRepository;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.Arrays;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * Every write first locks the product's list, like the room and product writes. So the image writes of a product run
 * one at a time (it keeps a single image) and take their locks in the same order as the other writes (no deadlock).
 * The product is loaded only after the lock, so a product deleted while a write waited is not found.
 */
@Service
@Transactional(readOnly = true)
public class ProductImageService {

    private static final int MAX_IMAGE_BYTES = 5 * 1024 * 1024;
    private static final byte[] JPEG_SIGNATURE = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};
    private static final byte[] PNG_SIGNATURE = {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n'};

    private final ProductImageRepository imageRepository;
    private final ProductRepository productRepository;
    private final ShoppingListRepository listRepository;
    private final UserRepository users;

    public ProductImageService(ProductImageRepository imageRepository, ProductRepository productRepository,
            ShoppingListRepository listRepository, UserRepository users) {
        this.users = users;
        this.imageRepository = imageRepository;
        this.productRepository = productRepository;
        this.listRepository = listRepository;
    }

    /**
     * The image type comes from the file's first bytes: the Content-Type sent by the browser is ignored, because anyone
     * can lie in it.
     */
    @Transactional
    public ProductImageResponse replace(UUID officeId, UUID productId, MultipartFile file) {
        ShoppingList list = lockListOfProduct(officeId, productId);
        Product product = productRepository.findInOffice(productId, officeId).orElseThrow(ApiException::notFound);

        byte[] data = readBytes(file);
        if (data.length > MAX_IMAGE_BYTES) {
            throw ApiException.imageTooLarge();
        }
        String contentType = detectContentType(data).orElseThrow(ApiException::invalidImage);

        imageRepository.deleteByProductId(product.getId());
        ProductImage image = imageRepository.save(new ProductImage(product.getId(), contentType, data));
        list.touch();

        return new ProductImageResponse(ImageUrls.of(image.getId()));
    }

    @Transactional
    public void delete(UUID officeId, UUID productId) {
        ShoppingList list = lockListOfProduct(officeId, productId);
        Product product = productRepository.findInOffice(productId, officeId).orElseThrow(ApiException::notFound);

        imageRepository.deleteByProductId(product.getId());
        list.touch();
    }

    public ImageContent load(UUID userId, UUID imageId) {
        var user = users.findById(userId).orElseThrow(ApiException::notFound);
        var product = productRepository.findByImageInOffice(imageId, user.getOfficeId()).orElseThrow(ApiException::notFound);
        if (!ListAccessPolicy.permits(user, product.getRoom().getList().getClient())) {
            throw ApiException.notFound();
        }
        return imageRepository.findById(imageId).map(ImageContent::of).orElseThrow(ApiException::notFound);
    }

    private ShoppingList lockListOfProduct(UUID officeId, UUID productId) {
        return listRepository.findByProductInOfficeForUpdate(productId, officeId).orElseThrow(ApiException::notFound);
    }

    private static byte[] readBytes(MultipartFile file) {
        try {
            return file.getBytes();
        } catch (IOException exception) {
            throw new UncheckedIOException(exception);
        }
    }

    private static Optional<String> detectContentType(byte[] data) {
        if (startsWith(data, JPEG_SIGNATURE)) {
            return Optional.of(MediaType.IMAGE_JPEG_VALUE);
        }
        if (startsWith(data, PNG_SIGNATURE)) {
            return Optional.of(MediaType.IMAGE_PNG_VALUE);
        }
        return Optional.empty();
    }

    private static boolean startsWith(byte[] data, byte[] signature) {
        return data.length >= signature.length
                && Arrays.equals(data, 0, signature.length, signature, 0, signature.length);
    }
}
