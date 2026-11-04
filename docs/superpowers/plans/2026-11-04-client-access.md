# Private Client Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give invited clients private access to their own shopping lists, with purchase tracking and per-product notes editable by the office's admins.

**Architecture:** Extend the existing account and JWT flow with `ADMIN`/`CLIENT` roles and an explicit account-to-client relationship. Keep administrative APIs office-scoped, add restricted client APIs, and authorize shared links and images against current ownership. Reuse the existing mail, invitation, session and UI infrastructure.

**Tech Stack:** Java 25, Spring Boot 4.1, Spring Security, PostgreSQL 18, Flyway; Next.js 15.5.28 App Router, React 19.1.10, JavaScript; existing JUnit/MockMvc/Testcontainers and Vitest/Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-04-client-access-design.md` (approved 2026-11-04).

## Global Constraints

- Use English for code, routes, files, identifiers, comments and test names. Only user-facing UI strings, including validation/error copy, remain Brazilian Portuguese. The user's instruction overrides older UI naming rules.
- Preserve existing public URLs for unrelated administrative/settings/password-reset pages; new routes are English. The client routes are `/my-lists` and `/my-lists/[id]`, labeled “Minhas listas”.
- Keep the existing visual identity, responsive breakpoints, CSS tokens and components. Do not add dependencies, tools, frameworks or mockups.
- Use new Flyway migrations only; never edit V1–V4. Preserve current passwords, lists, purchases, internal notes and image bytes.
- Roles are `ADMIN` and `CLIENT`; invitations last seven days; `clientNotes` has at most 1,000 characters, is trimmed, and stores empty text as `null`.
- Keep `ProblemDetail`, JWT lifetime, password hashing, httpOnly cookies, office isolation and list-first write locking. No browser persistence for tokens, lists or note drafts.
- No public signup or admin invitation; no cross-office superadmin, real-time synchronization, audit history, chat or multiple accounts per client.
- Design approval authorizes the security/API changes described here. It does not authorize dependency changes or production provisioning/migrations.
- At execution, read `AGENTS.md`, `api/AGENTS.md`, `ui/AGENTS.md` and the global `code-quality` skill. Use an isolated checkout according to `using-git-worktrees`. Do not commit UI changes unless the user asks; keep suggested commit boundaries below available for review.
- Implement in order; do not deploy intermediate tasks. Each task has focused verification; the complete feature must pass the final gates before release. No product code is written during this planning turn.

## Review Focus

1. Tokens with missing, malformed or stale role/office/client claims must return 401 rather than allow access or fail with 500 (Tasks 1–2).
2. Contact-email edits, reused addresses and overlapping invite operations must never transfer an active login or create two accounts (Task 3).
3. A purchase/note write waiting behind a list transfer must recheck the committed owner and return 404 for the previous client (Task 4).
4. A forged login return path, share token or image identifier must never cause an external redirect, arbitrary fetch or information leak (Tasks 5, 6 and 9).
5. A checkbox refresh, failed note save or late response must not erase a note draft or overwrite a different field's saved value (Tasks 4, 8 and 10).

## File Map and Fixed Contracts

All API Java paths below are relative to `api/src/main/java/br/com/fluiar/selecao/`; API tests mirror them under `api/src/test/java/br/com/fluiar/selecao/`. UI paths are relative to `ui/nextjs/`. Migration and operations paths are repo-relative. Keep existing classes unless explicitly replaced below.

| Unit | New files | Existing files affected |
| --- | --- | --- |
| Account identity | `model/UserRole.java`, `security/CurrentClientId.java`; `api/src/main/resources/db/migration/V5__add_client_accounts.sql`; `api/ops/provision-admin.sql` | `model/User.java`, `dto/MeResponse.java`, `security/TokenService.java`, `security/CredentialsVersionValidator.java`, `repository/UserRepository.java`, `config/SecurityConfig.java` |
| Client invitations | `controller/ClientAccessController.java`, `dto/ClientAccessResponse.java`; `api/src/main/resources/db/migration/V6__bind_invitations_to_clients.sql` | `model/OfficeInvitation.java`, `service/InvitationService.java`, `repository/OfficeInvitationRepository.java`, `repository/ClientRepository.java`, `service/ClientService.java`, `service/EmailService.java`, invitation DTOs, `controller/AuthController.java`, `controller/OfficeController.java` |
| Client shopping | `controller/ClientShoppingListController.java`, `service/ClientShoppingListService.java`, `dto/ClientListSummaryResponse.java`, `dto/ClientListDetailResponse.java`, `dto/ProductPurchaseRequest.java`, `dto/ProductClientNotesRequest.java`; `api/src/main/resources/db/migration/V7__add_product_client_notes.sql` | `model/Product.java`, `repository/ShoppingListRepository.java`, `repository/ProductRepository.java`, `service/ProductService.java`, `controller/ProductController.java`, `dto/ProductResponse.java` |
| Private resources | `service/ListAccessService.java`, `dto/ListAccessResponse.java` | `controller/PublicListController.java`, `service/ShoppingListService.java`, `service/ProductImageService.java`, `controller/ProductImageController.java`, `repository/ProductImageRepository.java`, `service/OfficeService.java` |
| Role-aware frontend | `lib/auth-routing.js`, `lib/auth.server.js`, `app/(app)/(admin)/layout.js`, `app/(auth)/invitation/page.js` | `components/layout/AppShell.js`, auth/acceptance/settings actions and forms, `lib/api.server.js`, shared layout, route tests and fixtures; move existing admin route folders under `(admin)` |
| Access management UI | `components/client-access/{ClientAccessManager.js,actions.js,queries.server.js}` | Client detail page/component, office manager/actions, invitation form and legacy invitation page |
| Client UI | `components/client-shopping/{ClientLists.js,ClientShoppingList.js,queries.server.js,actions.js}`, `components/lista/ProductClientNotesEditor.js`, `app/(app)/my-lists/{layout.js,page.js,[id]/page.js}` | `components/lista/{RoomTable.js,ShoppingList.js,ClientView.js}`, product actions, shared validation and revalidation helpers |
| Resource frontend | `app/images/[imageId]/route.js`, `lib/product-images.server.js` | `app/l/[shareToken]/page.js`, `components/lista/ShareControls.js`, `lib/api.server.js`, `lib/format.js`, image consumers/tests |

Adjacent `*.test.js` files accompany every new UI module with behavior. New API tests: `repository/ClientAccountSchemaTest.java`, `security/AccountTokenTest.java`, `controller/RoleAuthorizationTest.java`, `controller/ClientAccessControllerTest.java`, `controller/ClientShoppingListControllerTest.java`, `controller/ClientProductFeedbackTest.java`. Extend existing auth, invitation, account, office, product, public-list and image tests as specified in tasks.

### API contracts

`MeResponse` retains `id,name,email,officeId,officeName` and adds `role: "ADMIN"|"CLIENT"` and `clientId: UUID|null`. Auth responses keep `{accessToken,expiresAt,user}`. A client account is linked by immutable client UUID, never by email matching.

| Method and path | Authorization | Request / result |
| --- | --- | --- |
| `GET /api/clients/{clientId}/access` | Admin in client's office | `{status:"NOT_INVITED"|"PENDING"|"EXPIRED"|"ACTIVE",email,invitationId:null|UUID,expiresAt:null|Instant}`; email is active login email when active, otherwise client contact email |
| `POST /api/clients/{clientId}/invitations` | Admin in client's office | No body; uses stored contact email; 201 existing `InvitationResponse` extended with `clientId` |
| `DELETE /api/clients/{clientId}/invitations/{invitationId}` | Admin in client's office | 204; mismatched/nonexistent/revoked invitation 404 |
| `GET /api/auth/invitations/{token}` | Token holder | Existing office/inviter/email fields plus `clientName`; no list data |
| `POST /api/auth/invitations/{token}/acceptance` | Token holder | `{password}`; name/email/client/role are server-owned; 201 auth response for `CLIENT` |
| `GET /api/client/lists` | Client | Array of `{id,name,description,totalProducts,boughtProducts,pendingProducts,updatedAt,completed}` |
| `GET /api/client/lists/{listId}` | Owning client | `{id,name,description,updatedAt,stats:{totalProducts,boughtProducts,pendingProducts},rooms:[{id,name,position,products:[{id,name,quantity,bought,clientNotes,links:[{url,note}]}]}],signature:{officeName,architectNames}}` |
| `PATCH /api/client/lists/{listId}/products/{productId}` | Owning client | Strict `{bought:boolean}`; 200 client product DTO |
| `PUT /api/client/lists/{listId}/products/{productId}/client-notes` | Owning client | Strict `{clientNotes:string|null}`; 200 client product DTO; explicit null/blank clears the field, missing property is 400 |
| `PUT /api/products/{productId}/client-notes` | Admin in product's office | Same notes request; 200 existing `ProductResponse` plus `clientNotes` |
| `GET /api/public/lists/{shareToken}` | Authenticated admin in office or owning client | Replace public list contents with `{listId,role}` for server-side navigation; do not disclose an unauthorized list |
| `GET /api/images/{imageId}` | Authenticated admin in office or owning client | Existing image bytes/type; `Cache-Control: private, no-store` |

All other domain endpoints stay admin-only. Own `/api/me` and password operations support both roles. Missing authentication is 401, prohibited admin operations are 403, inaccessible resources are 404, invalid fields/types/unknown fields in the new strict requests are 400 with no partial write. Active account/email/pending-email conflicts are 409. Invalid/expired/consumed invitation tokens keep the existing 400 invalid-link behavior. Retire `/api/auth/signup` and `/api/office/invitations` without an alternate account-creation path.

### Test and execution convention

For every task: write the listed behavior tests, run the focused command and record an assertion/HTTP-status failure, implement the smallest change, rerun that command and record success, then refactor while green. New modules may have an inert export/signature for test setup; missing-module/compile failures do not count as RED. Existing behavior intentionally replaced by the approved spec gets updated assertions; unrelated regression tests remain intact. Numbers/strings with business meaning become named constants.

Suggested commit messages end with a period. They describe task boundaries, not authorization to commit UI work. Execution-mode selection and plan review happen before implementation.

## Task 1: Account Schema, JWT Context and Admin Provisioning

**Files:** Account identity row above; `dto/AuthResponse.java`, `service/AuthService.java`; tests `repository/ClientAccountSchemaTest.java`, `security/AccountTokenTest.java`, `config/JwtConfigTest.java`; `api/README.md`.

**Interfaces:** `UserRole {ADMIN,CLIENT}`; `User.admin(UUID officeId,String name,String email,String passwordHash)` and `User.client(UUID officeId,UUID clientId,String name,String email,String passwordHash)`; getters `getRole()/getClientId()`. JWT adds `role` and, for clients only, `client_id`. `@CurrentClientId` reads the verified UUID claim; keep `@CurrentOfficeId` and `@CurrentUserId` for existing controllers.

- [ ] **1. Write failing identity/upgrade tests.** Test a legacy V4 schema in a temporary schema on the existing PostgreSQL container, seed a user/list/product/invitation, migrate latest, then assert `role=ADMIN`, unchanged password/list/bought/notes, incremented credentials version and no usable old member invitation. Assert metadata contains `users.role/client_id` before selecting them so RED is an assertion rather than missing-column SQL. Test the final schema rejects a CLIENT without a client, ADMIN with a client, duplicate client account and cross-office client relationship; deleting a client deletes its client account without deleting its office/admin. Keep cleanup isolated from the Spring application's schema.

Representative assertions in `adminSessionIncludesItsRole` use the existing signup fixture until Task 2 replaces it:

```java
var session = signUp("Admin", "admin@example.com");
var me = mvc.get().uri("/api/me").header(HttpHeaders.AUTHORIZATION, bearer(session)).exchange();
assertThat(me).hasStatus(HttpStatus.OK);
assertThat(me).bodyJson().extractingPath("$.role").isEqualTo("ADMIN");
assertThat(me).bodyJson().extractingPath("$.clientId").isNull();
```
- [ ] **2. Run RED:** from `api/`, `./mvnw test -Dtest='ClientAccountSchemaTest,AccountTokenTest'`. Expected: missing context/schema behavior, not compilation failure. Add JWT tests that `/api/me` contains the exact role/clientId and that missing/wrong-type/unknown role, wrong office/client binding, stale version or deleted account yields 401.
- [ ] **3. Implement V5 and identity.** Add non-null role after backfilling existing users to ADMIN; no permanent ADMIN default. Add nullable unique `users.client_id`, unique `clients(id,office_id)`, composite FK `(client_id,office_id)` with cascade and a CHECK enforcing the role/client relation. Increment existing credentials versions; delete pending member invitations. Issue the new JWT claims and validate them against the current account in the existing credentials validator's one account lookup; malformed claims return invalid-token, not an exception. No user input chooses role. Update auth DTOs/factories while retaining existing admin login behavior.
- [ ] **4. Add `api/ops/provision-admin.sql`.** Use psql parameters `office_id,user_id,office_name,name,email,password_hash`, one transaction and the existing `{bcrypt}` hash format; create the office only if needed, reject account conflicts, never overwrite a password or store raw credentials. Document secure parameter delivery, hash generation through the existing encoder, required relogin and no automatic production execution. Test the script using supplied test-only hashes and assert login works and a repeat does not replace the account.
- [ ] **5. Run GREEN:** repeat the focused tests including provision-script and migration assertions; inspect the diff. Suggested API-only commit: `Add client account identity and database constraints.`

## Task 2: Close Public Account Creation and Enforce Role Boundaries

**Files:** `config/SecurityConfig.java`, `controller/AuthController.java`, `service/AuthService.java`, `controller/OfficeController.java`, `service/OfficeService.java`, `repository/UserRepository.java`, `dto/OfficeResponse.java`; remove `dto/SignupRequest.java` after migrating its validation tests to `dto/PasswordValidationTest.java`. Tests: `controller/RoleAuthorizationTest.java`, `controller/AuthControllerTest.java`, `controller/OfficeControllerTest.java`, `config/SecurityConfigTest.java`, `config/DatabaseErrorLoggingTest.java`, `support/ApiIntegrationTest.java` and existing controller test callers of `signUp`/`inviteMember`.

**Interfaces:** Test helpers `createAdmin(String name,String email) -> TestSession`, `createAdminInOffice(TestSession owner,String name,String email) -> TestSession`, `createClientAccount(TestSession admin,UUID clientId,String email) -> TestSession`; overload `createClient(TestSession admin,String name,String email) -> UUID` for multiple real invitation recipients, retaining the two-argument helper for existing tests. Account fixtures insert with the real encoder and obtain sessions through `/api/auth/login`; they are not production provisioning endpoints. Keep `TestSession(token,userId,officeId)` and existing request/concurrency helpers.

- [ ] **1. Write failing boundary tests.** Seed two admins in separate offices and two clients in one office. Assert CLIENT receives 403 on representative admin reads/writes/deletes, dashboard, office updates, invitations, rooms, products, share rotation and uploads, while both roles can read/update their own account. Assert POST signup creates zero accounts for anonymous or authenticated callers and old office invitations cannot issue or accept an admin account.

Representative test `clientCannotReadTheOfficeClientDirectory`:

```java
var admin = createAdmin("Admin", "admin@example.com");
var clientId = createClient(admin, "Client");
var client = createClientAccount(admin, clientId, "client@example.com");
assertThat(mvc.get().uri("/api/clients")
        .header(HttpHeaders.AUTHORIZATION, bearer(client)).exchange()).hasStatus(HttpStatus.FORBIDDEN);
```
- [ ] **2. Run RED:** `./mvnw test -Dtest='RoleAuthorizationTest,SecurityConfigTest,AuthControllerTest,OfficeControllerTest'` from `api/`. Cover public health/docs, CORS and unchanged login/password-reset responses alongside the new rejection assertions.
- [ ] **3. Implement security rules in order.** Map only the validated role to `ROLE_ADMIN`/`ROLE_CLIENT`; allow public auth/login/reset/invitation-token operations and existing infrastructure paths; allow authenticated shared-link/image reads; restrict `/api/client/**` to CLIENT; permit own account paths for both; restrict remaining `/api/**` to ADMIN. Remove `signup` production service/controller/DTO code and obsolete office-invitation controller methods. Removed endpoints return 404 for callers otherwise allowed by security; role gates still apply. Return security errors as `ProblemDetail` without personal data. Filter office members and signatures to `ADMIN` using `findByOfficeIdAndRoleOrderByNameAsc(UUID,UserRole)`.
- [ ] **4. Replace test setup dependencies.** Replace all `signUp` fixtures with `createAdmin`, and old `inviteMember` fixtures representing architects with `createAdminInOffice`; locate the complete caller set with `rg -n '\b(signUp|inviteMember)\(' api/src/test`. Rewrite signup-specific expectations to rejection; preserve login, reset, uniqueness, office isolation and concurrency assertions. Move SignupRequestTest's password cases (null/blank, 8–72 characters, exactly 72 UTF-8 bytes, over 72 UTF-8 bytes, accented letters/emojis and unmodified spaces) to a `PasswordValidationTest` targeting the existing `@ValidPassword` on a test record. Move its blank-email single-message case to the existing client DTO validation coverage; do not delete meaningful validation evidence with the retired signup DTO. Update DatabaseErrorLoggingTest's account factory while preserving its no-email-in-logs assertion. Do not retain a misleading helper named signup or expose a fixture insertion endpoint.
- [ ] **5. Run GREEN:** repeat the focused tests and `./mvnw test -Dtest='AccountControllerTest,PasswordResetTest,PasswordValidationTest,DatabaseErrorLoggingTest'`. Suggested API-only commit: `Restrict administration and remove public signup.`

## Task 3: Invite a Specific Client and Manage Access State

**Files:** Client invitations row; `dto/InvitationAcceptRequest.java`, `dto/InvitationInfoResponse.java`, `dto/InvitationResponse.java`, `service/AccountService.java`; tests `controller/ClientAccessControllerTest.java`, `controller/InvitationAcceptanceTest.java`, `controller/ClientControllerTest.java`, `controller/AccountControllerTest.java`, shared helpers.

**Interfaces:** `InvitationService.invite(UUID adminId,UUID officeId,UUID clientId) -> InvitationResponse`, `revoke(UUID officeId,UUID clientId,UUID invitationId) -> void`, `inspect(String token) -> InvitationInfoResponse`, `accept(String token,InvitationAcceptRequest request) -> AuthResponse`; `getAccess(UUID officeId,UUID clientId) -> ClientAccessResponse`. `InvitationAcceptRequest(String password)` retains the existing password validation. `ClientRepository.findByIdAndOfficeIdForUpdate(UUID id,UUID officeId) -> Optional<Client>` owns the shared lifecycle lock; `UserRepository.findByClientId(UUID)` finds the activated account. Add fixture `inviteClient(TestSession admin,UUID clientId) -> TestSession` using actual e-mail inspection and acceptance, and replace the old acceptance helper with `requestInvitationAcceptance(String token,String password) -> MvcTestResult`.

- [ ] **1. Write failing invitation assertions.** Assert 201 sends to the client's stored normalized email, inspect exposes `clientName`, acceptance rejects supplied identity fields with 400, creates exactly one CLIENT for that client and uses its stored name. Exercise NOT_INVITED/PENDING/EXPIRED/ACTIVE and active login email. Assert validity is seven days, only the token hash is stored, resend replaces the old token, revoke/expiry/reuse returns existing invalid-link 400, active-account/email conflicts return 409 and cross-office/mismatched-client invitations return 404.

In `acceptanceCreatesOnlyTheInvitedClientAccount`, obtain `token` from the invitation e-mail for fixture `clientId`, then assert:

```java
var result = requestInvitationAcceptance(token, DEFAULT_PASSWORD);
assertThat(result).hasStatus(HttpStatus.CREATED);
assertThat(result).bodyJson().extractingPath("$.user.role").isEqualTo("CLIENT");
assertThat(result).bodyJson().extractingPath("$.user.clientId").isEqualTo(clientId.toString());
assertThat(requestInvitationAcceptance(token, DEFAULT_PASSWORD)).hasStatus(HttpStatus.BAD_REQUEST);
```
- [ ] **2. Run RED:** `./mvnw test -Dtest='ClientAccessControllerTest,InvitationAcceptanceTest,ClientControllerTest'`. Add deterministic races using `requestsDuringConcurrentTransaction`: accept/accept, accept/revoke, accept/resend and accept/contact-email-change. Assert one account at most, no old-link acceptance and no unhandled 500. Test SMTP failure produces no success or orphan new invitation; a failed resend rolls back to the prior valid invitation.
- [ ] **3. Implement V6 and client-bound flow.** Clear remaining legacy invitations; add required unique `client_id` and same-office composite FK with cascade to `office_invitations`, retaining token hash and office/email uniqueness. Accept only the password field through locally strict request binding; reject extra identity fields without changing global mapper behavior. Lock the client row first for invite, accept, revoke and contact-email updates. Acceptance may inspect the hash to find the client, then locks client and rereads/locks/revalidates the invitation. Recheck active accounts/email uniqueness under the lock and rely on DB uniqueness for cross-office races. Never delete or replace another client's pending invitation just because its email matches; return 409 on that pending-email conflict.
- [ ] **4. Complete lifecycle rules.** Use `/invitation?token=...` in new e-mails, client-specific Portuguese copy and existing mail service. On contact-email edit revoke pending invitation under the same client lock; do not change an active login email. Return the account email through access state after a self-service email change. Delete cascades eliminate client account/reset tokens/invitations, and current JWT checks reject removed users. Keep name/contact and account profile independent after activation.
- [ ] **5. Run GREEN:** repeat invitation tests plus `./mvnw test -Dtest='AccountControllerTest,PasswordResetTest,OfficeControllerTest'`. Recheck that office members contain admins only. Suggested API-only commit: `Invite clients to activate their private accounts.`

## Task 4: Private Client Lists and Independent Product Feedback Writes

**Files:** Client shopping row; `dto/Inputs.java`, `exception/ErrorMessages.java`; tests `controller/ClientShoppingListControllerTest.java`, `controller/ClientProductFeedbackTest.java`, `controller/ProductControllerTest.java`, `model/ProductTest.java`, `repository/SummaryQueriesTest.java`.

**Interfaces:** `ClientShoppingListService.list(UUID officeId,UUID clientId) -> List<ClientListSummaryResponse>`, `get(UUID officeId,UUID clientId,UUID listId) -> ClientListDetailResponse`, `setPurchase(UUID officeId,UUID clientId,UUID listId,UUID productId,ProductPurchaseRequest) -> ClientListDetailResponse.ClientProduct`, `setClientNotes(UUID officeId,UUID clientId,UUID listId,UUID productId,ProductClientNotesRequest) -> ClientListDetailResponse.ClientProduct`; `ProductService.updateClientNotes(UUID officeId,UUID productId,ProductClientNotesRequest) -> ProductResponse`. Request records are `ProductPurchaseRequest(Boolean bought)` and `ProductClientNotesRequest(String clientNotes)`. Product adds `getClientNotes()` and `changeClientNotes(String)`.

- [ ] **1. Write failing ownership/data-minimization tests.** Given clients A/B in one office and C in another, `GET /api/client/lists` returns only A's old/new lists; detail and product writes for B/C return 404. Assert a product from another list also returns 404 even if both lists belong to A. Assert responses omit prices, internal notes, images, share tokens, contacts and other clients; signature excludes clients. Empty lists return 200 with empty rooms and zero counts.

In `clientCannotReadAnotherClientsList`, `clientA` is A's TestSession and `listB` belongs to B:

```java
assertThat(mvc.get().uri("/api/client/lists/{listId}", listB)
        .header(HttpHeaders.AUTHORIZATION, bearer(clientA)).exchange()).hasStatus(HttpStatus.NOT_FOUND);
```
- [ ] **2. Run RED:** `./mvnw test -Dtest='ClientShoppingListControllerTest,ClientProductFeedbackTest,ProductControllerTest'`. Pin strict writes with actual bodies: `{"bought":true}` updates only bought; `{"clientNotes":"  Bought locally  "}` stores `"Bought locally"`; `{"clientNotes":null}` and blank text clear it; 1,000 characters pass, 1,001 fail. Unknown fields such as `quantity`, `role`, `notes`, `clientId` and invalid JSON/types return 400 and leave all values unchanged. Explicit null/missing bought is invalid; an empty notes body is also 400 so a missing property cannot erase saved text. Require the nullable `clientNotes` creator property explicitly, preserving the distinction between missing and explicit null.
- [ ] **3. Implement V7, DTOs and endpoints from the contract table.** Add nullable `products.client_notes varchar(1000)` only. Bind ownership to verified office/client claims. Use client-specific summary/detail DTOs rather than filtering private JSON in the browser. Use locally strict request binding for new purchase/notes/acceptance DTOs (for example a rejecting `@JsonAnySetter` on each record); do not silently discard extra fields or change global deserialization contracts. Reject type coercion for the strict new requests. Normalize notes with `Inputs.optionalText`; use entity length constants in API/UI validation.
- [ ] **4. Preserve concurrent writes.** Lock the list before loading products, then recheck current client ownership after the lock. Notes setter changes only clientNotes; purchase setter changes only bought; administrative quantity/status keeps its current meaning. Full administrative product edits must leave clientNotes unchanged. Use the existing list touch/flush patterns. Test purchase and notes writes waiting on the same list lock both survive, and a waiting previous-owner write after transfer receives 404 without mutation. Assert admin can read/edit clientNotes and that counts/totals update after client purchases.
- [ ] **5. Run GREEN:** repeat the focused classes plus `./mvnw test -Dtest='ProductTest,SummaryQueriesTest,ShoppingListControllerTest'`. Suggested API-only commit: `Add private client lists and product feedback.`

## Task 5: Authorize Legacy Share Links and Product Image Reads

**Files:** Private resources row, `config/SecurityConfig.java`, `repository/ShoppingListRepository.java`; tests `controller/PublicListControllerTest.java`, `controller/ProductImageControllerTest.java`, `controller/RoleAuthorizationTest.java`.

**Interfaces:** `ListAccessService.resolve(UUID userId,String shareToken) -> ListAccessResponse(UUID listId,UserRole role)`; `ProductImageService.load(UUID userId,UUID imageId) -> ImageContent`. These mixed-role services load the current account and enforce office/client ownership before returning a result. Remove the unauthenticated `ShoppingListService.getPublic(String)` path and retire `PublicListResponse` if no caller remains.

- [ ] **1. Write failing access assertions.** Anonymous legacy share/image reads return 401; owner CLIENT and same-office ADMIN succeed; another client in the same office and any account in another office return 404. Deleted accounts fail authentication. After reassignment, only the new client can resolve the same token or read its image; rotated tokens return 404 even for the old owner. Include malformed tokens/UUIDs and valid nonexistent IDs without internal details.

In `sharedListRequiresAuthentication`, use `shareToken` from a real admin-created list:

```java
assertThat(mvc.get().uri("/api/public/lists/{token}", shareToken).exchange())
        .hasStatus(HttpStatus.UNAUTHORIZED);
```
- [ ] **2. Run RED:** `./mvnw test -Dtest='PublicListControllerTest,ProductImageControllerTest,RoleAuthorizationTest'`. Assert the share response has exactly listId/role, no list payload. Assert successful image bytes/type are preserved and Cache-Control is private/no-store, never public or year-long. Keep existing upload validation and office-isolation assertions.
- [ ] **3. Implement mixed-role reads.** Remove public exemptions for `/api/public/**` and `/api/images/**`, add explicit authenticated matchers before the admin catch-all, scope image queries by a join through product → room → list → client and the current account. Never load/disclose an image or list before authorization. Return 404 consistently for inaccessible resources. Remove unreachable public serialization and update comments/contracts rather than retaining a second public reader.
- [ ] **4. Run GREEN:** repeat the focused tests; grep production controllers/security for any alternate public list/image readers. Suggested API-only commit: `Require ownership for shared lists and images.`

## Task 6: Role-Aware Login, Navigation and Server Page Guards

**Files:** `lib/auth-routing.js`, `lib/auth-routing.test.js`, `lib/auth.server.js`, `lib/auth.server.test.js`, `lib/api.server.js`, its tests, `test-support/fixtures.js`, `components/auth/{AuthForms.js,actions.js}` and tests, `components/layout/{AppShell.js,AppShell.test.js}`, `components/configuracoes/{SettingsForm.js,actions.js}` and tests; `app/(app)/layout.js`, new `app/(app)/(admin)/layout.js`, `app/(auth)/login/page.js`, `app/(auth)/cadastro/page.js`, `app/routes.test.js`.

Move the complete existing `app/(app)/dashboard/`, `clientes/`, `listas/` and `escritorio/` folders under `app/(app)/(admin)/`, including colocated tests. Route groups do not change their URLs. Keep `configuracoes/` and the shared error/loading files under `(app)`; update all source/test imports affected by moves.

**Interfaces:** `getHomePath(user:{role:string}) -> string` returns `/dashboard` or `/my-lists`; `safeReturnPath(value:unknown) -> string|null` accepts only `/l/{validShareToken}` with no query/fragment; `getLoginPath(returnTo?:string) -> string` builds a local login URL from that validator. `requireAdmin() -> Promise<MeResponse>` redirects clients home; `requireClient() -> Promise<MeResponse>` redirects admins home. Both rely on request-scoped `getCurrentUser()`. Add optional `returnTo` to `apiRequest`/`readApi` options for protected 401/missing-cookie redirects; never attach JWTs to public auth requests. Fixture `ME` remains ADMIN; new `CLIENT_ME` has `role:'CLIENT'` and the existing client fixture's UUID as `clientId`.

- [ ] **1. Write failing UI/access assertions.** Existing `LoginForm` success for a CLIENT must navigate to `/my-lists`; ADMIN to `/dashboard`; no “Criar conta” link. Pass `{role:'CLIENT',clientId:...}` through login, `/api/me`, profile update and password-change sanitizers without dropping either field. Assert the client shell has only “Minhas listas”, “Configurações”, “Sair” and a role-correct logo link; the admin menu is preserved. CLIENT entering admin layout is redirected; malformed/unknown roles fail closed without rendering protected children.

Assertions in `clientLoginOpensOwnLists` after filling/submitting LoginForm with the existing Testing Library helpers and a successful CLIENT_ME login mock:

```js
await waitFor(() => expect(push).toHaveBeenCalledWith('/my-lists'));
expect(screen.queryByRole('link', { name: 'Criar conta' })).toBeNull();
```
- [ ] **2. Run RED:** from `ui/nextjs/`, `npx vitest run components/auth/AuthForms.test.js components/auth/actions.test.js components/layout/AppShell.test.js lib/auth-routing.test.js lib/auth.server.test.js lib/api.server.test.js app/routes.test.js`. Assert hostile `next` values (`https://evil.example`, `//evil.example`, backslashes, encoded separators, arrays and invalid tokens) are discarded; only a valid local share path survives success and protected 401 redirects.
- [ ] **3. Implement helpers, guards and navigation.** Shared layout authenticates both roles; `(admin)/layout.js` calls `requireAdmin` before returning its content. CLIENT pages get their own guard in Task 8. Keep API authorization as the final data boundary because Next can render layouts/pages in parallel. `LoginForm({returnTo})` gets a validated server-provided target; use the same helper after acceptance. Validate role/client binding before writing a new session; own-password responses retain it. Remove signup action/form and redirect the legacy `/cadastro` page to `/login`; remove all create-account links. Preserve reset/profile/password functionality for both roles and adjust the client profile description so it does not claim their name appears as an architect signature.
- [ ] **4. Translate changed form identifiers/comments to English while leaving labels in Portuguese.** For example, `password`, `confirmPassword`, `currentPassword`, `name`; update field maps, HTML ids, focus assertions and validators together. Do not rename unrelated legacy URLs or components for style alone. Add `role/clientId` to ADMIN fixtures and a separate CLIENT fixture instead of making every test user a client.
- [ ] **5. Run GREEN:** repeat the focused command plus `npx vitest run components/configuracoes/SettingsForm.test.js components/configuracoes/actions.test.js lib/session.server.test.js`; verify moved-page tests collect. Suggested boundary: `Route authenticated users according to their account role.` No UI commit without explicit authorization.

## Task 7: Client Invitation Management and Password Acceptance UI

**Files:** Create `components/client-access/{ClientAccessManager.js,actions.js,queries.server.js}` and adjacent tests, `app/(auth)/invitation/{page.js,page.test.js}`. Move `components/convite/{InvitationForm.js,InvitationForm.test.js,actions.js,actions.test.js}` to `components/invitation/`; update imports. Modify `app/(auth)/convite/page.js` and its tests as a legacy redirect, `app/(app)/(admin)/clientes/[id]/page.js`, `components/clientes/Clientes.js`, `components/escritorio/{OfficeManager.js,actions.js}` and tests, `app/(app)/(admin)/escritorio/page.js` and tests, fixtures and route tests.

**Interfaces:** `getClientAccess(clientId:string) -> Promise<ClientAccessResponse>`; Server Actions `inviteClient(clientId:string) -> Promise<ActionResult<InvitationResponse>>`, `revokeClientInvitation(clientId:string,invitationId:string) -> Promise<ActionResult<void>>`; `ClientAccessManager({clientId,access})`. `acceptInvitation(token:string,input:{password:string}) -> Promise<ActionResult<MeResponse>>` validates/sanitizes role/client identity before setting the session. `InvitationForm({token,invitation:{email,clientName,officeName,invitedByName}})` no longer asks for a name.

- [ ] **1. Write failing acceptance/access tests.** Admin client detail displays “Convidar cliente”, “Reenviar convite”, “Revogar convite” or active access/email according to the four contract states. No email field in the send action; no fake success on 409/500/transport failure. Pending requests disable duplicate sends and refresh only after API success. Acceptance shows fixed client name/email, asks for password/confirmation, sends only `{password}`, sets a valid CLIENT session and navigates to `/my-lists`.

Assertions in `acceptanceUsesOnlyTheChosenPassword` after filling a matching password pair and submitting InvitationForm for valid `token`:

```js
await waitFor(() => expect(acceptInvitation).toHaveBeenCalledWith(token, { password: 'clientPassword1' }));
expect(screen.queryByLabelText('Nome completo')).toBeNull();
await waitFor(() => expect(push).toHaveBeenCalledWith('/my-lists'));
```
- [ ] **2. Run RED:** `npx vitest run components/client-access/ClientAccessManager.test.js components/client-access/actions.test.js components/client-access/queries.server.test.js components/invitation/InvitationForm.test.js components/invitation/actions.test.js 'app/(auth)/invitation/page.test.js'`. Assert malformed IDs/tokens/bodies cause no fetch or session write, expired/revoked invitations show the established unavailable state, API outages reach the error boundary, mismatched passwords fail locally, and unmount/late success causes no navigation or toast. Use deferred promises instead of fake network timers.
- [ ] **3. Implement fixed actions and pages against Task 3 contracts.** Validate UUIDs and whitelist fields. Refresh client detail after successful send/revoke; keep active login email distinct from contact email in copy. Preserve the previous client's pending state if sending fails. `/invitation` inspects tokens without reading/forwarding an existing JWT; validate every required response field. The existing `/convite` page redirects a validated token to `/invitation?token=...` and never creates accounts itself.
- [ ] **4. Retire office member invitation controls/actions/tests.** Keep office rename and ADMIN members. Replace member-invitation assertions with absence of those controls; client invites live only on the specific client's page. Update the contact-email hint to explain invitations and the independence of an active login email. Keep unrelated client editing/deletion behavior.
- [ ] **5. Run GREEN:** repeat focused tests plus `npx vitest run components/clientes/Clientes.test.js components/escritorio/OfficeManager.test.js components/escritorio/actions.test.js app/routes.test.js`; check both affected page tests at their new paths. Suggested boundary: `Let admins invite clients to activate their access.`

## Task 8: Client List Pages, Purchase Controls and Reusable Note Editor

**Files:** Create `components/client-shopping/{ClientLists.js,ClientShoppingList.js,queries.server.js,actions.js}` and adjacent tests; `components/lista/{ProductClientNotesEditor.js,ProductClientNotesEditor.test.js}`; `app/(app)/my-lists/{layout.js,page.js,page.test.js,[id]/page.js,[id]/page.test.js}`. Modify `lib/validation.js`, its tests, `lib/revalidate.server.js`, client DTO fixtures and `app/styles/lista.css` only if existing classes are insufficient.

**Interfaces:** `getClientLists() -> Promise<ClientListSummaryResponse[]>`, cached `getClientList(listId:string) -> Promise<ClientListDetailResponse>`; `setClientPurchase(listId:string,productId:string,bought:boolean) -> Promise<ActionResult<ClientProduct>>`, `saveClientNotes(listId:string,productId:string,clientNotes:string|null) -> Promise<ActionResult<ClientProduct>>`. `ClientLists({lists:ClientListSummaryResponse[]})` and `ClientShoppingList({list:ClientListDetailResponse})`; fixtures `CLIENT_LIST` and `CLIENT_PRODUCT` use the client DTOs from the fixed contract, never a spread of private DTOs. `ProductClientNotesEditor({productId,productName,clientNotes,onSave})`, where `onSave(notes:string|null)` returns `Promise<ActionResult<{clientNotes:string|null}>>`; extra product fields are allowed in a successful data object. The editor owns its draft/pending/error state; its caller owns endpoint selection and refresh. Its textarea's accessible name is `Observação do cliente: ${productName}` and save button's is `Salvar observação de ${productName}`.

- [ ] **1. Write failing page/list assertions.** CLIENT guard is required; pages load only `/api/client/lists...` and API-shaped props. Client cards show progress and `/my-lists/{id}` links without admin actions or prices. Empty overview/list uses existing EmptyState styling; errors are not rendered as successful emptiness. List detail preserves room/name/quantity/link layout, shows bought checkboxes, notes, three filters and authoritative counts; invalid UUID/404 reaches notFound. Metadata reads only the protected client endpoint, including for unauthorized list IDs.

Core assertions in `purchaseSaveUsesTheClientEndpoint` after rendering ClientShoppingList with CLIENT_LIST and a successful action mock:

```js
fireEvent.click(screen.getByRole('checkbox', { name: `Comprado: ${CLIENT_PRODUCT.name}` }));
await waitFor(() => expect(setClientPurchase).toHaveBeenCalledWith(CLIENT_LIST.id, CLIENT_PRODUCT.id, true));
expect(screen.queryByRole('link', { name: 'Editar lista' })).toBeNull();
```
- [ ] **2. Run RED:** `npx vitest run components/client-shopping/ClientLists.test.js components/client-shopping/ClientShoppingList.test.js components/client-shopping/actions.test.js components/client-shopping/queries.server.test.js components/lista/ProductClientNotesEditor.test.js 'app/(app)/my-lists/page.test.js' 'app/(app)/my-lists/[id]/page.test.js'`. For new components expose inert exports first so the failure is a missing behavior assertion. Test explicit save/clear, immediate purchase save, 1,000/1,001 characters, errors and double submit. Render a note containing HTML and assert literal text, not an inserted DOM element.
- [ ] **3. Implement strict transport adapters.** Purchase action sends only `{bought}` to the nested product PATCH; notes action sends only `{clientNotes}` to its PUT. Reject unknown input, malformed IDs, non-booleans and oversized notes before fetch. Both use authenticated fixed paths, `actionResult` and invalidate admin summaries plus `/my-lists` and `/my-lists/[id]` after success. Never fetch the admin list endpoint as a client preflight. Query helpers use no-store reads and do not reconstruct private DTOs in the browser.
- [ ] **4. Implement pages/components using current CSS and Fields/Button/feedback utilities.** Call `requireClient` in the client layout. Key per-product editor ownership by list/product UUID so moving to another list cannot retain a draft. Refresh after confirmed writes; derive saved products and counts from refreshed server props. The editor must preserve a dirty draft through unrelated checkbox refreshes and failed saves; do not reset every draft whenever list props arrive. Keep separate purchase/note pending guards, suppress late callbacks after unmount and keep inputs/errors associated by English IDs and Portuguese labels.
- [ ] **5. Run GREEN with deferred-response assertions.** While a note is dirty, resolve a purchase and rerender saved list props: the draft stays. Reject a note save: the draft stays and an error appears. Resolve/reject after navigation: no feedback/navigation on the old view. Successful note save updates the saved value without overwriting another field. Filter/count assertions follow returned data, not optimistic local totals. Suggested boundary: `Add private shopping lists for invited clients.`

## Task 9: Private Shared-Link Navigation and Authenticated Images in Next.js

**Files:** `app/l/[shareToken]/{page.js,page.test.js}`, `components/lista/{ShareControls.js,ShareControls.test.js}`, `lib/api.server.js` and tests; new `app/images/[imageId]/{route.js,route.test.js}`, `lib/product-images.server.js` and tests; `lib/format.js`, `lib/format.test.js`; `components/lista/RoomTable.test.js`, `components/produtos/ProductForm.test.js`, route fixtures/tests.

**Interfaces:** Protected share resolver uses `readApi('/api/public/lists/'+token,{returnTo:'/l/'+token}) -> {listId,role}`. It validates response UUID/role then redirects ADMIN to `/listas/{id}` and CLIENT to `/my-lists/{id}`. Export the existing fixed-origin URL builder as `requestUrl(path:string) -> URL` for reuse by the binary adapter. `readProductImage(imageId:string) -> Promise<Response>` reads the cookie server-side and fetches only the fixed `/api/images/{uuid}` path; `GET(request,{params:Promise<{imageId:string}>}) -> Promise<Response>` delegates to it. `imageSource(imageUrl:string|null) -> string|null` maps valid API image paths to same-origin `/images/{uuid}` URLs.

- [ ] **1. Write failing privacy/redirect tests.** No cookie at `/l/{token}` redirects to `/login?next=` plus the encoded valid local share path; stale-cookie 401 preserves that return target. Owner/admin navigate to their authorized destination; 404 reaches notFound; malformed tokens produce no API request; malformed resolver role/UUID is not used as a destination. Replace old anonymous public-content tests, retaining network-error handling. Share controls say “Link da lista” and login/permission is required; copy/rotation and old-token revocation remain admin-only.

In `imageProxyDoesNotFetchWithoutASession`, clear the cookie mock and use a valid fixture image UUID as `imageId`:

```js
const response = await GET(new Request(`http://localhost/images/${imageId}`), {
  params: Promise.resolve({ imageId }),
});
expect(response.status).toBe(401);
expect(fetchMock).not.toHaveBeenCalled();
```
- [ ] **2. Run RED:** `npx vitest run 'app/l/[shareToken]/page.test.js' components/lista/ShareControls.test.js lib/api.server.test.js lib/format.test.js lib/product-images.server.test.js 'app/images/[imageId]/route.test.js'`. Test the image route with no cookie (401), expired cookie (401), inaccessible image (404), API outage (503), valid PNG/JPEG bytes and private/no-store headers. Malformed IDs, query-injected IDs and full URLs must not trigger fetch; cookies/tokens/upstream errors must not be echoed to the browser.
- [ ] **3. Implement protected link lookup and fixed-origin binary fetch.** Remove `auth:'public'` for share reads and adjust the API helper's old public-path rule so protected share/image paths can carry JWTs. Public auth endpoints still never forward a stale JWT. The binary adapter reuses fixed-origin URL validation and timeout but does not force binary through the JSON parser. Return only permitted status/content headers and safe ProblemDetail for failures; do not forward Set-Cookie, arbitrary redirects or public cache headers. Never send the JWT in a URL or HTML.
- [ ] **4. Point all persisted image consumers to the local proxy.** Keep object-URL upload previews local and unchanged. Reject arbitrary image origins rather than turning the proxy into a URL-fetch service. Remove public image assumptions from tests and ensure protected share metadata does not read list data anonymously.
- [ ] **5. Run GREEN:** repeat the focused suite plus `npx vitest run components/lista/RoomTable.test.js components/produtos/ProductForm.test.js app/routes.test.js`. Suggested boundary: `Protect shared links and proxy authenticated product images.`

## Task 10: Admin Feedback Editing and Read-Only Client Preview

**Files:** `components/lista/{RoomTable.js,ShoppingList.js,ClientView.js}` and tests, `components/produtos/actions.js`, `components/produtos/actions.test.js`, `components/listas/queries.server.js`, fixtures; new client view tests if needed. Reuse the note editor produced by Task 8; do not introduce another note draft implementation.

**Interfaces:** `saveProductClientNotes(listId:string,productId:string,clientNotes:string|null) -> Promise<ActionResult<ProductResponse>>` validates IDs and product/list membership like existing admin product actions, then calls `/api/products/{productId}/client-notes`. `ProductResponse` gains `clientNotes:string|null` in all UI JSDoc and fixtures. `RoomTable` gets `onNotes(id:string,notes:string|null)`; `ShoppingList` binds it to the admin action and confirmed refresh.

- [ ] **1. Write failing admin/preview assertions.** Admin rows display the client's saved observation, can save/clear it, and retain existing purchase/quantity/product/room controls. The preview shows bought state and client notes as text without edit controls. No CLIENT account is listed in the architect signature. Full product save payloads do not include clientNotes and do not erase it; notes save payloads do not include bought, quantity or internal notes.

In `adminCanReadTheClientObservation`, render the normal admin ShoppingList fixture with PRODUCT.clientNotes set to `Bought locally`:

```js
expect(screen.getByRole('textbox', { name: `Observação do cliente: ${PRODUCT.name}` }).value)
  .toBe('Bought locally');
fireEvent.click(screen.getByRole('button', { name: 'Ver como cliente' }));
expect(screen.getByText('Bought locally')).toBeTruthy();
expect(screen.queryByRole('button', { name: `Salvar observação de ${PRODUCT.name}` })).toBeNull();
```
- [ ] **2. Run RED:** `npx vitest run components/lista/RoomTable.test.js components/lista/ShoppingList.test.js components/lista/ClientView.test.js components/produtos/actions.test.js`. Assert failure preserves draft and no success toast, cross-list product causes no PUT, successful save refreshes, and an unrelated purchase/quantity refresh preserves a dirty note draft. Keep the existing two-tap removal and quantity validation regressions.
- [ ] **3. Integrate the existing editor with admin callbacks.** Give “Observação do cliente” its own field and error display; keep internal `notes` and link notes separate. Extend the read-only ClientView to show clientNotes without a save handler. Maintain admin mutation guards and server-authoritative totals. Keep updated props/typedefs complete; no client account data reaches the preview signature.
- [ ] **4. Run GREEN:** repeat the focused command plus `npx vitest run components/lista/ProductClientNotesEditor.test.js components/client-shopping/ClientShoppingList.test.js components/produtos/ProductForm.test.js`. Suggested boundary: `Let admins edit client purchase observations.`

## Final Verification and Handoff

- [ ] **Review coverage before broad checks.** Trace every approved spec requirement to Tasks 1–10. Confirm creation of new lists, contact/login changes, deletion, list reassignment, admin scope, clientNotes clearing, strict payloads, unchanged password settings, legacy token handling, protected images and hidden private fields are covered. No old signup/member-invite fixture may bypass the new access model.
- [ ] **Update operational documentation.** Describe local setup, client invitations, account states, private shared links, admin SQL provisioning and first rollout in `api/README.md` and `ui/README.md`. Update factual maps in root/API/UI `AGENTS.md` where this change makes them inaccurate, without weakening boundaries or tests. Record any repeated UI implementation pitfall only as required by the existing UI rules. Document that previously downloaded/publicly cached images cannot be recalled. No production account insertion, migration execution or deployment.
- [ ] **Run final API checks:** from `api/`, `./mvnw verify`; expected `BUILD SUCCESS`, zero failures/errors/skipped. Use JDK 25 and a running Docker per `api/AGENTS.md`; do not change dependencies or suppress unavailable-test evidence.
- [ ] **Run final UI checks:** from `ui/nextjs/`, `npm run lint` (zero errors, only the two accepted img warnings), `npm test` (all pass), then `npm run build` (success; accepted workspace-root warning). Stop dev server before build; do not claim these ran during planning.
- [ ] **Check real screens on desktop and phone.** With the local API/mailbox: admin sends an invitation, client chooses password, logs in, sees only their lists, saves a note/checkbox, admin sees/edits them, and a second client cannot use the first client's link. Verify layout, keyboard labels, form focus, dark theme and image rendering using existing tooling; no new browser-test dependency.
- [ ] **Run one independent code-quality review** of the final candidate and recorded RED/GREEN/final-check evidence, using the global skill and one reviewer at a time. Resolve blocking findings and get the reviewer's recheck; rerun only checks invalidated by corrections. Do not substitute self-review for the required independent review or report an unverified criterion as passed.
- [ ] **Verify diff/status and report evidence.** Keep unrelated changes and generated output out. Report what changed, focused/full check results, review status and any actual limitations. Leave UI code uncommitted unless explicitly authorized; do not push, deploy or touch production as part of this plan.

## Planning Self-Review

- Spec coverage: identity/provisioning/old sessions → 1–2; invitation states, races and contact/login separation → 3 and 7; owner-scoped lists/feedback/transfer → 4 and 8; public-link/image closure → 5 and 9; admin feedback/preview → 10; existing style and language → 6–10; rollout and independent verification → final gates.
- Interfaces: clients use `clientNotes` everywhere; purchase PATCH and notes PUT are independent; client and admin DTOs intentionally differ; `role/clientId` survive all session-returning paths; the binary image adapter reuses the fixed origin without JSON parsing.
- Review Focus: all five conditions above have explicit owning tests, including malformed identity, invitation races, post-lock ownership checks, local return paths and note draft preservation.
- Scope: no dependencies, new auth platform, unrelated URL migration, real-time transport, audit model or production action. All new code paths/names are English; only UI copy is Portuguese.
- Execution has not started. The user must review this plan and choose the execution method required by the writing-plans skill.
