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
