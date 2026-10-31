# UI/API Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the prototype's fake data and simulated saves with authenticated, persistent API workflows, including rooms, products, images, account recovery and public sharing.

**Architecture:** Keep reads in Next.js Server Components and send mutations through feature-local Server Actions. Store the API JWT in an httpOnly cookie; a server-only HTTP client forwards it as a Bearer header, while Spring remains the authority for office ownership and business validation. Use the API's English DTO fields directly in display components; map Portuguese form keys only at form submission and error rendering.

**Tech Stack:** Next.js 15.5.28 App Router, React/React DOM 19.1.10, plain JavaScript, npm, Vitest 5.0.5, Testing Library, existing CSS; existing Java 25 / Spring Boot 4.1.2 / PostgreSQL 18 API.

**Spec:** `api/PLANO-BACKEND.md`, especially "Contrato da API", "Formato de erro", "Impacto no frontend" and "Fora do escopo e riscos aceitos"; `AGENTS.md`; `ui/AGENTS.md`; the approved decisions recorded below. Implemented API DTOs/controllers take precedence over stale examples in the backend plan.

## Global Constraints

- Work only in the existing `/Users/brunovidotto/Documents/bruno/selecao-fluiar` worktree. Do not create another worktree or switch branches.
- "User-facing text is Brazilian Portuguese." Code and JSON fields stay English; retain existing Portuguese form keys and URL folders.
- "Next.js 15 (App Router), React 19, plain JavaScript." Do not introduce TypeScript, state libraries, tools or dependency changes without separate approval.
- "Keep data loading in pages." Await Next 15 `params`, `searchParams` and `cookies()`.
- "Base URL from `NEXT_PUBLIC_API_URL`." Local value: `http://localhost:8080`, without `/api`; paths in this plan include `/api`.
- "Errors are `ProblemDetail`: show `detail` in a toast and each `errors[field]` under its field." Keep API message wording unchanged.
- "Usar o campo `completed` no lugar de `bought === total` (lista vazia não é \"Concluída\")." This is the JSON property `completed`, not the Java accessor `isCompleted`.
- Preserve the existing design, fonts and CSS variables; do not edit `ui/html/`, generated output or the historical quality ledger.
- Do not change API endpoints, DTOs, status codes, security configuration or migrations. Ask first if the actual integration reveals a contract defect.
- "Do not commit secrets." Never stage `node_modules/`, `.next/`, `api/target/` or `ui/.playwright-mcp/`.
- Commit messages are one short imperative sentence ending with a period. No push, deploy or PR is included.
- Run focused tests while iterating; one final full UI gate. If API code changes are separately approved, also require `./mvnw verify` with no skipped tests.

## Review Focus

- A JWT revoked by a password change must send protected reads and writes to `/login`, while a stale cookie must not break public reset/invitation/share requests (Tasks 1, 3, 9; companion Task 2).
- A mismatched nested product URL or another office's UUID must not display or modify the wrong resource (Tasks 4, 5, 7, 8 and the final two-account browser check).
- A product saved successfully before an image failure must remain saved; retrying must not create a second product or report complete success (Task 7).
- Empty rooms/lists, null prices and an unsaved numeric draft must not become completed lists, fabricated zero-price products or successful purchases (Tasks 2, 5, 6, 8).
- API-indexed link errors after dropping blank rows, non-ASCII passwords at the BCrypt byte limit and failures without JSON must remain understandable and actionable (Tasks 1, 2, 7).

---

## Approved Decisions And Scope

- User selected httpOnly cookie + server calls, the full backend frontend-impact scope, a separate room-management page, and a baseline commit before integration.
- User explicitly requires all work in this worktree. No worktree-creation prerequisite applies.
- Remove `ProtoNav`, hard-coded people/contact details, fake saves and `?estado=` demo switches as each affected screen is integrated. Real empty/error states replace them.
- Office management and invitation acceptance are a separable deliverable: execute `2026-10-31-office-invitations-integration.md` after Tasks 1-3. Both plans are required to complete the user's "Everything" scope.
- Do not implement roles, member removal, automatic client email delivery, account deletion, refresh tokens, server logout, pagination, live updates or deployment.
- The baseline commit is already authorized. Subsequent small commits below are proposed as part of plan approval; do not make them before that approval.

## File Structure And Ownership

All paths below are relative to the repository root unless a task explicitly says "UI-relative". UI commands run from `ui/nextjs/`.

| File or area | Responsibility |
| --- | --- |
| `.gitignore` (new) | Exclude local environments, generated output and browser artifacts before the approved baseline is staged. |
| `ui/nextjs/lib/session.server.js` (new) | Read/write/delete the session cookie; no JWT secret or browser token storage. |
| `ui/nextjs/lib/api.server.js` (new) | Fixed-origin HTTP requests, Bearer forwarding, JSON/204 handling, expected error conversion. |
| `ui/nextjs/lib/route-input.js` (new) | UUID and opaque-link-token validation before interpolation into API paths. |
| `ui/nextjs/lib/revalidate.server.js` (new) | Invalidate the affected workspace views after a successful mutation. |
| `ui/nextjs/components/forms/useApiForm.js` (new) | Async submission, duplicate-submit guard, field errors and feedback; replaces `useDemoForm`. |
| `ui/nextjs/lib/validation.js`, `lib/format.js` | Shared messages/rules and Brazilian display formatting; no API I/O. |
| `ui/nextjs/components/auth/actions.js` (new), `AuthForms.js` | Authentication/recovery commands and forms. |
| `ui/nextjs/components/clientes/actions.js` (new), `Clientes.js` | Client commands, forms and delete-confirmation behavior. |
| `ui/nextjs/components/listas/actions.js` (new), `Listas.js` | Shopping-list commands, filters, forms and cards. |
| `ui/nextjs/components/ambientes/actions.js`, `RoomManager.js` (new) | Room CRUD and accessible up/down ordering. |
| `ui/nextjs/components/produtos/actions.js`, `product-values.js` (new), `ProductForm.js` | Product persistence, multipart images, form-to-DTO conversion and indexed-link errors. |
| `ui/nextjs/components/lista/*.js` | Persisted private list and shared read-only product tables; no demo DTOs. |
| `ui/nextjs/components/lista/ShareControls.js`, `actions.js` (new) | Copy and explicitly rotate share links. |
| `ui/nextjs/components/configuracoes/actions.js` (new), `SettingsForm.js` | Separate profile/password requests and token replacement. |
| `ui/nextjs/app/(app)/**/page.js`, `app/(auth)/**/page.js` | Server reads, metadata, route checks, real empty/invalid-link states. |
| `ui/nextjs/app/(app)/listas/[id]/ambientes/page.js` (new) | Room management route. |
| `ui/nextjs/app/l/[shareToken]/page.js` (new) | Public read-only list outside the authenticated layout. |
| `ui/nextjs/app/error.js`, `app/(app)/error.js`, `app/(app)/loading.js`, `app/(auth)/error.js`, `app/l/[shareToken]/error.js` (new) | Retryable layout/page failures and loading feedback; the root boundary also catches failures in the authenticated layout itself. |
| `ui/nextjs/test-support/fixtures.js` (new) | Deterministic API-shaped test data only. Never imported by production modules. |
| `ui/nextjs/lib/data.js`, `components/forms/useDemoForm.js`, `components/layout/ProtoNav.js` | Retire after the final consumer is migrated; do not leave a fake-data fallback. |

Tests live next to their modules. Feature `actions.test.js` files call the actions directly, mocking server HTTP/session/navigation/cache seams, not the component that calls them.

## Shared Interfaces

Use JSDoc for these shapes, not TypeScript. This section defines names used across tasks.

- `ActionResult<T> = { ok: true, data: T } | { ok: false, status: number, detail: string, errors: Record<string,string> }`.
- `ApiError(status, detail, errors = {})` is exported by `lib/api.server.js`. Only expected HTTP/transport errors become `ActionResult` failures.
- `apiRequest(path, { method = 'GET', body, auth = 'required' } = {}) -> Promise<DTO | undefined>`; `body` is a JSON object or `FormData`; `auth` is `'required' | 'public'`.
- `readApi(path, options?) -> Promise<DTO | undefined>` calls `apiRequest`, maps resource 404 to `notFound()`, and otherwise rethrows. Expected invalid reset/invitation links are handled by their pages, not converted to 404.
- `actionResult(work: () => Promise<T>) -> Promise<ActionResult<T>>` wraps only `ApiError`; it must rethrow Next navigation signals and unexpected programming errors.
- `getAccessToken() -> Promise<string | null>`, `setSession(authResponse, { persistent = false } = {}) -> Promise<void>`, `clearSession() -> Promise<void>` in `session.server.js`.
- `getCurrentUser() -> Promise<MeResponse>` in `api.server.js` uses request-scoped `React.cache` around `GET /api/me`. No module-level user/token cache.
- `isUuid(value) -> boolean`, `isLinkToken(value) -> boolean`, `requireUuid(value) -> string` in `route-input.js`. UUID matches the complete canonical hexadecimal `8-4-4-4-12` form (case-insensitive). Link tokens match `^[A-Za-z0-9_-]{43}$`. Invalid route IDs call `notFound()`; invalid mutation IDs become 400 `Revise os dados enviados.` without an HTTP write.
- `revalidateWorkspaceData() -> void` invalidates `/dashboard`, `/clientes`, `/clientes/[id]` (`layout`), `/listas`, `/listas/[id]` (`layout`). This is the shared set of views whose counts/contents change; do not invalidate the root, auth or public tree.
- API DTO names in task signatures refer to the exact records under `api/src/main/java/br/com/fluiar/selecao/dto/`, not new UI models. For example, `ProductResponse` has `quantity`, `unitPrice`, `imageUrl`, `links: [{url,note}]`; `RoomResponse` has `products`, not `items`.
- Each action validates UUID/token arguments and the documented input object's scalar/array types before forwarding a whitelisted body; reject null/array bodies as 400 `Revise os dados enviados.` without a write. Detailed field/business validation remains authoritative in the API. Do not export an action that accepts an arbitrary API path, HTTP method, token, office ID or user ID.

## Test And Commit Procedure

For each task: write its tests first, run the named focused command and record the real RED failure, implement, run GREEN, then review/refactor without changing behavior. Do not claim RED from a missing import alone: create an inert interface stub if needed and observe the behavioral assertion fail.

Test snippets specify assertion cores, not repeated import/mock boilerplate. Use Vitest/Testing Library imports and the existing Portuguese role/label queries. Mock `next/navigation` with throwing `redirect`/`notFound` signals so tests cannot accidentally continue after navigation. Mock `next/headers` and `next/cache` in server tests. Install no test framework.

Create deterministic API fixtures with UUIDs: client `11111111-1111-4111-8111-111111111111`, list `22222222-2222-4222-8222-222222222222`, room `33333333-3333-4333-8333-333333333333`, product `44444444-4444-4444-8444-444444444444`; use a second room `33333333-3333-4333-8333-333333335555`, and a second product `44444444-4444-4444-8444-444444446666`. Export `CLIENT`, `LIST`, `ROOM`, `PRODUCT`, `ME`, `DASHBOARD`, `PUBLIC_LIST` from `test-support/fixtures.js`. `ME.id = '88888888-8888-4888-8888-888888888888'`, `ME.officeId = '77777777-7777-4777-8777-777777777777'`, `ME.officeName = 'Escritório de Ana Lima'`, `ME.name = 'Ana Lima'`, `ME.email = 'ana@example.com'`. `CLIENT.phone = '31999998888'`. `LIST.shareToken = 'a'.repeat(43)`. Default list has one room/product named `Cozinha`/`Batedeira`, quantity 2, unit price 12.50, `bought: false`, and stats `{totalProducts:1,boughtProducts:0,pendingProducts:1,estimatedTotal:25,remainingTotal:25}`. Construct complete DTOs according to their Java records; `PUBLIC_LIST` contains only the public subset.

Choose an execution approach with the user before implementation. In subagent-driven execution, each task gets an implementation context and a fresh independent read-only Next.js reviewer before its commit. In native execution, inspect the complete diff at each task boundary and use one fresh independent reviewer at the final gate. Both approaches require the lead's full diff review and resolution of demonstrated blocking findings; an implementation worker is never its own independent reviewer. Rerun only affected checks and do not use the historical ledger as a live checklist.

### Task 1: Server API And Session Boundary

**Files:**
- Create: `.gitignore`; UI-relative `lib/session.server.js`, `lib/api.server.js`, `lib/route-input.js`, `lib/revalidate.server.js`, `test-support/fixtures.js`.
- Modify: `ui/nextjs/vitest.config.mjs`; `ui/README.md`.
- Test: UI-relative `lib/session.server.test.js`, `lib/api.server.test.js`, `lib/route-input.test.js`.

**Interfaces:**
- Consumes: existing API contract and `NEXT_PUBLIC_API_URL`.
- Produces: every server/shared interface listed in "Shared Interfaces"; no client-visible JWT.

- [x] **Step 1: Capture the approved baseline before integration.** Check `git status`; add ignore entries for `**/node_modules/`, `**/.next/`, `**/out/`, `api/target/`, `ui/.playwright-mcp/`, `.env`, `.env.*`, `**/.env`, `**/.env.*`, with exceptions for `.env.example`. Inspect ignored/untracked files and staged changes for secrets. Stage the moved `ui/`, implemented `api/`, agent rules and old-path deletions explicitly, excluding these new plan documents from the baseline. Run `git diff --cached --check` and inspect `git diff --cached --stat`; confirm it is the current app move/backend snapshot, not integration edits. Commit `Move the apps into ui and api.` Record its hash as the integration review base.
- [x] **Step 2: Write session, transport and route-input regression tests.** Configure the Vitest-only `server-only` alias to the installed `next/dist/compiled/server-only/empty.js`; production files use `import 'server-only'` without adding a dependency. Assert these cases in named tests:

```js
test('the cookie hides the JWT and follows remember-me expiry', async () => {
  await setSession({ accessToken: 'jwt', expiresAt: '2026-11-30T12:00:00Z' }, { persistent: true });
  expect(cookieStore.set).toHaveBeenCalledWith('fluiar_session', 'jwt', expect.objectContaining({
    httpOnly: true, sameSite: 'lax', path: '/', expires: new Date('2026-11-30T12:00:00Z'),
  }));
  // Repeat with persistent:false: no expires/maxAge; secure:true in production, false locally.
});
test('public requests ignore even a revoked cookie', async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ email: ME.email })));
  await apiRequest('/api/auth/password-resets/' + 'a'.repeat(43), { auth: 'public' });
  expect(fetchMock.mock.calls[0][1].headers.get('Authorization')).toBeNull();
});
test('a protected 401 redirects even when its body is empty', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
  await expect(apiRequest('/api/me')).rejects.toThrow('NEXT_REDIRECT');
  expect(redirect).toHaveBeenCalledWith('/login');
});
test('a successful bodyless response does not attempt JSON parsing', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
  expect(await apiRequest('/api/clients/' + CLIENT.id, { method: 'DELETE' })).toBeUndefined();
});
```

Also assert: no cookie redirects without a fetch; missing API URL fails clearly rather than calling a relative Next URL; trailing slash is normalized; absolute/off-origin path arguments are rejected before fetch; different request cookies produce different Bearer headers; JSON requests set `Content-Type`, multipart does not; every fetch is `cache:'no-store'`; `redirect:'error'` prevents forwarding a token across upstream redirects; 400/409/429 keep `detail`/`errors`; an HTML 502, rejected fetch and timeout become 503 `Não conseguimos conectar à API. Tente novamente.`; malformed successful JSON becomes 502 `A API retornou uma resposta inválida.`; empty 202/204 bodies return `undefined`; valid/invalid full UUIDs and 43-character link tokens are distinguished. `actionResult` must not swallow `NEXT_REDIRECT`/`NEXT_NOT_FOUND`.
- [x] **Step 3: Run RED.** `npx vitest run lib/session.server.test.js lib/api.server.test.js lib/route-input.test.js`. Expected: behavioral assertions fail against inert stubs.
- [x] **Step 4: Implement the shared interfaces.** Use a fixed configured HTTP(S) API origin, `Headers`, a named 15-second `AbortSignal.timeout`, JSON serialization only for JSON bodies, and no-store requests. Treat `/api/auth/**`, `/api/public/**` and `/api/images/**` as public even if a caller accidentally leaves the default; never attach a JWT there. Any 401 redirects to `/login`, except a rejected POST login already on `/login`, which returns its expected error for display. Session writes occur only in actions, never during render; cookie `secure` follows `NODE_ENV === 'production'`. For `persistent:true` use the API's `expiresAt`, not a fabricated frontend lifetime. Return no `AuthResponse` through an action.
- [x] **Step 5: Run GREEN.** Repeat Step 3; expected all tests pass. Document `NEXT_PUBLIC_API_URL=http://localhost:8080` and local server prerequisites in `ui/README.md`; do not start services or install packages for this task.
- [x] **Step 6: Review and commit the server boundary.** Stage only this task's named files/tests and the two approved plan documents, inspect the diff, then `git commit -m "Add the server API and session boundary."` In later task commits, include the relevant plan's completed checkboxes as tracking evidence.

### Task 2: Async Forms And Contract-Matching Validation

**Files:**
- Create: UI-relative `components/forms/useApiForm.js`, `components/forms/useApiForm.test.js`, `lib/format.test.js`.
- Modify: UI-relative `lib/validation.js`, `lib/validation.test.js`, `lib/format.js`, `components/ui/Button.js`.

**Interfaces:**
- Consumes: `ActionResult<T>`, existing `field()` input props and feedback helpers.
- Produces: `useApiForm({ initial = {}, rules = {}, validate, action, fieldMap = {}, onSuccess }) -> { values, setValue, setValues, errors, busy, field, submit }`; `action(values)` returns `Promise<ActionResult<T>>`; `onSuccess(data, values, {go,toast})` may be async. Optional `validate(values) -> Record<string,string>` adds feature-specific local errors after `validateAll`; `fieldMap` is a mapping object or `(submittedValues) -> Record<string,string>`. Resolve it against the submitted snapshot, not edits made while awaiting the response.
- Produces: `formatShortDate(iso)`, `formatLongDate(iso)`, `formatUpdatedAt(iso, now = new Date())`, `imageSource(imageUrl)`; existing `parseBRL` remains compatible, but product submission must validate input before using it.

- [x] **Step 1: Write failing hook/rule/format tests.**

```js
test('server errors focus the mapped field and do not navigate', async () => {
  // Render the hook with name->nome and phone->tel, submit its rendered form.
  action.mockResolvedValue({ ok:false, status:400, detail:'Revise os campos destacados.',
    errors:{ phone:'Digite o telefone com DDD, como (31) 99999-9999.' } });
  // After submit:
  await waitFor(() => expect(document.activeElement.id).toBe('tel'));
  expect(onSuccess).not.toHaveBeenCalled();
  expect(screen.getByText('Revise os campos destacados.')).toBeTruthy();
});
test('password byte limits do not trim a valid password', () => {
  expect(validateField('senha', {senha:'á'.repeat(37)}, {password:true}))
    .toBe('Senha longa demais: letras com acento e emojis ocupam mais de um caractere.');
  expect(validateField('senha', {senha:'1234567'}, {password:true})).toBe('Use entre 8 e 72 caracteres.');
  expect(validateField('senha', {senha:'  abc123  '}, {password:true})).toBe('');
});
test('formatting uses Sao Paulo dates and absolute API image paths', () => {
  const now = new Date('2026-10-31T18:00:00Z');
  expect(formatUpdatedAt('2026-10-31T17:20:00Z', now)).toBe('Hoje, 14:20');
  expect(formatUpdatedAt('2026-10-30T17:20:00Z', now)).toBe('Ontem');
  expect(formatUpdatedAt('2026-10-27T17:20:00Z', now)).toBe('27 out');
  expect(imageSource('/api/images/' + PRODUCT.id)).toBe('http://localhost:8080/api/images/' + PRODUCT.id);
});
```

Add assertions that duplicate submits call the pending action once, invalid local input never calls it, an action rejection restores `busy` and shows a fallback toast, unmount does not run success navigation, and `busy` disables the actual button. Cover full-string URL matching, phone 10/11 digits, fractional/0/1000 quantities, negative/invalid/overprecision prices, and maximum text lengths. Pin quantity messages to `Use um valor a partir de 1.` / `Use um valor até 999.`; new-password rules to 8-72 UTF-16 code units and at most 72 UTF-8 bytes; required/email/match copy remains existing Portuguese. Add `maxLength`, `max`, `integer`, `phone`, `password`, `money` rules; money accepts a blank value, zero or Brazilian grouped/ungrouped decimals with at most two decimal places and at most ten integer digits. Validation reports errors instead of silently rounding/clamping invalid input.

Exact remaining validation copy: `maxLength -> Use no máximo {max} caracteres.`, `integer -> Revise os dados enviados.`, money precision/syntax -> `Use no máximo 10 dígitos e 2 casas decimais.`, negative money -> `Use um valor a partir de 0.00.`, phone (including an empty digit string) -> `Digite o telefone com DDD, como (31) 99999-9999.`. Use `phone:true` rather than `required:true` on the client phone so blank input matches the API's pattern violation. An unexpected action rejection shows `Não conseguimos salvar agora. Tente novamente.`. `formatShortDate` returns `27 out 2026`; `formatLongDate` returns `27 de outubro de 2026` for an October 27 Sao Paulo date. These rules mirror existing API messages; do not change backend wording.
- [x] **Step 2: Run RED.** `npx vitest run components/forms/useApiForm.test.js lib/validation.test.js lib/format.test.js`.
- [x] **Step 3: Implement the new hook and pure rules/formatters.** Guard concurrent submits synchronously with a ref, combine ordinary and optional feature validation, await action and success callback, map server errors from the submitted snapshot, focus the first mapped invalid input, and show `detail` even if no field matches. When a value changes, recompute already-visible local errors, including custom link-row errors; do not leave a corrected nested field permanently invalid. `go(url,message)` uses `flash`, `router.push` and `router.refresh`. Do not add a simulated timer. `Button` sets `disabled={busy || disabled}` for actual buttons. Use `America/Sao_Paulo` explicitly for dates. `imageSource(null)` returns `null`; non-null API image paths are prefixed with the configured base URL.
- [x] **Step 4: Run GREEN.** Repeat Step 2; all pass. Keep `useDemoForm` temporarily for unmigrated consumers.
- [x] **Step 5: Review and commit.** `git commit -m "Support asynchronous forms and API validation."`

### Task 3: Real Signup, Login And Logout

**Files:**
- Create: UI-relative `components/auth/actions.js`, `components/auth/actions.test.js`, `app/error.js`, `app/error.test.js`, `app/(app)/error.js`, `app/(app)/loading.js`, `app/(auth)/error.js`.
- Modify: UI-relative `components/auth/AuthForms.js`, `components/auth/AuthForms.test.js`, `components/layout/AppShell.js`, `components/layout/AppShell.test.js`, `app/(app)/layout.js`, `app/(auth)/login/page.js`, `app/(auth)/cadastro/page.js`, `app/layout.js`, `app/routes.test.js`.
- Retire: UI-relative `components/layout/ProtoNav.js` after verifying its only mount is removed.

**Interfaces:**
- Consumes: Tasks 1-2 interfaces.
- Produces: `login({email,password,rememberMe}) -> Promise<ActionResult<MeResponse>>`, `signup({name,email,password}) -> Promise<ActionResult<MeResponse>>`, `logout() -> Promise<never>` in `'use server'` `components/auth/actions.js`.
- Produces: `AppShell({user:MeResponse,children})`; `LoginForm()` and `SignupForm()` have no demo-state props.

- [x] **Step 1: Write failing auth/action/layout tests.** Mock HTTP responses at `fetch` in action tests so cookie forwarding is exercised; mock actions only in component tests.

```js
test('login consumes AuthResponse without serializing its token', async () => {
  // fetchMock resolves AuthResponse with accessToken:'jwt', user:ME, expiresAt from Task 1.
  const result = await login({email:ME.email,password:'password123',rememberMe:true});
  expect(result).toEqual({ok:true,data:ME});
  expect(JSON.stringify(result)).not.toContain('jwt');
  expect(cookieStore.set).toHaveBeenCalledWith('fluiar_session','jwt',expect.objectContaining({httpOnly:true}));
});
test('login forwards the unchecked remember-me choice', async () => {
  // Fill email/password, uncheck "Manter conectada neste aparelho", submit, await the action.
  expect(login).toHaveBeenCalledWith({email:ME.email,password:'password123',rememberMe:false});
});
test('logout clears the cookie instead of merely following a link', async () => {
  await expect(logout()).rejects.toThrow('NEXT_REDIRECT');
  expect(cookieStore.delete).toHaveBeenCalledWith('fluiar_session');
  expect(redirect).toHaveBeenCalledWith('/login');
});
```

Also assert signup maps `nome/senha -> name/password`, omits confirmation, uses a session cookie and navigates to `/dashboard` without `estado`; invalid credentials render `E-mail ou senha incorretos.` on `/login` with a toast and no session; 429 displays the exact API detail; signup conflict maps `email` inline; a protected layout without a cookie redirects; the shell renders `Ana Lima` and the real `officeName`, never a fake role/person. Retain the drawer Escape/focus-trap tests with a `user={ME}` fixture. In `app/error.test.js`, render the root boundary with a synthetic error and `reset=vi.fn()`; clicking "Tentar novamente" must call `reset` once and must not render the error's internal message.
- [x] **Step 2: Run RED.** `npx vitest run components/auth/actions.test.js components/auth/AuthForms.test.js components/layout/AppShell.test.js app/error.test.js app/routes.test.js`.
- [x] **Step 3: Implement auth commands and migrate only login/signup.** Whitelist request fields, never trim passwords, call auth endpoints with `auth:'public'`, set the session before returning only `user`. Keep login accessible even with an invalid cookie, avoiding redirect loops. Bind the remember-me checkbox to state (initially checked, matching today's UI). The private layout awaits `getCurrentUser()` and passes it to the shell; every protected action/read still checks its own session via `apiRequest`. Keep `/` redirecting to `/login`. Remove the root `ProtoNav` mount/file and login prototype copy. Unexpected read failures show "Não conseguimos carregar esta página." and a "Tentar novamente" button; the root `app/error.js` handles failures thrown by `(app)/layout.js`, which its same-segment error boundary cannot catch. Loading uses existing classes and Portuguese text.
- [x] **Step 4: Run GREEN.** Repeat Step 2; all pass. Keep forgot/reset on their old hook only until Task 9; do not rewrite them prematurely.
- [x] **Step 5: Review and commit.** `git commit -m "Connect signup login and logout to the API."`

### Task 4: Persist Lists And Display API DTOs

**Files:**
- Create: UI-relative `components/listas/actions.js`, `components/listas/actions.test.js`, `components/listas/queries.server.js`, `components/listas/queries.server.test.js`, `components/ui/Display.test.js`.
- Modify: UI-relative `components/listas/Listas.js`, `components/listas/Listas.test.js`, `components/ui/Display.js`, `components/lista/ShoppingList.js`, `components/lista/RoomTable.js`, `components/lista/ClientView.js`, `components/lista/ItemLinks.js`, `components/lista/ListFooter.js`.
- Modify: UI-relative `app/(app)/listas/page.js`, `app/(app)/listas/nova/page.js`, `app/(app)/listas/[id]/page.js`, `app/(app)/listas/[id]/editar/page.js`, `app/routes.test.js`.
- Test: UI-relative `components/lista/ShoppingList.test.js`.

**Interfaces:**
- Consumes: Tasks 1-3; direct public/private subset-compatible room/product/link DTOs.
- Produces: `saveList(id:null|string, body:{name,description,clientId}) -> Promise<ActionResult<ListDetailResponse>>`, `deleteList(id) -> Promise<ActionResult<undefined>>`.
- Produces: request-scoped `getList(id) -> Promise<ListDetailResponse>` in `queries.server.js`, shared by page and metadata.
- Produces: `ShoppingList({list:ListDetailResponse,signature:{officeName,architectNames}})`, `ClientView({rooms})` reading `room.products`, and `ListSignature({signature})`.
- Produces: `StatusBadge({total,done,completed})`, with `completed` required; `ListCards`/`ListsTable` consume `ListSummaryResponse[]`.

- [x] **Step 1: Write failing list/action/read-only-view tests.**

```js
test('an empty API list is not completed', () => {
  render(<StatusBadge total={0} done={0} completed={false} />);
  expect(screen.queryByText('Concluída')).toBeNull();
  expect(screen.getByText('Sem produtos')).toBeTruthy();
});
test('the list form maps fields and uses the returned UUID', async () => {
  saveList.mockResolvedValue({ok:true,data:LIST});
  // Fill "Nome da lista", optional description and client select, then submit.
  expect(saveList).toHaveBeenCalledWith(null,{name:'Casa nova',description:null,clientId:CLIENT.id});
  await waitFor(() => expect(push).toHaveBeenCalledWith('/listas/' + LIST.id));
});
test('read-only tables accept the real API link shape', () => {
  render(<ClientView rooms={[{name:'Cozinha',products:[{
    name:'Batedeira',quantity:2,bought:false,links:[{url:'https://loja.com/item',note:'Azul'}],
  }]}]} />);
  expect(screen.getByText('2')).toBeTruthy();
  expect(screen.getByRole('link',{name:/loja.com/}).getAttribute('href')).toBe('https://loja.com/item');
  expect(screen.queryByRole('checkbox')).toBeNull();
});
```

Also assert list create/PUT bodies exclude UI-only keys, server `clientId` errors map to `cli`, a deleted/foreign client stays a field error, API delete failure retains cards/rows, and cancelling never calls DELETE. Filter by `completed`, including zero-product lists in "Em andamento". Verify `getList` rejects malformed IDs before fetching and maps API 404 to `notFound`; 503 must not become an empty list. Preserve list edits on failed save. The list page must fetch `/api/lists/{id}` and `/api/office` in parallel; signature uses office name and all member names, with no hard-coded contact email or architect names.
- [x] **Step 2: Run RED.** `npx vitest run components/listas/actions.test.js components/listas/queries.server.test.js components/listas/Listas.test.js components/ui/Display.test.js components/lista/ShoppingList.test.js app/routes.test.js`.
- [x] **Step 3: Implement list commands, pages and shared displays.** Server actions validate UUID arguments, whitelist API fields, preserve upstream office checks and call `revalidateWorkspaceData()` only after success. The new-list page fetches clients; use `?cliente=` only when the UUID exists in that returned list, otherwise leave blank. Show a "Cadastre um cliente" link when there are no clients. Remove fake `generateStaticParams`, demo-state switches and fake `getClient` joins from the four list pages; metadata shares `getList`. Use API `estimatedTotal` with `brl` and ISO dates with formatters. Adapt `RoomTable` too (`products/quantity/unitPrice/imageUrl`) so private list reads do not crash during the migration; until Task 8 its local controls retain their existing behavior.
- [x] **Step 4: Refresh from server props rather than keeping a second row collection.** `ListsTable` and `ListCards` retain search/filter state, but use incoming list props directly. `useDeleteList` performs the single DELETE before its completion callback, success feedback and `router.refresh`; `ListCards({lists,onDeleted?})` calls the optional `onDeleted(id)` only after successful deletion. Client-detail callers will migrate in Task 5. Update `ClientView` to share the API's public subset: private rows use IDs; public rows without IDs use stable position keys for this immutable rendering. `ListSignature` renders only API-supplied office/member text; leave the original `ListNote` wording unchanged.
- [x] **Step 5: Run GREEN.** Repeat Step 2; all pass. Replace old list fixture expectations rather than preserving slug compatibility.
- [x] **Step 6: Review and commit.** `git commit -m "Persist shopping lists and render API list data."`

### Task 5: Persist Clients And Load The Dashboard

**Files:**
- Create: UI-relative `components/clientes/actions.js`, `components/clientes/actions.test.js`, `components/clientes/queries.server.js`, `components/clientes/queries.server.test.js`, `app/(app)/dashboard/page.test.js`.
- Modify: UI-relative `components/clientes/Clientes.js`, `components/clientes/Clientes.test.js`, `app/(app)/clientes/page.js`, `app/(app)/clientes/novo/page.js`, `app/(app)/clientes/[id]/page.js`, `app/(app)/clientes/[id]/editar/page.js`, `app/(app)/dashboard/page.js`, `app/routes.test.js`.

**Interfaces:**
- Consumes: `ListCards` and `deleteList` from Task 4; common server/form interfaces.
- Produces: `saveClient(id:null|string, body:{name,email,phone}) -> Promise<ActionResult<ClientResponse>>`, `deleteClient(id) -> Promise<ActionResult<undefined>>`; request-scoped `getClient(id) -> Promise<ClientDetailResponse>`.
- Produces: `ClientDetail({client:ClientDetailResponse,children})`; derives lists/count/deletion copy from `client.lists`, never a duplicate local list.

- [x] **Step 1: Write failing client and dashboard tests.**

```js
test('a masked phone is sent as digits and the created UUID selects the route', async () => {
  saveClient.mockResolvedValue({ok:true,data:CLIENT});
  // Fill name/email/phone "(31) 99999-8888" and submit.
  expect(saveClient).toHaveBeenCalledWith(null,{name:'Ana Lima',email:ME.email,phone:'31999998888'});
  await waitFor(() => expect(push).toHaveBeenCalledWith('/clientes/' + CLIENT.id));
});
test('failed client deletion keeps the client and its lists', async () => {
  deleteClient.mockResolvedValue({ok:false,status:503,detail:'Tente novamente.',errors:{}});
  // Confirm deletion in a rendered ClientsTable, await its response.
  expect(screen.getByRole('link',{name:CLIENT.name})).toBeTruthy();
  expect(screen.queryByText('Cliente excluído.')).toBeNull();
});
test('the dashboard uses API counts rather than recent-array lengths', async () => {
  // Mock GET /api/dashboard: clientCount:12, listCount:9, pendingProductCount:17,
  // totalProductCount:21, completedListCount:2, clientsCreatedThisMonth:3,
  // listsWithPendingProductsCount:4, recentClients:[], recentLists:[]; getCurrentUser -> ME.
  render(await Page());
  expect(screen.getByText('12')).toBeTruthy();
  expect(screen.getByText('9')).toBeTruthy();
  expect(screen.getByText('17')).toBeTruthy();
  expect(screen.getByText('3 novos este mês')).toBeTruthy();
});
```

Retain accent-insensitive client search, no-results and cancel-confirmation assertions. Add direct-action missing-session and upstream other-office 404 tests (no success feedback/invalidation). Add the last-list deletion regression using a server-prop rerender: until DELETE succeeds the count is 1; after refreshed `client.lists:[]`, the heading/count, empty state and client cascade warning all use zero. A GET failure must render the error boundary, not "Nenhum cliente". Ignore `?estado=vazio` when API data is nonempty.
- [x] **Step 2: Run RED.** `npx vitest run components/clientes/actions.test.js components/clientes/queries.server.test.js components/clientes/Clientes.test.js app/'(app)'/dashboard/page.test.js app/routes.test.js`.
- [x] **Step 3: Implement client commands and reads.** Map `nome -> name`, `tel -> phone`, and server errors in reverse; use `listCount` on summaries and `lists.length` on detail. Show masked phone/creation dates only at render time. Replace fake ID redirects and every static params export. Make `useDeleteClient` perform the real delete before its completion callback and refresh; all three entry points (row, detail, edit form) share that behavior. No local row/list copies.
- [x] **Step 4: Implement dashboard reads.** Start `getCurrentUser()` and `/api/dashboard` together; use all seven API count fields and its recent arrays without recomputing global totals. Render the real first name and current Sao Paulo date, not the prototype's Friday. Only `clientCount === 0 && listCount === 0` selects the first-use empty dashboard.
- [x] **Step 5: Run GREEN.** Repeat Step 2; all pass.
- [x] **Step 6: Review and commit.** `git commit -m "Persist clients and load the live dashboard."`

### Task 6: Separate Room Management

**Files:**
- Create: UI-relative `components/ambientes/actions.js`, `components/ambientes/actions.test.js`, `components/ambientes/RoomManager.js`, `components/ambientes/RoomManager.test.js`, `app/(app)/listas/[id]/ambientes/page.js`.
- Modify: UI-relative `components/lista/ShoppingList.js`, `components/lista/ShoppingList.test.js`, `app/styles/app.css`.

**Interfaces:**
- Consumes: `getList(id)`, `ActionResult`, `useApiForm`, `revalidateWorkspaceData()`.
- Produces: `createRoom(listId,{name}) -> Promise<ActionResult<RoomResponse>>`, `renameRoom(roomId,{name}) -> Promise<ActionResult<RoomResponse>>`, `deleteRoom(roomId) -> Promise<ActionResult<undefined>>`, `reorderRooms(listId,roomIds:string[]) -> Promise<ActionResult<RoomResponse[]>>`.
- Produces: `RoomManager({listId,rooms:RoomResponse[]})`, names limited to 60 characters.

- [x] **Step 1: Write failing room action/component tests.**

```js
test('moving a room sends every UUID once in the new order', async () => {
  // Render rooms ROOM and a second room; click "Mover Cozinha para baixo".
  expect(reorderRooms).toHaveBeenCalledWith(LIST.id,[secondRoom.id,ROOM.id]);
});
test('a duplicate room name stays editable and displays the API error', async () => {
  createRoom.mockResolvedValue({ok:false,status:409,detail:'Já existe um ambiente com esse nome nesta lista.',
    errors:{name:'Já existe um ambiente com esse nome nesta lista.'}});
  // Submit "Cozinha"; wait for the field error.
  expect(screen.getByLabelText('Nome do ambiente').value).toBe('Cozinha');
  expect(screen.getByLabelText('Nome do ambiente').getAttribute('aria-invalid')).toBe('true');
});
test('an empty list still offers room management', () => {
  render(<ShoppingList list={{...LIST,rooms:[],stats:{...LIST.stats,totalProducts:0}}} signature={signature} />);
  expect(screen.getByRole('link',{name:'Gerenciar ambientes'}).getAttribute('href'))
    .toBe('/listas/' + LIST.id + '/ambientes');
});
```

Also assert blank/61-character names never submit, rename uses room ID, first/last movement buttons are disabled at boundaries, DELETE requires a cascade warning including `products.length`, cancelling does nothing, and a failed reorder/delete leaves server order/rows unchanged. An incomplete room-order 400 shows `Envie todos os ambientes da lista, sem repetir.` and refreshes the room list so a concurrently added room is available on retry. No request is sent to order zero rooms.
- [x] **Step 2: Run RED.** `npx vitest run components/ambientes/actions.test.js components/ambientes/RoomManager.test.js components/lista/ShoppingList.test.js`.
- [x] **Step 3: Implement actions and the room page.** Use the exact four endpoints from the backend table. Validate UUID shapes/array uniqueness before write, let the API validate list membership and complete order. Add rows with "Renomear", "Mover ... para cima/baixo", "Excluir ambiente" and an add form; unique input IDs include room UUIDs. Use existing cards/buttons/confirmation; await writes before refreshing. Never optimistically remove a room with products.
- [x] **Step 4: Expose room management independent of product count.** Keep list editing/room navigation available for empty lists. With no rooms, the product CTA points to `/listas/{id}/ambientes`; with rooms but no products, it points to `/listas/{id}/produtos/novo`.
- [x] **Step 5: Run GREEN.** Repeat Step 2; all pass.
- [x] **Step 6: Review and commit.** `git commit -m "Add room management for shopping lists."`

### Task 7: Persist Products And Images Without Duplicate Retries

**Files:**
- Create: UI-relative `components/produtos/actions.js`, `components/produtos/actions.test.js`, `components/produtos/product-values.js`, `components/produtos/product-values.test.js`.
- Modify: UI-relative `components/produtos/ProductForm.js`, `components/produtos/ProductForm.test.js`, `app/(app)/listas/[id]/produtos/novo/page.js`, `app/(app)/listas/[id]/produtos/[produtoId]/editar/page.js`, `next.config.mjs`, `app/routes.test.js`.

**Interfaces:**
- Consumes: `getList`, `useApiForm`, API product/link DTOs and shared validation.
- Produces: `saveProduct(listId,productId:null|string,body:ProductRequest) -> Promise<ActionResult<ProductResponse>>`; `deleteProduct(listId,productId) -> Promise<ActionResult<undefined>>`; `uploadProductImage(listId,productId,formData:FormData) -> Promise<ActionResult<ProductImageResponse>>`; `deleteProductImage(listId,productId) -> Promise<ActionResult<undefined>>`.
- Produces internally: `requireProductInList(listId,productId) -> Promise<ListDetailResponse>` in the product action module. It uses `apiRequest` (not page-oriented `readApi`/`getList`), so expected 404 becomes an action failure value rather than a swallowed navigation signal; reuse it for Task 8.
- Produces: `ProductForm({listId,product?,rooms:RoomResponse[],defaultRoomId=''})`.
- Produces: `toProductRequest(values) -> ProductRequest`, `validateProductLinks(values) -> Record<string,string>`, `productFieldMap(values) -> Record<string,string>` in `product-values.js`. Values are `{nome,amb,qtd,preco,obs,bought,links:[{id,url,note}]}`; link `id` is a stable local row ID, never serialized to the API.

- [x] **Step 1: Write failing mapping, security, upload and retry tests.**

```js
test('product payloads preserve zero and omit only entirely blank link rows', () => {
  const values = {nome:'Batedeira',amb:ROOM.id,qtd:'2',preco:'0,00',obs:'',bought:false,
    links:[{id:'row0',url:'',note:''},{id:'row1',url:'https://loja.com/item',note:'Azul'}]};
  expect(toProductRequest(values)).toEqual({name:'Batedeira',roomId:ROOM.id,quantity:2,
    unitPrice:0,notes:null,bought:false,links:[{url:'https://loja.com/item',note:'Azul'}]});
  expect(productFieldMap(values)['links[0].url']).toBe('link-row1-url');
  expect(toProductRequest({...values,preco:''}).unitPrice).toBeNull();
});
test('an image failure after create does not create again on retry', async () => {
  saveProduct.mockResolvedValue({ok:true,data:PRODUCT});
  uploadProductImage.mockResolvedValueOnce({ok:false,status:503,detail:'Falha no envio.',errors:{}})
    .mockResolvedValueOnce({ok:true,data:{imageUrl:'/api/images/' + PRODUCT.id}});
  // Render new form, choose a PNG, submit twice, awaiting the first failure before retry.
  expect(saveProduct.mock.calls[0][1]).toBeNull();
  expect(saveProduct.mock.calls[1][1]).toBe(PRODUCT.id);
  expect(uploadProductImage).toHaveBeenCalledTimes(2);
  // Before retry success, no navigation/success toast; selected file remains available.
});
test('a mismatched nested product URL is not found', async () => {
  // getList -> LIST whose rooms do not contain foreignProductId; params use valid UUIDs.
  await expect(EditProductPage({params:Promise.resolve({id:LIST.id,produtoId:foreignProductId})}))
    .rejects.toThrow('NEXT_NOT_FOUND');
});
```

Add assertions for room ID preselection/reset via `?ambiente=<UUID>`, an unknown room query leaving the select blank, an empty-room page showing the management CTA instead of an unusable form, integer quantity 1-999, money `1.234,56 -> 1234.56`, blank price `null`, and invalid/fractional/negative values blocking save. Test 10-link maximum, note-only rows requiring a URL, URL/note lengths 2048/200, notes 1000, product name 120, and errors for a filtered link index attaching to the right visible input. Keep JPG/PNG and exact `5*1024*1024` boundary tests; over-limit/type-invalid files never invoke upload.

Action tests must assert JSON save precedes multipart upload, multipart field is exactly `file`, no manual multipart Content-Type, returned image paths are displayed through `imageSource`, removal uses DELETE, and another office's/list's product cannot be written through this list's actions. A selected file is not sent until the product save succeeds.
- [x] **Step 2: Run RED.** `npx vitest run components/produtos/actions.test.js components/produtos/product-values.test.js components/produtos/ProductForm.test.js app/routes.test.js`.
- [x] **Step 3: Implement product mapping and routes.** Query the list's actual rooms, remove `ROOM_NAMES`, use `room.id` for option values and row-add links, and check product membership using the loaded list before rendering the nested edit page. Store link rows in form values with stable `row0`, `row1`, ... IDs; allocate new IDs on add, not random IDs during server render. Drop only wholly blank rows; a note-only row reports `Cole o link completo, começando com https://` at its URL input. Trim URLs/notes and map compact API error indices to `link-{rowId}-url/note`. Report too many filled rows as `Adicione no máximo 10 links.` on the `links` field, whose container is focusable. Use the shared hook's extra validation/error-mapping seams defined in Task 2.
- [x] **Step 4: Implement the product/image commands.** Before update/delete/image writes, load the supplied list and require the product UUID to occur in its `rooms[].products`; return 404 for a mismatch. The API still authorizes every request and validates the target room belongs to that product's list. Whitelist JSON fields, validate file shape/size on the action boundary and let the API inspect image bytes. Set `experimental.serverActions.bodySizeLimit:'6mb'` in Next 15, matching the backend's 6MB multipart request budget and allowing a 5MiB file plus overhead.
- [x] **Step 5: Implement sequential save with explicit partial success.** Keep the returned product ID after the first successful POST; later submits PUT that ID. Then upload a selected file or DELETE a removed existing image. Keep the file/removal intent on failure, stay on the form, show the original API detail and `O produto foi salvo, mas a imagem não foi atualizada. Tente novamente.`; do not announce complete success. Clear image intent only after success. Add "Remover imagem", and use the returned `imageUrl` for persisted previews. Successful completion navigates to the list. This is not a distributed transaction; do not undo the saved product on image failure.
- [x] **Step 6: Run GREEN.** Repeat Step 2; all pass.
- [x] **Step 7: Review and commit.** `git commit -m "Persist products and handle image upload retries."`

### Task 8: Persist Inline Shopping-List Changes

**Files:**
- Modify: UI-relative `components/produtos/actions.js`, `components/produtos/actions.test.js`, `components/lista/ShoppingList.js`, `components/lista/ShoppingList.test.js`, `components/lista/RoomTable.js`.
- Create: UI-relative `components/lista/RoomTable.test.js`.

**Interfaces:**
- Consumes: Task 7's `deleteProduct` and product/list membership check.
- Produces: `patchProduct(listId,productId,patch:{bought?:boolean,quantity?:number}) -> Promise<ActionResult<ProductResponse>>` in product actions.
- Produces: async `RoomTable` callbacks `onToggle(id,bought)`, `onQty(id,quantity)`, `onRemove(id)` returning the corresponding `ActionResult`; `pendingIds:Set<string>` disables all controls for an in-flight row.

- [x] **Step 1: Write failing persistence and race/failure tests.**

```js
test('a failed purchase update does not change the saved checkbox or totals', async () => {
  patchProduct.mockResolvedValue({ok:false,status:503,detail:'Tente novamente.',errors:{}});
  // Render LIST with PRODUCT.bought:false, click its purchase checkbox, await response.
  expect(patchProduct).toHaveBeenCalledWith(LIST.id,PRODUCT.id,{bought:true});
  expect(screen.getByRole('checkbox',{name:'Comprado: ' + PRODUCT.name}).checked).toBe(false);
  expect(screen.queryByText('Marcado como comprado')).toBeNull();
});
test('an unfinished quantity draft is never silently saved as one', async () => {
  // Render a row with quantity:2; enter "" and blur.
  expect(screen.getByRole('spinbutton',{name:'Quantidade'}).getAttribute('aria-invalid')).toBe('true');
  expect(patchProduct).not.toHaveBeenCalled();
});
test('two taps remove only after the API confirms deletion', async () => {
  // First "Remover Batedeira" arms; second confirms. Hold DELETE unresolved.
  expect(deleteProduct).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('link',{name:PRODUCT.name})).toBeTruthy();
  // Resolve success and rerender the refreshed list without PRODUCT.
  expect(screen.queryByRole('link',{name:PRODUCT.name})).toBeNull();
});
```

Also assert 0, fractions and 1000 are rejected rather than clamped; a failed quantity PATCH restores the server value; Enter/blur sends one PATCH; a second click while pending sends no second write; success refreshes and uses server `list.stats`, `bought` and `quantity`. Preserve filter counts, original 2500ms removal-arm timeout and read-only mode. Null unit price displays "Sem preço". Room-add URLs contain room UUIDs, never room names. Product action tests exercise no session, invalid IDs, cross-list product and upstream other-office 404.
- [x] **Step 2: Run RED.** `npx vitest run components/produtos/actions.test.js components/lista/ShoppingList.test.js components/lista/RoomTable.test.js`.
- [x] **Step 3: Implement PATCH and await all three row mutations.** Use pessimistic updates: incoming list props own rooms/products/stats; local state owns only mode, filter, quantity drafts, confirmation arm and pending IDs. Do not maintain a second room/product collection. Revalidate only after API success and call `router.refresh()`; successful toasts must follow confirmed writes. Keep controls disabled per row until completion. Reset a quantity draft after failed persistence or confirmed server quantity changes without resetting list filters.
- [x] **Step 4: Run GREEN.** Repeat Step 2; all pass.
- [x] **Step 5: Review and commit.** `git commit -m "Persist inline shopping list changes."`

### Task 9: Password Recovery And Real Reset Links

**Files:**
- Modify: UI-relative `components/auth/actions.js`, `components/auth/actions.test.js`, `components/auth/AuthForms.js`, `components/auth/AuthForms.test.js`, `app/(auth)/recuperar-senha/page.js`, `app/(auth)/nova-senha/page.js`.

**Interfaces:**
- Consumes: public `apiRequest`, `isLinkToken`, async form validation.
- Produces: `requestPasswordReset({email}) -> Promise<ActionResult<undefined>>`, `confirmPasswordReset({token,newPassword}) -> Promise<ActionResult<undefined>>`.
- Produces: `ForgotPasswordForm()`, `ResetPasswordForm({token,email})`; invalid-link state renders without a reset form.

- [x] **Step 1: Write failing reset/resend/link tests.**

```js
test('resend uses the submitted address rather than a demo user', async () => {
  requestPasswordReset.mockResolvedValue({ok:true,data:undefined});
  // Submit "other@example.com", then click "Reenviar e-mail".
  expect(requestPasswordReset).toHaveBeenNthCalledWith(2,{email:'other@example.com'});
});
test('reset confirmation sends the URL token and new password only', async () => {
  // Render ResetPasswordForm token={'a'.repeat(43)} email={ME.email}; fill matching passwords.
  expect(confirmPasswordReset).toHaveBeenCalledWith({token:'a'.repeat(43),newPassword:'password123'});
});
test('a reset link that expired after inspection remains actionable', async () => {
  confirmPasswordReset.mockResolvedValue({ok:false,status:400,
    detail:'Este link expirou ou já foi usado. Peça um novo.',errors:{}});
  // Submit valid passwords.
  await waitFor(() => expect(screen.getByText('Este link expirou ou já foi usado. Peça um novo.')).toBeTruthy());
  expect(screen.queryByText('Senha redefinida')).toBeNull();
});
```

Assert 202/204 empty-body success; missing/array/malformed tokens never fetch; valid token GET retrieves the displayed email; an expired/used token GET 400 shows a recovery link, not a fake email/form. A revoked session cookie is never forwarded on inspect/request/confirm. Failed resend and 429 show real `detail` and no success message. Confirmation returns to a real login rather than auto-authentication.
- [x] **Step 2: Run RED.** `npx vitest run components/auth/actions.test.js components/auth/AuthForms.test.js`.
- [x] **Step 3: Implement public reset flows.** The reset page awaits `searchParams`, accepts one valid token, inspects `/api/auth/password-resets/{token}`, and passes only email/token to its form. For invalid links render the exact API link-error copy and "Pedir novo link" to `/recuperar-senha`; preserve other failures for the auth error boundary. Request/resend always use the last submitted email and non-enumerating copy `Se houver uma conta com este e-mail, enviaremos um link. Ele vale por 1 hora.` Remove the fake sent-state query, demo link and hard-coded account email.
- [x] **Step 4: Run GREEN.** Repeat Step 2; all pass.
- [x] **Step 5: Review and commit.** `git commit -m "Connect password recovery and reset links."`

### Task 10: Profile And Password Settings With Token Replacement

**Files:**
- Create: UI-relative `components/configuracoes/actions.js`, `components/configuracoes/actions.test.js`.
- Modify: UI-relative `components/configuracoes/SettingsForm.js`, `components/configuracoes/SettingsForm.test.js`, `app/(app)/configuracoes/page.js`.

**Interfaces:**
- Consumes: `getCurrentUser`, `setSession`, async forms and current-password error mapping.
- Produces: `updateProfile({name,email,currentPassword?}) -> Promise<ActionResult<MeResponse>>`, `changePassword({currentPassword,newPassword}) -> Promise<ActionResult<MeResponse>>`.
- Produces: `SettingsForm({user:MeResponse})` with two independent forms/buttons: "Salvar perfil" and "Alterar senha".

- [ ] **Step 1: Write failing settings/action tests.**

```js
test('changing email requires the current password only for the profile request', async () => {
  // Change the email, fill "Senha atual" in the profile section and save profile.
  expect(updateProfile).toHaveBeenCalledWith({name:ME.name,email:'new@example.com',currentPassword:'oldPassword'});
  expect(changePassword).not.toHaveBeenCalled();
});
test('changing password replaces the cookie before returning a sanitized user', async () => {
  // fetchMock resolves a new AuthResponse with accessToken:'new-jwt'.
  expect(await changePassword({currentPassword:'oldPassword',newPassword:'newPassword123'}))
    .toEqual({ok:true,data:ME});
  expect(cookieStore.set).toHaveBeenCalledWith('fluiar_session','new-jwt',expect.objectContaining({httpOnly:true}));
});
```

Assert a name-only or case/whitespace-normalized unchanged-email update sends no currentPassword; server `currentPassword` errors appear under `senhaEmail` for profile and `atual` for password; wrong current password and 429 preserve edits. No password request is sent when only profile is saved. After password success, fields clear and the next protected fetch uses the new cookie. No password/JWT appears in action output. Test profile success followed by password failure as two separate submissions: the saved profile remains visible, with no claim of an atomic combined update.
- [ ] **Step 2: Run RED.** `npx vitest run components/configuracoes/actions.test.js components/configuracoes/SettingsForm.test.js`.
- [ ] **Step 3: Implement independent profile/password forms.** Keep the existing two card sections, but remove the ambiguous combined save. IDs remain unique: `nome/email/senhaEmail` versus `atual/nova/nova2`. Profile submits only its three API fields; password submits `currentPassword/newPassword` and replaces the cookie with the backend's new 12-hour token as a session cookie (`persistent:false`). Do not preserve a fabricated 30-day lifetime after password change. Refresh `/(app)` layout and affected list signatures after profile success; profile reads come from `/api/me`, never `USER`.
- [ ] **Step 4: Run GREEN.** Repeat Step 2; all pass.
- [ ] **Step 5: Review and commit.** `git commit -m "Save profile changes and replace password sessions."`

### Task 11: Public Sharing And Removal Of The Last Demo Paths

**Files:**
- Create: UI-relative `components/lista/actions.js`, `components/lista/actions.test.js`, `components/lista/ShareControls.js`, `components/lista/ShareControls.test.js`, `app/l/[shareToken]/page.js`, `app/l/[shareToken]/page.test.js`, `app/l/[shareToken]/error.js`.
- Modify: UI-relative `components/lista/ShoppingList.js`, `components/lista/ShoppingList.test.js`, `components/lista/ListFooter.js`, `app/routes.test.js`; repository-relative `ui/README.md`, `ui/AGENTS.md`.
- Retire: UI-relative `lib/data.js`, `components/forms/useDemoForm.js`, `components/forms/useDemoForm.test.js` once no production/test import remains.

**Interfaces:**
- Consumes: `ClientView`, `ListSignature`, public `apiRequest`, private `getList`, common feedback.
- Produces: `rotateShareToken(listId) -> Promise<ActionResult<ShareTokenResponse>>`; `ShareControls({listId,shareToken})`.
- Produces: public `/l/[shareToken]` rendering only `PublicListResponse` fields: `{name,description,rooms:[{name,products:[{name,quantity,bought,links}]}],signature:{officeName,architectNames}}`.

- [ ] **Step 1: Write failing share/public/privacy tests.**

```js
test('copying does not rotate an existing share token', async () => {
  // Render ShareControls; mock clipboard.writeText; click "Copiar link".
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith(window.location.origin + '/l/' + LIST.shareToken);
  expect(rotateShareToken).not.toHaveBeenCalled();
});
test('public lists omit private fields and editing controls', async () => {
  // Render Page with PUBLIC_LIST response and params shareToken:'a'.repeat(43).
  expect(screen.queryByRole('checkbox')).toBeNull();
  expect(screen.queryByRole('button',{name:'Ver como cliente'})).toBeNull();
  expect(screen.queryByText(ME.email)).toBeNull();
  expect(screen.queryByText('Sem preço')).toBeNull();
});
test('an old rotated token is not served from a Next cache', async () => {
  // fetchMock -> 404 for a formerly valid token; read public page again.
  await expect(Page({params:Promise.resolve({shareToken:'a'.repeat(43)})})).rejects.toThrow('NEXT_NOT_FOUND');
  expect(fetchMock.mock.calls.at(-1)[1].cache).toBe('no-store');
});
```

Assert rotation requires explicit confirmation warning that the old link stops working, sends one POST, and updates the displayed/copied token only after success; a failed POST keeps the old link. Clipboard denial/insecure context leaves a read-only selectable link field and useful error rather than announcing a copy. Empty public list has no editor CTA or private navigation; public GET carries no Bearer header even with a stale cookie. Test missing/malformed token 404, resource 404, transport failure retry boundary, API office/member signature and object-shaped links. Final route tests use API UUID fixtures and include clients, lists, rooms, nested products and public tokens.
- [ ] **Step 2: Run RED.** `npx vitest run components/lista/actions.test.js components/lista/ShareControls.test.js components/lista/ShoppingList.test.js app/l/'[shareToken]'/page.test.js app/routes.test.js`.
- [ ] **Step 3: Implement public sharing.** Public page lives outside `(app)`, fetches only `/api/public/lists/{token}` with public/no-store policy and generic metadata (no token in title). Reuse `ClientView`/`ListSignature`, not the authenticated `ShoppingList` component. Never pass private `ListDetailResponse` or a session JWT into this route. `ShareControls` derives its absolute frontend URL in a browser event; first render must not depend on `window`. Show controls for lists with or without products. After rotation keep the returned opaque share token locally until refreshed props agree, then copy/display that value; ordinary copy never rotates.
- [ ] **Step 4: Retire demo-only modules and document the real workflow.** Search all UI app/component/lib/test imports for `lib/data`, `useDemoForm`, `ProtoNav`, fake person IDs and `estado`; migrate remaining tests to `test-support/fixtures.js` and remove only the now-unused modules named above. Remove `?estado=` support, not ordinary route query inputs. Update README and UI rules to describe async forms/server calls, real auth, room IDs, environment setup and current test commands; preserve unrelated boundaries/warnings. No dependency or lockfile churn is needed.
- [ ] **Step 5: Run GREEN.** Repeat Step 2 plus `npx vitest run components/forms/useApiForm.test.js`; all pass.
- [ ] **Step 6: Review and commit.** `git commit -m "Add public list sharing and retire demo data."`

## Final Integration Gate (Both Plans)

Execute the office/invitation companion before claiming the whole integration is complete. These are acceptance checks, not permission to add tools or change contracts.

- [ ] Run once from `ui/nextjs/`: `npm run lint`, `npm test`, then stop any Next dev server before `npm run build`. Expected: zero lint errors, only the two accepted image warnings, all tests pass, production build succeeds. Record logs and the route table. Authenticated user-data routes must be dynamic; no fake `generateStaticParams` remains. No TypeScript check applies.
- [ ] Start/reuse the local API, PostgreSQL, Mailpit and production Next server using the repo commands. Environment repair/execution is delegated under the chosen execution workflow; reuse live processes rather than launching duplicates. No production access or real outgoing email is needed. If network/package downloads are needed, ask first. Leave a requested preview running and report its URL/process ownership.
- [ ] Use the available browser automation/preview tools, without installing Playwright, to record the actual full-stack flow at 1440px and 390px: signup -> create client -> create empty list -> create/reorder rooms -> create/move/edit product with links and image -> inline quantity/purchased updates -> reload -> public copy/rotation -> profile/password update -> logout/login. Check drawer focus, field errors, overflow, empty-state CTAs and persistence after refresh.
- [ ] Use Mailpit for reset/resend and office invitation acceptance; confirm single-use/expired/revoked links fail clearly and the new member shares the same office data. These emails stay in the local sink.
- [ ] Use two local accounts in different offices: private URLs/actions for the other office return 404, and a mismatched product-under-list URL is 404. Confirm user B never receives user A's private RSC data after login/logout transitions.
- [ ] Inspect rendered HTML/RSC and Server Action responses for JWTs, passwords and private data on public routes. The httpOnly cookie is the only frontend JWT store; browser calls to Next do not expose upstream AuthResponse. Verify a forged cross-origin Server Action POST is rejected by Next's built-in origin check; do not loosen `allowedOrigins`.
- [ ] Verify bodyless 202/204, 401 expiry, invalid credentials, 409 duplicate fields, 429, API downtime, failed image upload and denied clipboard against either recorded browser execution or the focused regression tests. Never simulate a success message when the corresponding write failed.
- [ ] Run one final independent whole-change Next.js review, including both plans' files, against the recorded baseline. Resolve blocking findings and refresh invalidated evidence; do not rerun the full suite for unchanged inputs. Report actual checks, remaining limitations, baseline hash and final diff. Do not claim automated end-to-end coverage: this repo has unit/component tests plus a recorded browser acceptance check.

## Plan Self-Review

- Coverage: session/config/errors -> Tasks 1-3; list/client/dashboard data -> Tasks 4-5; room lifecycle -> Task 6; product/image lifecycle -> Tasks 7-8; recovery -> Task 9; account settings -> Task 10; public sharing/removal of prototype code -> Task 11; office/invitations -> companion Tasks 1-2.
- Ownership: API DTOs stay canonical; the server owns the session; page props own persisted collections; forms own drafts; failed two-step image writes preserve their saved product ID.
- Contract cross-check: JSON uses `completed`, `rooms[].products`, `quantity`, `unitPrice`, `imageUrl`, object-shaped links and API stats; public products intentionally have no IDs/prices/images/private notes.
- Review Focus cases each have an explicit owner/test. Browser checks cover framework behavior that mocked async-page tests cannot prove.
- No implementation, task commit or independent code review is claimed by this plan document.
