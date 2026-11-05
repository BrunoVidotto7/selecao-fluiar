package br.com.fluiar.selecao.dto;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
public record ProductImportRequest(@NotBlank @Size(max=2048) String url, @Size(max=512) String variantId) {
    public ProductImportRequest { url=Inputs.text(url); variantId=Inputs.optionalText(variantId); }
}
