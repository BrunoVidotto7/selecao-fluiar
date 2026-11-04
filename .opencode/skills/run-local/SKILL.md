---
name: Run Seleção Fluiar locally
description: Start, restart or stop the Seleção Fluiar local stack — the Spring Boot API in api/ (JDK 25, PostgreSQL and Mailpit from Docker) plus the Next.js UI in ui/nextjs/ — with the environment each app needs, then confirm both answer.
---

# Run the local stack

Two processes and one Docker stack. Each one has its own directory and its own
prerequisites; the commands below are the only ones that work here.

| Piece | Directory | URL |
| --- | --- | --- |
| API | `api/` | http://localhost:8080 · Swagger `/swagger-ui.html` |
| UI | `ui/nextjs/` | http://localhost:3000 |
| PostgreSQL, Mailpit | `api/compose.yaml` | `:5432`, Mailpit web `:8025` |

Run every command from the directory named for it. `ui/` has no `package.json`:
npm there walks up to a parent folder and runs the wrong scripts.

## 0. Look before starting

Do not start a second copy on a busy port; reuse what is already up.

```bash
lsof -nP -iTCP:8080 -sTCP:LISTEN; lsof -nP -iTCP:3000 -sTCP:LISTEN
```

## 1. Infrastructure

Docker must be running (the stack, and the `./mvnw verify` tests, need it).

```bash
docker info >/dev/null 2>&1 || open -a 'Rancher Desktop'   # wait for the daemon
cd api && docker compose up -d
```

## 2. API

`JWT_SECRET` has no default: the API fails at startup without a secret of 32+
bytes. `api/.env` holds the local development secret and is gitignored; when it
is missing, generate one for the session instead of writing it to a file.

```bash
cd api && set -a && . ./.env && set +a && export JAVA_HOME=$(/usr/libexec/java_home -v 25) && ./mvnw spring-boot:run
```

Start it as a background process and keep its output: startup takes about 20 to
40 seconds, and a compile or migration error is only in that output.

## 3. UI

```bash
cd ui/nextjs && node -v && npm install   # npm install only when node_modules is missing
cd ui/nextjs && npm run dev
```

Node must satisfy `^22.22.2 || ^24.15.0 || >=26` (`.nvmrc` says 24.22.2).
`ui/nextjs/.env.local` must contain `NEXT_PUBLIC_API_URL=http://localhost:8080`,
without `/api`.

## 4. Confirm both answer

```bash
curl -s http://localhost:8080/actuator/health                          # "status":"UP"
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/login   # 200
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8080/api/clients  # 401
```

`/` answers `307` to `/login` while there is no session, and both `401` responses are
correct: without a token every private path stays closed. Connection refused means
that piece is not up yet.

## 5. Local login

There is no seed data and passwords are stored hashed, so an existing account's
password cannot be read back. The local development account is:

| E-mail | Senha |
| --- | --- |
| `bruno@fluiar.com.br` | `fluiar-dev-2026` |

It is local only (a throwaway database on this machine), never a real credential.
When the database does not have it, create it with the API running:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:8080/api/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"name":"Bruno Vidotto","email":"bruno@fluiar.com.br","password":"fluiar-dev-2026"}'
# 201 = created, 409 = already exists
```

Passwords need 8 to 72 characters (`User.PASSWORD_MIN_LENGTH` /
`PASSWORD_MAX_LENGTH`). Sign up through `/cadastro` in the UI does the same thing.
Password reset e-mails land in Mailpit at http://localhost:8025.

## Stop

```bash
pids=$(lsof -ti tcp:8080); [ -n "$pids" ] && kill $pids
pids=$(lsof -ti tcp:3000); [ -n "$pids" ] && kill $pids
cd api && docker compose stop    # keeps the pgdata volume; `down` does too
```

## Traps

- JDK 25 is required and `./mvnw -v` shows the Java Maven uses. If it is not 25,
  the build fails with `release version 25 not supported`; the `JAVA_HOME` line
  above fixes it.
- IntelliJ IDEA 2023.3 cannot compile Java 25, so running from the IDE fails with
  `configured to use JDK 0`. Use the terminal commands above there.
- macOS may refuse to execute `./mvnw` with `operation not permitted` when the file
  carries a `com.apple.quarantine` attribute. Run `sh ./mvnw ...` instead (the
  wrapper still runs), or clear it once with `xattr -d com.apple.quarantine mvnw`.
- Never run `npm run build` while `npm run dev` is running: both write `.next/`.
- Flyway rejects an edited migration on the existing `pgdata` volume. A schema
  change is a new file in `api/src/main/resources/db/migration/`.
- Do not start the UI with `npm run dev -- -p 3001`: the API CORS allow list and
  the e-mail links point at `http://localhost:3000`.
- A Homebrew PostgreSQL 15 can hold `:5432` on `[::1]` while Docker publishes the
  same port on `127.0.0.1`. The API's `jdbc:postgresql://localhost:5432/selecao`
  then reaches the Homebrew one, and `docker compose exec postgres psql` shows an
  empty database while the app has data. Check with
  `/opt/homebrew/opt/postgresql@15/bin/psql -h ::1 -U selecao -d selecao -c '\dt'`
  and `lsof -nP -iTCP:5432 -sTCP:LISTEN` before trusting either.
