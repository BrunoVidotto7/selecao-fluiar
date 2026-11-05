# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Seleção Fluiar: a shopping-list workspace where interior architects manage clients and per-room shopping lists, and invited clients track purchases. Two independent apps, no root build:

- `api/`: Java 25 + Spring Boot 4.1 + PostgreSQL 18 REST API (Flyway, Spring Security, self-signed JWTs).
- `ui/nextjs/`: Next.js 15 (App Router) + React 19, plain JavaScript (no TypeScript).
- `ui/html/`: static design-review copy of the screens. Not built or tested; edit only when asked.

Detailed per-app rules live in `AGENTS.md` (repo-wide), `api/AGENTS.md` and `ui/AGENTS.md`; read the relevant one before editing. `.github/copilot-instructions.md` summarizes them. Setup, configuration variables and API examples are in `README.md`.

User-facing text and UI routes are Brazilian Portuguese. Only code is English: identifiers, props, test names, comments, API endpoints and JSON fields.

## Commands

API (run from `api/`; always `./mvnw`, never global `mvn`):

```bash
./mvnw test -Dtest=ClientControllerTest               # one class
./mvnw test -Dtest='ClientControllerTest#methodName'  # one method
./mvnw verify                                         # all tests; required before finishing
docker compose up -d                                  # local PostgreSQL :5432 + Mailpit (SMTP :1025, web :8025)
export JWT_SECRET=$(openssl rand -base64 48)          # required to start; 32+ bytes
./mvnw spring-boot:run                                # :8080, Swagger at /swagger-ui.html
```

- Needs JDK 25 (`./mvnw -v` may differ from `java -version`; fix with `export JAVA_HOME=$(/usr/libexec/java_home -v 25)`).
- Tests need running Docker (Testcontainers starts its own PostgreSQL); compose is not needed for tests. With Rancher Desktop, set `DOCKER_HOST=unix://$HOME/.rd/docker.sock` and `TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock`.

UI (run from `ui/nextjs/`, NOT `ui/`, which has no `package.json`; use npm, Node `^22.22.2 || ^24.15.0 || >=26`):

```bash
npm ci && npm run dev                                 # :3000; needs .env.local with NEXT_PUBLIC_API_URL=http://localhost:8080 (no /api suffix)
npx vitest run components/clientes/Clientes.test.js   # one file
npx vitest run -t "client search"                     # by test name
npm test && npm run lint                              # required before finishing
npm run build                                         # if routes/layouts/config changed; stop dev server first (shared .next/)
```

Expected noise, not bugs: two `no-img-element` lint warnings, a Next "inferred workspace root" build warning, a PostCSS `npm audit` advisory, and some Maven 401 metadata / `uk_users_email` / `JWT_SECRET` log lines in API tests.

## Architecture

- Domain hierarchy: office -> client -> shopping list -> room -> product. Users belong to an office; a `CLIENT` account is bound to exactly one client in the same office (composite FKs). There is no public signup: admins are provisioned via `api/ops/provision-admin.sql`; clients join by email invitation.
- API layering is strict: `controller` -> `service` -> `repository` -> `model`. Controllers handle HTTP only, call one service method per endpoint, never touch repositories or return entities. Services own business rules and transactions. To add a resource, copy `Client*` (controller, service, repository, model, DTOs, `ClientControllerTest`).
- Multi-tenancy: controllers take `@CurrentOfficeId UUID officeId`; services load via `findByIdAndOfficeId(...)`/`findInOffice(...)`. Another office's (or another client's) resource returns 404, never 403. Share links and image reads are authorized by `ListAccessPolicy`; client DTOs omit prices, images and internal notes.
- Concurrency: room/product writes first lock the shopping list (`ShoppingListRepository.findInOfficeForUpdate` and the `findByRoomInOfficeForUpdate`/`findByProductInOfficeForUpdate` variants). New list-scoped writes must take the same lock.
- Product sync: a scheduled worker inside the API process claims products with `FOR UPDATE SKIP LOCKED` + leases (`ProductSyncRepository`), collects retailer data outside the transaction (`StoreProductExtractor`, `SafeStoreHttpClient` with SSRF protections), then `ProductSyncService` rechecks ownership/version/lease/purchase state under locks before applying. No message broker.
- Auth flow: the API signs JWTs itself (`JwtConfig`, `TokenService`). The UI stores the token only in the httpOnly `fluiar_session` cookie (`lib/session.server.js`); only Server Actions write/clear it, and the Next server adds the bearer header (`lib/api.server.js`, fixed origin, no-store). Tokens never reach browser JS.
- UI pages in `app/` are Server Components that load data and pass props to `'use client'` components in `components/`. `params`/`searchParams` are Promises (await them). Errors arrive as `ProblemDetail` (RFC 9457): `detail` to a toast, `errors[field]` under fields. API fields are English; legacy form keys are Portuguese (`nome`, `tel`), so map explicitly.
- Validation messages are duplicated and must change together: `ui/nextjs/lib/validation.js` and `api/.../exception/ErrorMessages.java` / `src/main/resources/ValidationMessages.properties`.
- `api/PLANO-BACKEND.md` (Portuguese) is the original design spec; where it disagrees with the code, the code wins.

## Conventions worth knowing

- API: DTOs are `record`s; request records normalize input in the compact constructor (`Inputs.text/email/digits`). Entities have no public setters (intention methods like `rename`, `markBought`). Errors via `ApiException` factories; never leak personal data in responses/logs. Use the injected `Clock` (America/Sao_Paulo) for time. No Lombok/MapStruct. A field must not have two constraints failing on the same value (only the first message per field is kept).
- Schema changes: a new `V<next>__<description>.sql` Flyway file; never edit an existing migration. Hibernate is `ddl-auto: validate`.
- API tests extend `support/ApiIntegrationTest` (shared Spring context + one PostgreSQL container, DB truncated per test). Putting `@MockitoBean`/`@TestPropertySource` in a single class starts a second context; put shared mocks in the base class. Every ID-taking endpoint needs an "another office -> 404" test.
- UI forms: `useApiForm` + inputs from `components/ui/Fields.js` (copy `ClientForm`); rules/messages go in `lib/validation.js`. `go(url, message)` navigates with a toast on the next screen; `useToast()`/`useConfirm()` for the current one. Use `Button` variants instead of new classes.
- UI styling: colors/fonts only from CSS variables in `app/styles/app.css` (a new color needs values in `:root`, the `prefers-color-scheme: dark` block and `:root[data-theme="dark"]`). `lista.css` preserves original-page rules; mark additions with a "novo" comment.
- UI tests: Vitest + Testing Library + jsdom; query by role/label in Portuguese (no test ids); mock `next/navigation` per file; wrap toast/confirm components in `<FeedbackProvider>`; test pending/unmount with deferred promises resolved in `act()`.
- Process (from `AGENTS.md`): KISS, avoid unrelated changes, behavior changes are test-first (RED-GREEN-REFACTOR), do not commit unless asked. Commit messages are one short imperative sentence ending in a period. Check `git status` before `git add`.

## Boundaries

- Ask before: adding/upgrading dependencies (pin exact versions published 7+ days ago), adding a tool/language/framework (TypeScript, Playwright, Tailwind), changing the API contract (paths, JSON fields, status codes, error format) or security config (`PUBLIC_PATHS`, CORS, token lifetime, JWT secret rule).
- Never edit `node_modules/`, `.next/`, `api/target/`, or an already-applied Flyway migration. Never commit secrets (the only committed one is the test secret in `api/src/test/resources/application-test.yml`).
