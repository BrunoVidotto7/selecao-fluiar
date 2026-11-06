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

## Primeiro acesso

Não existe conta padrão nem cadastro público: o primeiro administrador é criado direto no PostgreSQL com `ops/provision-admin.sql`. Os clientes entram depois, por convite por e-mail.

1. Com o PostgreSQL no ar e a API rodando (passo 3 acima), rode a API ao menos uma vez antes: o Flyway cria as tabelas na partida e o script precisa delas.
2. Gere o hash BCrypt da senha (mínimo de 8 caracteres) com o `htpasswd`, que já vem no macOS e no pacote `apache2-utils` do Linux. O `{bcrypt}` na frente é obrigatório: o `PasswordEncoder` da API é o delegating e escolhe o algoritmo por esse prefixo. O prefixo `$2y$` que o `htpasswd` gera é aceito.

   ```bash
   read -rs SENHA
   HASH="{bcrypt}$(htpasswd -bnBC 10 '' "$SENHA" | tr -d ':\n')"
   ```

3. Rode o script no PostgreSQL do Compose, passando os dados como variáveis do `psql`:

   ```bash
   docker compose exec -T postgres psql -U selecao -d selecao \
     -v office_id="$(uuidgen)" -v user_id="$(uuidgen)" \
     -v office_name='Meu Escritório' -v name='Seu Nome' -v email='voce@exemplo.com' \
     -v password_hash="$HASH" < ops/provision-admin.sql
   ```

   O script usa `ON_ERROR_STOP` e roda numa transação: cria o escritório se ele ainda não existir, cria uma conta `ADMIN` e recusa e-mail repetido sem alterar a conta existente. Nunca passe a senha pura, só o hash.
4. Entre com o e-mail e a senha:

   ```bash
   curl -X POST http://localhost:8080/api/auth/login -H 'Content-Type: application/json' \
     -d '{"email":"voce@exemplo.com","password":"<a senha>"}'
   ```

   A resposta `200` traz o `accessToken`. Pela interface, use a mesma conta na tela de login.

Em outro ambiente, rode o mesmo script contra o banco certo (explicitamente: a API não cria contas na partida) e guarde os valores fora do código versionado e do histórico do shell.

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

## Saúde, métricas e logs

- O actuator só existe na porta de gerenciamento (`MANAGEMENT_PORT`, padrão `8081`), sem login. Ela deve ficar interna: nunca a publique no balanceador nem na internet. Na porta da API (8080) o actuator não responde.
- Probes: `/actuator/health/liveness` e `/actuator/health/readiness` (o readiness depende só do banco; o e-mail fica fora da saúde). Nenhum mostra detalhes.
- Métricas: `/actuator/prometheus`, também só na porta de gerenciamento. Aponte o scraper do Prometheus para ela.
- Toda resposta traz `X-Request-Id`. Se o cliente enviar o cabeçalho (até 64 caracteres, `A-Z a-z 0-9 -`), o valor é reaproveitado; senão a API gera um UUID. O id aparece entre colchetes em cada linha de log.
- As listas (clientes, listas, ambientes, produtos) não são paginadas de propósito: o escritório de uma arquiteta tem dezenas de itens, e a UI mostra tudo de uma vez. O dashboard não carrega tudo: usa contagens no banco e só as 5 linhas mais recentes.

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

## Notas de operação

### Limite de tentativas e proxy

Os limites de tentativas por endereço são contados pelo endereço do cliente, lido de `X-Forwarded-For` (`server.forward-headers-strategy: native`). O servidor Next.js envia esse cabeçalho com o endereço do navegador, e o Tomcat só o aceita de um proxy interno confiável (loopback e faixas privadas).

- O Next.js não deve ser exposto diretamente à internet. O proxy na frente dele deve SOBRESCREVER o cabeçalho indicado em `TRUSTED_CLIENT_IP_HEADER` (`x-forwarded-for`, usa a última entrada, ou `x-real-ip`), nunca apenas repassá-lo.
- Sem essa variável (ou sem o proxy), a API vê o endereço privado do servidor Next.js e aplica só os limites por e-mail; os limites por endereço são ignorados para endereços privados.
- O salto Next.js para API deve ficar em rede privada, para que ninguém de fora forje o `X-Forwarded-For`.

### Contas administrativas

Contas existentes migram para `ADMIN` sem trocar a senha, e as sessões antigas precisam entrar de novo. Não há senha administrativa padrão. Contas de cliente só nascem quando o cliente aceita o convite por e-mail de um administrador.

### Release da API e da interface

- API e interface saem juntas: publique a API primeiro e a interface logo em seguida. Um rollback da API exige o rollback da interface.
- Os health checks devem apontar para a `MANAGEMENT_PORT` (`/actuator/health/liveness` e `/readiness`), não mais para a porta da API.
- Defina `TRUSTED_CLIENT_IP_HEADER` no servidor Next.js (veja "Limite de tentativas e proxy").

### Acesso dos clientes (release)

- Faça o deploy das migrations V5 a V7 da API junto com a aplicação Next.js correspondente. Os convites antigos do escritório ficam inválidos. Crie qualquer novo administrador de forma explícita (veja "Primeiro acesso") antes de convidar clientes pela tela de detalhe do cliente.
- Os convites expiram em sete dias e ficam presos ao UUID do cliente e ao e-mail de contato guardados. Aceitar o convite cria uma conta `CLIENT` e pede só a senha. Trocar o e-mail de contato revoga o convite pendente, mas não muda o e-mail de login de uma conta ativa. Apagar um cliente apaga em cascata a conta e as listas dele.
- Os links compartilhados exigem login e posse atual da lista. As imagens exigem uma conta autorizada e voltam como privadas pelo proxy do Next, com cache só no navegador (`private, max-age=31536000, immutable`; cada imagem nova ganha um novo id) e `no-store` nas respostas de erro. Cópias de imagens já baixadas ou guardadas em cache público não podem ser recolhidas.
- Antes do release, rode a suíte completa da API com Docker (upgrade de schema, provisionamento, corridas de convite, troca de dono da lista e posse de imagens). Depois confira o e-mail do convite e os fluxos de cliente e de admin em perfis de navegador separados, em tela de desktop e de celular. Nenhuma migration nem provisionamento roda no build do frontend.
