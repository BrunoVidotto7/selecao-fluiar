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
| CFG-CQ-001 | Important | CONTRACTS | CFG | `package.json`, `README.md:37` | README promises Node 18.18+, but the test toolchain needs Node `^22.22.2 \|\| ^24.15.0 \|\| >=26` (jsdom 30, vitest 5, vite 8). | OPEN | | 0 |
| CFG-CQ-002 | Important | TESTS | CFG | `package.json:10` | No permanent tests; `npm test` fails ("No test files found"); root redirect and not-found fallback unprotected. | OPEN | | 0 |
| CFG-CQ-003 | Important | CONTRACTS | CFG | `app/styles/app.css:191,212` | Mobile drawer `.side` is fixed full-height with no vertical scrolling; on short viewports (568x320) the account footer and "Sair" are unreachable. | OPEN | | 0 |
| CFG-CQ-004 | Minor | SIMPLICITY | CFG | `app/layout.js:13-16` | Fonts loaded from external Google stylesheet with lint suppression instead of `next/font`. | OPEN (Minor, not fixed) | | |
| CFG-CQ-005 | Minor | CONTRACTS | CFG | `next.config.mjs:2` | Workspace root inferred from a lockfile outside the repo; set `outputFileTracingRoot`. | OPEN (Minor, not fixed) | | |
| CFG-CQ-006 | Minor | CONTRACTS | CFG | `app/styles/app.css:77-89` | `--muted` #888 small labels/hints ~3.5:1 contrast on white, below 4.5:1. | OPEN (Minor, not fixed) | | |
| CFG-CQ-007 | Minor | CONTRACTS | CFG | `app/styles/app.css:243-250` | Auth panel in OS dark theme: white text on `--sage` #76A5AF ~2.7:1 contrast. | OPEN (Minor, not fixed) | | |
| SHR-CQ-001 | Important | STATE | SHR | `components/forms/useDemoForm.js:39-44` | Simulated-submit timer is never cancelled; leaving the form within 650 ms still runs `onSuccess` and redirects. | OPEN | | 0 |
| SHR-CQ-002 | Important | CONTRACTS | SHR | `components/feedback/Feedback.js:41-47` | Confirmation `alertdialog` (`aria-modal`) does not contain Tab/Shift+Tab; focus reaches background controls. | OPEN | | 0 |
| SHR-CQ-003 | Important | STATE | SHR | `components/feedback/Feedback.js:31-38` | Confirmation survives navigation (provider in root layout); old `onConfirm` can still run on the new page. | OPEN | | 0 |
| SHR-CQ-004 | Important | CONTRACTS | SHR | `components/layout/AppShell.js:25-31` | Open mobile drawer does not contain keyboard focus; Tab reaches covered page controls. | OPEN | | 0 |
| SHR-CQ-005 | Important | CONTRACTS | SHR | `lib/validation.js:4-10` | `match` compares trimmed values, so `Password1` and `Password1 ` pass confirmation. | OPEN | | 0 |
| SHR-CQ-006 | Important | TESTS | SHR | `components/forms/useDemoForm.js:33-44` (area) | No tests for shared validation, form lifetime, confirmation and drawer behavior. | OPEN | | 0 |
| SHR-CQ-007 | Minor | STATE | SHR | `components/ui/Button.js:12` | Busy button stays natively enabled; keyboard can submit twice. | OPEN (Minor, not fixed) | | |
| SHR-CQ-008 | Minor | STATE | SHR | `components/forms/useDemoForm.js:16-20` | Errors of dependent fields (`match`, `requiredIf`) are not refreshed when the other field changes. | OPEN (Minor, not fixed) | | |
| SHR-CQ-009 | Minor | CONTRACTS | SHR | `components/ui/Fields.js:13-19` | Hints and password-strength text are not linked via `aria-describedby`. | OPEN (Minor, not fixed) | | |
| SHR-CQ-010 | Minor | CONTRACTS | SHR | `components/ui/Fields.js:8-11` | Label inside `.lbl-row` loses the shared label style (selector `.field>label`). | OPEN (Minor, not fixed) | | |
| SHR-CQ-011 | Minor | CONTRACTS | SHR | `components/layout/ProtoNav.js:23-35` | ProtoNav panel is before its trigger in DOM order; Tab skips the opened links. | OPEN (Minor, not fixed) | | |
| SHR-CQ-012 | Minor | STATE | SHR | `components/layout/AppShell.js:49-51` | Drawer stays open on same-path or query-only navigation. | OPEN (Minor, not fixed) | | |
| ACCT-CQ-001 | Important | STATE | ACCT | `components/auth/AuthForms.js:10-11,56-57` | `useState(showError)` / `useState(initialSent)` ignore later prop changes; query-only navigation (`/login` to `/login?estado=erro`) does not change the screen. | OPEN | | 0 |
| ACCT-CQ-002 | Important | STATE | ACCT | `components/auth/AuthForms.js:58-65` | Recovery confirmation shows the current input draft, not the submitted (validated) email. | OPEN | | 0 |
| ACCT-CQ-003 | Important | TESTS | ACCT | `components/auth/AuthForms.js` (area) | No tests for login/signup/recovery/reset/settings workflows. | OPEN | | 0 |
| ACCT-CQ-004 | Minor | DUPLICATION | ACCT | `components/auth/AuthForms.js:38-47` | Minimum password length 8 repeated in three forms and placeholders. | OPEN (Minor, not fixed) | | |
| CLST-CQ-001 | Important | STATE | CLST | `app/(app)/clientes/page.js:9-14`, `listas/page.js:14`, `listas/nova/page.js:12` | Tables and new-list form copy query-derived props into state without a reset `key`; query-only navigation keeps stale rows/draft. | OPEN | | 0 |
| CLST-CQ-002 | Important | STATE | CLST | `components/listas/Listas.js:85-97`, `clientes/[id]/page.js:31-38` | Client detail: `ListCards` deletes locally but heading count, delete-client warning and empty state use the original server list. | OPEN | | 0 |
| CLST-CQ-003 | Important | CONTRACTS | CLST | `app/(app)/listas/nova/page.js:7-12` | `?cliente=` forwarded unvalidated; unknown or repeated value passes the required-client rule. | OPEN | | 0 |
| CLST-CQ-004 | Important | TESTS | CLST | `components/listas/Listas.js` (area) | No tests for search/filters, deletions, empty states, form validation, client preselection, query navigation. | OPEN | | 0 |
| CLST-CQ-005 | Minor | CONTRACTS | CLST | `app/(app)/listas/[id]/editar/page.js:15`, `listas/nova/page.js:12` | Full `CLIENTS` records sent to `ListForm`, which only needs id and name. | OPEN (Minor, not fixed) | | |
| SHOP-CQ-001 | Important | STATE | SHOP | `app/(app)/listas/[id]/produtos/novo/page.js:12-17` | `ProductForm` keeps the old draft/room on query-only navigation (no reset `key`). | OPEN | | 0 |
| SHOP-CQ-002 | Important | CONTRACTS | SHOP | `app/(app)/listas/[id]/produtos/novo/page.js:12-17` | `?ambiente=` forwarded unvalidated; unknown or repeated value passes the required-room rule. | OPEN | | 0 |
| SHOP-CQ-003 | Important | STATE | SHOP | `components/lista/ShoppingList.js:69-79` | Emptiness checked by room count; removing every product shows empty tables / blank client view instead of the empty state. | OPEN | | 0 |
| SHOP-CQ-004 | Important | CONTRACTS | SHOP | `components/lista/ClientView.js:15-17`, `RoomTable.js:61` | Product-level `notes` are not rendered in either list mode. | CHALLENGED (design reference has no product notes in the list) | | 0 |
| SHOP-CQ-005 | Important | CONTRACTS | SHOP | `components/produtos/ProductForm.js:67-75` | Quantity normalised only on blur; Enter submits 0 or negative quantity as success. | OPEN | | 0 |
| SHOP-CQ-006 | Important | CONTRACTS | SHOP | `components/produtos/ProductForm.js:37-39` | Upload promises "JPG ou PNG, até 5 MB" but accepts any `image/*` of any size. | OPEN | | 0 |
| SHOP-CQ-007 | Important | CONTRACTS | SHOP | `components/lista/RoomTable.js:54-55` | Armed two-step remove keeps `aria-label="Remover item"`; screen readers get no confirmation cue. | OPEN | | 0 |
| SHOP-CQ-008 | Important | TESTS | SHOP | `components/lista/ShoppingList.js` (area) | No tests for list counts/filters/toggles/removal/empty states or product form validation. | OPEN | | 0 |
| SHOP-CQ-009 | Minor | CONTRACTS | SHOP | `components/lista/ShoppingList.js:69-73` | Empty client preview still shows the "Adicionar primeiro produto" edit action. | OPEN (Minor, not fixed) | | |
| SHOP-CQ-010 | Minor | CONTRACTS | SHOP | `app/(app)/listas/[id]/page.js:15` | Full list and client records sent to `ShoppingList`, which needs only id and name. | OPEN (Minor, not fixed) | | |
| SHOP-CQ-011 | Minor | DUPLICATION | SHOP | `components/produtos/ProductForm.js:28-29` | Purchase-link URL regex and message duplicate `lib/validation.js:8`. | OPEN (Minor, not fixed) | | |
| SHOP-CQ-012 | Minor | SIMPLICITY | SHOP | `components/lista/RoomTable.js:49` | Raw `<img>` thumbnails (lint warnings) instead of `next/image`. | OPEN (Minor, not fixed) | | |

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
