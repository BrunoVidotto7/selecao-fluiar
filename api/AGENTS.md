# AGENTS.md

REST API of Seleção Fluiar: interior architects manage clients and per-room shopping lists.
Java 25, Spring Boot 4.1, PostgreSQL 18, Flyway, and Spring Security with JWTs that this API signs itself.
The UI in `../ui/nextjs/` calls this API through server requests. Repo-wide rules (git, the UI) are in `../AGENTS.md`.

Run every command from `api/`.

## Commands

```bash
./mvnw test -Dtest=ClientControllerTest               # one class, ~10 s: use while iterating
./mvnw test -Dtest='ClientControllerTest#methodName'  # one method
./mvnw verify                                         # all tests, under a minute: required before finishing
```

- Always use `./mvnw`, never a global `mvn`.
- JDK 25 is required. `./mvnw -v` shows the Java that Maven uses, which can differ from `java -version`.
  If it is not 25 (the build fails with `release version 25 not supported`), run
  `export JAVA_HOME=$(/usr/libexec/java_home -v 25)` first.
- Tests need a running Docker: Testcontainers starts its own PostgreSQL. `docker compose` is not needed for tests.
- If tests fail with "Could not find a valid Docker environment" or a Ryuk timeout (Rancher Desktop), export
  `DOCKER_HOST=unix://$HOME/.rd/docker.sock` and `TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock`.

Run the app only for manual checks:

```bash
docker compose up -d                          # PostgreSQL :5432, Mailpit SMTP :1025 and web :8025
export JWT_SECRET=$(openssl rand -base64 48)  # required: startup fails without a secret of 32+ bytes
./mvnw spring-boot:run                        # http://localhost:8080, Swagger at /swagger-ui.html
```

The other environment variables and their local defaults are in `README.md`.

## Definition of done

- `./mvnw verify` ends with `BUILD SUCCESS`: 0 failures, 0 errors, 0 skipped.
- Each behavior change has a test that failed before the change on an assertion or HTTP status, not on a
  compile error.
- These log lines are expected, do not chase them: Maven "Could not transfer metadata ... HTTP Status: 401"
  for the Flyway repositories, "JWT_SECRET precisa ter pelo menos 32 bytes" from `JwtConfigTest`, and
  `duplicate key ... "uk_users_email"` from the duplicate e-mail test.

## Where things are

Only what file names do not tell you:

- `PLANO-BACKEND.md` (Portuguese): the design spec. It has the decisions and their reasons, layer rules,
  the endpoint table ("Contrato da API"), the error format and the accepted risks ("Fora do escopo e riscos
  aceitos"). Its checkboxes were never ticked and some paths are old (`nextjs/` is now `../ui/nextjs/`, and
  "the root README" is now `../ui/README.md`).
  When it disagrees with the code, the code is the current state. Its `feat: ...` commit style is replaced
  by the git rules in `../AGENTS.md`.
- For a new resource, copy `ClientController`, `ClientService`, `ClientRepository`, `model/Client`,
  `dto/ClientRequest` and `dto/ClientResponse`. For its tests, copy `ClientControllerTest`.
- `config/SecurityConfig` `PUBLIC_PATHS`: only authentication, health and documentation are public. Other paths need
  `Authorization: Bearer <token>`. `/api/client/**` requires CLIENT, administrative resources require
  ADMIN; `/api/me`, share resolution and image reads accept both roles.

## Code rules

- Layers: `controller` -> `service` -> `repository` -> `model`. A controller handles HTTP only and calls one
  service method per endpoint. It never uses a repository or returns an entity. Services hold the business
  rules, with `@Transactional(readOnly = true)` on the class and `@Transactional` on methods that write.
- Every resource belongs to an office. Controllers take `@CurrentOfficeId UUID officeId`. Services load with
  `findByIdAndOfficeId(...)` or `findInOffice(...)` and `.orElseThrow(ApiException::notFound)`.
  A resource of another office answers 404, never 403.
- Room and product writes first lock their list with `ShoppingListRepository.findInOfficeForUpdate` (or
  `findByRoomInOfficeForUpdate` / `findByProductInOfficeForUpdate`). New writes inside a list take the same
  lock, so positions stay unique and writes cannot deadlock.
- Schema changes go in a new file, `src/main/resources/db/migration/V<next>__<description>.sql`. Hibernate
  runs with `ddl-auto: validate`, so an entity change without a migration fails at startup. Foreign keys use
  `on delete cascade`: the database deletes the children, not JPA.
- Entities have no public setters. They change through intention methods (`rename`, `update`, `markBought`,
  `touch`). Field limits are constants on the entity (`Client.NAME_MAX_LENGTH`) and the DTOs reuse them.
- DTOs are `record`s. Request records clean their input in the compact constructor with `Inputs.text`,
  `Inputs.email` (strip and lowercase) or `Inputs.digits`. Responses are built with a static `of(...)`.
  Summary responses (`ClientSummaryResponse`, `ListSummaryResponse`) are built in JPQL with `select new`.
- In services, get the current time from the injected `Clock` bean (zone `America/Sao_Paulo`), as
  `DashboardService` does, so tests can control it.
- Errors: throw `ApiException` through its factories (`notFound()`, `invalidField(...)`, `conflict(...)`).
  `GlobalExceptionHandler` turns every error into a `ProblemDetail` (RFC 9457) with a per-field `errors` map.
  Only the first message per field is kept, so a field must not have two constraints that fail for the same
  value: use `@NotNull @Size(min = 8, max = 72)`, not `@NotBlank` together with `@Size`.
- Error responses and logs never show personal data or internal details (e-mail addresses, tokens, file
  paths, SQL values). Follow the existing handlers in `GlobalExceptionHandler`.
- User-facing text and UI routes are Brazilian Portuguese. Only code is English: identifiers, props, test names, comments, API endpoints and JSON fields. Specific messages
  are constants in `exception/ErrorMessages.java`. Bean Validation defaults are in
  `src/main/resources/ValidationMessages.properties`. The UI shows the same wording
  (`../ui/nextjs/lib/validation.js`): when you change a message, change both sides.
- JSON: camelCase, dates as ISO-8601 UTC instants, money as `BigDecimal` with 2 decimals, IDs as UUID strings.
- No Lombok, no MapStruct, no interfaces for services. Name magic numbers and strings as constants.
  Comment only a "why" that is not obvious.

Client accounts bind to one client in the same office. Client list writes lock the list before
rechecking ownership. `clientNotes` is separate from internal `notes`; purchase and notes use
independent strict payloads. Invitations bind to the stored client contact and accept only a password.
Admins are provisioned explicitly with `ops/provision-admin.sql`; there is no public signup.

## Test rules

- API tests extend `support/ApiIntegrationTest` and call the real endpoints with `MockMvcTester`. Use its
  helpers (`createAdmin`, `createClientAccount`, `inviteClient`, `createClient`, `createList`, `createRoom`, `createProduct`, `bearer`,
  `readJson`, `lastEmailTo`, `extractToken`) and add new shared helpers there.
- Every test class shares one Spring context and one PostgreSQL container. A `@MockitoBean`,
  `@TestPropertySource` or other context setting in a single class starts a second context and container.
  Put shared mocks in `ApiIntegrationTest`. The mail sender is already mocked there: read sent e-mails with
  `lastEmailTo(email)`.
- Each test starts with an empty database (`TRUNCATE offices CASCADE`). Create the data it needs with the
  helpers.
- Every new endpoint that takes an ID gets a test that another office's resource answers 404, like
  `clientOfAnotherOfficeIsNotFound` in `ClientControllerTest`.

## Boundaries

Ask first:

- Changing the API contract: paths, JSON fields, status codes or the error format. The UI integration plan
  ("Impacto no frontend" in `PLANO-BACKEND.md`) depends on it.
- Changing security: `PUBLIC_PATHS`, CORS, token lifetime, password hashing or the JWT secret rule.
- Adding or upgrading a dependency. When approved, use a version published at least 7 days ago, pinned
  exactly, and leave the versions that Spring Boot manages unpinned.

Never:

- Edit a migration that already exists. Flyway rejects a changed file on every database that already ran
  it, including the local Docker volume.
- Commit secrets. Real values come from environment variables. The only committed secret is the test one
  in `src/test/resources/application-test.yml`.
- Edit `target/` (build output).
