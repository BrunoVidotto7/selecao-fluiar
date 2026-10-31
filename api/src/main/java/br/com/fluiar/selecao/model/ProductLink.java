package br.com.fluiar.selecao.model;

import jakarta.persistence.Embeddable;

@Embeddable
public record ProductLink(String url, String note) {

    public static final int URL_MAX_LENGTH = 2048;
    public static final int NOTE_MAX_LENGTH = 200;
}
