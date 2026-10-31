# Code-quality ledger: full review of the Next.js app

Source of truth for this review. Updated after every step.

## Request

Run a full code-quality review of the Next.js app. Fix every Critical and Important finding, review
again, and repeat until a full review finds none. Minor findings are recorded, not fixed.

- Procedure: `code-quality-next-js` skill; reviewer: `code-quality-next-js-reviewer`, one at a time,
  fresh context each run.
- Severities follow `engineering-guide.md` (Critical, Important, Minor).
- Stop and ask for: product/behavior decisions, breaking API/data changes, major dependency
  upgrades, new test frameworks, credentials, production access, destructive operations; a finding
  still OPEN after 3 fix attempts; 5 rounds without reaching Done.

### Scope override (included in every reviewer brief)

The whole application is the candidate, not a diff. Review all human-written source, configuration
and tests as they are now. Existing issues count as findings. Skip generated, vendored and build
output (`node_modules`, `.next`, lockfiles, generated clients).

## Setup

- Repository: `/Users/brunovidotto/Documents/bruno/selecao-fluiar` (git initialised for this review,
  user decision). App: `nextjs/`. `html/` is a separate static version of the same screens; out of
  scope.
- Baseline commit: `80ec884` (on `master`). Review branch: `quality/full-review-2026-10-30`.
- Tooling commit `3e3d0bf` (user approved): ESLint 9.39.5 + eslint-config-next 15.5.28 (flat config
  via `@eslint/eslintrc` FlatCompat), Vitest 5.0.5 + @vitejs/plugin-react 6.1.2 + jsdom 30.1.3 +
  @testing-library/react 16.3.3 + @testing-library/dom 10.4.2. Scripts `npm run lint`, `npm test`.

## App facts (nextjs-guide.md section 1)

| Question | Answer |
| --- | --- |
| Versions | next 15.5.28 (latest 15.x, npm tag `backport`), react 19.1.10, react-dom 19.1.10. React2Shell fix (15.5.7 / 19.1.2) is included. |
| Router | App Router only (`app/`). No `pages/`. Route groups `(auth)` and `(app)`. |
| Cache Components | Off (Next 15, no `cacheComponents` in `next.config.mjs`). Previous caching model applies. No `fetch`, `unstable_cache` or revalidation used. |
| Data access | Static mock module `lib/data.js` imported by pages (prototype; README says to replace with API/DB). No DAL, no `server-only`. |
| Session check | None. README: authentication is not implemented; auth screens only redirect. No Server Actions, Route Handlers, middleware/proxy or `pages/api`. |
| Hosting | Not configured (no Dockerfile, no `output`). README: `npm run build` + `npm start`. |
| Checks | `npm run lint` (ESLint), `npm test` (Vitest), `npm run build` (`next build`, also runs ESLint in Next 15). Type-check: N/A (plain JavaScript, no TypeScript; user decision). No E2E. No CI config. |
| Project rules | User AGENTS.md: KISS, simplest working solution, comments only when necessary, no unnecessary defensive programming, follow existing conventions, no unrelated changes. README: visual prototype without backend; fictional data, nothing saved; forms only do visual validation, toasts and confirmations. |

## Review areas

| Area | Prefix | Files (under `nextjs/`) |
| --- | --- | --- |
| Root, config, dependencies, global styles, security entry points | CFG | `package.json`, `next.config.mjs`, `jsconfig.json`, `.gitignore`, `eslint.config.mjs`, `vitest.config.mjs`, `app/layout.js`, `app/page.js`, `app/not-found.js`, `app/(app)/layout.js`, `app/(auth)/layout.js`, `app/styles/app.css`, `app/styles/lista.css`. Security entry points: none exist (verify absence). |
| Shared components and lib | SHR | `components/ui/{Button,Display,Fields,Icon}.js`, `components/feedback/Feedback.js`, `components/forms/useDemoForm.js`, `components/layout/{AppShell,AuthLayout,ProtoNav}.js`, `lib/{data,format,validation}.js` |
| Auth and account | ACCT | `app/(auth)/{login,cadastro,recuperar-senha,nova-senha}/page.js`, `components/auth/AuthForms.js`, `app/(app)/configuracoes/page.js`, `components/configuracoes/SettingsForm.js` |
| Dashboard, clients and lists management | CLST | `app/(app)/dashboard/page.js`, `app/(app)/clientes/{page,novo/page,[id]/page,[id]/editar/page}.js`, `components/clientes/Clientes.js`, `app/(app)/listas/{page,nova/page,[id]/editar/page}.js`, `components/listas/Listas.js` |
| Shopping list and products | SHOP | `app/(app)/listas/[id]/page.js`, `components/lista/{ShoppingList,RoomTable,ClientView,ItemLinks,ListFooter}.js`, `app/(app)/listas/[id]/produtos/{novo/page,[produtoId]/editar/page}.js`, `components/produtos/ProductForm.js` |

Tests are colocated as `*.test.js` next to the module they cover and belong to that module's area.

## Baseline checks (commit 3e3d0bf)

| Check | Result |
| --- | --- |
| `npm run lint` | Pass: 0 errors, 2 warnings `@next/next/no-img-element` at `components/lista/RoomTable.js:49` and `components/produtos/ProductForm.js:60`. |
| Type-check | N/A (plain JavaScript). |
| `npm test` | No test files (Vitest exits 1: "No test files found"). Toolchain verified with a throwaway test, then deleted. |
| `npm run build` | Pass. 250 static pages. Dynamic (ƒ): `/clientes`, `/dashboard`, `/listas`, `/listas/nova`, `/login`, `/recuperar-senha`. SSG (●): `/clientes/[id]`, `/clientes/[id]/editar`, `/listas/[id]`, `/listas/[id]/editar`, `/listas/[id]/produtos/novo`, `/listas/[id]/produtos/[produtoId]/editar`. Static (○): `/`, `/_not-found`, `/cadastro`, `/clientes/novo`, `/configuracoes`, `/nova-senha`. Warning: workspace root inferred from `/Users/brunovidotto/package-lock.json` (a lockfile outside the repo). |
| `npm audit` | 1 high: `postcss` 8.4.31 bundled by `next` 15.5.28 (GHSA-qx2v-qp2m-jg93, GHSA-6g55-p6wh-862q, GHSA-fxqj-rqcc-2cmp, GHSA-r28c-9q8g-f849); 1 moderate: `next` (depends on it). npm's only fix is `next@16.4.3` (major upgrade). |

## Findings

| ID | Severity | Criterion | Area | File | Summary | Status | Commit | Attempts |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CFG-CQ-001 | Important | CONTRACTS | CFG | `package.json`, `README.md:37` | README promises Node 18.18+, but the test toolchain needs Node `^22.22.2 \|\| ^24.15.0 \|\| >=26` (jsdom 30, vitest 5, vite 8). | RESOLVED | f3ccb2b | 1 |
| CFG-CQ-002 | Important | TESTS | CFG | `package.json:10` | No permanent tests; `npm test` fails ("No test files found"); root redirect and not-found fallback unprotected. | RESOLVED | 3f4f6c8 (+ all area test commits) | 1 |
| CFG-CQ-003 | Important | CONTRACTS | CFG | `app/styles/app.css:191,212` | Mobile drawer `.side` is fixed full-height with no vertical scrolling; on short viewports (568x320) the account footer and "Sair" are unreachable. | RESOLVED | 55d9b81 | 1 |
| CFG-CQ-004 | Minor | SIMPLICITY | CFG | `app/layout.js:13-16` | Fonts loaded from external Google stylesheet with lint suppression instead of `next/font`. | OPEN (Minor, not fixed) | | |
| CFG-CQ-005 | Minor | CONTRACTS | CFG | `next.config.mjs:2` | Workspace root inferred from a lockfile outside the repo; set `outputFileTracingRoot`. | OPEN (Minor, not fixed) | | |
| CFG-CQ-006 | Minor | CONTRACTS | CFG | `app/styles/app.css:77-89` | `--muted` #888 small labels/hints ~3.5:1 contrast on white, below 4.5:1. | OPEN (Minor, not fixed) | | |
| CFG-CQ-007 | Minor | CONTRACTS | CFG | `app/styles/app.css:243-250` | Auth panel in OS dark theme: white text on `--sage` #76A5AF ~2.7:1 contrast. | OPEN (Minor, not fixed) | | |
| CFG-CQ-008 | Important | CONTRACTS | CFG | `app/styles/app.css:339-346` | Confirmation overlay/box has no max height or vertical scroll; on short viewports (e.g. 320x240) its buttons can be clipped. (Round 2) | RESOLVED | 2f1dca4 | 1 |
| SHR-CQ-001 | Important | STATE | SHR | `components/forms/useDemoForm.js:39-44` | Simulated-submit timer is never cancelled; leaving the form within 650 ms still runs `onSuccess` and redirects. | RESOLVED | 1e64ed8, d32904a | 2 |
| SHR-CQ-002 | Important | CONTRACTS | SHR | `components/feedback/Feedback.js:41-47` | Confirmation `alertdialog` (`aria-modal`) does not contain Tab/Shift+Tab; focus reaches background controls. | RESOLVED | 720451e | 1 |
| SHR-CQ-003 | Important | STATE | SHR | `components/feedback/Feedback.js:31-38` | Confirmation survives navigation (provider in root layout); old `onConfirm` can still run on the new page. | RESOLVED | 8be1d9b, f5bc0b9, 4cd6e54 | 3 |
| SHR-CQ-004 | Important | CONTRACTS | SHR | `components/layout/AppShell.js:25-31` | Open mobile drawer does not contain keyboard focus; Tab reaches covered page controls. | RESOLVED | c33e5a0 | 1 |
| SHR-CQ-005 | Important | CONTRACTS | SHR | `lib/validation.js:4-10` | `match` compares trimmed values, so `Password1` and `Password1 ` pass confirmation. | RESOLVED | 8fbe432 | 1 |
| SHR-CQ-006 | Important | TESTS | SHR | `components/forms/useDemoForm.js:33-44` (area) | No tests for shared validation, form lifetime, confirmation and drawer behavior. | RESOLVED | b88365c (+ tests in 8fbe432, 1e64ed8, 720451e, c33e5a0, 8be1d9b) | 1 |
| SHR-CQ-007 | Minor | STATE | SHR | `components/ui/Button.js:12` | Busy button stays natively enabled; keyboard can submit twice. | OPEN (Minor, not fixed) | | |
| SHR-CQ-008 | Minor | STATE | SHR | `components/forms/useDemoForm.js:16-20` | Errors of dependent fields (`match`, `requiredIf`) are not refreshed when the other field changes. | OPEN (Minor, not fixed) | | |
| SHR-CQ-009 | Minor | CONTRACTS | SHR | `components/ui/Fields.js:13-19` | Hints and password-strength text are not linked via `aria-describedby`. | OPEN (Minor, not fixed) | | |
| SHR-CQ-010 | Minor | CONTRACTS | SHR | `components/ui/Fields.js:8-11` | Label inside `.lbl-row` loses the shared label style (selector `.field>label`). | OPEN (Minor, not fixed) | | |
| SHR-CQ-011 | Minor | CONTRACTS | SHR | `components/layout/ProtoNav.js:23-35` | ProtoNav panel is before its trigger in DOM order; Tab skips the opened links. | OPEN (Minor, not fixed) | | |
| SHR-CQ-012 | Minor | STATE | SHR | `components/layout/AppShell.js:49-51` | Drawer stays open on same-path or query-only navigation. | OPEN (Minor, not fixed) | | |
| SHR-CQ-013 | Minor | CONTRACTS | SHR | `components/feedback/Feedback.js:80-82` | After confirming an inline deletion, focus is not moved to a surviving control (trigger removed). (Round 2) | OPEN (Minor, not fixed) | | |
| ACCT-CQ-001 | Important | STATE | ACCT | `components/auth/AuthForms.js:10-11,56-57` | `useState(showError)` / `useState(initialSent)` ignore later prop changes; query-only navigation (`/login` to `/login?estado=erro`) does not change the screen. | RESOLVED | d38f9b1 | 1 |
| ACCT-CQ-002 | Important | STATE | ACCT | `components/auth/AuthForms.js:58-65` | Recovery confirmation shows the current input draft, not the submitted (validated) email. | RESOLVED | 0037254 | 1 |
| ACCT-CQ-003 | Important | TESTS | ACCT | `components/auth/AuthForms.js` (area) | No tests for login/signup/recovery/reset/settings workflows. | RESOLVED | 4014fa9 (+ tests in d38f9b1, 0037254) | 1 |
| ACCT-CQ-004 | Minor | DUPLICATION | ACCT | `components/auth/AuthForms.js:38-47` | Minimum password length 8 repeated in three forms and placeholders. | OPEN (Minor, not fixed) | | |
| ACCT-CQ-005 | Minor | CONTRACTS | ACCT | `components/auth/AuthForms.js:60-62,99-101` | Recovery and reset confirmations replace the form without moving focus to the confirmation. (Round 2) | OPEN (Minor, not fixed) | | |
| CLST-CQ-001 | Important | STATE | CLST | `app/(app)/clientes/page.js:9-14`, `listas/page.js:14`, `listas/nova/page.js:12` | Tables and new-list form copy query-derived props into state without a reset `key`; query-only navigation keeps stale rows/draft. | RESOLVED | 67acf9a | 1 |
| CLST-CQ-002 | Important | STATE | CLST | `components/listas/Listas.js:85-97`, `clientes/[id]/page.js:31-38` | Client detail: `ListCards` deletes locally but heading count, delete-client warning and empty state use the original server list. | RESOLVED | 2481e34 | 1 |
| CLST-CQ-003 | Important | CONTRACTS | CLST | `app/(app)/listas/nova/page.js:7-12` | `?cliente=` forwarded unvalidated; unknown or repeated value passes the required-client rule. | RESOLVED | 2d8039e | 1 |
| CLST-CQ-004 | Important | TESTS | CLST | `components/listas/Listas.js` (area) | No tests for search/filters, deletions, empty states, form validation, client preselection, query navigation. | RESOLVED | 999d86d, 5532d86 (+ tests in 2d8039e, 67acf9a, 2481e34) | 2 |
| CLST-CQ-005 | Minor | CONTRACTS | CLST | `app/(app)/listas/[id]/editar/page.js:15`, `listas/nova/page.js:12` | Full `CLIENTS` records sent to `ListForm`, which only needs id and name. | OPEN (Minor, not fixed) | | |
| SHOP-CQ-001 | Important | STATE | SHOP | `app/(app)/listas/[id]/produtos/novo/page.js:12-17` | `ProductForm` keeps the old draft/room on query-only navigation (no reset `key`). | RESOLVED | 8568b2d | 1 |
| SHOP-CQ-002 | Important | CONTRACTS | SHOP | `app/(app)/listas/[id]/produtos/novo/page.js:12-17` | `?ambiente=` forwarded unvalidated; unknown or repeated value passes the required-room rule. | RESOLVED | 24b9b75 | 1 |
| SHOP-CQ-003 | Important | STATE | SHOP | `components/lista/ShoppingList.js:69-79` | Emptiness checked by room count; removing every product shows empty tables / blank client view instead of the empty state. | RESOLVED | 17f8111 | 1 |
| SHOP-CQ-004 | Important | CONTRACTS | SHOP | `components/lista/ClientView.js:15-17`, `RoomTable.js:61` | Product-level `notes` are not rendered in either list mode. | DISPROVED (reviewer: design shows only per-link notes) | | 0 |
| SHOP-CQ-005 | Important | CONTRACTS | SHOP | `components/produtos/ProductForm.js:67-75` | Quantity normalised only on blur; Enter submits 0 or negative quantity as success. | RESOLVED | c468260 | 1 |
| SHOP-CQ-006 | Important | CONTRACTS | SHOP | `components/produtos/ProductForm.js:37-39` | Upload promises "JPG ou PNG, até 5 MB" but accepts any `image/*` of any size. | RESOLVED | 01233f5 | 1 |
| SHOP-CQ-007 | Important | CONTRACTS | SHOP | `components/lista/RoomTable.js:54-55` | Armed two-step remove keeps `aria-label="Remover item"`; screen readers get no confirmation cue. | RESOLVED | 3496274 | 1 |
| SHOP-CQ-008 | Important | TESTS | SHOP | `components/lista/ShoppingList.js` (area) | No tests for list counts/filters/toggles/removal/empty states or product form validation. | RESOLVED | 60d26c3, e1eccc7 (+ tests in 24b9b75, 8568b2d, 17f8111, c468260, 01233f5, 3496274) | 2 |
| SHOP-CQ-009 | Minor | CONTRACTS | SHOP | `components/lista/ShoppingList.js:69-73` | Empty client preview still shows the "Adicionar primeiro produto" edit action. | OPEN (Minor, not fixed) | | |
| SHOP-CQ-010 | Minor | CONTRACTS | SHOP | `app/(app)/listas/[id]/page.js:15` | Full list and client records sent to `ShoppingList`, which needs only id and name. | OPEN (Minor, not fixed) | | |
| SHOP-CQ-011 | Minor | DUPLICATION | SHOP | `components/produtos/ProductForm.js:28-29` | Purchase-link URL regex and message duplicate `lib/validation.js:8`. | OPEN (Minor, not fixed) | | |
| SHOP-CQ-012 | Minor | SIMPLICITY | SHOP | `components/lista/RoomTable.js:49` | Raw `<img>` thumbnails (lint warnings) instead of `next/image`. | OPEN (Minor, not fixed) | | |
| SHOP-CQ-013 | Important | CONTRACTS | SHOP | `components/lista/RoomTable.js:38-45` | Inline quantity `commitQty` accepts values >0 (e.g. 0.5) despite min=1; summary uses it. (Round 2) | RESOLVED | ab0ae8c | 1 |
| SHOP-CQ-014 | Important | CONTRACTS | SHOP | `components/produtos/ProductForm.js:29-32` | Purchase-link regex checks only a prefix: `https://loja.com oferta` passes and the form reports success. (Round 2) | RESOLVED | fa8c9ef | 1 |
| SHOP-CQ-015 | Minor | STATE | SHOP | `components/produtos/ProductForm.js:39-42` | Concurrent FileReader callbacks can overwrite the latest image preview with an older one. (Round 2) | OPEN (Minor, not fixed) | | |

## Rounds

### Round 1

Review (candidate `3e3d0bf`):

| Area | Verdict | Findings | Criteria |
| --- | --- | --- | --- |
| CFG | CHANGES_REQUIRED | 3 Important (001-003), 4 Minor (004-007) | FLOW PASS, COHESION PASS, STATE N/A, SIMPLICITY PASS, DUPLICATION PASS, CONTRACTS FAIL, TESTS FAIL |
| SHR | CHANGES_REQUIRED | 6 Important (001-006), 6 Minor (007-012) | FLOW PASS, COHESION PASS, STATE FAIL, SIMPLICITY PASS, DUPLICATION PASS, CONTRACTS FAIL, TESTS FAIL |
| ACCT | CHANGES_REQUIRED | 3 Important (001-003), 1 Minor (004) | FLOW PASS, COHESION PASS, STATE FAIL, SIMPLICITY PASS, DUPLICATION PASS, CONTRACTS FAIL, TESTS FAIL |
| CLST | CHANGES_REQUIRED | 4 Important (001-004), 1 Minor (005) | FLOW PASS, COHESION PASS, STATE FAIL, SIMPLICITY PASS, DUPLICATION PASS, CONTRACTS FAIL, TESTS FAIL |
| SHOP | CHANGES_REQUIRED | 8 Important (001-008), 4 Minor (009-012) | FLOW PASS, COHESION PASS, STATE FAIL, SIMPLICITY PASS, DUPLICATION PASS, CONTRACTS FAIL, TESTS FAIL |

Lead verification: CFG-CQ-001 confirmed from installed engine fields; CFG-CQ-002 confirmed (no test
files); CFG-CQ-003 confirmed (drawer content ~416px tall vs 320px viewport, no overflow rule).
Reviewer residual risk: PostCSS advisory not reachable (only developer-authored CSS), not a finding.
SHR: lead confirmed 001 (timer not stored/cleared), 002 (no Tab handling, ProtoNav reachable),
003 (pathname effect never clears `dialog`), 004 (only Escape handled), 005 (both sides trimmed).
ACCT: lead confirmed 001 (same component instance kept on query-only navigation; the project
already uses a `key` for this in `listas/[id]/page.js`), 002 (`f.values.email` is the live draft).
CLST: lead confirmed 001-003 in code. Extra fact: `next start` on the 3e3d0bf build serves
`?estado=vazio` correctly on the SSG routes `/clientes/[id]` and `/listas/[id]`, so the SSG label
in the build table is not a defect.
SHOP: lead confirmed 001-003 and 005-007 in code. SHOP-CQ-004 challenged: `html/lista.html`
(design reference) renders only per-link notes in the list, its data has no product-level notes,
and `ClientView.js` states it is a faithful reproduction of the original page. Showing product
notes in the list is a design decision; the challenge goes to the next reviewer. Not fixed meanwhile.

Fix plan (one commit per finding): CFG-CQ-001; SHR-CQ-005, 001, 002, 004, 003, 006; ACCT-CQ-001,
002, 003; CLST-CQ-003, 001, 002, 004; SHOP-CQ-002, 001, 003, 005, 006, 007, 008; CFG-CQ-003
(verified in a real browser, since jsdom has no layout); CFG-CQ-002 last (root tests, suite green).

Fix evidence:
- CFG-CQ-001 (f3ccb2b): RED Vitest crashes on Node 20.19.2 (inside the old README promise). GREEN on
  Node 22.22.2 (installed with nvm): throwaway test passes, lint 0 errors, build 250/250 pages.
- SHR-CQ-005 (8fbe432): RED `lib/validation.test.js` "match rejects passwords that differ only by
  surrounding spaces" failed (expected mismatch, got ''). GREEN 7/7, lint clean.
- SHR-CQ-001 (1e64ed8): RED `useDemoForm.test.js` "leaving the form before the simulated delay
  ends cancels the success callback" failed (onSuccess called once). GREEN 10/10, lint clean.
- SHR-CQ-002 (720451e): RED `Feedback.test.js` "Tab and Shift+Tab keep the focus inside the
  confirmation" failed. Added `lib/focus.js` `keepFocusInside` (also needed by SHR-CQ-004). GREEN 15/15.
- SHR-CQ-004 (c33e5a0): RED `AppShell.test.js` "Tab and Shift+Tab keep the focus inside the open
  mobile drawer" failed. Trap applies only while `(max-width: 960px)` matches (desktop test). GREEN 19/19.
- SHR-CQ-003 (8be1d9b): RED `Feedback.test.js` "navigating to another page discards an open
  confirmation and its action" failed (dialog still rendered). Fix: `setDialog(null)` on pathname
  change (same pattern as AppShell drawer). GREEN 20/20.
- SHR-CQ-006: coverage only (no defect, so no RED). Tests: `lib/validation.test.js` (8fbe432),
  `components/forms/useDemoForm.test.js` (1e64ed8 + first-invalid-field focus test in the SHR-CQ-006
  commit), `components/feedback/Feedback.test.js` (720451e, 8be1d9b), `components/layout/AppShell.test.js`
  (c33e5a0). GREEN 21/21.
- ACCT-CQ-001 (d38f9b1): RED `components/auth/AuthForms.test.js` (page boundary: render page, then
  rerender with new searchParams, as App Router reconciles query-only navigation) failed for login
  and recovery. Fix: `key` by preview state in both pages. GREEN 23/23.
- ACCT-CQ-002 (commit after d38f9b1, message "ACCT-CQ-002: ..."): RED "recovery confirmation shows
  the submitted email, not a later edit of the field" failed. Fix: keep `sentTo` from `onSuccess`
  values; preview uses `USER.email`. GREEN 24/24.
- ACCT-CQ-003 (4014fa9): coverage only. `AuthForms.test.js` (login fail/success, signup validation
  and destination, reset mismatch/success, recovery recipient, query previews) and
  `configuracoes/SettingsForm.test.js` (profile-only save, new password needs current). GREEN 30/30.
- CLST-CQ-003 (commit "CLST-CQ-003: ..."): RED `components/listas/Listas.test.js` invalid client
  query (unknown, repeated) passed the required rule. Fix: `getClient(q.cliente)?.id ?? ''`. GREEN 33/33.
- CLST-CQ-001 (67acf9a): RED 3 page-boundary tests (clients empty query, lists empty query, new-list
  client reset) failed. Fix: `key` on ClientsTable, ListsTable, ListForm. GREEN 36/36.
- CLST-CQ-002 (2481e34): RED `Clientes.test.js` "deleting the last list card updates the count, the
  empty state and the client delete warning" failed (heading kept "· 1"). Fix: new `ClientDetail`
  client component owns the lists (server profile passed as children, keyed by empty state);
  `ListCards` is now controlled (`onDeleted`). GREEN 37/37, lint 0 errors.

Working notes for the lead: tests mock `next/navigation` per file with `vi.hoisted`; pages are
tested by awaiting `Page({ searchParams: Promise.resolve(q) })` and rendering the element; wrap in
`FeedbackProvider` (mock `usePathname`) when confirmations must open. All round 1 Important fixes
are committed. Next: full checks, re-review per area (include the SHOP-CQ-004 challenge), round 2.
- CLST-CQ-004 (999d86d): coverage only. `Clientes.test.js` (accent-insensitive search, no-results,
  confirmed/cancelled delete, detail list ownership, empty query) and `Listas.test.js` (status +
  search filters, form validation, client preselection/reset, dashboard normal/empty). GREEN 42/42.
- SHOP-CQ-002 (24b9b75): RED `produtos/ProductForm.test.js` invalid room query (unknown, repeated)
  passed. Fix: `ROOM_NAMES.includes(ambiente) ? ambiente : ''`. GREEN 45/45.
- SHOP-CQ-001 (8568b2d): RED "the new product form resets its room and draft when only the query
  changes" failed. Fix: `key={room}` on ProductForm. GREEN 46/46.
- SHOP-CQ-003 (17f8111): RED `lista/ShoppingList.test.js` "removing the last product shows the empty
  list state in both modes" failed. Fix: use `stats.n` instead of `rooms.length`. GREEN 47/47.
- SHOP-CQ-005 (c468260): RED `validation.test.js` "min rejects numbers below the minimum" and
  `ProductForm.test.js` "submitting with Enter rejects the quantity" ('0', '-2', '') failed. Fix:
  shared `min` rule; `qtd: { required: true, min: 1 }`; error and aria on the stepper. GREEN 51/51.
- SHOP-CQ-006 (01233f5): RED "the image picker rejects a GIF / a PNG over 5 MB" failed (FileReader
  called). Fix: `IMAGE_TYPES` + `MAX_IMAGE_BYTES` checks, `accept` limited to JPG/PNG. GREEN 54/54.
- SHOP-CQ-007 (3496274): RED "the two-step remove button names the product and the pending
  confirmation" failed (name "Remover item"). Fix: dynamic `aria-label` (`Remover X` /
  `Confirmar remoção de X`). GREEN 55/55.
- SHOP-CQ-008 (60d26c3): coverage only. `ShoppingList.test.js` (summary counts/totals, bought toggle,
  quantity edit, filters, armed-remove timeout, read-only client view) and `ProductForm.test.js`
  (name required, valid save). GREEN 61/61.
- CFG-CQ-003 (55d9b81): browser check with Playwright on `next dev`. RED at 568x320 with the drawer
  open: `.side` overflowY visible, scrollHeight 393 > 320, scrollTop stuck at 0, "Sair" bottom 393.
  Fix: `overflow-y:auto; overscroll-behavior:contain` on `.side`. GREEN: overflowY auto, "Sair"
  scrolled into view (bottom 320). Desktop 1280x800: no scrollbar. No automated test (jsdom has no
  layout; Playwright was not approved as a test framework).
- CFG-CQ-002 (3f4f6c8): `npm test` exits 0 with 11 files / 66 tests. `app/routes.test.js` adds root
  redirect, not-found page and unknown client/list/product ids reaching `notFound`.
- Round 1 full checks after fixes (HEAD 3f4f6c8): lint 0 errors / 2 known `no-img-element`
  warnings; `npm test` 11 files, 66 tests, exit 0; `next build` 250/250 pages, exit 0 (same
  workspace-root warning, CFG-CQ-005). Type-check N/A.

Round 1 re-reviews (fresh reviewer per area, HEAD 2bac449):
- CFG: APPROVED. CFG-CQ-001, 002, 003 RESOLVED. No new findings. All criteria PASS (STATE N/A).
  Residual: drawer geometry verified manually in a browser (no E2E framework approved).
- SHR: CHANGES_REQUIRED. RESOLVED: SHR-CQ-002, 004, 005, 006. OPEN again: SHR-CQ-001 (a second
  submit overwrites the timer ref; the first timer survives unmount) and SHR-CQ-003 (query-only
  history navigation, e.g. browser Back to `?estado=vazio`, keeps the dialog and its old action).
  Lead verified both. Attempt 2 next. STATE FAIL, TESTS FAIL, others PASS.
  - SHR-CQ-001 attempt 2 (d32904a): RED "submitting twice and then leaving the form cancels every
    pending success callback" failed. Fix: `clearTimeout(pending.current)` before scheduling.
  - SHR-CQ-003 attempt 2 (commit "SHR-CQ-003: Discard an open confirmation on browser history
    navigation"): RED "browser history navigation (Back/Forward, even query-only) discards an open
    confirmation" failed. Fix: `popstate` listener closes the dialog (focus is trapped and the scrim
    closes on click, so history traversal is the only way the URL changes while it is open;
    `useSearchParams` in the root provider would need a Suspense boundary). GREEN 68/68, lint clean.
- SHR re-review of attempt 2 (HEAD f5bc0b9): SHR-CQ-001 RESOLVED. SHR-CQ-003 still OPEN: a
  query-only Link navigation started before the dialog opens can commit while it is open (no
  pathname change, no popstate) and remount the keyed view, keeping the stale action. Reviewer also
  asked for a fresh build on the current candidate.
  - Attempt 3 plan (last before asking the user): tie the dialog to the component that opened it.
    `useConfirm` registers an owner; when the owner unmounts (any navigation that replaces the
    view), the provider discards its dialog. Replaces the pathname and popstate effects.
  - Attempt 3 (4cd6e54): RED "leaving the page that opened a confirmation discards it" and "a
    query-only navigation that remounts the page (link or Back/Forward) discards its confirmation"
    failed. Fix: `useConfirm` owner + provider `cancel(owner)` on unmount; pathname/popstate effects
    and their tests replaced by view-lifetime tests (+ "re-rendering the same page keeps its
    confirmation open"). GREEN 69/69, lint 0 errors, build 250/250 at 4cd6e54.
- SHR re-review of attempt 3 (HEAD 4cd6e54): APPROVED. SHR-CQ-003 RESOLVED. No new findings. All
  criteria PASS. Residual: navigation modelled by unmount/keyed remount in jsdom (no E2E).
- ACCT (HEAD 5c1f75e): APPROVED. ACCT-CQ-001, 002, 003 RESOLVED. No new findings. All criteria PASS.
- CLST (HEAD 5c1f75e): CHANGES_REQUIRED. CLST-CQ-001, 002, 003 RESOLVED. CLST-CQ-004 OPEN: ClientForm
  validation and successful client/list create/edit saves are untested. TESTS FAIL, others PASS.
  - CLST-CQ-004 attempt 2 (5532d86): ClientForm required/e-mail validation, new/edit client
    destinations, new/edit list destinations. GREEN 73/73, lint clean. Next: SHOP re-review, then
    one re-review for CLST-CQ-004, full checks, round 2.
- SHOP (HEAD 5532d86): CHANGES_REQUIRED. RESOLVED: SHOP-CQ-001, 002, 003, 005, 006, 007. SHOP-CQ-004
  DISPROVED (design reference renders only per-link notes). SHOP-CQ-008 OPEN: existing-product edit
  (prefilled values, save) and product deletion confirm/cancel untested. TESTS FAIL, others PASS.
  - SHOP-CQ-008 attempt 2 (e1eccc7): edit page prefilled values + save, product delete cancel/confirm.
    GREEN 75/75, lint clean.
- Re-review of CLST-CQ-004 and SHOP-CQ-008 attempt 2 (HEAD bfbc25c): APPROVED, both RESOLVED.
- Round 1 result: all 24 Important findings RESOLVED (SHOP-CQ-004 DISPROVED). 16 Minor recorded.
  Next: full checks at HEAD, then Round 2 fresh full review of all 5 areas (CFG, SHR, ACCT, CLST,
  SHOP) with code-quality-next-js-reviewer, new IDs continue per area (CFG-CQ-008, SHR-CQ-013,
  ACCT-CQ-005, CLST-CQ-006, SHOP-CQ-013). Then complete-review agents in parallel.
- Round 1 final checks (HEAD bfbc25c + ledger): lint 0 errors / 2 known warnings; npm test 11 files,
  75 tests, exit 0; next build 250/250, exit 0. Type-check N/A.

### Round 2

Fresh full review of all 5 areas (one reviewer at a time, fresh context).

| Area | Verdict | Findings | Criteria |
| --- | --- | --- | --- |
| CFG | CHANGES_REQUIRED | 1 Important (CFG-CQ-008) | FLOW PASS, COHESION PASS, STATE N/A, SIMPLICITY PASS, DUPLICATION PASS, CONTRACTS FAIL, TESTS FAIL (layout not covered by jsdom) |

| SHR | APPROVED | 1 Minor (SHR-CQ-013) | all PASS; SHR-CQ-001..006 confirmed RESOLVED |
| ACCT | APPROVED | 1 Minor (ACCT-CQ-005) | all PASS; ACCT-CQ-001..003 confirmed RESOLVED |
| CLST | APPROVED | none | all PASS; CLST-CQ-001..004 confirmed RESOLVED |
| SHOP | CHANGES_REQUIRED | 2 Important (SHOP-CQ-013, 014), 1 Minor (015) | CONTRACTS FAIL, TESTS FAIL, others PASS; SHOP-CQ-001..008 confirmed RESOLVED, 004 DISPROVED |

CFG round 2 notes: CFG-CQ-001..003 confirmed RESOLVED (no regression). CFG-CQ-008 to be verified
in a real browser (Playwright on next dev, 320x240) before fixing.
Round 2 fix plan (one commit each, RED-GREEN): SHOP-CQ-013 (clamp inline qty to >=1, test 0.5 via
blur/Enter + summary), SHOP-CQ-014 (complete URL validation with `new URL` + http(s) protocol; reuse
shared rule if simple; test malformed link keeps form open), CFG-CQ-008 (`.modal` overlay scrollable /
`.box` max-height + overflow; verify in Playwright at 320x240, RED then GREEN). Then re-review,
full checks, Round 3 full review, then complete-review agents in parallel.
- SHOP-CQ-013 (ab0ae8c): RED "an inline quantity below 1 is corrected to 1 on blur/Enter" failed
  (0.5 kept, total R$ 25). Fix: `+qty >= 1 ? +qty : 1`. GREEN 77/77.
- SHOP-CQ-014 (commit "SHOP-CQ-014: Validate the whole purchase link"): RED "the purchase link
  'https://loja.com oferta' is accepted: false" failed (saved). Fix: end anchor `$` on the link
  regex in ProductForm. The shared `url` rule in lib/validation.js has the same pattern but is unused
  (duplication already recorded as Minor SHOP-CQ-011). GREEN 79/79, lint clean.
- CFG-CQ-008 (2f1dca4): Playwright on next dev, /clientes/sergio-hooper, "Excluir" dialog. RED at
  320x240: box 16..290px, confirm button bottom 264, overflowY visible on overlay and box, no scroll.
  Fix: `.modal .box` gets `max-height:100%; overflow-y:auto; overscroll-behavior:contain`. GREEN: box
  16..224, scrollable (274 > 208), confirm button reachable (bottom 198). Desktop 1280x800: no
  scrollbar. No automated test (jsdom has no layout).
- Round 2 re-review (HEAD 5efe2e9): APPROVED. CFG-CQ-008, SHOP-CQ-013, SHOP-CQ-014 RESOLVED. No new
  findings. Full checks at 5efe2e9: lint 0 errors / 2 known warnings; 79 tests pass; build 250/250.
- Round 2 result: 3 Important found and RESOLVED; 3 new Minor (SHR-CQ-013, ACCT-CQ-005, SHOP-CQ-015).
  Because Round 2 found Important findings, Round 3 is a fresh full review of all 5 areas.

### Round 3

Fresh full review of all 5 areas (one reviewer at a time, fresh context). New IDs continue:
CFG-CQ-009, SHR-CQ-014, ACCT-CQ-006, CLST-CQ-006, SHOP-CQ-016.

| Area | Verdict | Findings | Criteria |
| --- | --- | --- | --- |
| CFG | APPROVED | none | all PASS (STATE N/A); CFG-CQ-001..003, 008 confirmed RESOLVED |
| SHR | APPROVED | none | all PASS; SHR-CQ-001..006 confirmed RESOLVED |
| ACCT | APPROVED | none | all PASS; ACCT-CQ-001..003 confirmed RESOLVED |
| CLST | APPROVED | none | all PASS; CLST-CQ-001..004 confirmed RESOLVED |
| SHOP | APPROVED | none | all PASS; SHOP-CQ-001..003, 005..008, 013, 014 confirmed RESOLVED; 004 DISPROVED |

Round 3 result: DONE for the code-quality-next-js-reviewer loop. No open Critical or Important
findings; every criterion PASS or justified N/A; checks pass (last code change 2f1dca4, checked at
5efe2e9: lint 0 errors / 2 known warnings, 79 tests, build 250/250).

## Complete-review rounds (user request)

Agents run in parallel each round: complete-review-architecture (ARCH), -cleancode (CLEAN),
-critical (CRIT), -security (SEC), -performance (PERF). Goal: no open Critical or High (= Important)
findings. Fixes follow the same RED-GREEN-REFACTOR, one commit per finding, re-review by a fresh agent.

### CR Round 1

Launched in parallel at HEAD 9b168cf (background agent ids: ARCH 23da2d41, CLEAN 48a4018f,
CRIT 38501f43, SEC b42082d5, PERF 45885c34). Security was listed twice by the user; run once.

User request (later): after this reviewer loop reaches Done, run complete-review-architecture,
-cleancode, -critical, -security, -performance in parallel, in rounds, until no Critical or High
(Important) findings remain.

- Note: untracked `api/PLANO-BACKEND.md` (user file, not part of this work) and `.playwright-mcp/`
  (browser tool output) are left unstaged.

CR Round 1 result (HEAD 9b168cf): ARCH, CLEAN, CRIT, SEC, PERF all APPROVED; no findings of any
severity. Security: PostCSS advisory not exploitable here. DONE.

## Final report

### Verdict
- Code-quality loop (code-quality-next-js-reviewer, one fresh reviewer at a time): 3 rounds.
  Round 1: 24 Important, 16 Minor. Round 2: 3 Important, 3 Minor. Round 3: none. Verdict: DONE.
- Complete-review loop (user request; architecture, clean code, critical, security, performance in
  parallel): 1 round, all five APPROVED with no Critical/High findings. Verdict: DONE.
- Important findings: 27 total, 26 RESOLVED, 1 DISPROVED (SHOP-CQ-004), 0 open. Critical: 0.
- Minor findings recorded and left open: 19.

### All findings

| ID | Severity | Area | Status | Commit |
| --- | --- | --- | --- | --- |
| CFG-CQ-001 | Important | CFG | RESOLVED | f3ccb2b |
| CFG-CQ-002 | Important | CFG | RESOLVED | 3f4f6c8 (+ all area test commits) |
| CFG-CQ-003 | Important | CFG | RESOLVED | 55d9b81 |
| CFG-CQ-004 | Minor | CFG | Minor, open (not fixed) | - |
| CFG-CQ-005 | Minor | CFG | Minor, open (not fixed) | - |
| CFG-CQ-006 | Minor | CFG | Minor, open (not fixed) | - |
| CFG-CQ-007 | Minor | CFG | Minor, open (not fixed) | - |
| CFG-CQ-008 | Important | CFG | RESOLVED | 2f1dca4 |
| SHR-CQ-001 | Important | SHR | RESOLVED | 1e64ed8, d32904a |
| SHR-CQ-002 | Important | SHR | RESOLVED | 720451e |
| SHR-CQ-003 | Important | SHR | RESOLVED | 8be1d9b, f5bc0b9, 4cd6e54 |
| SHR-CQ-004 | Important | SHR | RESOLVED | c33e5a0 |
| SHR-CQ-005 | Important | SHR | RESOLVED | 8fbe432 |
| SHR-CQ-006 | Important | SHR | RESOLVED | b88365c (+ tests in 8fbe432, 1e64ed8, 720451e, c33e5a0, 8be1d9b) |
| SHR-CQ-007 | Minor | SHR | Minor, open (not fixed) | - |
| SHR-CQ-008 | Minor | SHR | Minor, open (not fixed) | - |
| SHR-CQ-009 | Minor | SHR | Minor, open (not fixed) | - |
| SHR-CQ-010 | Minor | SHR | Minor, open (not fixed) | - |
| SHR-CQ-011 | Minor | SHR | Minor, open (not fixed) | - |
| SHR-CQ-012 | Minor | SHR | Minor, open (not fixed) | - |
| SHR-CQ-013 | Minor | SHR | Minor, open (not fixed) | - |
| ACCT-CQ-001 | Important | ACCT | RESOLVED | d38f9b1 |
| ACCT-CQ-002 | Important | ACCT | RESOLVED | 0037254 |
| ACCT-CQ-003 | Important | ACCT | RESOLVED | 4014fa9 (+ tests in d38f9b1, 0037254) |
| ACCT-CQ-004 | Minor | ACCT | Minor, open (not fixed) | - |
| ACCT-CQ-005 | Minor | ACCT | Minor, open (not fixed) | - |
| CLST-CQ-001 | Important | CLST | RESOLVED | 67acf9a |
| CLST-CQ-002 | Important | CLST | RESOLVED | 2481e34 |
| CLST-CQ-003 | Important | CLST | RESOLVED | 2d8039e |
| CLST-CQ-004 | Important | CLST | RESOLVED | 999d86d, 5532d86 (+ tests in 2d8039e, 67acf9a, 2481e34) |
| CLST-CQ-005 | Minor | CLST | Minor, open (not fixed) | - |
| SHOP-CQ-001 | Important | SHOP | RESOLVED | 8568b2d |
| SHOP-CQ-002 | Important | SHOP | RESOLVED | 24b9b75 |
| SHOP-CQ-003 | Important | SHOP | RESOLVED | 17f8111 |
| SHOP-CQ-004 | Important | SHOP | DISPROVED (reviewer: design shows only per-link notes) | - |
| SHOP-CQ-005 | Important | SHOP | RESOLVED | c468260 |
| SHOP-CQ-006 | Important | SHOP | RESOLVED | 01233f5 |
| SHOP-CQ-007 | Important | SHOP | RESOLVED | 3496274 |
| SHOP-CQ-008 | Important | SHOP | RESOLVED | 60d26c3, e1eccc7 (+ tests in 24b9b75, 8568b2d, 17f8111, c468260, 01233f5, 3496274) |
| SHOP-CQ-009 | Minor | SHOP | Minor, open (not fixed) | - |
| SHOP-CQ-010 | Minor | SHOP | Minor, open (not fixed) | - |
| SHOP-CQ-011 | Minor | SHOP | Minor, open (not fixed) | - |
| SHOP-CQ-012 | Minor | SHOP | Minor, open (not fixed) | - |
| SHOP-CQ-013 | Important | SHOP | RESOLVED | ab0ae8c |
| SHOP-CQ-014 | Important | SHOP | RESOLVED | fa8c9ef |
| SHOP-CQ-015 | Minor | SHOP | Minor, open (not fixed) | - |

### Minor findings left open
- CFG-CQ-004 (CFG): Fonts loaded from external Google stylesheet with lint suppression instead of `next/font`.
- CFG-CQ-005 (CFG): Workspace root inferred from a lockfile outside the repo; set `outputFileTracingRoot`.
- CFG-CQ-006 (CFG): `--muted` #888 small labels/hints ~3.5:1 contrast on white, below 4.5:1.
- CFG-CQ-007 (CFG): Auth panel in OS dark theme: white text on `--sage` #76A5AF ~2.7:1 contrast.
- SHR-CQ-007 (SHR): Busy button stays natively enabled; keyboard can submit twice.
- SHR-CQ-008 (SHR): Errors of dependent fields (`match`, `requiredIf`) are not refreshed when the other field changes.
- SHR-CQ-009 (SHR): Hints and password-strength text are not linked via `aria-describedby`.
- SHR-CQ-010 (SHR): Label inside `.lbl-row` loses the shared label style (selector `.field>label`).
- SHR-CQ-011 (SHR): ProtoNav panel is before its trigger in DOM order; Tab skips the opened links.
- SHR-CQ-012 (SHR): Drawer stays open on same-path or query-only navigation.
- SHR-CQ-013 (SHR): After confirming an inline deletion, focus is not moved to a surviving control (trigger removed). (Round 2)
- ACCT-CQ-004 (ACCT): Minimum password length 8 repeated in three forms and placeholders.
- ACCT-CQ-005 (ACCT): Recovery and reset confirmations replace the form without moving focus to the confirmation. (Round 2)
- CLST-CQ-005 (CLST): Full `CLIENTS` records sent to `ListForm`, which only needs id and name.
- SHOP-CQ-009 (SHOP): Empty client preview still shows the "Adicionar primeiro produto" edit action.
- SHOP-CQ-010 (SHOP): Full list and client records sent to `ShoppingList`, which needs only id and name.
- SHOP-CQ-011 (SHOP): Purchase-link URL regex and message duplicate `lib/validation.js:8`.
- SHOP-CQ-012 (SHOP): Raw `<img>` thumbnails (lint warnings) instead of `next/image`.
- SHOP-CQ-015 (SHOP): Concurrent FileReader callbacks can overwrite the latest image preview with an older one. (Round 2)

### Checks before and after

| Check | Baseline (3e3d0bf) | Final (code 2f1dca4, checked at 5efe2e9) |
| --- | --- | --- |
| Lint | 0 errors, 2 `no-img-element` warnings | 0 errors, same 2 warnings (Minor SHOP-CQ-012) |
| Type-check | N/A (plain JavaScript) | N/A |
| Tests | No test files (`npm test` exit 1) | 11 files, 79 tests, exit 0 |
| Build | Pass, 250 pages, workspace-root warning | Pass, 250 pages, same warning (Minor CFG-CQ-005) |
| npm audit | 1 high (postcss inside next 15.5.28) | Unchanged; security reviewer: not reachable (build-time only, own CSS) |

### Blocked or waiting for a decision
- Nothing blocked. No Critical/Important finding is open.
- Optional decisions for the user: upgrade to Next 16 to clear the bundled PostCSS advisory (major
  upgrade, not required by the security review); whether to fix any Minor findings; whether to add
  an E2E tool (Playwright) so layout fixes CFG-CQ-003/008 get automated tests (verified manually in
  a browser only).
- Untracked and left alone: `api/PLANO-BACKEND.md` (user file) and `.playwright-mcp/` (browser tool
  output, safe to delete). Nothing pushed.
