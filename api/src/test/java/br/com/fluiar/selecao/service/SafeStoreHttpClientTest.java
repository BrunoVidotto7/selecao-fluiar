package br.com.fluiar.selecao.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import java.net.InetAddress;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class SafeStoreHttpClientTest {
    @Test void rejectsCredentialsPortsPlainHttpAndUnsupportedStores() {
        for (String url : new String[] {"http://moveca.com.br/a", "https://user:pass@moveca.com.br/a", "https://moveca.com.br:444/a", "https://moveca.com.br.evil.test/a", "https://127.0.0.1/a"}) {
            assertThatThrownBy(() -> SafeStoreHttpClient.store(url)).as(url).isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Test void blocksPrivateAndReservedIpv4AndIpv6() throws Exception {
        for (String ip : new String[] {"127.0.0.1", "10.0.0.1", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "192.0.2.5", "198.18.0.1", "198.51.100.4", "203.0.113.1", "::1", "fc00::1", "fe80::1", "2001:db8::1", "2002:7f00:1::", "::ffff:127.0.0.1"}) {
            assertThat(SafeStoreHttpClient.publicAddress(InetAddress.getByName(ip))).as(ip).isFalse();
        }
        assertThat(SafeStoreHttpClient.publicAddress(InetAddress.getByName("8.8.8.8"))).isTrue();
        assertThat(SafeStoreHttpClient.publicAddress(InetAddress.getByName("2606:4700:4700::1111"))).isTrue();
    }

    @Test void pinsTheValidatedAddressAndValidatesRedirectDnsBeforeConnecting() throws Exception {
        var publicIp = InetAddress.getByName("8.8.8.8");
        var privateIp = InetAddress.getByName("127.0.0.1");
        AtomicInteger calls = new AtomicInteger();
        SafeStoreHttpClient client = new SafeStoreHttpClient(host -> new InetAddress[] {host.equals("cdn.example.com") ? privateIp : publicIp}, (uri, address, maxBytes, deadline) -> {
            calls.incrementAndGet();
            assertThat(address).isEqualTo(publicIp);
            return new SafeStoreHttpClient.Response(302, Map.of("location", "https://cdn.example.com/image.jpg"), new byte[0]);
        });
        assertThatThrownBy(() -> client.get("https://moveca.com.br/a", false, 1024)).isInstanceOf(java.io.IOException.class);
        assertThat(calls).hasValue(1);
    }

    @Test void rejectsRedirectOutsidePageAllowlistAndBoundsRedirectsAndBytes() throws Exception {
        var ip = InetAddress.getByName("8.8.8.8");
        AtomicInteger calls = new AtomicInteger();
        SafeStoreHttpClient client = new SafeStoreHttpClient(host -> new InetAddress[] {ip}, (uri, address, maxBytes, deadline) -> {
            calls.incrementAndGet();
            return new SafeStoreHttpClient.Response(302, Map.of("location", "https://moveca.com.br/loop"), new byte[0]);
        });
        assertThatThrownBy(() -> client.get("https://moveca.com.br/a", true, 10)).isInstanceOf(java.io.IOException.class);
        assertThat(calls.get()).isLessThanOrEqualTo(4);
        SafeStoreHttpClient oversized = new SafeStoreHttpClient(host -> new InetAddress[] {ip}, (uri, address, maxBytes, deadline) -> new SafeStoreHttpClient.Response(200, Map.of(), new byte[11]));
        assertThatThrownBy(() -> oversized.get("https://moveca.com.br/a", true, 10)).isInstanceOf(java.io.IOException.class);
        SafeStoreHttpClient outside = new SafeStoreHttpClient(host -> new InetAddress[] {ip}, (uri, address, maxBytes, deadline) -> new SafeStoreHttpClient.Response(302, Map.of("location", "https://evil.example/a"), new byte[0]));
        assertThatThrownBy(() -> outside.get("https://moveca.com.br/a", true, 10)).isInstanceOf(java.io.IOException.class);
    }
    @Test void enforcesLimitsDuringChunkedFixedAndConnectionClosedReads() throws Exception {
        for (String raw : new String[] {
                "HTTP/1.1 200 OK\r\nContent-Length: 11\r\n\r\nabcdefghijk",
                "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n6\r\nabcdef\r\n6\r\nghijkl\r\n0\r\n\r\n",
                "HTTP/1.1 200 OK\r\n\r\nabcdefghijk",
                "HTTP/1.1 200 OK\r\nContent-Length: 5\r\n\r\nab",
                "HTTP/1.1 200 OK\r\nContent-Length: 1\r\nContent-Length: 2\r\n\r\na",
                "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\nContent-Length: 1\r\n\r\na",
                "HTTP/1.1 200 OK\r\nContent-Encoding: gzip\r\n\r\na",
                "HTTP/1.1 200 OK\r\nX-Large: " + "x".repeat(65536) + "\r\n\r\n"}) {
            assertThatThrownBy(() -> SafeStoreHttpClient.readResponse(new java.io.ByteArrayInputStream(raw.getBytes(java.nio.charset.StandardCharsets.US_ASCII)), 10)).isInstanceOf(java.io.IOException.class);
        }
        String raw = "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n3\r\nabc\r\n2\r\nde\r\n0\r\n\r\n";
        assertThat(SafeStoreHttpClient.readResponse(new java.io.ByteArrayInputStream(raw.getBytes(java.nio.charset.StandardCharsets.US_ASCII)), 10).body()).isEqualTo("abcde".getBytes());
    }

    @Test void rejectsMixedPublicAndPrivateDnsWithoutConnecting() throws Exception {
        var pub = InetAddress.getByName("8.8.8.8");
        var local = InetAddress.getByName("10.0.0.1");
        AtomicInteger calls = new AtomicInteger();
        SafeStoreHttpClient client = new SafeStoreHttpClient(host -> new InetAddress[] {pub, local}, (uri, address, limit, deadline) -> {
            calls.incrementAndGet();
            return new SafeStoreHttpClient.Response(200, Map.of(), new byte[0]);
        });
        assertThatThrownBy(() -> client.get("https://moveca.com.br/a", true, 10)).isInstanceOf(java.io.IOException.class);
        assertThat(calls).hasValue(0);
    }

    @Test void acceptsRepeatedMetadataWithoutForwardingCookiesOrLosingFramingValidation() throws Exception {
        String raw = "HTTP/1.1 200 OK\r\nSet-Cookie: first=a\r\nSet-Cookie: second=b\r\nLink: </a>; rel=preload\r\nLink: </b>; rel=preload\r\nContent-Length: 3\r\n\r\nabc";
        org.assertj.core.api.Assertions.assertThatCode(() -> {
            var response = SafeStoreHttpClient.readResponse(new java.io.ByteArrayInputStream(raw.getBytes(java.nio.charset.StandardCharsets.US_ASCII)), 10);
            assertThat(response.body()).isEqualTo("abc".getBytes());
            assertThat(response.headers()).doesNotContainKey("set-cookie");
        }).doesNotThrowAnyException();
    }

}
