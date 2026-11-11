package br.com.fluiar.selecao.dto;

import br.com.fluiar.selecao.exception.ErrorMessages;
import br.com.fluiar.selecao.model.ProjectInfo;
import br.com.fluiar.selecao.model.ShoppingList;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

public record ShoppingListRequest(
        @NotBlank @Size(max = ShoppingList.NAME_MAX_LENGTH) String name,
        @Size(max = ShoppingList.DESCRIPTION_MAX_LENGTH) String description,
        @NotNull(message = ErrorMessages.LIST_CLIENT_REQUIRED) UUID clientId,
        @NotNull List<@NotNull @Valid ListMemberRequest> members,
        @Size(max = ProjectInfo.PROJECT_CODE_MAX_LENGTH) String projectCode,
        @Size(max = ProjectInfo.CONTRACT_MAX_LENGTH) String contract,
        @Size(max = ProjectInfo.CONTRACTOR_NAME_MAX_LENGTH) String contractorName,
        @ValidTaxDocument String contractorDocument,
        @Pattern(regexp = ProjectInfo.SITE_ZIP_CODE_PATTERN, message = ErrorMessages.ZIP_CODE_INVALID) String siteZipCode,
        @Size(max = ProjectInfo.SITE_ADDRESS_MAX_LENGTH) String siteAddress) {

    public ShoppingListRequest {
        name = Inputs.text(name);
        description = Inputs.optionalText(description);
        projectCode = Inputs.optionalText(projectCode);
        contract = Inputs.optionalText(contract);
        contractorName = Inputs.optionalText(contractorName);
        contractorDocument = Inputs.compactCode(contractorDocument);
        siteZipCode = Inputs.compactCode(siteZipCode);
        siteAddress = Inputs.optionalText(siteAddress);
    }

    public ProjectInfo projectInfo() {
        return new ProjectInfo(projectCode, contract, contractorName, contractorDocument, siteZipCode, siteAddress);
    }
}
