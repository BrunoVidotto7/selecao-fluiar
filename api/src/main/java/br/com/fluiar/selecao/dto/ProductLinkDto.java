package br.com.fluiar.selecao.dto;

import br.com.fluiar.selecao.exception.ErrorMessages;
import br.com.fluiar.selecao.model.ProductLink;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ProductLinkDto(
        @NotNull @Size(max = ProductLink.URL_MAX_LENGTH)
        @Pattern(regexp = Inputs.URL_PATTERN, message = ErrorMessages.LINK_URL_INVALID) String url,
        @Size(max = ProductLink.NOTE_MAX_LENGTH) String note) {

    public ProductLinkDto {
        url = Inputs.text(url);
        note = Inputs.optionalText(note);
    }

    public static ProductLinkDto of(ProductLink link) {
        return new ProductLinkDto(link.url(), link.note());
    }

    public ProductLink toModel() {
        return new ProductLink(url, note);
    }
}
