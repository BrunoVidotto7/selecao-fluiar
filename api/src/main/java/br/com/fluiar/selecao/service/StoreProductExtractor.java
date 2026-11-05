package br.com.fluiar.selecao.service;

import br.com.fluiar.selecao.dto.ProductImportPreview;
import br.com.fluiar.selecao.dto.ProductImportPreview.Variant;
import br.com.fluiar.selecao.model.Product;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Objects;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

@Component
public class StoreProductExtractor {
    private static final Pattern SCRIPT = Pattern.compile("<script\\b[^>]*type\\s*=\\s*['\"]application/ld\\+json['\"][^>]*>(.*?)</script\\s*>", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final Pattern CONDITIONAL_PRICE = Pattern.compile("pix|parcela|installment|mensal|cupom|coupon|boleto|strikethrough|listprice|preço anterior|preco anterior", Pattern.CASE_INSENSITIVE);
    private static final int MAX_PRODUCT_NAME = Product.NAME_MAX_LENGTH;
    private static final BigDecimal MAX_PRICE = new BigDecimal("9999999999.99");
    private final JsonMapper mapper = JsonMapper.builder().build();

    public ProductImportPreview extract(String url, String store, String requestedVariant, String html) {
        List<JsonNode> products = readProducts(html);
        List<JsonNode> matching = products.stream().filter(product -> matchesPage(product, url)).toList();
        if (matching.size() != 1) {
            return result(url, store, null, null, List.of(), null, null, null, "unresolved");
        }
        JsonNode product = normalizeStoreProduct(matching.getFirst(), store, html);
        String productId = firstText(product, "productID", "sku", "mpn");
        if (productId == null) productId = text(product, "@id");
        String name = text(product, "name");
        if (name != null && name.length() > MAX_PRODUCT_NAME) name = null;
        String image = imageUrl(product.get("image"), url);
        String variantId = requestedVariant == null ? queryVariant(url) : requestedVariant;
        if ("fonte-do-sofa".equals(store) && image != null) image = image.replaceFirst("(?i)\\.webp(?=\\?|$)", ".jpg");
        List<JsonNode> offers = new ArrayList<>();
        addArrayOrObject(product.get("offers"), offers);
        List<JsonNode> children = new ArrayList<>();
        addArrayOrObject(product.get("hasVariant"), children);
        LinkedHashMap<String, Variant> variants = new LinkedHashMap<>();
        for (JsonNode child : children) {
            String id = firstText(child, "sku", "productID");
            if (id != null) variants.putIfAbsent(id, new Variant(id, Objects.requireNonNullElse(firstText(child, "variantLabel", "name"), id)));
        }
        for (JsonNode offer : offers) {
            String id = offerVariant(offer);
            if (id != null && !conditional(offer)) variants.putIfAbsent(id, new Variant(id, Objects.requireNonNullElse(text(offer, "name"), id)));
        }
        if (variantId != null && variants.isEmpty() && !Objects.equals(variantId, text(product, "sku"))) {
            return result(url, store, productId, variantId, List.of(), name, null, image, "unresolved");
        }
        if (!variants.isEmpty() && variantId == null && (variants.size() > 1 || children.isEmpty())) {
            return result(url, store, productId, null, List.copyOf(variants.values()), name, null, image, "variant_required");
        }
        if (variantId != null && !variants.isEmpty() && !variants.containsKey(variantId)) {
            return result(url, store, productId, variantId, List.copyOf(variants.values()), name, null, image, "unresolved");
        }
        if (variantId == null && variants.size() == 1) variantId = variants.keySet().iterator().next();
        if (!children.isEmpty()) {
            String chosenId = variantId;
            List<JsonNode> selected = children.stream().filter(child -> Objects.equals(chosenId, firstText(child, "sku", "productID"))).toList();
            if (selected.size() != 1) return result(url, store, productId, variantId, List.copyOf(variants.values()), name, null, image, "unresolved");
            JsonNode child = selected.getFirst();
            String childName = text(child, "name");
            if (childName != null) name = childName;
            String childImage = imageUrl(child.get("image"), url);
            if (childImage != null) image = "fonte-do-sofa".equals(store) ? childImage.replaceFirst("(?i)\\.webp(?=\\?|$)", ".jpg") : childImage;
            offers.clear();
            addArrayOrObject(child.get("offers"), offers);
        }
        List<BigDecimal> prices = new ArrayList<>();
        boolean invalidPrice = false;
        for (JsonNode offer : offers) {
            String offerId = offerVariant(offer);
            if (offerId != null && !Objects.equals(offerId, variantId)) continue;
            if (conditional(offer)) continue;
            if (hasType(offer, "AggregateOffer")) { invalidPrice = true; continue; }
            BigDecimal price = regularPrice(offer);
            if (price == null) invalidPrice = true;
            else prices.add(price);
        }
        if (name != null && name.length() > MAX_PRODUCT_NAME) name = null;
        if (productId != null && productId.length() > 512) productId = null;
        if (variantId != null && variantId.length() > 512) productId = null;
        BigDecimal price = !invalidPrice && !prices.isEmpty() && prices.stream().distinct().count() == 1 ? prices.getFirst() : null;
        String resolution = productId != null && name != null && price != null && image != null ? "resolved" : "unresolved";
        return result(url, store, productId, variantId, List.copyOf(variants.values()), name, price, image, resolution);
    }

    private JsonNode normalizeStoreProduct(JsonNode original, String store, String html) {
        ObjectNode product = (ObjectNode) original.deepCopy();
        if ("moveca".equals(store)) {
            JsonNode data = embeddedJson(html, "ymq_option.product");
            if (data != null && data.has("variants")) {
                String page = text(original, "url");
                if (page != null && page.endsWith("/" + text(data, "handle"))) {
                    var variants = product.putArray("hasVariant");
                    for (JsonNode variant : data.get("variants")) {
                        ObjectNode child = variants.addObject();
                        child.put("sku", text(variant, "id"));
                        child.put("name", text(original, "name"));
                        child.set("image", original.get("image"));
                        ObjectNode offer = child.putObject("offers");
                        offer.put("priceCurrency", "BRL");
                        offer.put("price", cents(text(variant, "price")));
                    }
                    product.remove("offers");
                }
            }
        }
        if ("fonte-do-sofa".equals(store)) {
            JsonNode data = embeddedJson(html, "LS.variants");
            if (data != null && data.isArray()) {
                var variants = product.putArray("hasVariant");
                for (JsonNode variant : data) {
                    if (!Objects.equals(text(original, "sku"), text(variant, "sku"))) continue;
                    ObjectNode child = variants.addObject();
                    child.put("sku", text(variant, "id"));
                    child.put("name", text(original, "name"));
                    child.put("image", text(variant, "image_url"));
                    child.put("variantLabel", String.join(" / ", Objects.requireNonNullElse(text(variant, "option0"), ""), Objects.requireNonNullElse(text(variant, "option1"), ""), Objects.requireNonNullElse(text(variant, "option2"), "")));
                    ObjectNode offer = child.putObject("offers");
                    offer.put("priceCurrency", text(original.path("offers"), "priceCurrency"));
                    String regular = cents(text(variant, "price_number_raw"));
                    BigDecimal numeric = money(text(variant, "price_number"));
                    offer.put("price", regular != null && numeric != null && numeric.compareTo(new BigDecimal(regular)) == 0 ? regular : null);
                }
                product.remove("offers");
            } else {
                List<JsonNode> advertised = new ArrayList<>();
                addArrayOrObject(product.get("offers"), advertised);
                if (advertised.stream().noneMatch(offer -> offerVariant(offer) != null)) product.remove("offers");
            }
        }
        if ("casavee".equals(store)) {
            JsonNode data = embeddedJson(html, "const dataProduct");
            String regular = null;
            if (data != null && Objects.equals(text(original, "sku"), text(data, "codigo"))) {
                JsonNode card = data.path("valor_cartao");
                if (card.isArray() && card.size() > 5) {
                    String total = card.get(1).asString();
                    String detailedTotal = text(card.get(5), "valor");
                    if (Objects.equals(total, detailedTotal)) regular = total;
                }
            }
            ObjectNode offer = product.putObject("offers");
            offer.put("priceCurrency", text(original.path("offers"), "priceCurrency"));
            offer.put("price", regular);
        }
        return product;
    }

    private static String cents(String value) {
        if (value == null || !value.matches("[0-9]+")) return null;
        return new BigDecimal(value).movePointLeft(2).toPlainString();
    }

    private JsonNode embeddedJson(String html, String marker) {
        var assignment = Pattern.compile(Pattern.quote(marker) + "\\s*=").matcher(html);
        if (!assignment.find()) return null;
        int start = assignment.end();
        if (marker.equals("const dataProduct")) {
            start = html.indexOf("produto:", start);
            if (start < 0) return null;
            start += "produto:".length();
        }
        while (start < html.length() && Character.isWhitespace(html.charAt(start))) start++;
        if (start == html.length() || (html.charAt(start) != '[' && html.charAt(start) != '{')) return null;
        int depth = 0;
        boolean quoted = false, escaped = false;
        for (int end = start; end < html.length(); end++) {
            char c = html.charAt(end);
            if (quoted) {
                if (escaped) escaped = false;
                else if (c == '\\') escaped = true;
                else if (c == '"') quoted = false;
            } else if (c == '"') quoted = true;
            else if (c == '[' || c == '{') depth++;
            else if ((c == ']' || c == '}') && --depth == 0) {
                try { return mapper.readTree(html.substring(start, end + 1)); }
                catch (RuntimeException ignored) { return null; }
            }
        }
        return null;
    }

    private List<JsonNode> readProducts(String html) {
        List<JsonNode> products = new ArrayList<>();
        var scripts = SCRIPT.matcher(html);
        while (scripts.find()) {
            try { collectProducts(mapper.readTree(scripts.group(1)), products); }
            catch (RuntimeException ignored) { /* A malformed block cannot supply trusted product data. */ }
        }
        return products;
    }

    private static void collectProducts(JsonNode node, List<JsonNode> products) {
        if (node == null) return;
        if (hasType(node, "Product") || hasType(node, "ProductGroup")) {
            products.add(node);
            return;
        }
        if (node.isContainer()) for (JsonNode child : node) collectProducts(child, products);
    }

    private static boolean matchesPage(JsonNode product, String url) {
        if (samePage(text(product, "url"), url) || samePage(text(product, "@id"), url)) return true;
        List<JsonNode> offers = new ArrayList<>();
        addArrayOrObject(product.get("offers"), offers);
        return offers.stream().anyMatch(offer -> samePage(text(offer, "url"), url));
    }

    private static boolean samePage(String candidate, String url) {
        if (candidate == null) return false;
        try {
            URI a = URI.create(candidate), b = URI.create(url);
            return a.getHost() != null && a.getHost().replaceFirst("^www\\.", "").equalsIgnoreCase(b.getHost().replaceFirst("^www\\.", ""))
                    && Objects.requireNonNullElse(a.getPath(), "").replaceFirst("/$", "").equals(Objects.requireNonNullElse(b.getPath(), "").replaceFirst("/$", ""));
        } catch (IllegalArgumentException ignored) { return false; }
    }

    private static BigDecimal regularPrice(JsonNode offer) {
        if (!"BRL".equals(text(offer, "priceCurrency"))) return null;
        List<JsonNode> specifications = new ArrayList<>();
        addArrayOrObject(offer.get("priceSpecification"), specifications);
        List<BigDecimal> prices = new ArrayList<>();
        if (offer.has("price")) {
            BigDecimal price = money(text(offer, "price"));
            if (price == null) return null;
            prices.add(price);
        }
        for (JsonNode specification : specifications) {
            if (conditional(specification)) continue;
            String currency = text(specification, "priceCurrency");
            if (currency != null && !"BRL".equals(currency)) return null;
            BigDecimal price = money(text(specification, "price"));
            if (price == null) return null;
            prices.add(price);
        }
        return !prices.isEmpty() && prices.stream().distinct().count() == 1 ? prices.getFirst() : null;
    }

    private static BigDecimal money(String value) {
        if (value == null || !value.matches("[0-9]+(?:\\.[0-9]{1,2})?")) return null;
        try {
            BigDecimal price = new BigDecimal(value).setScale(2, RoundingMode.UNNECESSARY);
            return price.signum() >= 0 && price.compareTo(MAX_PRICE) <= 0 ? price : null;
        } catch (ArithmeticException ignored) { return null; }
    }

    private static boolean conditional(JsonNode offer) {
        String description = String.join(" ", Objects.requireNonNullElse(text(offer, "name"), ""), Objects.requireNonNullElse(text(offer, "description"), ""), Objects.requireNonNullElse(text(offer, "priceType"), ""), Objects.requireNonNullElse(text(offer, "paymentMethod"), ""));
        return CONDITIONAL_PRICE.matcher(description).find() || offer.has("eligibleTransactionVolume") || offer.has("eligibleQuantity") || offer.has("billingDuration");
    }

    private static String offerVariant(JsonNode offer) {
        String id = text(offer, "sku");
        if (id == null && offer.has("itemOffered")) id = text(offer.get("itemOffered"), "sku");
        return id != null ? id : queryVariant(text(offer, "url"));
    }

    static String queryVariant(String url) {
        if (url == null) return null;
        try {
            String query = URI.create(url).getRawQuery();
            if (query == null) return null;
            for (String part : query.split("&")) {
                String[] pair = part.split("=", 2);
                if (pair.length == 2 && (pair[0].equals("variant") || pair[0].equals("skuId"))) return URLDecoder.decode(pair[1], StandardCharsets.UTF_8);
            }
        } catch (IllegalArgumentException ignored) { return null; }
        return null;
    }

    private static String imageUrl(JsonNode image, String baseUrl) {
        if (image == null) return null;
        if (image.isArray()) return image.isEmpty() ? null : imageUrl(image.get(0), baseUrl);
        String url = image.isString() ? image.asString() : firstText(image, "url", "contentUrl");
        if (url == null) return null;
        try { return SafeStoreHttpClient.validatedUri(URI.create(baseUrl).resolve(url).toString()).toString(); }
        catch (IllegalArgumentException ignored) { return null; }
    }

    private static boolean hasType(JsonNode node, String type) {
        JsonNode value = node.get("@type");
        if (value == null) return false;
        if (value.isArray()) { for (JsonNode item : value) if (type.equals(item.asString())) return true; return false; }
        return type.equals(value.asString());
    }

    private static void addArrayOrObject(JsonNode node, List<JsonNode> target) {
        if (node == null) return;
        if (node.isArray()) node.forEach(target::add); else if (node.isObject()) target.add(node);
    }

    private static String firstText(JsonNode node, String... names) {
        for (String name : names) { String value = text(node, name); if (value != null) return value; }
        return null;
    }

    private static String text(JsonNode node, String name) {
        JsonNode value = node.get(name);
        if (value == null || value.isNull() || value.isContainer()) return null;
        String text = value.asString().strip();
        return text.isEmpty() ? null : text;
    }

    private static ProductImportPreview result(String url, String store, String productId, String variantId,
            List<Variant> variants, String name, BigDecimal price, String image, String resolution) {
        return new ProductImportPreview(url, store, productId, variantId, variants, name, price, image, resolution);
    }
}
