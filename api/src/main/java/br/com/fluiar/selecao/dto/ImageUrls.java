package br.com.fluiar.selecao.dto;

import java.util.UUID;

/** Image URLs are API paths; reading one needs an authorized account, so the Next.js proxy adds the bearer header. */
public final class ImageUrls {

    public static final String IMAGE_PATH = "/api/images/";

    private ImageUrls() {
    }

    /** Returns null for a product without an image. */
    public static String of(UUID imageId) {
        return imageId == null ? null : IMAGE_PATH + imageId;
    }
}
