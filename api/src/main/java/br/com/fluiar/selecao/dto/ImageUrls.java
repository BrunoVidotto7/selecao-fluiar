package br.com.fluiar.selecao.dto;

import java.util.UUID;

/** Images have a public URL, because an {@code <img src>} does not send the Authorization header. */
public final class ImageUrls {

    public static final String IMAGE_PATH = "/api/images/";

    private ImageUrls() {
    }

    /** Returns null for a product without an image. */
    public static String of(UUID imageId) {
        return imageId == null ? null : IMAGE_PATH + imageId;
    }
}
