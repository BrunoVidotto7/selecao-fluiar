# Seleção Fluiar — API

API REST da Seleção Fluiar (Java 25, Spring Boot 4.1.2, PostgreSQL 18).

## Pré-requisitos

- JDK 25
- Docker (para o PostgreSQL e o Mailpit locais, e para os testes com Testcontainers)

## Como rodar localmente

Todos os comandos rodam dentro de `api/`.

1. Suba a infraestrutura (PostgreSQL e Mailpit):

   ```bash
   docker compose up -d
   ```

2. Gere o segredo que assina os tokens JWT:

   ```bash
   export JWT_SECRET=$(openssl rand -base64 48)
   ```

3. Rode a API:

   ```bash
   ./mvnw spring-boot:run
   ```

## Como testar

```bash
./mvnw verify
```

Os testes sobem um PostgreSQL próprio com Testcontainers, então o Docker precisa estar rodando.

## Endereços

| O quê | Endereço |
|---|---|
| API | `http://localhost:8080` |
| Swagger | `http://localhost:8080/swagger-ui.html` |
| Mailpit (e-mails capturados) | `http://localhost:8025` |

## Variáveis de ambiente

Os valores padrão servem só para o Docker Compose local. Em produção, defina todas.

| Variável | Para que serve | Padrão local |
|---|---|---|
| `DB_URL` | URL JDBC do PostgreSQL | `jdbc:postgresql://localhost:5432/selecao` |
| `DB_USERNAME` | Usuário do banco | `selecao` |
| `DB_PASSWORD` | Senha do banco | `selecao` |
| `JWT_SECRET` | Segredo que assina os tokens (pelo menos 32 bytes) | nenhum (obrigatório) |
| `FRONTEND_URL` | Endereço do frontend, usado nos links dos e-mails | `http://localhost:3000` |
| `CORS_ALLOWED_ORIGINS` | Origens que podem chamar a API, separadas por vírgula | `http://localhost:3000` |
| `MAIL_HOST` | Servidor SMTP | `localhost` |
| `MAIL_PORT` | Porta do SMTP | `1025` |
| `MAIL_USERNAME` | Usuário do SMTP | vazio |
| `MAIL_PASSWORD` | Senha do SMTP | vazio |
| `MAIL_STARTTLS` | Liga o STARTTLS no SMTP: use `true` nos provedores que exigem (por exemplo, porta 587); o Mailpit fica com `false` | `false` |
| `MAIL_FROM` | Remetente dos e-mails | `nao-responda@fluiar.com.br` |

## Administrative account provisioning

Admins are provisioned directly in PostgreSQL. Existing accounts migrate to `ADMIN`; existing sessions must log in again. There is no default administrative password.

Run `ops/provision-admin.sql` using psql with `ON_ERROR_STOP` and parameters `office_id`, `user_id`, `office_name`, `name`, `email`, and `password_hash`. Supply an encoded `{bcrypt}` hash produced by the existing Spring `PasswordEncoder`; never supply a raw password. Pass operational values through a protected local parameter file/session, not versioned source or shell history. The script inserts an office only if missing, inserts one account, and rejects duplicate accounts instead of changing their credentials. Run it explicitly against the intended database; the application does not seed accounts on startup.

Client accounts are created only when a client accepts an administrative email invitation.

## Client access rollout

Deploy the API migrations V5–V7 and matching Next.js application together. Existing
accounts become ADMIN without changing passwords; their old sessions must log in
again. Legacy office invitations are invalidated. Provision any new administrator
explicitly before inviting clients from their administrative client detail page.

Client invitations expire after seven days and bind to the stored client UUID and
contact email. Acceptance creates one CLIENT account and accepts only a password.
Changing contact email revokes a pending invitation; it does not change an active
account's login email. Deleting a client cascades to its account and lists.

Shared links now require authentication and current ownership. Images require an
authorized account and return private/no-store responses through the Next proxy.
Previously downloaded or publicly cached image copies cannot be recalled.

Before release, run the complete API suite with Docker, including schema upgrade,
operational provisioning, invitation races, list reassignment and image ownership
checks. Then check the invitation email and client/admin flows in separate browser
profiles at desktop and phone sizes. No migration or provisioning runs as part of
a frontend build.
