# Product store sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Track steps below.

**Goal:** Import and synchronize the five approved stores while preserving private client contracts and human activity semantics.
**Architecture:** A concrete safe HTTPS collector and JSON-LD extractor feed both admin previews and a leased database worker. Explicit human activity is independent from list modification. Next server actions retain private sessions.
**Tech Stack:** Existing Java 25/Spring/PostgreSQL and Next 15/React 19, no new dependencies.
**Spec:** docs/superpowers/specs/2026-11-05-product-store-sync-design.md

## Global Constraints

- Five stores only: Moveca, Fonte do Sofá, Westwing, Abra Casa, Casavee.
- Preserve local image-import changes, bought/manual products and restricted client DTOs.
- HTTPS public pinned destinations; bounded time, bytes, redirects and calls.
- Last human activity >= now minus 30 days; attempts at least 24 hours apart, including failures.
- No dependency additions, commits, pushes, merges or deployments.

## Review Focus

- Conflicting offers and Pix/installment ambiguity preserve previous price (Task 1).
- DNS rebinding and redirected images cannot reach private networks (Task 1).
- Old collection results cannot overwrite manual edits or purchases (Task 2).
- Prefetch, metadata and helper reads never record activity (Tasks 2/3).
- Failed image download preserves the previous image and reports partial (Task 2).

### Task 1: Safe collector and deterministic store extraction
**Files:** Create `api/src/main/java/br/com/fluiar/selecao/service/StoreProductCollector.java`, `StoreProductExtractor.java`, `SafeStoreHttpClient.java`, `dto/ProductImportPreview.java`; tests in matching API test packages and store fixtures in `api/src/test/resources/stores/`.
**Interfaces:** `StoreProductCollector.preview(String url, String variantId)` returns ProductImportPreview with sourceUrl, store, productId, variantId, variants, name, unitPrice, imageUrl, resolution. `downloadImage(String url)` returns validated bytes/content type through an explicit record. Preview uses no database writes. Resolution is `resolved`, `variant_required` or `unresolved`; variants have id and label.
- [ ] Write executable failing behavioral tests using fixtures for all stores, recommended products, variants, Pix/total/installments, currencies/conflicts and hostile destinations.
- [ ] Run each affected test, record assertion failure before implementing.
- [ ] Implement concrete bounded collection, pinned public HTTPS, extraction and validated JPG/PNG downloads without dependencies.
- [ ] Run focused tests green and report evidence.

### Task 2: Persistence, preview endpoint, activity and leased synchronization
**Files:** API only except Task 1 owned files. Create next migration, activity/sync entities and repositories, sync worker/service, preview controller/request. Modify ProductRequest/Response/ProductService/ProductImageService and human write services/controllers as necessary.
**Interfaces:** Consume Task 1 collector. Produce approved preview and activity endpoints, optional admin storeSync request/response. Request omission preserves binding, null disables, object `{sourceUrl,variantId}` explicitly revalidates current collector preview against saved name/price and persisted image. Response contains sourceUrl/store/productId/variantId/enabled/lastAttemptAt/lastSyncedAt/status. Fix exact wire schema in task report for UI. No client metadata exposure.
- [ ] Write failing HTTP/state tests for activity ownership, 30-day/24-hour limits, omission/null and manual disabling; record behavioral RED.
- [ ] Implement migration, human write activity, authorized activity endpoints, preview and binding validation.
- [ ] Implement atomic expiring PostgreSQL leases, per-store bounds and paginated scheduled collection outside list locks; recheck eligibility/version before application, preserve each invalid field and unchanged image bytes.
- [ ] Test simultaneous claims, expiration, edits/buys/deletes during network, partial/failure and no automatic human activity; run focused tests.

### Task 3: Administrative import UX and explicit screen activity
**Files:** UI only: ProductForm/actions/product-values, RoomTable and detail screen components/pages and colocated tests. Preserve existing image search/import work.
**Interfaces:** Consume Task 2 wire schema; fixed server actions for preview and both activity endpoints. Client mount invokes activity only for committed authenticated detail screen, never metadata or server read.
- [ ] Write behavioral failing tests for Buscar produto, variant selection, manual edits warning, preview mismatch, source/status and mounted screen activity.
- [ ] Integrate previews, private image persistence, explicit binding, manual fallback and metadata display with existing form retry/unmount guards.
- [ ] Run focused UI tests and targeted lint; record evidence.

### Task 4: Integration and final verification
**Files:** Fix integration issues only in responsible task ownership; persistent ledger under plan workspace.
- [ ] Independent read-only code-quality-reviewer reviews each task and final feature; fix blockers and reuse reviewer.
- [ ] Run API `./mvnw verify` (0 skipped), UI `npm test`, `npm run lint`, `npm run build`; report exact outputs.
- [ ] Confirm original local changes preserved; leave all changes uncommitted in worktree and report location and real limitations.

## Execution outcome

Implementation and current verification are recorded in `.superpowers/sdd/2026-11-05-product-store-sync/progress.md` in the original checkout. API clean verify:302 tests,0 failures/errors/skips. UI:1171 tests,lint0errors,production build passed. Independent code review has no open code findings; final approval is NOT_VERIFIED because original pre-edit behavioral RED evidence is missing for binding/worker and UI activity (retrospective sensitivity is recorded separately). Work remains uncommitted in `.worktrees/product-store-sync`; original local work is preserved.
