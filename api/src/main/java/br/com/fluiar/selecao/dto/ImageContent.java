package br.com.fluiar.selecao.dto;

import br.com.fluiar.selecao.model.ProductImage;

public record ImageContent(String contentType, byte[] data) {

    public static ImageContent of(ProductImage image) {
        return new ImageContent(image.getContentType(), image.getData());
    }
}
