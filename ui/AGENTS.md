# UI (`ui/`)

Front end of Seleção Fluiar: interior architects manage clients and per-room shopping lists.
This file covers `ui/` only. For files under `ui/`, it wins over the repo root `AGENTS.md`.

- `nextjs/`: the real app. Next.js 15 (App Router), React 19, plain JavaScript. Work here unless
  the task says otherwise.
- `html/`: a static HTML/CSS/JS copy of the same screens, for quick design review. Not built, not
  tested, and it already differs from `nextjs/`. Edit it only when the task asks for it.

Authentication, the private layout, office administration, clients, dashboard, shopping-list pages
and separate room management use the REST API in `../api/`. Settings save profile and password
independently; password changes replace the httpOnly cookie before success. Product forms save JSON
before image upload/removal and retain the saved UUID for retries. Inline product controls await API
writes; refreshed list props own products and totals. Clients use `/minhas-listas` and can edit purchase status and per-product client notes.
`/l/[shareToken]` requires a session and resolves only an authorized list. Copying a link never rotates it; rotation requires
confirmation because the old link stops working.

## Commands

Run every command from `ui/nextjs/`. `ui/` has no `package.json`: npm there walks up to a parent
folder and runs the wrong scripts.

Node `^22.22.2 || ^24.15.0 || >=26`. Use npm (there is a `package-lock.json`), not yarn or pnpm.

```bash
npm install
npm run dev                                          # http://localhost:3000
npx vitest run components/clientes/Clientes.test.js  # one file: use this while iterating
npx vitest run -t "client search"                    # only tests whose name matches
npm test                                             # all tests
npm run lint                                         # ESLint (next/core-web-vitals)
npm run build                                        # production build, also runs ESLint
```

Stop `npm run dev` before `npm run build`: both write to `.next/`.

## Map

Only what the file names do not tell you (paths relative to `ui/nextjs/`):

```
app/(auth)/                    login, cadastro, recuperar-senha, nova-senha (layout with brand panel)
app/(app)/                     internal screens (layout = AppShell: side menu, mobile drawer)
app/(app)/(admin)/             administrative routes, guarded by requireAdmin
app/(app)/minhas-listas/             client list overview/detail, guarded by requireClient
app/(auth)/invitation/          password-only client invitation acceptance
app/l/[shareToken]/            authenticated share resolver
app/images/[imageId]/          authenticated binary proxy, private/no-store
app/styles/app.css             design tokens (CSS variables) and every shared class
app/styles/lista.css           rules copied from the original list page, scoped to .listdoc
components/ui/                 Button, Fields (TextInput, Select, ...), Display (PageHeader, EmptyState, ...), Icon
components/feedback/Feedback.js  useToast, useConfirm (delete confirmation), flash
components/forms/useApiForm.js   async forms, validation, pending guards and API field errors
components/lista/ShareControls.js  copy links and explicitly rotate opaque share tokens
lib/api.server.js              fixed-origin server requests, no-store reads and ActionResult
lib/session.server.js          the httpOnly fluiar_session cookie; only actions write/clear it
lib/route-input.js             complete UUID and opaque link-token validation
lib/validation.js              validation rules and their messages
test-support/fixtures.js       deterministic API-shaped data, imported only by tests
docs/quality-ledger.md         record of a finished code review; history, not instructions
```

## How the code works

- Pages in `app/` are Server Components. They read data and pass it as props to the client
  components in `components/` (files that start with `'use client'`). Keep data loading in pages.
- `params` and `searchParams` are Promises in Next 15. Await them. An unknown id calls `notFound()`.
- Empty/error states come from API results, not retired `?estado=` switches. Keep ordinary query
  inputs such as `cliente`, `ambiente` and `token`. Clients, lists, rooms and products use API UUIDs,
  never names or slugs as identifiers. Key private list owners by UUID, not `updatedAt`.
- Forms use `useApiForm` with the inputs from `components/ui/Fields.js`. Copy `ClientForm` in
  `components/clientes/Clientes.js`:

  ```js
  const f = useApiForm({
    initial: { nome: client?.name || '', email: client?.email || '', tel: client?.phone || '' },
    rules: { nome: { required: true }, email: { required: true, email: true }, tel: { phone: true } },
    fieldMap: { name: 'nome', email: 'email', phone: 'tel' },
    action: (values) => saveClient(client?.id ?? null, { name: values.nome, email: values.email, phone: values.tel }),
    onSuccess: (saved, values, { go }) => go('/clientes', 'Cliente cadastrado.'),
  });
  // <form onSubmit={f.submit} noValidate> <TextInput label="Nome completo" {...f.field('nome')} />
  ```

  The field key is also the input `id`, and submit focuses the first invalid field by `id`. Keep
  keys unique on the page. Put new rules and messages in `lib/validation.js`, not in components.
- `go(url, message)` saves the message with `flash()` and navigates; the next screen shows it as a
  toast. Use `useToast()` for messages on the same screen. Await API writes before success feedback;
  keep duplicate-submit guards and suppress late feedback/navigation after unmount.
- Deleting a client or a list asks first with `useConfirm()`. Removing an item row in the shopping
  list uses the original page's two-tap button instead (`components/lista/RoomTable.js`).
- `Button` renders a `next/link` when it has `href`, otherwise a `<button type="button">`. Pick a
  `variant` (`primary`, `ghost`, `danger`, `text`, `text-danger`) instead of adding classes.

## Style

- User-facing text and UI routes are Brazilian Portuguese. Only code is English: identifiers, props, test names, comments, API endpoints and JSON fields.
- Imports: `app/` uses the `@/` alias (`@/components/...`, `@/lib/...`). Inside `components/`,
  import other components with relative paths (`../ui/Button`) and `lib/` with `@/lib/...`.
- Colors and fonts come only from the CSS variables in `app/styles/app.css`. Reuse its existing
  classes before adding new ones:

  ```css
  .badge { color: var(--sage); background: var(--chip); }  /* good */
  .badge { color: #134F5C; background: #EEF6F7; }          /* bad */
  ```

- The variables under "Tokens da página original" come from the client's original page. Ask before
  changing them.
- A new color variable needs three values in `app.css`: `:root`, the
  `@media (prefers-color-scheme:dark)` block and `:root[data-theme="dark"]`.
- `lista.css` keeps the original page's rules unchanged. Mark additions with a "novo" comment.

## Tests

- Vitest, Testing Library and jsdom, with globals on. A test is `X.test.js` next to the module.
- Find elements by role or label in Portuguese, as a user sees them:
  `screen.getByRole('button', { name: 'Salvar cliente' })`. The project does not use test ids.
- Mock `next/navigation` in each test file, as `components/clientes/Clientes.test.js` does:

  ```js
  const { push } = vi.hoisted(() => ({ push: vi.fn() }));
  vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), usePathname: () => '/clientes', notFound: vi.fn() }));
  ```

- Render a page by awaiting it:
  `render(await Page({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) }))`.
- Mock HTTP/session/navigation seams for server pages and actions, with complete API DTO fixtures.
  Use deferred action promises resolved inside `act()` for pending and unmount tests, not fake server
  delays. Fake timers are only for real timed behavior such as the two-tap removal confirmation.
- Wrap the component in `<FeedbackProvider>` when it shows a toast or a confirmation.
- There are no end-to-end tests. Check layout-only changes in the browser (`npm run dev`) at desktop
  and phone widths.

## Connecting to the API

Implemented controllers and DTOs under `../api/src/main/java/` are authoritative. Local service
setup is documented in `../api/README.md`. The fixed points:

- Configure `nextjs/.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:8080`, without `/api`.
  `apiRequest` keeps requests on that fixed origin, disables caching and redirects protected 401s
  to `/login`. Protected reads get the JWT from the httpOnly cookie, never browser storage.
- Pages keep user reads request-scoped. Server Actions expose fixed operations with validated
  UUID/token arguments and whitelisted bodies; `actionResult` wraps only expected `ApiError`s.
- Auth and invitation/reset requests do not read or forward the JWT. Share resolution uses the
  current session and returns only `{listId, role}`. Client pages use client DTOs without prices,
  internal notes or contact details. Image reads use the private Next proxy; tokens stay
  in server headers. Login preserves only validated local `/l/<token>` return paths.
- Errors are `ProblemDetail`: show `detail` in a toast and each `errors[field]` under its field.
  API fields and new form keys are English; map any retained legacy form keys explicitly.
- The UI and the API show the same validation messages. If you change the wording in
  `lib/validation.js`, change `api/src/main/java/br/com/fluiar/selecao/exception/ErrorMessages.java`
  or `api/src/main/resources/ValidationMessages.properties` too.

## Boundaries

Ask first:

- Adding or upgrading any dependency, including the Next 16 upgrade.
- Adding a tool, language or framework: TypeScript, Tailwind, Playwright, a CSS or state library.

Never:

- Edit `node_modules/` or `.next/`.
- Commit `node_modules/`, `.next/` or `ui/.playwright-mcp/` (browser tool output).
  Check `git status` before `git add`.
- Fix the Minor findings in `nextjs/docs/quality-ledger.md` or the known warnings below as a side effect
  of another task.

## Known warnings (not bugs)

- `npm run lint`: two `@next/next/no-img-element` warnings, in `components/lista/ProductThumb.js` and
  `components/produtos/ProductForm.js`.
- `npm run build`: an "inferred workspace root" warning, caused by a lockfile outside the repo.
- `npm audit`: a PostCSS advisory inside Next 15. Known and accepted; only Next 16 removes it.

## Before you finish

1. The changed test files pass: `npx vitest run <files>`.
2. `npm run lint`: 0 errors, only the two known warnings.
3. `npm test`: all tests pass.
4. If you changed routes, layouts or config: `npm run build` passes.
5. New behavior has a test. Do not commit unless asked.

For a controller-assigned integration task with an explicit focused-check contract, run its focused
tests and targeted lint only. The controller owns the final full lint/test/build gate and independent
review; do not claim either from a task-local result.

If something in `ui/` took more than one attempt to get right, add one line about it to this file.

For server helpers, assert returned data and navigation before cache wiring; a cache spy alone can hide an unfinished implementation.

For async forms, hold actions and success callbacks with deferred promises and resolve them inside `act()`; do not use the prototype timer to test pending state or unmount cleanup.

For malformed-input tables, wrap each argument in a row so an empty array is tested as the body, not expanded into no arguments.

Reset-link tests should wrap page calls in an async helper so a synchronous prototype fails behavior assertions, not Promise matcher errors.

Retry failed Server Component reads with `router.refresh()` and boundary reset in one transition; reset alone reuses the rejected server payload.

List preselection uses the API client's actual UUID value, matching case-insensitively; key edit forms by list ID so navigation cannot retain another list's fields.

Scope recent-client link queries to their section: recent-list links also include the client's name.

Room order arrays must reject sparse entries before writing; array iteration can silently skip them.

Product image retries must retain the saved UUID and pending file/removal; mobile link errors wrap the inputs without changing their two-row layout.

Inline row guards must survive filtering and be registered before dispatch; key list owners by UUID (not updatedAt) so refresh preserves filters.

Browser email inputs strip surrounding whitespace; test normalized comparisons without assuming the submitted value retains it.

Share controls retain a returned token until refreshed props acknowledge it; pending refreshes must not announce rotation early.

Office rename drafts belong to the office UUID; reconcile props after saves settle, ignoring superseded-name acknowledgments and preserving newer edits.

Keep JSX copy separate from identifier renames; verify Portuguese labels after field-key changes.

Store preview bindings must compare the current photo intent as well as name and price; removing a preview photo makes the save manual, and changing the source URL invalidates the old preview.
