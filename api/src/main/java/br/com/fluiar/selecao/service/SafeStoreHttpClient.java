package br.com.fluiar.selecao.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.function.Function;
import javax.net.ssl.SNIHostName;
import javax.net.ssl.SSLParameters;
import javax.net.ssl.SSLSocket;
import javax.net.ssl.SSLSocketFactory;
import org.springframework.stereotype.Component;

@Component
public class SafeStoreHttpClient {
    private static final int MAX_URL_LENGTH = 4096;
    private static final int MAX_REDIRECTS = 3;
    private static final int MAX_HEADER_BYTES = 64 * 1024;
    private static final int CONNECT_TIMEOUT_MS = 3000;
    private static final int REQUEST_TIMEOUT_MS = 15000;
    private static final ScheduledExecutorService DEADLINES = Executors.newSingleThreadScheduledExecutor(Thread.ofPlatform().daemon().name("store-http-deadlines").factory());
    private static final Map<String, String> STORES = Map.of("moveca.com.br", "moveca", "fontedosofa.com.br", "fonte-do-sofa", "westwing.com.br", "westwing", "abracasa.com.br", "abra-casa", "casavee.com.br", "casavee");

    record Response(int status, Map<String, String> headers, byte[] body, String finalUrl) {
        Response(int status, Map<String, String> headers, byte[] body) { this(status, headers, body, null); }
    }
    @FunctionalInterface interface Exchange { Response get(URI uri, InetAddress address, int maxBytes, long deadline) throws IOException; }
    private final Function<String, InetAddress[]> resolver;
    private final Exchange exchange;

    public SafeStoreHttpClient() {
        this(SafeStoreHttpClient::resolve, SafeStoreHttpClient::exchangePinned);
    }

    SafeStoreHttpClient(Function<String, InetAddress[]> resolver, Exchange exchange) {
        this.resolver = resolver;
        this.exchange = exchange;
    }

    static URI validatedUri(String url) {
        if (url == null || url.length() > MAX_URL_LENGTH || url.chars().anyMatch(c -> c <= 32 || c >= 127)) throw new IllegalArgumentException("Invalid destination");
        URI uri = URI.create(url);
        if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null
                || (uri.getPort() != -1 && uri.getPort() != 443) || uri.getHost().contains("%") || uri.getRawFragment() != null) throw new IllegalArgumentException("Invalid destination");
        return uri;
    }

    static String store(String url) {
        String host = validatedUri(url).getHost().toLowerCase(Locale.ROOT).replaceFirst("^www\\.", "");
        String store = STORES.get(host);
        if (store == null) throw new IllegalArgumentException("Unsupported store");
        return store;
    }

    void validateImageDestination(String url) throws IOException {
        URI uri = validatedUri(url);
        resolvePublic(uri.getHost(), System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(CONNECT_TIMEOUT_MS));
    }

    Response get(String url, boolean page, int maxBytes) throws IOException {
        long deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(REQUEST_TIMEOUT_MS);
        URI uri;
        try { uri = validatedUri(url); } catch (IllegalArgumentException exception) { throw new IOException("Invalid destination"); }
        for (int redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
            if (page) {
                try { store(uri.toString()); } catch (IllegalArgumentException exception) { throw new IOException("Unsupported store"); }
            }
            InetAddress address = resolvePublic(uri.getHost(), deadline);
            Response response = exchange.get(uri, address, maxBytes, deadline);
            if (response.body().length > maxBytes || System.nanoTime() >= deadline) throw new IOException("Collection limit exceeded");
            if (List.of(301, 302, 303, 307, 308).contains(response.status())) {
                String location = response.headers().get("location");
                if (location == null) throw new IOException("Invalid redirect");
                try { uri = validatedUri(uri.resolve(location).toString()); } catch (IllegalArgumentException exception) { throw new IOException("Invalid redirect"); }
                continue;
            }
            if (response.status() != 200) throw new IOException("Store unavailable");
            return new Response(response.status(), response.headers(), response.body(), uri.toString());
        }
        throw new IOException("Too many redirects");
    }

    private InetAddress resolvePublic(String host, long deadline) throws IOException {
        var task = java.util.concurrent.CompletableFuture.supplyAsync(() -> resolver.apply(host), command -> Thread.ofVirtual().start(command));
        try {
            long remaining = Math.min(TimeUnit.MILLISECONDS.toNanos(CONNECT_TIMEOUT_MS), deadline - System.nanoTime());
            if (remaining <= 0) throw new IOException("Collection timeout");
            InetAddress[] addresses = task.get(remaining, TimeUnit.NANOSECONDS);
            if (addresses == null || addresses.length == 0) throw new IOException("Unresolved destination");
            for (InetAddress address : addresses) if (!publicAddress(address)) throw new IOException("Non-public destination");
            return addresses[0];
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IOException("Collection interrupted");
        } catch (java.util.concurrent.ExecutionException | java.util.concurrent.TimeoutException exception) {
            throw new IOException("Unresolved destination");
        } finally { task.cancel(true); }
    }

    private static InetAddress[] resolve(String host) {
        try { return InetAddress.getAllByName(host); }
        catch (java.net.UnknownHostException exception) { throw new IllegalArgumentException("Unresolved destination"); }
    }

    static boolean publicAddress(InetAddress address) {
        if (address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isLinkLocalAddress() || address.isSiteLocalAddress() || address.isMulticastAddress()) return false;
        byte[] bytes = address.getAddress();
        int a = bytes[0] & 255, b = bytes[1] & 255;
        if (bytes.length == 4) {
            return !(a == 0 || a == 10 || a == 127 || a >= 224 || (a == 100 && b >= 64 && b <= 127)
                    || (a == 169 && b == 254) || (a == 172 && b >= 16 && b <= 31)
                    || (a == 192 && (b == 0 || b == 168 || (b == 88 && (bytes[2] & 255) == 99)))
                    || (a == 198 && (b == 18 || b == 19 || (b == 51 && (bytes[2] & 255) == 100)))
                    || (a == 203 && b == 0 && (bytes[2] & 255) == 113));
        }
        if (bytes.length != 16 || (a & 0xe0) != 0x20) return false;
        int c = bytes[2] & 255, d = bytes[3] & 255;
        return !(a == 0x20 && b == 0x01 && (c < 2 || (c == 0x0d && d == 0xb8)))
                && !(a == 0x20 && b == 0x02) && !(a == 0x3f && b == 0xff && c < 0x10);
    }

    private static Response exchangePinned(URI uri, InetAddress address, int maxBytes, long deadline) throws IOException {
        try (Socket socket = new Socket()) {
            long remaining = deadline - System.nanoTime();
            if (remaining <= 0) throw new IOException("Collection timeout");
            var timeout = DEADLINES.schedule(() -> { try { socket.close(); } catch (IOException ignored) {} }, remaining, TimeUnit.NANOSECONDS);
            try {
                socket.connect(new InetSocketAddress(address, 443), CONNECT_TIMEOUT_MS);
                socket.setSoTimeout(REQUEST_TIMEOUT_MS);
                try (SSLSocket tls = (SSLSocket) ((SSLSocketFactory) SSLSocketFactory.getDefault()).createSocket(socket, uri.getHost(), 443, true)) {
                    SSLParameters parameters = tls.getSSLParameters();
                    parameters.setEndpointIdentificationAlgorithm("HTTPS");
                    parameters.setServerNames(List.of(new SNIHostName(uri.getHost())));
                    tls.setSSLParameters(parameters);
                    tls.startHandshake();
                    String target = uri.getRawPath();
                    if (target == null || target.isEmpty()) target = "/";
                    if (uri.getRawQuery() != null) target += "?" + uri.getRawQuery();
                    String request = "GET " + target + " HTTP/1.1\r\nHost: " + uri.getHost() + "\r\nUser-Agent: Fluiar-Product-Import/1.0\r\nAccept: text/html,image/jpeg,image/png\r\nAccept-Encoding: identity\r\nConnection: close\r\n\r\n";
                    tls.getOutputStream().write(request.getBytes(StandardCharsets.US_ASCII));
                    tls.getOutputStream().flush();
                    return readResponse(tls.getInputStream(), maxBytes);
                }
            } finally { timeout.cancel(false); }
        }
    }

    static Response readResponse(InputStream input, int maxBytes) throws IOException {
        int[] headerBudget = {MAX_HEADER_BYTES};
        String statusLine = line(input, headerBudget);
        if (!statusLine.matches("HTTP/1\\.[01] [0-9]{3}(?: .*)?")) throw new IOException("Invalid response");
        int status = Integer.parseInt(statusLine.substring(9, 12));
        Map<String, String> headers = new LinkedHashMap<>();
        while (true) {
            String line = line(input, headerBudget);
            if (line.isEmpty()) break;
            int colon = line.indexOf(':');
            if (colon <= 0) throw new IOException("Invalid header");
            String name = line.substring(0, colon).toLowerCase(Locale.ROOT);
            if (List.of("content-length", "transfer-encoding", "content-encoding", "content-type", "location").contains(name)
                    && headers.putIfAbsent(name, line.substring(colon + 1).strip()) != null) throw new IOException("Duplicate header");
        }
        if (List.of(301, 302, 303, 307, 308).contains(status)) return new Response(status, headers, new byte[0]);
        String encoding = headers.get("content-encoding");
        if (encoding != null && !encoding.equalsIgnoreCase("identity")) throw new IOException("Unsupported encoding");
        String transfer = headers.get("transfer-encoding");
        if (transfer != null && (!transfer.equalsIgnoreCase("chunked") || headers.containsKey("content-length"))) throw new IOException("Invalid framing");
        ByteArrayOutputStream body = new ByteArrayOutputStream();
        if (transfer != null) {
            while (true) {
                String chunk = line(input, headerBudget).split(";", 2)[0];
                long size;
                try { size = Long.parseLong(chunk, 16); } catch (NumberFormatException exception) { throw new IOException("Invalid chunk"); }
                if (size < 0 || size > maxBytes - body.size()) throw new IOException("Body too large");
                if (size == 0) { while (!line(input, headerBudget).isEmpty()) {} break; }
                copy(input, body, (int) size, maxBytes);
                if (!line(input, headerBudget).isEmpty()) throw new IOException("Invalid chunk");
            }
        } else if (headers.containsKey("content-length")) {
            long length;
            try { length = Long.parseLong(headers.get("content-length")); } catch (NumberFormatException exception) { throw new IOException("Invalid length"); }
            if (length < 0 || length > maxBytes) throw new IOException("Body too large");
            copy(input, body, (int) length, maxBytes);
        } else {
            byte[] buffer = new byte[8192];
            int count;
            while ((count = input.read(buffer)) != -1) {
                if (body.size() + count > maxBytes) throw new IOException("Body too large");
                body.write(buffer, 0, count);
            }
        }
        return new Response(status, Map.copyOf(headers), body.toByteArray());
    }

    private static void copy(InputStream input, ByteArrayOutputStream output, int length, int maxBytes) throws IOException {
        byte[] buffer = new byte[Math.min(8192, Math.max(1, length))];
        while (length > 0) {
            int count = input.read(buffer, 0, Math.min(buffer.length, length));
            if (count < 0) throw new IOException("Truncated response");
            if (output.size() + count > maxBytes) throw new IOException("Body too large");
            output.write(buffer, 0, count);
            length -= count;
        }
    }

    private static String line(InputStream input, int[] budget) throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        int current;
        while ((current = input.read()) != -1) {
            if (--budget[0] < 0) throw new IOException("Headers too large");
            if (current == '\n') {
                byte[] line = bytes.toByteArray();
                if (line.length == 0 || line[line.length - 1] != '\r') throw new IOException("Invalid line");
                return new String(line, 0, line.length - 1, StandardCharsets.ISO_8859_1);
            }
            bytes.write(current);
        }
        throw new IOException("Truncated response");
    }
}
