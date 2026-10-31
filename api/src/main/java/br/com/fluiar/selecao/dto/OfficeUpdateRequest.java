package br.com.fluiar.selecao.dto;

import br.com.fluiar.selecao.model.Office;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record OfficeUpdateRequest(@NotBlank @Size(max = Office.NAME_MAX_LENGTH) String name) {

    public OfficeUpdateRequest {
        name = Inputs.text(name);
    }
}
