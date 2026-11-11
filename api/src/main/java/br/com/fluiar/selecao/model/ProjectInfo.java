package br.com.fluiar.selecao.model;

import jakarta.persistence.Embeddable;

@Embeddable
public record ProjectInfo(String projectCode, String contract, String contractorName, String contractorDocument,
        String siteZipCode, String siteAddress) {

    public static final int PROJECT_CODE_MAX_LENGTH = 40;
    public static final int CONTRACT_MAX_LENGTH = 120;
    public static final int CONTRACTOR_NAME_MAX_LENGTH = 120;
    public static final int SITE_ADDRESS_MAX_LENGTH = 300;
    public static final String SITE_ZIP_CODE_PATTERN = "^\\d{8}$";

    public static final ProjectInfo EMPTY = new ProjectInfo(null, null, null, null, null, null);
}
