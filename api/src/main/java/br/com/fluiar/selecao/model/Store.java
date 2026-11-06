package br.com.fluiar.selecao.model;

import java.util.Arrays;

/** Supported retailers. The id is the value stored in products.store and returned by the API. */
public enum Store {
    MOVECA("moveca", "moveca.com.br"),
    FONTE_DO_SOFA("fonte-do-sofa", "fontedosofa.com.br"),
    WESTWING("westwing", "westwing.com.br"),
    ABRA_CASA("abra-casa", "abracasa.com.br"),
    CASAVEE("casavee", "casavee.com.br");

    private final String id;
    private final String host;

    Store(String id, String host) {
        this.id = id;
        this.host = host;
    }

    public String id() { return id; }

    public static Store ofHost(String host) {
        return Arrays.stream(values()).filter(store -> store.host.equals(host)).findFirst().orElse(null);
    }
}
