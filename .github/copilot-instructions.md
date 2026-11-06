# Seleção Fluiar

Interior architects manage clients and per-room shopping lists. Two independent apps in one repo:

- `api/`: REST API, Java 25 + Spring Boot 4.1 + PostgreSQL 18. Full rules in `api/AGENTS.md`.
- `ui/nextjs/`: Next.js 15 (App Router) + React 19, plain JavaScript (no TypeScript). Full rules in
  `ui/AGENTS.md`.

Repo-wide rules are in the root `AGENTS.md`. **Read the relevant `AGENTS.md` before editing**: it has
the authoritative commands, conventions and boundaries for that app; this file only summarizes.

User-facing text and UI routes are Brazilian Portuguese. Only code is English: identifiers, props, test names, comments, API endpoints and JSON fields.

## Commands

API (run from `api/`):

```bash
./mvnw test -Dtest=ClientControllerTest               # one class, ~10s, use while iterating
./mvnw test -Dtest='ClientControllerTest#methodName'  # one method
./mvnw verify                                         # all tests, required before finishing
```

Always use `./mvnw` (never global `mvn`). Requires JDK 25 and a running Docker (Testcontainers starts
its own PostgreSQL for tests).

UI (run from `ui/nextjs/`, not `ui/` — there is no `package.json` there):

```bash
npx vitest run components/clientes/Clientes.test.js  # one file, use while iterating
npx vitest run -t "client search"                    # by test name
npm test                                              # all tests
npm run lint                                          # required before finishing
npm run build                                         # if routes/layouts/config changed
```

## Architecture

- API layering is strict: `controller` -> `service` -> `repository` -> `model`. Controllers only
  handle HTTP and call one service method per endpoint; they never touch a repository or return an
  entity. Services hold business rules (`@Transactional(readOnly = true)` on the class,
  `@Transactional` on writing methods).
- Multi-tenancy: every resource belongs to an office. Controllers take `@CurrentOfficeId UUID
  officeId`; services load with `findByIdAndOfficeId(...)`/`findInOffice(...)`. A resource from
  another office returns 404, never 403.
- Room/product writes lock their shopping list first (`ShoppingListRepository.findInOfficeForUpdate`
  and its `findByRoomInOfficeForUpdate`/`findByProductInOfficeForUpdate` variants) to keep positions
  unique and avoid deadlocks.
- JWTs are signed by the API itself (`JwtConfig`, `TokenService`). On the UI side, the token lives only
  in the httpOnly cookie `fluiar_session` (`lib/session.server.js`), never in browser storage or action
  responses; only server actions write/clear it.
- UI pages (`app/`) are Server Components that load data (via `lib/api.server.js`, which calls the API
  with `NEXT_PUBLIC_API_URL`) and pass it as props to client components in `components/`. Errors come
  back as `ProblemDetail` (RFC 9457): `detail` goes in a toast, `errors[field]` under each field.
  API fields are English (`name`, `phone`); form keys are Portuguese (`nome`, `tel`) — map between them.
- Validation messages must match on both sides: `ui/nextjs/lib/validation.js` and
  `api/.../exception/ErrorMessages.java` / `ValidationMessages.properties`. Changing one requires
  changing the other.

## Key conventions

- API DTOs are `record`s; request records clean input in the compact constructor via `Inputs.text`,
  `Inputs.email`, `Inputs.digits`. Entities have no public setters — they change through intention
  methods (`rename`, `update`, `markBought`, `touch`). Field limits are constants on the entity
  (`Client.NAME_MAX_LENGTH`), reused by DTOs.
- API errors are thrown via `ApiException` factories (`notFound()`, `invalidField(...)`,
  `conflict(...)`); never leak personal data or internals in error responses/logs.
- Schema changes are new Flyway files (`V<next>__<description>.sql`); never edit an existing migration.
  Hibernate runs `ddl-auto: validate`.
- API tests extend `support/ApiIntegrationTest`, share one Spring context/PostgreSQL container, and use
  its helpers (`signUp`, `createClient`, `createList`, `bearer`, `lastEmailTo`, ...). A `@MockitoBean`
  or `@TestPropertySource` in a single test class starts a second context — put shared mocks in
  `ApiIntegrationTest` instead. Every ID-taking endpoint needs a "belongs to another office -> 404"
  test.
- UI forms use `useDemoForm` (`components/forms/useDemoForm.js`) with inputs from
  `components/ui/Fields.js`; put new validation rules/messages in `lib/validation.js`, not components.
  `go(url, message)` navigates and flashes a toast on the next screen; `useToast()`/`useConfirm()` are
  for the current screen.
- UI colors/fonts come only from CSS variables in `app/styles/app.css` — reuse existing classes before
  adding new ones. `params`/`searchParams` in `app/` pages are Promises (Next 15); await them.
- UI tests: Vitest + Testing Library + jsdom. Mock `next/navigation` per file. Query by role/label in
  Portuguese (no test ids). Fake-server submits wait 650ms — use `vi.useFakeTimers()` and advance.

## Boundaries

- Ask before adding/upgrading a dependency, or adding a new tool/language/framework. When approved,
  pin an exact version published at least 7 days ago.
- Never edit `node_modules/`, `.next/`, `api/target/`, or a Flyway migration that already ran. Never
  commit secrets — real values come from environment variables.
- There is no root `.gitignore`; check `git status` before `git add`.
