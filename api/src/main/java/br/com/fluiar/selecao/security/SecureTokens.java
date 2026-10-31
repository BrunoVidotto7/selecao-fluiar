package br.com.fluiar.selecao.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

/** Random tokens for links sent by e-mail, and the hash that the database keeps instead of the token. */
public final class SecureTokens {

    private static final int TOKEN_BYTES = 32;
    private static final String HASH_ALGORITHM = "SHA-256";
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Base64.Encoder URL_SAFE_ENCODER = Base64.getUrlEncoder().withoutPadding();

    private SecureTokens() {
    }

    public static String generate() {
        byte[] token = new byte[TOKEN_BYTES];
        RANDOM.nextBytes(token);
        return URL_SAFE_ENCODER.encodeToString(token);
    }

    public static String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance(HASH_ALGORITHM).digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            // Unreachable: every Java platform must support SHA-256.
            throw new IllegalStateException(exception);
        }
    }
}
