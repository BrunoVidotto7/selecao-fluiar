package br.com.fluiar.selecao.security;

import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.UnknownHostException;

public final class ClientAddress {

    private static final int UNIQUE_LOCAL_MASK = 0xFE;
    private static final int UNIQUE_LOCAL_PREFIX = 0xFC;

    private ClientAddress() {
    }

    /**
     * A private address (loopback, site-local, link-local, IPv6 fc00::/7) means our own Next server called without a
     * forwarded browser address, so per-address limits would count every user together and must be skipped.
     */
    public static boolean isPublic(String address) {
        InetAddress inet;
        try {
            inet = InetAddress.getByName(address);
        } catch (UnknownHostException e) {
            return true;
        }
        boolean uniqueLocal = inet instanceof Inet6Address
                && (inet.getAddress()[0] & UNIQUE_LOCAL_MASK) == UNIQUE_LOCAL_PREFIX;
        return !(inet.isLoopbackAddress() || inet.isSiteLocalAddress() || inet.isLinkLocalAddress()
                || inet.isAnyLocalAddress() || uniqueLocal);
    }
}
