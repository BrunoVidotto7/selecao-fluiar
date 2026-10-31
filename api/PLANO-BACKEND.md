# Plano de implementação do backend — Seleção Fluiar

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para implementar este plano tarefa por tarefa. Em cada tarefa, siga também a skill `code-quality` (ver "Fluxo de qualidade por tarefa"). Os passos usam checkbox (`- [ ]`) para acompanhamento.

**Objetivo:** criar a API REST que substitui os dados fictícios do frontend (`nextjs/lib/data.js`) por dados reais: contas, escritórios, clientes, listas de compras, ambientes, produtos, imagens e o link público da lista.

**Arquitetura:** um único serviço Spring Boot, organizado em camadas (`controller` → `service` → `repository` → `model`), com PostgreSQL e migrações Flyway. A autenticação usa um token JWT que o próprio backend assina; todos os dados pertencem a um escritório, e cada consulta é filtrada pelo escritório de quem está logado.

**Stack:** Java 25, Spring Boot 4.1.2, Spring Web MVC, Spring Data JPA (Hibernate), Spring Security (servidor de recursos OAuth2 com JWT), Bean Validation, Spring Mail, Flyway, PostgreSQL 18, springdoc-openapi, JUnit 5, MockMvcTester, Testcontainers 2, Maven.

**Spec:** o frontend em `nextjs/` (telas, `lib/data.js`, `lib/validation.js`, `components/**`), o `README.md` da raiz e a seção "Decisões" abaixo. Quem for executar deve ler os dois.

---

## Decisões

Decisões tomadas com o usuário antes do plano:

| Tema | Decisão |
|---|---|
| Autenticação | JWT Bearer. O Next.js envia `Authorization: Bearer <token>`. |
| Dono dos dados | Escritório compartilhado. Todos os usuários de um escritório veem os mesmos clientes e listas. Não há papéis (todos podem tudo). |
| Ambientes | Livres por lista. A arquiteta cria, renomeia, ordena e exclui os ambientes de cada lista. |
| Imagens | Guardadas no PostgreSQL (`bytea`), numa tabela própria. |
| E-mails | SMTP via Spring Mail. Localmente, o Mailpit captura os e-mails. |
| Escopo extra | Só o link público da lista (visão do cliente, somente leitura). |
| Build | Maven, com Maven Wrapper. |
| Idioma | Plano em português. Código, endpoints, JSON e nomes de classes em inglês. Mensagens para o usuário em português. |

Decisões técnicas deste plano (e o porquê, em uma linha):

| Decisão | Motivo |
|---|---|
| Pacotes por camada: `controller`, `service`, `repository`, `model`, `dto`, `config`, `security`, `exception` | Pedido do usuário; fácil para um júnior saber onde cada coisa mora. |
| Serviços são classes concretas, sem interface | Só existe uma implementação; o guia pede duas utilizações reais antes de criar abstrações. |
| Sem Lombok e sem MapStruct | Menos dependências e mágica. DTOs são `record`; respostas têm uma fábrica estática `of(...)`. |
| IDs `UUID` | Não dá para adivinhar IDs de outro escritório; serve para links. |
| Usuário pertence a exatamente um escritório | Modelo mais simples que atende "escritório compartilhado". |
| Convite só para e-mail sem conta | Evita mover contas entre escritórios (fora do escopo). |
| Revogação de JWT por `credentials_version` | Quando a senha muda, o número sobe e os tokens antigos deixam de valer. É determinístico (não depende de relógio). |
| Sem refresh token | "Manter conectada" só emite um token mais longo (30 dias em vez de 12 horas). |
| Sem paginação | Um escritório tem dezenas ou centenas de clientes; o frontend já filtra e pesquisa no navegador. Rever se passar de ~1000. |
| Sem trava otimista (`@Version`) | A última gravação vence. Risco aceito e registrado. |
| Resumos de listas e clientes calculados no SQL (JPQL com `select new ...Response(...)`) | Evita carregar todos os produtos só para contar. O record de resposta é montado direto pela consulta, sem conversão intermediária. |
| Exclusões em cascata feitas pelo banco (`on delete cascade`) | Uma regra só, no lugar certo; o JPA não precisa carregar filhos para apagar. |
| Imagem servida por URL pública com ID aleatório (`/api/images/{imageId}`) | A tag `<img src>` não envia o header `Authorization`. O ID muda a cada upload, então o cache pode ser longo. |
| Link público por `share_token` aleatório (256 bits) | Ninguém adivinha. Pode ser trocado se vazar. |
| Limite de tentativas em memória (`AttemptLimiter`) | 5 tentativas por e-mail no login e no pedido de redefinição de senha, e por conta na senha atual, a cada 15 minutos; passou disso, responde 429. Não precisa de dependência nem de tabela nova; cada instância conta por si e um restart esquece as contagens. Guarda no máximo 100 mil chaves; cheio, recusa (429) chaves novas até as janelas vencerem, sem apagar contagens que ainda valem. |
| Trocar o e-mail exige a senha atual | Um token roubado sozinho não move a conta para outro e-mail nem a toma de vez pelo link de redefinição de senha. |

---

## Restrições globais

Valem para todas as tarefas.

- Java **25**. Spring Boot **4.1.2** (publicado em 22/10/2026). PostgreSQL **18** (imagem `postgres:18-alpine`, igual no Docker Compose e nos testes).
- springdoc-openapi **3.2.0** (`springdoc-openapi-starter-webmvc-ui`, linha compatível com Boot 4.1). Foi publicado em 24/10/2026: só adicionar a partir de 31/10/2026 (regra de 7 dias). Antes disso, usar a última 3.1.x.
- Mailpit **v1.32.0** (`axllent/mailpit:v1.32.0`, publicado em 22/10/2026, traz correções de segurança).
- Versões de Flyway, Testcontainers, Hibernate, Jackson e driver PostgreSQL: as gerenciadas pelo Spring Boot. Não fixar versões à mão.
- Toda dependência nova precisa ter sido publicada há pelo menos 7 dias. Nada de `latest` ou faixas abertas.
- Spring Boot 4 é modular. Starters usados: `spring-boot-starter-webmvc`, `-data-jpa`, `-flyway`, `-validation`, `-actuator`, `-security`, `-security-oauth2-resource-server`, `-mail`. Testes: `spring-boot-starter-webmvc-test`, `-data-jpa-test`, `-security-test`, `spring-boot-testcontainers`, `org.testcontainers:testcontainers-junit-jupiter`, `org.testcontainers:testcontainers-postgresql`. Flyway também precisa de `org.flywaydb:flyway-database-postgresql`.
- O projeto fica em `api/`, na raiz de `selecao-fluiar/` (o mesmo diretório deste plano). A partir do Passo 4 da Tarefa 1, todos os comandos `./mvnw` e `git` das tarefas rodam dentro de `api/`. Pacote base: `br.com.fluiar.selecao`. `groupId` `br.com.fluiar`, `artifactId` `selecao-api`.
- Nenhum segredo no repositório. `JWT_SECRET`, credenciais do banco e do SMTP vêm de variáveis de ambiente. O único segredo commitado é o de teste, em `src/test/resources/application-test.yml`.
- Banco: `spring.jpa.hibernate.ddl-auto=validate` e `spring.jpa.open-in-view=false`. O schema só muda via migração Flyway (`src/main/resources/db/migration/V<n>__<descricao>.sql`).
- JSON em `camelCase`. Datas como instantes ISO-8601 em UTC (`2026-10-30T17:20:00Z`). Dinheiro como número com 2 casas (`BigDecimal`). IDs como string UUID.
- Todo recurso pertence a um escritório. Acessar um recurso de outro escritório responde **404** (não 403), para não revelar que ele existe.
- Erros seguem o formato `ProblemDetail` (RFC 9457) descrito em "Formato de erro". Mensagens em português, iguais às do frontend quando já existirem.
- Testes de integração usam PostgreSQL real via Testcontainers. Docker precisa estar rodando para `./mvnw verify`.
- Regras do guia de engenharia que valem para todo o código:
  - Texto e número "mágico" vira constante com nome do seu propósito (limites de campo nas entidades, mensagens em `ErrorMessages`, durações nos serviços).
  - Cada método de serviço deve ser lido como uma história em passos ("carrega a lista", "valida o ambiente", "salva", "atualiza a data da lista").
  - Linhas em branco separam blocos lógicos.
  - Comentário só para explicar um porquê que não é óbvio (ex.: a ordem de flush do Hibernate). Nunca para narrar o código, citar tarefa ou contar histórico.
  - Nenhum padrão de projeto, interface ou fábrica sem uma necessidade presente.

---

## Foco de revisão

As cinco situações que mais podem prejudicar um usuário real sem que a "história feliz" dos testes as pegue. Cada uma tem teste na tarefa dona do código.

1. **Recurso de outro escritório.** Pedir por ID um cliente, lista, ambiente, produto ou imagem de outro escritório deve dar 404 em GET, PUT, PATCH e DELETE. Testes nas Tarefas 7 a 12.
2. **E-mail com maiúsculas ou espaços.** `" Paula@Fluiar.com.br "` é a mesma conta que `paula@fluiar.com.br`: no cadastro (409), no login (200), no convite e na troca de e-mail. Testes nas Tarefas 2, 3 e 5.
3. **Token antigo depois de trocar ou redefinir a senha.** Deve dar 401. Testes nas Tarefas 3 e 4.
4. **Arquivo que não é imagem**, mas chega com `Content-Type: image/jpeg`, e arquivo maior que 5 MB. Devem dar 400 e 413. Teste na Tarefa 11.
5. **Lista sem produtos e produto sem preço.** Lista vazia não conta como "concluída". Produto sem preço não quebra os totais (o total ignora o produto e não vira `null`). Testes nas Tarefas 6 e 13.

---

## Fluxo de qualidade por tarefa

Este é o processo da skill `code-quality` e do `engineering-guide.md`, aplicado a este plano. Vale para as Tarefas 1 a 14.

1. **Entender.** Ler a tarefa inteira, as "Restrições globais" e o bloco **Interfaces** das tarefas anteriores que ela consome.
2. **RED.** Escrever os testes da tarefa e rodar. Eles precisam compilar e falhar por asserção ou status HTTP (exemplo: esperado 201, recebido 404). Erro de compilação ou exceção inesperada nunca vale como RED. Se o teste usa uma classe ou um método que ainda não existe, crie antes um esqueleto mínimo que compila (métodos que retornam `null` ou valor vazio) e rode de novo. Helpers do `ApiIntegrationTest` que leem o corpo conferem o status esperado antes de ler. Se um teste passar antes da implementação, ele não protege nada e deve ser corrigido.
3. **GREEN.** Escrever o menor código que faz os testes passarem.
4. **REFACTOR.** Com os testes verdes, limpar: nomes, constantes, fluxo legível, sem duplicação de regra.
5. **Verificar.** Rodar `./mvnw verify` (todos os testes, não só os da tarefa).
6. **Revisão independente.** Abrir um revisor `code-quality-reviewer` em contexto novo (nunca quem implementou). Entregar a ele, de forma neutra:
   - o pedido (o texto da tarefa);
   - o repositório e a base da revisão (o commit anterior à tarefa);
   - a lista de arquivos alterados;
   - as regras (este plano e o `engineering-guide.md`);
   - o resultado do `./mvnw verify`.

   Ele responde em JSON, avaliando os sete critérios: FLOW, COHESION, STATE, SIMPLICITY, DUPLICATION, CONTRACTS e TESTS.
7. **Corrigir.** Todo achado `Critical` ou `Important` é corrigido, ou contestado com evidência. O mesmo revisor confere de novo. Achados `Minor` são opcionais. A tarefa só termina com veredito `APPROVED` sobre o código atual.
8. **Commit.** Uma tarefa, um commit (ou poucos), com mensagem no estilo `feat: ...`.

Se a correção travar, ou se houver discordância justificada com o revisor, pare e peça decisão humana. Nunca invente aprovação.

---

## Arquitetura

### Regras das camadas

| Camada | Pode usar | Responsabilidade | Não faz |
|---|---|---|---|
| `controller` | `service`, `dto` | HTTP: caminho, status, `@Valid`, quem está logado (`@CurrentUserId`, `@CurrentOfficeId`). Chama **um** método de serviço. | Regra de negócio, acesso a repositório, entidade na resposta. |
| `service` | `repository`, `model`, `dto`, `security`, `exception` | Regras de negócio, transações (`@Transactional`), filtro por escritório, montagem das respostas. | Detalhes de HTTP. |
| `repository` | `model`, `dto` (só nos resumos JPQL) | Consultas (Spring Data JPA). | Regra de negócio. |
| `model` | — | Entidades JPA, com métodos de intenção (`rename`, `markBought`, `touch`). Sem setters públicos. Limites de tamanho dos campos como constantes. | Conhecer DTOs. |
| `dto` | `model` (constantes e fábricas `of`) | `record`s de entrada (com validação e normalização no construtor compacto) e de saída. | Lógica de negócio além de cálculos simples de exibição. |

Convenções dos serviços: `@Transactional(readOnly = true)` na classe e `@Transactional` nos métodos que gravam. Para buscar um recurso do escritório, os repositórios têm `findInOffice(id, officeId)` (ou o derivado `findByIdAndOfficeId`), e o serviço chama `.orElseThrow(ApiException::notFound)`.

### Estrutura de pastas (estado final)

```
api/
├── PLANO-BACKEND.md, pom.xml, mvnw, .mvn/, .gitignore, compose.yaml, README.md
└── src/
    ├── main/java/br/com/fluiar/selecao/
    │   ├── SelecaoApplication.java
    │   ├── config/      AppProperties, AppConfig, SecurityConfig, JwtConfig, OpenApiConfig
    │   ├── security/    TokenService, IssuedToken, CredentialsVersionValidator, SecureTokens,
    │   │                CurrentUserId, CurrentOfficeId
    │   ├── exception/   ApiException, ErrorMessages, GlobalExceptionHandler
    │   ├── model/       Office, User, PasswordResetToken, OfficeInvitation, Client, ShoppingList,
    │   │                Room, Product, ProductLink, ProductImage
    │   ├── repository/  um <Entidade>Repository por entidade (exceto ProductLink)
    │   ├── dto/         Inputs + records de request/response
    │   ├── service/     AuthService, AccountService, PasswordResetService, EmailService,
    │   │                OfficeService, InvitationService, ClientService, ShoppingListService,
    │   │                RoomService, ProductService, ProductImageService, DashboardService
    │   └── controller/  AuthController, AccountController, OfficeController, ClientController,
    │                    ShoppingListController, RoomController, ProductController,
    │                    ProductImageController, PublicListController, DashboardController
    ├── main/resources/  application.yml, ValidationMessages.properties, db/migration/V1..V4
    └── test/
        ├── java/br/com/fluiar/selecao/
        │   ├── support/     TestcontainersConfiguration, ApiIntegrationTest
        │   ├── controller/  testes de API: <X>ControllerTest, PasswordResetTest,
        │   │                InvitationAcceptanceTest, HealthCheckTest
        │   ├── repository/  SummaryQueriesTest
        │   └── security/    SecureTokensTest
        └── resources/       application-test.yml
```

### Modelo de dados

```
offices 1──N users 1──N password_reset_tokens
offices 1──N office_invitations
offices 1──N clients 1──N shopping_lists 1──N rooms 1──N products 1──N product_links
                                                       products 1──0..1 product_images
```

Toda chave estrangeira usa `on delete cascade`. Excluir um cliente apaga, no banco, as listas, ambientes, produtos, links e imagens dele.

### Contrato da API

"Público" significa sem token. Todo o resto exige `Authorization: Bearer <token>`.

| Método | Caminho | Corpo | Resposta | Tarefa |
|---|---|---|---|---|
| POST | `/api/auth/signup` (público) | `SignupRequest` | 201 `AuthResponse` | 2 |
| POST | `/api/auth/login` (público) | `LoginRequest` | 200 `AuthResponse` | 2 |
| GET | `/api/me` | — | 200 `MeResponse` | 2 |
| PUT | `/api/me` | `ProfileUpdateRequest` | 200 `MeResponse` | 3 |
| PUT | `/api/me/password` | `PasswordChangeRequest` | 200 `AuthResponse` | 3 |
| POST | `/api/auth/password-reset-requests` (público) | `PasswordResetRequest` | 202 | 4 |
| GET | `/api/auth/password-resets/{token}` (público) | — | 200 `PasswordResetInfoResponse` | 4 |
| POST | `/api/auth/password-resets` (público) | `PasswordResetConfirmRequest` | 204 | 4 |
| GET | `/api/office` | — | 200 `OfficeResponse` | 5 |
| PUT | `/api/office` | `OfficeUpdateRequest` | 200 `OfficeResponse` | 5 |
| GET | `/api/office/invitations` | — | 200 `InvitationResponse[]` | 5 |
| POST | `/api/office/invitations` | `InvitationRequest` | 201 `InvitationResponse` | 5 |
| DELETE | `/api/office/invitations/{id}` | — | 204 | 5 |
| GET | `/api/auth/invitations/{token}` (público) | — | 200 `InvitationInfoResponse` | 5 |
| POST | `/api/auth/invitations/{token}/acceptance` (público) | `InvitationAcceptRequest` | 201 `AuthResponse` | 5 |
| GET | `/api/clients` | — | 200 `ClientSummaryResponse[]` | 7 |
| POST | `/api/clients` | `ClientRequest` | 201 `ClientResponse` | 7 |
| GET | `/api/clients/{id}` | — | 200 `ClientDetailResponse` | 7 |
| PUT | `/api/clients/{id}` | `ClientRequest` | 200 `ClientResponse` | 7 |
| DELETE | `/api/clients/{id}` | — | 204 | 7 |
| GET | `/api/lists` | — | 200 `ListSummaryResponse[]` | 8 |
| POST | `/api/lists` | `ShoppingListRequest` | 201 `ListDetailResponse` | 8 |
| GET | `/api/lists/{id}` | — | 200 `ListDetailResponse` | 8 |
| PUT | `/api/lists/{id}` | `ShoppingListRequest` | 200 `ListDetailResponse` | 8 |
| DELETE | `/api/lists/{id}` | — | 204 | 8 |
| POST | `/api/lists/{listId}/rooms` | `RoomRequest` | 201 `RoomResponse` | 9 |
| PUT | `/api/lists/{listId}/room-order` | `RoomOrderRequest` | 200 `RoomResponse[]` | 9 |
| PUT | `/api/rooms/{id}` | `RoomRequest` | 200 `RoomResponse` | 9 |
| DELETE | `/api/rooms/{id}` | — | 204 | 9 |
| POST | `/api/lists/{listId}/products` | `ProductRequest` | 201 `ProductResponse` | 10 |
| GET | `/api/products/{id}` | — | 200 `ProductResponse` | 10 |
| PUT | `/api/products/{id}` | `ProductRequest` | 200 `ProductResponse` | 10 |
| PATCH | `/api/products/{id}` | `ProductStatusRequest` | 200 `ProductResponse` | 10 |
| DELETE | `/api/products/{id}` | — | 204 | 10 |
| PUT | `/api/products/{id}/image` | multipart, campo `file` | 200 `ProductImageResponse` | 11 |
| DELETE | `/api/products/{id}/image` | — | 204 | 11 |
| GET | `/api/images/{imageId}` (público) | — | 200 bytes da imagem | 11 |
| POST | `/api/lists/{id}/share-token` | — | 200 `ShareTokenResponse` | 12 |
| GET | `/api/public/lists/{shareToken}` (público) | — | 200 `PublicListResponse` | 12 |
| GET | `/api/dashboard` | — | 200 `DashboardResponse` | 13 |
| GET | `/actuator/health` (público) | — | 200 `{"status":"UP"}` | 1 |

A documentação interativa fica em `/swagger-ui.html` e o JSON OpenAPI em `/v3/api-docs`. `PUT /api/me` exige `currentPassword` quando o e-mail muda.

### Formato de erro

```json
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "detail": "Revise os campos destacados.",
  "instance": "/api/clients",
  "errors": { "email": "Digite um e-mail válido, como nome@email.com.", "links[0].url": "Cole o link completo, começando com https://" }
}
```

- `detail` é a mensagem para mostrar no aviso (toast).
- `errors` só aparece quando há erro por campo. As chaves são os nomes dos campos no JSON.
- Para cada campo vale a primeira mensagem. Por isso, um campo nunca deve ter duas restrições que falhem para o mesmo valor. Exemplo: senha usa `@NotNull @Size(min = 8, max = 72)`, e não `@NotBlank` junto com `@Size`.
- 401 sem token, ou com token inválido, é respondido pelo Spring Security com corpo vazio e header `WWW-Authenticate`. O frontend trata qualquer 401 mandando para `/login`.
- 429 com `detail` "Muitas tentativas. Tente novamente em alguns minutos." quando o limite de tentativas é atingido (login, pedido de redefinição de senha, senha atual).

### Convenções de teste

- `support/TestcontainersConfiguration`: um bean `PostgreSQLContainer` (`postgres:18-alpine`) anotado com `@ServiceConnection`.
- `support/ApiIntegrationTest`: classe abstrata com `@SpringBootTest`, `@AutoConfigureMockMvc`, `@ActiveProfiles("test")` e `@Import(TestcontainersConfiguration.class)`. Ela injeta `MockMvcTester mvc`, `JdbcTemplate jdbc` e `JsonMapper jsonMapper`, e recebe helpers ao longo das tarefas. Como todos os testes compartilham a mesma configuração, o Spring reaproveita um único contexto e um único container.
- Limpeza: um `@BeforeEach` roda `TRUNCATE offices CASCADE`, que limpa todas as tabelas ligadas a `offices` (todas, a partir da Tarefa 2). Outro `@BeforeEach` chama `AttemptLimiter.clear()`, porque as contagens ficam em memória no contexto compartilhado.
- E-mail: `@MockitoBean JavaMailSender mailSender`. O teste captura a `SimpleMailMessage` enviada (a partir da Tarefa 4).
- Cada tarefa lista seus testes numa tabela com nome, requisição e resultado esperado, com os valores exatos. Todos seguem o padrão abaixo:

```java
class AuthControllerTest extends ApiIntegrationTest {

    @Test
    void signUpCreatesOfficeAndReturnsToken() {
        var result = mvc.post().uri("/api/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("name", "Paula Hooper", "email", "paula@fluiar.com.br", "password", "senhaforte1")));

        assertThat(result).hasStatus(HttpStatus.CREATED);
        assertThat(result).bodyJson().extractingPath("$.accessToken").asString().isNotBlank();
        assertThat(result).bodyJson().extractingPath("$.user.officeName").isEqualTo("Escritório de Paula Hooper");
    }
}
```

Requisições autenticadas usam `.header(HttpHeaders.AUTHORIZATION, bearer(session))`.

---

## Tarefas

### Tarefa 1: Esqueleto do projeto

**Arquivos:**
- Criar: projeto dentro de `api/` (gerado pelo Spring Initializr), `api/pom.xml`, `api/.gitignore`, `api/compose.yaml`, `api/README.md`
- Criar: `src/main/java/br/com/fluiar/selecao/SelecaoApplication.java`, `config/AppProperties.java`, `config/AppConfig.java`
- Criar: `src/main/resources/application.yml`, `src/test/resources/application-test.yml`
- Teste: `support/TestcontainersConfiguration.java`, `support/ApiIntegrationTest.java`, `controller/HealthCheckTest.java`

**Interfaces:**
- Produz:
  - `@ConfigurationProperties("app") record AppProperties(Jwt jwt, String frontendUrl, List<String> corsAllowedOrigins, ZoneId timeZone, String mailFrom)`, com `record Jwt(String secret, Duration ttl, Duration rememberMeTtl)`.
  - Bean `Clock` em `AppConfig`: `Clock.system(appProperties.timeZone())`. Todo serviço que precisa de "agora" recebe o `Clock` (testável).
  - `abstract class ApiIntegrationTest` com `protected MockMvcTester mvc`, `protected JdbcTemplate jdbc`, `protected JsonMapper jsonMapper` e `protected String json(Object body)`.

- [ ] **Passo 1: Gerar o projeto**

O repositório git já existe na raiz de `selecao-fluiar/`: não rode `git init` (nem na raiz, nem em `api/`). O `unzip` abaixo mescla os arquivos gerados dentro do `api/` existente, sem apagar o diretório nem o `PLANO-BACKEND.md` (o zip não traz arquivo com esse nome).

```bash
cd /Users/brunovidotto/Documents/bruno/selecao-fluiar
curl -s https://start.spring.io/starter.zip \
  -d type=maven-project -d language=java -d bootVersion=4.1.2 -d javaVersion=25 \
  -d groupId=br.com.fluiar -d artifactId=selecao-api -d packageName=br.com.fluiar.selecao \
  -d applicationName=SelecaoApplication -d baseDir=api \
  -d dependencies=web,data-jpa,flyway,postgresql,validation,testcontainers \
  -o api.zip && unzip api.zip && rm api.zip
```

Apague o teste `contextLoads` e a classe `Test...Application` gerados. Mova a `TestcontainersConfiguration` gerada para o pacote `support`. Adicione `@ConfigurationPropertiesScan` em `SelecaoApplication`.

- [ ] **Passo 2: Conferir o `pom.xml`**

Dependências desta tarefa: `spring-boot-starter-webmvc`, `-data-jpa`, `-flyway`, `-validation`, `-actuator` (só no Passo 5, depois do RED), `org.flywaydb:flyway-database-postgresql`, `org.postgresql:postgresql` (runtime) e `org.springdoc:springdoc-openapi-starter-webmvc-ui` (ver regra de data nas Restrições). Testes: `spring-boot-starter-webmvc-test`, `-data-jpa-test`, `spring-boot-testcontainers`, `testcontainers-junit-jupiter`, `testcontainers-postgresql`. Security e mail entram nas Tarefas 2 e 4.

- [ ] **Passo 3: Escrever o teste que falha**

| Teste | Requisição | Esperado |
|---|---|---|
| `reportsUpWhenDatabaseIsReachable` | GET `/actuator/health` | 200; `$.status` = `"UP"` |

Escreva também o `ApiIntegrationTest`, com as anotações descritas em "Convenções de teste" e `json(Object)` usando `jsonMapper.writeValueAsString`.

- [ ] **Passo 4: Rodar e ver falhar**

Rodar: `cd api && ./mvnw test -Dtest=HealthCheckTest`
Esperado: FALHA: status 404 em vez de 200 (o actuator ainda não está no projeto).

- [ ] **Passo 5: Implementar a configuração**

Adicione `spring-boot-starter-actuator` ao `pom.xml`.

`compose.yaml`:

```yaml
services:
  postgres:
    image: postgres:18-alpine
    environment:
      POSTGRES_DB: selecao
      POSTGRES_USER: selecao
      POSTGRES_PASSWORD: selecao
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql]
  mailpit:
    image: axllent/mailpit:v1.32.0
    ports: ["1025:1025", "8025:8025"]
volumes:
  pgdata:
```

`application.yml` (os valores padrão do banco servem só para o Compose local; em produção tudo vem de variáveis de ambiente):

```yaml
spring:
  application:
    name: selecao-api
  datasource:
    url: ${DB_URL:jdbc:postgresql://localhost:5432/selecao}
    username: ${DB_USERNAME:selecao}
    password: ${DB_PASSWORD:selecao}
  jpa:
    open-in-view: false
    hibernate:
      ddl-auto: validate
    properties:
      hibernate:
        default_batch_fetch_size: 100   # carrega ambientes -> produtos -> links em lote (evita N+1)
  servlet:
    multipart:
      max-file-size: 5MB
      max-request-size: 6MB
management:
  endpoints:
    web:
      exposure:
        include: health
app:
  jwt:
    secret: ${JWT_SECRET:}
    ttl: 12h
    remember-me-ttl: 30d
  frontend-url: ${FRONTEND_URL:http://localhost:3000}
  cors-allowed-origins: ${CORS_ALLOWED_ORIGINS:http://localhost:3000}
  time-zone: America/Sao_Paulo
  mail-from: ${MAIL_FROM:nao-responda@fluiar.com.br}
```

`application-test.yml`: `app.jwt.secret: test-only-secret-with-at-least-32-bytes-0123456789`.

- [ ] **Passo 6: Rodar e ver passar**

Rodar: `./mvnw test -Dtest=HealthCheckTest`
Esperado: PASSA (o Testcontainers sobe o PostgreSQL e o Flyway roda sem migrações).

- [ ] **Passo 7: Escrever o `README.md` do backend**

O README deve ter:
- Pré-requisitos: JDK 25 e Docker.
- Como subir a infraestrutura: `docker compose up -d`.
- Como gerar o segredo: `export JWT_SECRET=$(openssl rand -base64 48)`.
- Como rodar: `./mvnw spring-boot:run`.
- Como testar: `./mvnw verify`.
- Endereços: API em `http://localhost:8080`, Swagger em `/swagger-ui.html`, Mailpit em `http://localhost:8025`.
- Tabela com as variáveis de ambiente: `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`, `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM`.

- [ ] **Passo 8: Verificar, revisar (fluxo de qualidade) e fazer o commit**

```bash
./mvnw verify
git add . && git commit -m "feat: add backend skeleton with PostgreSQL, Flyway and Testcontainers"
```

---

### Tarefa 2: Escritório, cadastro, login e JWT

**Arquivos:**
- Modificar: `pom.xml`. Adicionar `spring-boot-starter-security` e `spring-boot-starter-security-oauth2-resource-server`; nos testes, `spring-boot-starter-security-test`.
- Criar: `db/migration/V1__create_offices_and_users.sql`
- Criar: `model/Office.java`, `model/User.java`, `repository/OfficeRepository.java`, `repository/UserRepository.java`
- Criar: `dto/Inputs.java`, `dto/SignupRequest.java`, `dto/LoginRequest.java`, `dto/MeResponse.java`, `dto/AuthResponse.java`
- Criar: `security/TokenService.java`, `security/IssuedToken.java`, `security/CurrentUserId.java`, `security/CurrentOfficeId.java`
- Criar: `config/SecurityConfig.java`, `config/JwtConfig.java`, `config/OpenApiConfig.java`
- Criar: `exception/ApiException.java`, `exception/ErrorMessages.java`, `exception/GlobalExceptionHandler.java`, `resources/ValidationMessages.properties`
- Criar: `service/AuthService.java`, `service/AccountService.java`, `controller/AuthController.java`, `controller/AccountController.java`
- Modificar: `support/ApiIntegrationTest.java`
- Teste: `controller/AuthControllerTest.java`, `controller/AccountControllerTest.java`

**Interfaces:**
- Produz:
  - `Office(String name)`: `getId()`, `getName()`, `rename(String name)`. Constante `NAME_MAX_LENGTH = 120`.
  - `User(UUID officeId, String name, String email, String passwordHash)`: getters `getId`, `getOfficeId`, `getName`, `getEmail`, `getPasswordHash`, `getCredentialsVersion`. Métodos `rename(String)`, `changeEmail(String)` e `changePassword(String newHash)` (este também incrementa `credentialsVersion`). Constantes `NAME_MAX_LENGTH = 120`, `EMAIL_MAX_LENGTH = 254`, `PASSWORD_MIN_LENGTH = 8`, `PASSWORD_MAX_LENGTH = 72` (limite do BCrypt).
  - `OfficeRepository extends JpaRepository<Office, UUID>`. `UserRepository extends JpaRepository<User, UUID>` com `Optional<User> findByEmail(String email)` e `boolean existsByEmail(String email)`.
  - `Inputs` (normalização de entrada, usada nos construtores compactos dos records). `EMAIL_PATTERN = "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"` (mesma regra do front). `static String email(String)`: tira espaços e põe em minúsculas com `Locale.ROOT`. `static String text(String)`: tira espaços. `static String optionalText(String)`: tira espaços e transforma texto vazio em `null`. Todos aceitam `null`.
  - `SignupRequest(String name, String email, String password)`. `name`: `@NotBlank @Size(max = User.NAME_MAX_LENGTH)`. `email`: `@NotBlank @Email(regexp = Inputs.EMAIL_PATTERN) @Size(max = User.EMAIL_MAX_LENGTH)`. `password`: `@NotNull @Size(min = User.PASSWORD_MIN_LENGTH, max = User.PASSWORD_MAX_LENGTH, message = ErrorMessages.PASSWORD_SIZE)`. O construtor compacto normaliza `name` (`text`) e `email` (`email`). A senha nunca é alterada.
  - `LoginRequest(String email, String password, boolean rememberMe)`: `email` e `password` com `@NotBlank`; o e-mail é normalizado.
  - `MeResponse(UUID id, String name, String email, UUID officeId, String officeName)` + `static MeResponse of(User user, Office office)`.
  - `IssuedToken(String value, Instant expiresAt)`.
  - `AuthResponse(String accessToken, Instant expiresAt, MeResponse user)` + `static AuthResponse of(IssuedToken token, User user, Office office)`.
  - `TokenService.issue(User user, boolean rememberMe) : IssuedToken`. Constantes públicas `OFFICE_ID_CLAIM = "office_id"` e `CREDENTIALS_VERSION_CLAIM = "cv"`.
  - Anotações de parâmetro para os controllers:

    ```java
    @Target(ElementType.PARAMETER)
    @Retention(RetentionPolicy.RUNTIME)
    @AuthenticationPrincipal(expression = "T(java.util.UUID).fromString(subject)")
    public @interface CurrentUserId {}

    @Target(ElementType.PARAMETER)
    @Retention(RetentionPolicy.RUNTIME)
    @AuthenticationPrincipal(expression = "T(java.util.UUID).fromString(getClaimAsString('" + TokenService.OFFICE_ID_CLAIM + "'))")
    public @interface CurrentOfficeId {}
    ```

  - `ApiException extends RuntimeException`, com `HttpStatus status()` e `Map<String, String> fieldErrors()`. Fábricas: `notFound()` (404), `invalidCredentials()` (401), `emailInUse()` (409, erro no campo `email`), `invalidField(String field, String message)` (400) e `conflict(String field, String message)` (409).
  - `ErrorMessages` (mensagens para o usuário):
    - `VALIDATION_FAILED = "Revise os campos destacados."`
    - `NOT_FOUND = "Não encontramos o que você procurava."`
    - `INVALID_CREDENTIALS = "E-mail ou senha incorretos."`
    - `EMAIL_IN_USE = "Este e-mail já tem uma conta."`
    - `PASSWORD_SIZE = "Use entre 8 e 72 caracteres."`
    - `DUPLICATE_RECORD = "Este registro já existe."`
  - `AuthService`: `AuthResponse signUp(SignupRequest)` e `AuthResponse logIn(LoginRequest)`. Constante `DEFAULT_OFFICE_NAME_PREFIX = "Escritório de "`.
  - `AccountService.getMe(UUID userId) : MeResponse`.
  - `ApiIntegrationTest` ganha:
    - `record TestSession(String token, UUID userId, UUID officeId)`;
    - `DEFAULT_PASSWORD = "senhaforte1"`;
    - `TestSession signUp(String name, String email)`;
    - `String bearer(TestSession)`;
    - `String readJson(MvcTestResult result, String jsonPath)` (usa JsonPath);
    - `@BeforeEach cleanDatabase()` com `TRUNCATE offices CASCADE`.

- [ ] **Passo 1: Escrever os testes que falham**

`AuthControllerTest`:

| Teste | Requisição | Esperado |
|---|---|---|
| `signUpCreatesOfficeAndReturnsToken` | POST `/api/auth/signup` `{name:"Paula Hooper", email:"paula@fluiar.com.br", password:"senhaforte1"}` | 201; `$.accessToken` não vazio; `$.user.email` = `paula@fluiar.com.br`; `$.user.officeName` = `Escritório de Paula Hooper` |
| `signUpRejectsEmailAlreadyUsedIgnoringCaseAndSpaces` | Paula cadastrada; signup com email `" Paula@Fluiar.com.br "` | 409; `$.errors.email` = `Este e-mail já tem uma conta.` |
| `signUpReportsEachInvalidField` | `{name:"", email:"paula@", password:"curta"}` | 400; `$.detail` = `Revise os campos destacados.`; `$.errors.name` = `Preencha este campo.`; `$.errors.email` = `Digite um e-mail válido, como nome@email.com.`; `$.errors.password` = `Use entre 8 e 72 caracteres.` |
| `logInIgnoresEmailCase` | Paula cadastrada; POST `/api/auth/login` `{email:"PAULA@fluiar.com.br", password:"senhaforte1"}` | 200; `$.user.name` = `Paula Hooper` |
| `logInWithWrongPasswordFails` | login com senha `"errada123"` | 401; `$.detail` = `E-mail ou senha incorretos.` |
| `logInWithUnknownEmailFailsWithSameMessage` | login com `ninguem@fluiar.com.br` | 401; mesmo `$.detail` |
| `rememberMeIssuesLongerToken` | login com `rememberMe:true` e depois com `false` | primeiro `$.expiresAt` depois de agora + 29 dias; segundo antes de agora + 13 horas |

`AccountControllerTest`:

| Teste | Requisição | Esperado |
|---|---|---|
| `meReturnsAuthenticatedUser` | GET `/api/me` com o token da Paula | 200; `$.email` = `paula@fluiar.com.br`; `$.officeId` = `session.officeId()` |
| `meWithoutTokenIsUnauthorized` | GET `/api/me` sem header | 401 |
| `meWithTamperedTokenIsUnauthorized` | token com `"x"` no final | 401 |

- [ ] **Passo 2: Rodar e ver falhar**

Antes, crie a migração do Passo 3, porque o `cleanDatabase()` faz `TRUNCATE offices`. A segurança só entra no `pom.xml` no Passo 4.

Rodar: `./mvnw test -Dtest='AuthControllerTest,AccountControllerTest'`
Esperado: FALHA: status 404 em vez de 201, 200 e 401 (as rotas e a segurança ainda não existem).

- [ ] **Passo 3: Criar a migração `V1__create_offices_and_users.sql`**

```sql
create table offices (
    id         uuid primary key,
    name       varchar(120) not null,
    created_at timestamptz  not null,
    updated_at timestamptz  not null
);

create table users (
    id                  uuid primary key,
    office_id           uuid         not null references offices (id) on delete cascade,
    name                varchar(120) not null,
    email               varchar(254) not null,
    password_hash       varchar(100) not null,
    credentials_version int          not null default 0,
    created_at          timestamptz  not null,
    updated_at          timestamptz  not null,
    constraint uk_users_email unique (email)
);
create index ix_users_office_id on users (office_id);
```

Nas entidades: `@Id @GeneratedValue(strategy = GenerationType.UUID)`, `@CreationTimestamp` em `createdAt`, `@UpdateTimestamp` em `updatedAt` só quando a tabela tiver `updated_at`, e um construtor `protected` sem argumentos para o JPA. A regra vale para todas as entidades deste plano. Nem toda tabela tem `updated_at` (`password_reset_tokens`, `office_invitations`, `rooms` e `product_images` não têm); siga sempre a migração. `ProductLink` é `@Embeddable`, sem `id` nem datas. `User` guarda `officeId` como `UUID` simples: associação JPA só existe quando o código navega por ela.

- [ ] **Passo 4: Implementar segurança e JWT**

- `JwtConfig`:
  - monta uma `SecretKey` `HmacSHA256` com os bytes UTF-8 de `app.jwt.secret`;
  - se o segredo tiver menos de `MIN_SECRET_BYTES = 32`, falha na inicialização com `IllegalStateException("JWT_SECRET precisa ter pelo menos 32 bytes.")`;
  - `JwtEncoder` = `new NimbusJwtEncoder(new ImmutableSecret<>(key))`;
  - `JwtDecoder` = `NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build()`.
- `TokenService.issue`: claims `sub` = id do usuário, `office_id`, `cv` = `credentialsVersion`, `iat` = `clock.instant()` e `exp` = `iat` + `ttl` (ou `rememberMeTtl`). Header `JwsHeader.with(MacAlgorithm.HS256)`.
- `SecurityConfig`:
  - CSRF desligado (não há cookie, o token vai no header);
  - sessão `STATELESS`;
  - `PUBLIC_PATHS = {"/api/auth/**", "/actuator/health", "/error", "/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html"}` com `permitAll`; todo o resto `authenticated()`;
  - `oauth2ResourceServer(o -> o.jwt(withDefaults()))`;
  - CORS lendo `app.cors-allowed-origins`, métodos `GET, POST, PUT, PATCH, DELETE`, headers `Authorization, Content-Type`;
  - `PasswordEncoder` = `PasswordEncoderFactories.createDelegatingPasswordEncoder()`.
- `OpenApiConfig`: `@SecurityScheme(name = "bearer", type = HTTP, scheme = "bearer", bearerFormat = "JWT")` e `@OpenAPIDefinition(info = @Info(title = "Seleção Fluiar API", version = "v1"), security = @SecurityRequirement(name = "bearer"))`. Com isso o Swagger consegue enviar o token.

- [ ] **Passo 5: Implementar o tratamento de erros**

`GlobalExceptionHandler` é um `@RestControllerAdvice` que estende `ResponseEntityExceptionHandler`:
- `ApiException` → `ProblemDetail` com o `status` da exceção, `detail` = mensagem e a propriedade `errors` quando houver.
- Sobrescreve `handleMethodArgumentNotValid` → 400, `detail` = `VALIDATION_FAILED`, `errors` com a primeira mensagem de cada campo (`LinkedHashMap.putIfAbsent`).
- `DataIntegrityViolationException` → 409, `detail` = `DUPLICATE_RECORD`. É uma rede de segurança para duas gravações simultâneas num campo único.

`ValidationMessages.properties` (troca as mensagens padrão do Bean Validation):

```properties
jakarta.validation.constraints.NotBlank.message=Preencha este campo.
jakarta.validation.constraints.NotNull.message=Preencha este campo.
jakarta.validation.constraints.NotEmpty.message=Preencha este campo.
jakarta.validation.constraints.Email.message=Digite um e-mail válido, como nome@email.com.
jakarta.validation.constraints.Size.message=Use no máximo {max} caracteres.
jakarta.validation.constraints.Min.message=Use um valor a partir de {value}.
jakarta.validation.constraints.Max.message=Use um valor até {value}.
jakarta.validation.constraints.DecimalMin.message=Use um valor a partir de {value}.
jakarta.validation.constraints.Digits.message=Use no máximo {integer} dígitos e {fraction} casas decimais.
```

Mensagens específicas de um campo usam constantes de `ErrorMessages` direto na anotação (`message = ErrorMessages.PASSWORD_SIZE`). Assim cada texto existe em um lugar só.

- [ ] **Passo 6: Implementar serviços e controllers**

`AuthService.signUp`:
1. Se `userRepository.existsByEmail(email)`, lança `ApiException.emailInUse()`.
2. Salva `new Office(DEFAULT_OFFICE_NAME_PREFIX + name)`.
3. Salva `new User(office.getId(), name, email, passwordEncoder.encode(password))`.
4. Retorna `AuthResponse.of(tokenService.issue(user, false), user, office)`.

A verificação do passo 1 se repete nas Tarefas 3 e 5 de propósito: é uma linha, e a mensagem mora só em `emailInUse()`.

`AuthService.logIn`:
1. Busca o usuário por e-mail.
2. Se não existir, roda `passwordEncoder.matches(password, dummyPasswordHash)` e lança `invalidCredentials()`. O `dummyPasswordHash` é calculado uma vez no construtor. Essa comparação inútil deixa o tempo de resposta igual ao de um e-mail existente, para não revelar quais e-mails têm conta.
3. Se a senha não bater, lança a mesma exceção.
4. Retorna `AuthResponse.of(tokenService.issue(user, rememberMe), user, office)`.

Controllers:
- `AuthController` (`/api/auth`): `POST /signup` com `@ResponseStatus(CREATED)` e `POST /login`.
- `AccountController` (`/api/me`): `GET`, recebendo `@CurrentUserId UUID userId`.

- [ ] **Passo 7: Rodar e ver passar**

Rodar: `./mvnw test -Dtest='AuthControllerTest,AccountControllerTest'`
Esperado: PASSA.

- [ ] **Passo 8: Verificar, revisar (fluxo de qualidade) e fazer o commit**

```bash
./mvnw verify
git add . && git commit -m "feat: add sign up, login and JWT authentication with offices"
```

---

### Tarefa 3: Configurações da conta e revogação de tokens

**Arquivos:**
- Criar: `dto/ProfileUpdateRequest.java`, `dto/PasswordChangeRequest.java`, `security/CredentialsVersionValidator.java`
- Modificar: `config/JwtConfig.java`, `repository/UserRepository.java`, `service/AccountService.java`, `controller/AccountController.java`, `exception/ErrorMessages.java`
- Teste: `controller/AccountControllerTest.java` (novos casos)

**Interfaces:**
- Consome: `User.rename/changeEmail/changePassword`, `TokenService.issue`, `AuthResponse.of`, `MeResponse.of`, `ApiException.emailInUse/invalidField`.
- Produz:
  - `ProfileUpdateRequest(String name, String email)`: mesmas regras e normalização de `SignupRequest`.
  - `PasswordChangeRequest(String currentPassword, String newPassword)`: `currentPassword` com `@NotBlank`; `newPassword` com as regras de senha do cadastro.
  - `AccountService.updateProfile(UUID userId, ProfileUpdateRequest) : MeResponse`.
  - `AccountService.changePassword(UUID userId, PasswordChangeRequest) : AuthResponse`. A resposta traz um token novo, com validade padrão; o antigo deixa de valer.
  - `UserRepository.findCredentialsVersion(UUID id) : Optional<Integer>`, via `@Query("select u.credentialsVersion from User u where u.id = :id")`.
  - `CredentialsVersionValidator implements OAuth2TokenValidator<Jwt>`.
  - `ErrorMessages.WRONG_CURRENT_PASSWORD = "Senha atual incorreta."`
- Endpoints: `PUT /api/me` e `PUT /api/me/password`.

- [ ] **Passo 1: Escrever os testes que falham**

| Teste | Requisição | Esperado |
|---|---|---|
| `updateProfileChangesNameAndEmail` | PUT `/api/me` `{name:"Paula H.", email:"paula.h@fluiar.com.br"}` | 200 com os dados novos; login com o e-mail novo → 200 |
| `updateProfileRejectsEmailOfAnotherAccount` | Isabela cadastrada (outro escritório); Paula envia email `" ISABELA@fluiar.com.br"` | 409; `$.errors.email` = `Este e-mail já tem uma conta.` |
| `updateProfileAcceptsOwnEmailInAnotherCase` | Paula envia `PAULA@fluiar.com.br` | 200 |
| `changePasswordRequiresCurrentPassword` | PUT `/api/me/password` `{currentPassword:"errada123", newPassword:"novasenha1"}` | 400; `$.errors.currentPassword` = `Senha atual incorreta.` |
| `changePasswordRevokesOldTokens` | troca com a senha atual correta | 200 com novo `$.accessToken`; GET `/api/me` com o token antigo → 401; com o novo → 200; login com a senha nova → 200 |

- [ ] **Passo 2: Rodar e ver falhar**

Rodar: `./mvnw test -Dtest=AccountControllerTest`
Esperado: FALHA (endpoints inexistentes; o token antigo ainda vale).

- [ ] **Passo 3: Implementar o validador de versão de credenciais**

O validador lê `findCredentialsVersion(UUID.fromString(jwt.getSubject()))`. O token só é válido se o usuário existir e a versão for igual a `((Number) jwt.getClaim(CREDENTIALS_VERSION_CLAIM)).intValue()`. Caso contrário, retorna `OAuth2TokenValidatorResult.failure(new OAuth2Error(OAuth2ErrorCodes.INVALID_TOKEN))`.

No `JwtConfig`, adicione `decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(JwtValidators.createDefault(), credentialsVersionValidator))`. Custo aceito: uma consulta por chave primária a cada requisição autenticada.

- [ ] **Passo 4: Implementar o serviço e o controller**

`updateProfile`:
1. Carrega o usuário.
2. Se o e-mail mudou e já tem dono, lança `emailInUse()`.
3. Chama `rename` e `changeEmail`.
4. Retorna `MeResponse`.

`changePassword`:
1. Se a senha atual não bater, lança `invalidField("currentPassword", WRONG_CURRENT_PASSWORD)`.
2. Chama `user.changePassword(passwordEncoder.encode(newPassword))`.
3. Retorna `AuthResponse.of(tokenService.issue(user, false), user, office)`. O token novo já leva a versão incrementada.

- [ ] **Passo 5: Rodar e ver passar**

Rodar: `./mvnw test -Dtest=AccountControllerTest`
Esperado: PASSA.

- [ ] **Passo 6: Verificar, revisar (fluxo de qualidade) e fazer o commit**

```bash
./mvnw verify
git add . && git commit -m "feat: add account settings and revoke tokens on password change"
```

---

### Tarefa 4: Recuperação de senha

**Arquivos:**
- Modificar: `pom.xml` (adicionar `spring-boot-starter-mail`) e `application.yml`:

  ```yaml
  spring:
    mail:
      host: ${MAIL_HOST:localhost}
      port: ${MAIL_PORT:1025}
      username: ${MAIL_USERNAME:}
      password: ${MAIL_PASSWORD:}
  ```

- Criar: `db/migration/V2__create_password_reset_tokens.sql`, `model/PasswordResetToken.java`, `repository/PasswordResetTokenRepository.java`, `security/SecureTokens.java`
- Criar: `service/EmailService.java`, `service/PasswordResetService.java`, `dto/PasswordResetRequest.java`, `dto/PasswordResetInfoResponse.java`, `dto/PasswordResetConfirmRequest.java`
- Modificar: `controller/AuthController.java`, `exception/ApiException.java`, `exception/ErrorMessages.java`, `support/ApiIntegrationTest.java`
- Teste: `security/SecureTokensTest.java`, `controller/PasswordResetTest.java`

**Interfaces:**
- Consome: `User.changePassword`, `UserRepository.findByEmail`, `AppProperties.frontendUrl/mailFrom`, `Clock`.
- Produz:
  - `SecureTokens.generate() : String`: 32 bytes de `SecureRandom` em Base64 URL-safe sem padding (43 caracteres).
  - `SecureTokens.hash(String token) : String`: SHA-256 em hexadecimal minúsculo (64 caracteres). No banco só fica o hash; o token puro vai apenas no e-mail.
  - `PasswordResetToken(UUID userId, String tokenHash, Instant expiresAt)`: `getUserId()` e `isExpired(Instant now)`.
  - `PasswordResetTokenRepository`: `Optional<PasswordResetToken> findByTokenHash(String)` e `@Modifying @Query("delete from PasswordResetToken t where t.userId = :userId") void deleteByUserId(UUID userId)`.
  - `EmailService.sendPasswordReset(String to, String name, String resetLink)`. Usa `JavaMailSender` com `SimpleMailMessage` em texto puro, remetente `app.mail-from`.
  - `PasswordResetService`: `void requestReset(PasswordResetRequest)`, `PasswordResetInfoResponse inspect(String token)` e `void resetPassword(PasswordResetConfirmRequest)`. Constantes `RESET_TOKEN_VALIDITY = Duration.ofHours(1)` e `RESET_PATH = "/nova-senha?token="`.
  - DTOs: `PasswordResetRequest(String email)` (normalizado, `@NotBlank @Email`), `PasswordResetInfoResponse(String email)` e `PasswordResetConfirmRequest(String token, String newPassword)` (`token` com `@NotBlank`; senha com as regras do cadastro).
  - `ApiException.invalidLink()`: 400, `detail` = `ErrorMessages.INVALID_LINK = "Este link expirou ou já foi usado. Peça um novo."`
  - `ApiIntegrationTest` ganha `@MockitoBean protected JavaMailSender mailSender`, `SimpleMailMessage lastEmailTo(String recipient)` (captura com `ArgumentCaptor` e devolve a última mensagem para aquele destinatário) e `String extractToken(String emailText)` (regex `token=([A-Za-z0-9_-]+)`).
- Endpoints: `POST /api/auth/password-reset-requests` (202), `GET /api/auth/password-resets/{token}` e `POST /api/auth/password-resets` (204).

- [ ] **Passo 1: Escrever os testes que falham**

`SecureTokensTest` (teste unitário, sem Spring):

| Teste | Chamada | Esperado |
|---|---|---|
| `generatesUrlSafeTokensThatDoNotRepeat` | `generate()` duas vezes | 43 caracteres, só `[A-Za-z0-9_-]`, diferentes entre si |
| `hashIsSha256Hex` | `hash("abc")` | `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad` |

`PasswordResetTest`:

| Teste | Requisição | Esperado |
|---|---|---|
| `requestSendsLinkToExistingAccount` | POST `/api/auth/password-reset-requests` `{email:"paula@fluiar.com.br"}` | 202; e-mail para Paula com `http://localhost:3000/nova-senha?token=` |
| `requestForUnknownEmailSendsNothing` | `{email:"ninguem@fluiar.com.br"}` | 202; `verify(mailSender, never()).send(any(SimpleMailMessage.class))` |
| `inspectReturnsAccountEmail` | GET `/api/auth/password-resets/{token}` | 200; `$.email` = `paula@fluiar.com.br` |
| `resetChangesPasswordAndRevokesSessions` | POST `/api/auth/password-resets` `{token, newPassword:"novasenha1"}` | 204; login com a senha nova → 200; com a antiga → 401; GET `/api/me` com o token do cadastro → 401 |
| `resetLinkWorksOnlyOnce` | repetir o POST com o mesmo token | 400; `$.detail` = `Este link expirou ou já foi usado. Peça um novo.` |
| `expiredLinkIsRejected` | `update password_reset_tokens set expires_at = now() - interval '1 minute'`; depois GET inspect | 400 com a mesma mensagem |

- [ ] **Passo 2: Rodar e ver falhar**

Antes, crie `SecureTokens` com `generate()` e `hash(String)` retornando `null`, e adicione `spring-boot-starter-mail` ao `pom.xml` (o `ApiIntegrationTest` usa `JavaMailSender`).

Rodar: `./mvnw test -Dtest='SecureTokensTest,PasswordResetTest'`
Esperado: FALHA: `SecureTokensTest` recebe `null`; `PasswordResetTest` recebe 404 em vez de 202, 200 e 204 (as rotas ainda não existem).

- [ ] **Passo 3: Criar a migração `V2__create_password_reset_tokens.sql`**

```sql
create table password_reset_tokens (
    id         uuid primary key,
    user_id    uuid        not null references users (id) on delete cascade,
    token_hash char(64)    not null,
    expires_at timestamptz not null,
    created_at timestamptz not null,
    constraint uk_password_reset_tokens_hash unique (token_hash)
);
create index ix_password_reset_tokens_user_id on password_reset_tokens (user_id);
```

- [ ] **Passo 4: Implementar e-mail, serviço e endpoints**

Texto do e-mail (constantes em `EmailService`):
- Assunto: `Redefinição de senha — Seleção Fluiar`
- Corpo: `Olá, {nome}.\n\nRecebemos um pedido para redefinir a senha da sua conta na Seleção Fluiar.\nCrie uma senha nova neste link (vale por 1 hora):\n{link}\n\nSe não foi você, ignore este e-mail.`

Fluxo do `PasswordResetService`:
- `requestReset`: `userRepository.findByEmail(email).ifPresent(this::sendResetLink)`. A resposta é 202 nos dois casos, para não revelar quais e-mails existem.
- `sendResetLink`:
  1. Gera o token.
  2. Salva o hash com validade `clock.instant().plus(RESET_TOKEN_VALIDITY)`.
  3. Envia o e-mail com o link `frontendUrl + RESET_PATH + token`.
- `inspect`: busca o token válido, depois o usuário, e devolve o e-mail.
- `resetPassword`:
  1. Busca o token válido.
  2. Chama `user.changePassword(encode(newPassword))`, que revoga todos os JWT.
  3. Chama `deleteByUserId`, que apaga este link e qualquer outro pendente do usuário.
- `findValidToken(String token)` (privado): `findByTokenHash(SecureTokens.hash(token)).filter(t -> !t.isExpired(clock.instant())).orElseThrow(ApiException::invalidLink)`.

O e-mail é enviado dentro da transação. Se o SMTP falhar, o token não é salvo e a API responde 500. Comportamento aceito.

- [ ] **Passo 5: Rodar e ver passar**

Rodar: `./mvnw test -Dtest='SecureTokensTest,PasswordResetTest'`
Esperado: PASSA.

- [ ] **Passo 6: Verificar, revisar (fluxo de qualidade) e fazer o commit**

```bash
./mvnw verify
git add . && git commit -m "feat: add password reset by e-mail"
```

---

### Tarefa 5: Escritório e convites

**Arquivos:**
- Criar: `db/migration/V3__create_office_invitations.sql`, `model/OfficeInvitation.java`, `repository/OfficeInvitationRepository.java`
- Criar: `dto/OfficeResponse.java`, `dto/OfficeUpdateRequest.java`, `dto/InvitationRequest.java`, `dto/InvitationResponse.java`, `dto/InvitationInfoResponse.java`, `dto/InvitationAcceptRequest.java`
- Criar: `service/OfficeService.java`, `service/InvitationService.java`, `controller/OfficeController.java`
- Modificar: `controller/AuthController.java`, `service/EmailService.java`, `repository/UserRepository.java`, `support/ApiIntegrationTest.java`
- Teste: `controller/OfficeControllerTest.java`, `controller/InvitationAcceptanceTest.java`

**Interfaces:**
- Consome: `SecureTokens`, `EmailService`, `TokenService.issue`, `AuthResponse.of`, `ApiException.emailInUse/invalidLink/notFound`, `Office.rename`.
- Produz:
  - `OfficeInvitation(UUID officeId, String email, UUID invitedByUserId, String tokenHash, Instant expiresAt)`: getters e `isExpired(Instant now)`.
  - `OfficeInvitationRepository`: `findByTokenHash(String)`, `findByIdAndOfficeId(UUID id, UUID officeId)`, `findByOfficeIdOrderByCreatedAtDesc(UUID officeId)` e `@Modifying @Query("delete from OfficeInvitation i where i.officeId = :officeId and i.email = :email") void deleteByOfficeIdAndEmail(UUID officeId, String email)`.
  - `UserRepository.findByOfficeIdOrderByNameAsc(UUID officeId) : List<User>`.
  - `OfficeResponse(UUID id, String name, List<MemberResponse> members)`, com o record aninhado `MemberResponse(UUID id, String name, String email)` e `static OfficeResponse of(Office office, List<User> members)`.
  - `OfficeUpdateRequest(String name)`: `@NotBlank @Size(max = Office.NAME_MAX_LENGTH)`.
  - `InvitationRequest(String email)`: normalizado, `@NotBlank @Email`.
  - `InvitationResponse(UUID id, String email, Instant expiresAt, Instant createdAt)` + `of(OfficeInvitation)`.
  - `InvitationInfoResponse(String email, String officeName, String invitedByName)`.
  - `InvitationAcceptRequest(String name, String password)`: regras de nome e senha do cadastro.
  - `OfficeService`: `OfficeResponse getOffice(UUID officeId)` e `OfficeResponse rename(UUID officeId, OfficeUpdateRequest)`.
  - `InvitationService`:
    - `InvitationResponse invite(UUID userId, UUID officeId, InvitationRequest)`
    - `List<InvitationResponse> listPending(UUID officeId)` (inclui os expirados; o front mostra a data)
    - `void revoke(UUID officeId, UUID invitationId)`
    - `InvitationInfoResponse inspect(String token)`
    - `AuthResponse accept(String token, InvitationAcceptRequest)`
    - Constantes `INVITATION_VALIDITY = Duration.ofDays(7)` e `INVITATION_PATH = "/convite?token="`.
  - `EmailService.sendInvitation(String to, String officeName, String inviterName, String invitationLink)`.
  - `ApiIntegrationTest.inviteMember(TestSession owner, String name, String email) : TestSession`: convida pela API, lê o token do e-mail capturado e aceita o convite.
- Endpoints: `GET/PUT /api/office`, `GET/POST /api/office/invitations`, `DELETE /api/office/invitations/{id}`, `GET /api/auth/invitations/{token}` e `POST /api/auth/invitations/{token}/acceptance` (201).

- [ ] **Passo 1: Escrever os testes que falham**

`OfficeControllerTest`:

| Teste | Requisição | Esperado |
|---|---|---|
| `getOfficeListsMembers` | Paula cadastrada; GET `/api/office` | `$.name` = `Escritório de Paula Hooper`; `$.members[0].name` = `Paula Hooper` |
| `renameOffice` | PUT `/api/office` `{name:"Fluiar"}` | 200; `$.name` = `Fluiar` |
| `inviteSendsEmailAndShowsPendingInvitation` | POST `/api/office/invitations` `{email:" Isabela@Fluiar.com.br "}` | 201; `$.email` = `isabela@fluiar.com.br`; e-mail para Isabela com `http://localhost:3000/convite?token=`; GET invitations → 1 item |
| `inviteRejectsEmailThatAlreadyHasAccount` | convidar o e-mail de uma conta existente | 409; `$.errors.email` = `Este e-mail já tem uma conta.` |
| `invitingAgainReplacesPreviousInvitation` | convidar Isabela duas vezes | GET invitations → 1 item; o token do primeiro e-mail em GET `/api/auth/invitations/{token}` → 400 |
| `revokeInvalidatesInvitation` | DELETE `/api/office/invitations/{id}` | 204; GET `/api/auth/invitations/{token}` → 400 |
| `revokeInvitationOfAnotherOfficeIsNotFound` | Marina (outro escritório) faz DELETE no convite da Paula | 404 |

`InvitationAcceptanceTest` (Paula renomeou o escritório para `Fluiar` e convidou Isabela):

| Teste | Requisição | Esperado |
|---|---|---|
| `inspectShowsOfficeAndInviter` | GET `/api/auth/invitations/{token}` | `$.email` = `isabela@fluiar.com.br`; `$.officeName` = `Fluiar`; `$.invitedByName` = `Paula Hooper` |
| `acceptCreatesMemberOfSameOffice` | POST `/api/auth/invitations/{token}/acceptance` `{name:"Isabela Machado", password:"senhaforte2"}` | 201; `$.user.officeId` = escritório da Paula; GET `/api/office` (Paula) → 2 membros; o convite some de GET invitations |
| `acceptFailsWhenEmailGotAnAccountMeanwhile` | Isabela se cadastra sozinha antes de aceitar | 409; `$.errors.email` = `Este e-mail já tem uma conta.` |
| `expiredInvitationIsRejected` | `update office_invitations set expires_at = now() - interval '1 minute'` | 400; `$.detail` = `Este link expirou ou já foi usado. Peça um novo.` |

- [ ] **Passo 2: Rodar e ver falhar**

Rodar: `./mvnw test -Dtest='OfficeControllerTest,InvitationAcceptanceTest'`
Esperado: FALHA: status 404 em vez de 200 e 201 (as rotas de escritório e convites ainda não existem).

- [ ] **Passo 3: Criar a migração `V3__create_office_invitations.sql`**

```sql
create table office_invitations (
    id                 uuid primary key,
    office_id          uuid         not null references offices (id) on delete cascade,
    email              varchar(254) not null,
    invited_by_user_id uuid         not null references users (id) on delete cascade,
    token_hash         char(64)     not null,
    expires_at         timestamptz  not null,
    created_at         timestamptz  not null,
    constraint uk_office_invitations_hash unique (token_hash),
    constraint uk_office_invitations_office_email unique (office_id, email)
);
```

- [ ] **Passo 4: Implementar serviços, e-mail e controllers**

Texto do e-mail:
- Assunto: `Convite para o escritório {escritório} — Seleção Fluiar`
- Corpo: `{quem convidou} convidou você para participar do escritório {escritório} na Seleção Fluiar.\n\nCrie sua conta neste link (vale por 7 dias):\n{link}`

Fluxo do `InvitationService`:
- `invite`:
  1. Se o e-mail já tem conta, lança `emailInUse()`.
  2. Chama `deleteByOfficeIdAndEmail`, que apaga um convite anterior para o mesmo e-mail.
  3. Gera o token e salva o convite com validade `clock.instant().plus(INVITATION_VALIDITY)`.
  4. Envia o e-mail com `frontendUrl + INVITATION_PATH + token`.
  5. Retorna `InvitationResponse.of`.
- `accept`:
  1. Busca o convite válido.
  2. Se o e-mail já tem conta, lança `emailInUse()`.
  3. Salva `new User(invitation.getOfficeId(), name, invitation.getEmail(), encode(password))`.
  4. Apaga o convite.
  5. Retorna `AuthResponse.of(tokenService.issue(user, false), user, office)`.
- `findValidInvitation(String token)` (privado): mesma forma do `findValidToken` da Tarefa 4. As duas não devem ser unificadas: são conceitos diferentes (convite e redefinição de senha) que só se parecem.

Comentário obrigatório no `deleteByOfficeIdAndEmail`: o delete em lote (JPQL) roda na hora. Um `delete(entity)` só iria ao banco no flush, depois do insert do convite novo, e violaria a chave única `(office_id, email)`.

Controllers: o `OfficeController` recebe `@CurrentUserId` e `@CurrentOfficeId`; o `AuthController` ganha os dois endpoints públicos de convite.

- [ ] **Passo 5: Rodar e ver passar**

Rodar: `./mvnw test -Dtest='OfficeControllerTest,InvitationAcceptanceTest'`
Esperado: PASSA.

- [ ] **Passo 6: Verificar, revisar (fluxo de qualidade) e fazer o commit**

```bash
./mvnw verify
git add . && git commit -m "feat: add shared office with e-mail invitations"
```

---

### Tarefa 6: Modelo de dados de clientes, listas, ambientes e produtos

Esta tarefa cria o schema, as entidades e as consultas de uma vez. Assim as tarefas de API (7 a 13) usam formatos finais e não precisam mudar respostas umas das outras.

**Arquivos:**
- Criar: `db/migration/V4__create_shopping_domain.sql`
- Criar: `model/Client.java`, `model/ShoppingList.java`, `model/Room.java`, `model/Product.java`, `model/ProductLink.java`, `model/ProductImage.java`
- Criar: `repository/ClientRepository.java`, `repository/ShoppingListRepository.java`, `repository/RoomRepository.java`, `repository/ProductRepository.java`, `repository/ProductImageRepository.java`
- Criar: `dto/ClientSummaryResponse.java`, `dto/ListSummaryResponse.java`
- Teste: `repository/SummaryQueriesTest.java`

**Interfaces:**
- Produz:
  - `Client(UUID officeId, String name, String email, String phone)`: getters e `update(String name, String email, String phone)`. Constantes `NAME_MAX_LENGTH = 120`, `EMAIL_MAX_LENGTH = 254` e `PHONE_DIGITS_PATTERN = "\\d{10,11}"`.
  - `ShoppingList(Client client, String name, String description, String shareToken)`:
    - getters `getId`, `getClient`, `getName`, `getDescription`, `getShareToken`, `getRooms` e `getUpdatedAt`;
    - métodos `update(String name, String description, Client client)`, `replaceShareToken(String)` e `touch()`;
    - constantes `NAME_MAX_LENGTH = 120` e `DESCRIPTION_MAX_LENGTH = 500`;
    - `client` com `@ManyToOne(fetch = LAZY)`;
    - `rooms` com `@OneToMany(mappedBy = "list") @OrderBy("position")`, só para leitura (sem cascade) e iniciada com `new ArrayList<>()`;
    - `touch()` faz `updatedAt = Instant.now()`. Isso deixa a entidade "suja", e o `@UpdateTimestamp` grava a data no flush. É chamado quando ambientes, produtos ou imagens da lista mudam.
  - `Room(ShoppingList list, String name, int position)`:
    - getters `getId`, `getList`, `getName`, `getPosition` e `getProducts`;
    - métodos `rename(String)` e `moveTo(int position)`;
    - constante `NAME_MAX_LENGTH = 60`;
    - `products` com `@OneToMany(mappedBy = "room") @OrderBy("createdAt, id")`, só para leitura.
  - `Product(Room room, String name, int quantity, BigDecimal unitPrice, String notes, boolean bought, List<ProductLink> links)`:
    - getters, incluindo `getImageId()`;
    - métodos `update(Room room, String name, int quantity, BigDecimal unitPrice, String notes, boolean bought, List<ProductLink> links)`, `markBought(boolean)`, `changeQuantity(int)` e `lineTotal() : BigDecimal` (`unitPrice × quantity`, ou `BigDecimal.ZERO` sem preço);
    - constantes `NAME_MAX_LENGTH = 120`, `NOTES_MAX_LENGTH = 1000`, `MIN_QUANTITY = 1`, `MAX_QUANTITY = 999` e `MAX_LINKS = 10`;
    - `links` com `@ElementCollection @CollectionTable(name = "product_links", joinColumns = @JoinColumn(name = "product_id")) @OrderColumn(name = "position")`; o `update` faz `clear()` + `addAll()`;
    - `imageId` com `@Formula("(select pi.id from product_images pi where pi.product_id = id)")`. Comentário obrigatório: o id da imagem é lido junto com o produto sem carregar os bytes.
  - `@Embeddable record ProductLink(String url, String note)`, com as constantes `URL_MAX_LENGTH = 2048` e `NOTE_MAX_LENGTH = 200`.
  - `ProductImage(UUID productId, String contentType, byte[] data)`: `getId`, `getContentType` e `getData`. `data` é um `byte[]` simples, **sem** `@Lob`: no PostgreSQL vira `bytea`, enquanto `@Lob` usaria `oid`.
  - `ClientRepository`: `Optional<Client> findByIdAndOfficeId(UUID id, UUID officeId)` e `List<ClientSummaryResponse> findSummaries(UUID officeId)`.
  - `ShoppingListRepository`: `Optional<ShoppingList> findInOffice(UUID id, UUID officeId)`, `List<ListSummaryResponse> findSummaries(UUID officeId)` e `List<ListSummaryResponse> findSummariesByClient(UUID officeId, UUID clientId)`.
  - `RoomRepository`: `Optional<Room> findInOffice(UUID id, UUID officeId)`.
  - `ProductRepository`: `Optional<Product> findInOffice(UUID id, UUID officeId)`.
  - `ProductImageRepository extends JpaRepository<ProductImage, UUID>`.
  - `ClientSummaryResponse(UUID id, String name, String email, String phone, long listCount, Instant createdAt, Instant updatedAt)`.
  - `ListSummaryResponse(UUID id, String name, String description, UUID clientId, String clientName, long totalProducts, long boughtProducts, BigDecimal estimatedTotal, Instant updatedAt)`:
    - o construtor compacto troca `estimatedTotal` `null` por `BigDecimal.ZERO`;
    - `@JsonProperty("completed") public boolean isCompleted()` retorna `totalProducts > 0 && boughtProducts == totalProducts`. Lista vazia **não** está concluída.

- [ ] **Passo 1: Escrever os testes que falham**

`SummaryQueriesTest` usa `@DataJpaTest`, `@AutoConfigureTestDatabase(replace = Replace.NONE)` e `@Import(TestcontainersConfiguration.class)`. Os dados são criados com os repositórios, e o `TestEntityManager` faz `flush()` e `clear()` antes de consultar.

| Teste | Dados | Esperado |
|---|---|---|
| `listSummaryCountsBoughtProductsAndSumsPricedOnes` | uma lista com 3 produtos em 2 ambientes: (qtd 2, R$ 10,00, comprado), (qtd 1, sem preço, pendente), (qtd 3, R$ 5,50, pendente) | `totalProducts` 3; `boughtProducts` 1; `estimatedTotal` 36.50; `isCompleted()` false |
| `emptyListIsNotCompleted` | uma lista sem ambientes e outra com um ambiente vazio | `totalProducts` 0; `estimatedTotal` 0 (não `null`); `isCompleted()` false |
| `fullyBoughtListIsCompleted` | 2 produtos comprados | `isCompleted()` true |
| `summariesOnlyIncludeOwnOffice` | clientes e listas em 2 escritórios | `findSummaries(A)` (listas e clientes) só traz os do escritório A |
| `clientSummaryCountsLists` | um cliente com 2 listas e outro sem listas | `listCount` 2 e 0 |
| `findInOfficeIgnoresOtherOffices` | lista, ambiente e produto do escritório A | `findInOffice(id, B)` vazio e `findInOffice(id, A)` presente, nos três repositórios |
| `imageIdIsReadThroughFormula` | salvar uma `ProductImage` do produto; `flush` + `clear` | `productRepository.findById(id).get().getImageId()` = id da imagem |
| `deletingClientCascadesToEverything` | cliente com lista, ambiente, produto com 2 links e imagem; `clientRepository.delete` + `flush` | `count(*)` = 0 em `shopping_lists`, `rooms`, `products`, `product_links` e `product_images` |

- [ ] **Passo 2: Rodar e ver falhar**

Antes, crie o esqueleto que compila e sobe o contexto: a migração do Passo 3, as entidades já mapeadas (sem o `@Formula`; `getImageId()` retorna `null`), os records de resumo e os repositórios, com `findSummaries`, `findSummariesByClient` e `findInOffice` como métodos `default` que retornam `List.of()` ou `Optional.empty()`.

Rodar: `./mvnw test -Dtest=SummaryQueriesTest`
Esperado: FALHA nas asserções das consultas e de `getImageId()`. Só `deletingClientCascadesToEverything` já passa, porque o `on delete cascade` vem da migração; ele fica como proteção do schema.

- [ ] **Passo 3: Criar a migração `V4__create_shopping_domain.sql`**

```sql
create table clients (
    id         uuid primary key,
    office_id  uuid         not null references offices (id) on delete cascade,
    name       varchar(120) not null,
    email      varchar(254) not null,
    phone      varchar(11)  not null,
    created_at timestamptz  not null,
    updated_at timestamptz  not null
);
create index ix_clients_office_id on clients (office_id);

create table shopping_lists (
    id          uuid primary key,
    client_id   uuid         not null references clients (id) on delete cascade,
    name        varchar(120) not null,
    description varchar(500),
    share_token varchar(64)  not null,
    created_at  timestamptz  not null,
    updated_at  timestamptz  not null,
    constraint uk_shopping_lists_share_token unique (share_token)
);
create index ix_shopping_lists_client_id on shopping_lists (client_id);

create table rooms (
    id         uuid primary key,
    list_id    uuid        not null references shopping_lists (id) on delete cascade,
    name       varchar(60) not null,
    position   int         not null,
    created_at timestamptz not null
);
create unique index uk_rooms_list_name on rooms (list_id, lower(name));

create table products (
    id         uuid primary key,
    room_id    uuid           not null references rooms (id) on delete cascade,
    name       varchar(120)   not null,
    quantity   int            not null check (quantity between 1 and 999),
    unit_price numeric(12, 2) check (unit_price >= 0),
    notes      varchar(1000),
    bought     boolean        not null default false,
    created_at timestamptz    not null,
    updated_at timestamptz    not null
);
create index ix_products_room_id on products (room_id);

create table product_links (
    product_id uuid          not null references products (id) on delete cascade,
    position   int           not null,
    url        varchar(2048) not null,
    note       varchar(200),
    primary key (product_id, position)
);

create table product_images (
    id           uuid primary key,
    product_id   uuid        not null references products (id) on delete cascade,
    content_type varchar(20) not null,
    data         bytea       not null,
    created_at   timestamptz not null,
    constraint uk_product_images_product unique (product_id)
);
```

- [ ] **Passo 4: Implementar entidades e repositórios**

Consultas `findInOffice` (cada uma já traz os pais com `join fetch`):
- Lista: `select l from ShoppingList l join fetch l.client c where l.id = :id and c.officeId = :officeId`
- Ambiente: `select r from Room r join fetch r.list l join fetch l.client c where r.id = :id and c.officeId = :officeId`
- Produto: `select p from Product p join fetch p.room r join fetch r.list l join fetch l.client c where p.id = :id and c.officeId = :officeId`

Resumo de clientes (`ClientRepository.findSummaries`):

```java
@Query("""
        select new br.com.fluiar.selecao.dto.ClientSummaryResponse(
            c.id, c.name, c.email, c.phone, count(l.id), c.createdAt, c.updatedAt)
        from Client c
        left join ShoppingList l on l.client = c
        where c.officeId = :officeId
        group by c.id, c.name, c.email, c.phone, c.createdAt, c.updatedAt
        order by c.updatedAt desc
        """)
```

Resumo de listas (constantes de interface em `ShoppingListRepository`, para as duas consultas não duplicarem o texto):

```java
String SUMMARY_SELECT = """
        select new br.com.fluiar.selecao.dto.ListSummaryResponse(
            l.id, l.name, l.description, c.id, c.name,
            count(p.id),
            sum(case when p.bought = true then 1 else 0 end),
            sum(p.unitPrice * p.quantity),
            l.updatedAt)
        from ShoppingList l
        join l.client c
        left join Room r on r.list = l
        left join Product p on p.room = r
        """;
String SUMMARY_GROUP_AND_ORDER = """
        group by l.id, l.name, l.description, c.id, c.name, l.updatedAt
        order by l.updatedAt desc
        """;

@Query(SUMMARY_SELECT + "where c.officeId = :officeId " + SUMMARY_GROUP_AND_ORDER)
List<ListSummaryResponse> findSummaries(UUID officeId);

@Query(SUMMARY_SELECT + "where c.officeId = :officeId and c.id = :clientId " + SUMMARY_GROUP_AND_ORDER)
List<ListSummaryResponse> findSummariesByClient(UUID officeId, UUID clientId);
```

Se o Hibernate não achar o construtor por causa de `long` versus `Long`, troque os componentes de contagem dos records para `Long`. Os testes desta tarefa pegam o problema.

- [ ] **Passo 5: Rodar e ver passar**

Rodar: `./mvnw test -Dtest=SummaryQueriesTest`
Esperado: PASSA. O contexto também valida o schema contra as entidades (`ddl-auto=validate`).

- [ ] **Passo 6: Verificar, revisar (fluxo de qualidade) e fazer o commit**

```bash
./mvnw verify
git add . && git commit -m "feat: add clients, lists, rooms and products data model"
```

---

### Tarefa 7: API de clientes

**Arquivos:**
- Criar: `dto/ClientRequest.java`, `dto/ClientResponse.java`, `dto/ClientDetailResponse.java`, `service/ClientService.java`, `controller/ClientController.java`
- Modificar: `dto/Inputs.java`, `exception/ErrorMessages.java`, `support/ApiIntegrationTest.java`
- Teste: `controller/ClientControllerTest.java`

**Interfaces:**
- Consome: `ClientRepository.findByIdAndOfficeId/findSummaries`, `ShoppingListRepository.findSummariesByClient`, `Client.update`.
- Produz:
  - `Inputs.digits(String) : String`: remove tudo que não é dígito; aceita `null`.
  - `ClientRequest(String name, String email, String phone)`:
    - `name`: `@NotBlank @Size(max = Client.NAME_MAX_LENGTH)`;
    - `email`: `@NotBlank @Email(regexp = Inputs.EMAIL_PATTERN) @Size(max = Client.EMAIL_MAX_LENGTH)`;
    - `phone`: `@NotNull @Pattern(regexp = Client.PHONE_DIGITS_PATTERN, message = ErrorMessages.PHONE_INVALID)`;
    - o construtor compacto aplica `text`, `email` e `digits`. A validação roda depois do construtor, então o padrão confere os dígitos já limpos.
  - `ClientResponse(UUID id, String name, String email, String phone, Instant createdAt, Instant updatedAt)` + `of(Client)`.
  - `ClientDetailResponse(UUID id, String name, String email, String phone, Instant createdAt, Instant updatedAt, List<ListSummaryResponse> lists)` + `of(Client, List<ListSummaryResponse>)`.
  - `ClientService`: `List<ClientSummaryResponse> list(UUID officeId)`, `ClientDetailResponse get(UUID officeId, UUID clientId)`, `ClientResponse create(UUID officeId, ClientRequest)`, `ClientResponse update(UUID officeId, UUID clientId, ClientRequest)` e `void delete(UUID officeId, UUID clientId)`.
  - `ErrorMessages.PHONE_INVALID = "Digite o telefone com DDD, como (31) 99999-9999."`
  - `ApiIntegrationTest.createClient(TestSession, String name) : UUID`.

- [ ] **Passo 1: Escrever os testes que falham**

| Teste | Requisição | Esperado |
|---|---|---|
| `createClientNormalizesEmailAndPhone` | POST `/api/clients` `{name:"Sérgio Hooper", email:" Sergio.Hooper@Gmail.com ", phone:"(31) 98842-1170"}` | 201; `$.email` = `sergio.hooper@gmail.com`; `$.phone` = `31988421170` |
| `createClientReportsInvalidFields` | `{name:"", email:"sergio@", phone:"123"}` | 400; `$.errors.name` = `Preencha este campo.`; `$.errors.email` = `Digite um e-mail válido, como nome@email.com.`; `$.errors.phone` = `Digite o telefone com DDD, como (31) 99999-9999.` |
| `listClientsShowsOfficeClients` | 2 clientes | GET `/api/clients` → 2 itens com `listCount` 0 |
| `colleaguesShareClients` | Paula cria um cliente; `inviteMember(paula, "Isabela Machado", "isabela@fluiar.com.br")` | GET `/api/clients` como Isabela → 1 item |
| `getClientReturnsDetail` | GET `/api/clients/{id}` | 200; `$.name` = `Sérgio Hooper`; `$.lists` = `[]` |
| `updateClientChangesData` | PUT `/api/clients/{id}` com dados novos | 200; o GET mostra os dados novos |
| `deleteClientRemovesIt` | DELETE `/api/clients/{id}` | 204; GET → 404 |
| `clientOfAnotherOfficeIsNotFound` | Marina (outro escritório) faz GET, PUT e DELETE no cliente da Paula | 404 nos três |

- [ ] **Passo 2: Rodar e ver falhar**

Rodar: `./mvnw test -Dtest=ClientControllerTest`
Esperado: FALHA: status 404 em vez de 201 e 200 (`/api/clients` ainda não existe).

- [ ] **Passo 3: Implementar serviço e controller**

`get`: busca o cliente com `findByIdAndOfficeId(...).orElseThrow(ApiException::notFound)` e devolve `ClientDetailResponse.of(client, listRepository.findSummariesByClient(officeId, clientId))`. Os outros métodos seguem o mesmo padrão de busca. O controller (`/api/clients`) recebe `@CurrentOfficeId UUID officeId`; o POST responde 201.

- [ ] **Passo 4: Rodar e ver passar**

Rodar: `./mvnw test -Dtest=ClientControllerTest`
Esperado: PASSA.

- [ ] **Passo 5: Verificar, revisar (fluxo de qualidade) e fazer o commit**

```bash
./mvnw verify
git add . && git commit -m "feat: add clients API"
```

---

### Tarefa 8: API de listas

**Arquivos:**
- Criar: `dto/ShoppingListRequest.java`, `dto/ListDetailResponse.java`, `dto/ListStatsResponse.java`, `dto/RoomResponse.java`, `dto/ProductResponse.java`, `dto/ProductLinkDto.java`, `dto/ImageUrls.java`
- Criar: `service/ShoppingListService.java`, `controller/ShoppingListController.java`
- Modificar: `exception/ErrorMessages.java`, `support/ApiIntegrationTest.java`
- Teste: `controller/ShoppingListControllerTest.java`

**Interfaces:**
- Consome: `ShoppingListRepository.findInOffice/findSummaries`, `ClientRepository.findByIdAndOfficeId`, `SecureTokens.generate`, `ShoppingList.update`, `Product.lineTotal`.
- Produz:
  - `ShoppingListRequest(String name, String description, UUID clientId)`:
    - `name`: `@NotBlank @Size(max = ShoppingList.NAME_MAX_LENGTH)`, com `text`;
    - `description`: `@Size(max = ShoppingList.DESCRIPTION_MAX_LENGTH)`, com `optionalText`;
    - `clientId`: `@NotNull(message = ErrorMessages.LIST_CLIENT_REQUIRED)`.
  - `ProductLinkDto(String url, String note)` + `static ProductLinkDto of(ProductLink)` + `ProductLink toModel()`. As validações entram na Tarefa 10.
  - `ImageUrls.of(UUID imageId) : String`: devolve `"/api/images/" + imageId`, ou `null` sem imagem. Constante `IMAGE_PATH = "/api/images/"`.
  - `ProductResponse(UUID id, UUID roomId, String name, int quantity, BigDecimal unitPrice, String notes, boolean bought, String imageUrl, List<ProductLinkDto> links)` + `of(Product)`.
  - `RoomResponse(UUID id, String name, int position, List<ProductResponse> products)` + `of(Room)`.
  - `ListStatsResponse(int totalProducts, int boughtProducts, int pendingProducts, BigDecimal estimatedTotal, BigDecimal remainingTotal)` + `static of(List<Product> products)`. `estimatedTotal` é a soma de `lineTotal()`; `remainingTotal` é a mesma soma só dos produtos não comprados.
  - `ListDetailResponse(UUID id, String name, String description, UUID clientId, String clientName, String shareToken, Instant updatedAt, ListStatsResponse stats, List<RoomResponse> rooms)` + `of(ShoppingList)`. Navega `getRooms()` → `getProducts()`; o `default_batch_fetch_size` evita N+1.
  - `ShoppingListService`: `List<ListSummaryResponse> list(UUID officeId)`, `ListDetailResponse get(UUID officeId, UUID listId)`, `ListDetailResponse create(UUID officeId, ShoppingListRequest)`, `ListDetailResponse update(UUID officeId, UUID listId, ShoppingListRequest)` e `void delete(UUID officeId, UUID listId)`.
  - `ErrorMessages.LIST_CLIENT_REQUIRED = "Escolha o cliente desta lista."`
  - `ApiIntegrationTest.createList(TestSession, UUID clientId, String name) : UUID`.

- [ ] **Passo 1: Escrever os testes que falham**

Os endpoints de ambientes e produtos só chegam nas Tarefas 9 e 10. Por isso, estes testes criam ambientes e produtos com `RoomRepository` e `ProductRepository` injetados no teste. Valores em dinheiro são comparados numericamente.

| Teste | Requisição | Esperado |
|---|---|---|
| `createListForClient` | POST `/api/lists` `{name:"Lista de compras da casa", description:"Itens para a casa nova.", clientId}` | 201; `$.clientName` = `Sérgio Hooper`; `$.shareToken` com 43 caracteres; `$.rooms` = `[]`; `$.stats.totalProducts` = 0 |
| `createListRequiresClient` | sem `clientId` | 400; `$.errors.clientId` = `Escolha o cliente desta lista.` |
| `createListRejectsClientOfAnotherOffice` | `clientId` de um cliente da Marina | 400; mesma mensagem em `$.errors.clientId` |
| `listListsReturnsSummaries` | 1 lista vazia | GET `/api/lists` → `$[0].clientName` = `Sérgio Hooper`; `$[0].totalProducts` = 0; `$[0].completed` = false |
| `clientShowsItsLists` | 1 lista para Sérgio | GET `/api/clients/{id}` → `$.lists` com 1 item; GET `/api/clients` → `$[0].listCount` = 1 |
| `getListShowsRoomsProductsAndStats` | "Cozinha" (posição 0) com Batedeira (qtd 1, R$ 459,00, pendente, 2 links) e Forma para bolo (qtd 2, R$ 39,90, comprada); "Lavanderia" (posição 1) com Caixa organizadora (qtd 3, sem preço) | `$.rooms[0].name` = `Cozinha`; `$.rooms[0].products[0].links` com 2 itens; `$.stats`: total 3, comprados 1, pendentes 2, `estimatedTotal` 538.80, `remainingTotal` 459.00; `imageUrl` = null |
| `updateListCanMoveToAnotherClient` | PUT `/api/lists/{id}` com outro `clientId` do mesmo escritório | 200; `$.clientName` novo |
| `deleteListRemovesIt` | DELETE | 204; GET → 404 |
| `listOfAnotherOfficeIsNotFound` | Marina faz GET, PUT e DELETE na lista da Paula | 404 |

- [ ] **Passo 2: Rodar e ver falhar**

Rodar: `./mvnw test -Dtest=ShoppingListControllerTest`
Esperado: FALHA: status 404 em vez de 201 e 200 (`/api/lists` ainda não existe).

- [ ] **Passo 3: Implementar serviço e controller**

`create`:
1. Chama `findClientForList(officeId, request.clientId())` (privado), que busca o cliente no escritório ou lança `invalidField("clientId", LIST_CLIENT_REQUIRED)`. É 400, e não 404, porque o id veio no corpo da requisição.
2. Salva `new ShoppingList(client, name, description, SecureTokens.generate())`.
3. Retorna `ListDetailResponse.of(list)`.

`update`:
1. Busca a lista com `findInOffice` (404 se não achar).
2. Chama `findClientForList`.
3. Chama `list.update(...)`.
4. Retorna `ListDetailResponse.of(list)`.

`delete`: busca a lista com `findInOffice` e apaga; o banco apaga os filhos em cascata.

- [ ] **Passo 4: Rodar e ver passar**

Rodar: `./mvnw test -Dtest=ShoppingListControllerTest`
Esperado: PASSA.

- [ ] **Passo 5: Verificar, revisar (fluxo de qualidade) e fazer o commit**

```bash
./mvnw verify
git add . && git commit -m "feat: add shopping lists API with stats"
```

---

### Tarefa 9: API de ambientes

**Arquivos:**
- Criar: `dto/RoomRequest.java`, `dto/RoomOrderRequest.java`, `service/RoomService.java`, `controller/RoomController.java`
- Modificar: `repository/RoomRepository.java`, `exception/ErrorMessages.java`, `support/ApiIntegrationTest.java`
- Teste: `controller/RoomControllerTest.java`

**Interfaces:**
- Consome: `ShoppingListRepository.findInOffice`, `RoomRepository.findInOffice`, `ShoppingList.touch`, `Room.rename/moveTo`, `RoomResponse.of`.
- Produz:
  - `RoomRepository` ganha:
    - `@Query("select coalesce(max(r.position), -1) from Room r where r.list = :list") int findMaxPosition(ShoppingList list)`
    - `boolean existsByListAndNameIgnoreCase(ShoppingList list, String name)`
    - `boolean existsByListAndNameIgnoreCaseAndIdNot(ShoppingList list, String name, UUID id)`
    - `List<Room> findByListOrderByPosition(ShoppingList list)`
  - `RoomRequest(String name)`: `@NotBlank @Size(max = Room.NAME_MAX_LENGTH)`, com `text`.
  - `RoomOrderRequest(List<UUID> roomIds)`: `@NotEmpty`.
  - `RoomService`: `RoomResponse create(UUID officeId, UUID listId, RoomRequest)`, `RoomResponse rename(UUID officeId, UUID roomId, RoomRequest)`, `void delete(UUID officeId, UUID roomId)` e `List<RoomResponse> reorder(UUID officeId, UUID listId, RoomOrderRequest)`.
  - `ErrorMessages.ROOM_NAME_IN_USE = "Já existe um ambiente com esse nome nesta lista."`
  - `ErrorMessages.ROOM_ORDER_INCOMPLETE = "Envie todos os ambientes da lista, sem repetir."`
  - `ApiIntegrationTest.createRoom(TestSession, UUID listId, String name) : UUID`.

- [ ] **Passo 1: Escrever os testes que falham**

| Teste | Requisição | Esperado |
|---|---|---|
| `createRoomAppendsAtTheEnd` | POST `/api/lists/{id}/rooms` com "Cozinha" e depois "Lavanderia" | 201; `$.position` 0 e 1; o GET da lista mostra os dois nessa ordem |
| `createRoomRejectsDuplicateNameIgnoringCase` | criar `" cozinha "` de novo | 409; `$.errors.name` = `Já existe um ambiente com esse nome nesta lista.` |
| `sameRoomNameIsAllowedInAnotherList` | "Cozinha" em duas listas | 201 nas duas |
| `renameRoom` | PUT `/api/rooms/{id}` `{name:"Cozinha gourmet"}` | 200; `$.name` = `Cozinha gourmet` |
| `renameRoomToNameOfAnotherRoomFails` | renomear Lavanderia para `"COZINHA"` | 409 |
| `renameRoomKeepingItsOwnNameSucceeds` | renomear Cozinha para `"cozinha"` | 200 |
| `deleteRoomRemovesItsProducts` | ambiente com 1 produto (salvo via `ProductRepository`) | 204; o GET da lista não mostra o ambiente e `stats.totalProducts` = 0 |
| `reorderRooms` | PUT `/api/lists/{id}/room-order` `{roomIds:[lavanderia, cozinha]}` | 200; posições 0 e 1 nessa ordem; o GET da lista confirma |
| `reorderRejectsIncompleteOrRepeatedIds` | `[cozinha]` e depois `[cozinha, cozinha]` | 400; `$.errors.roomIds` = `Envie todos os ambientes da lista, sem repetir.` |
| `roomChangesRefreshListUpdatedAt` | guardar o `updatedAt` da lista; criar um ambiente | `updatedAt` em GET `/api/lists` maior que o anterior |
| `roomOfAnotherOfficeIsNotFound` | Marina: POST na lista da Paula, PUT, DELETE e reorder | 404 |

- [ ] **Passo 2: Rodar e ver falhar**

Rodar: `./mvnw test -Dtest=RoomControllerTest`
Esperado: FALHA: status 404 em vez de 201 e 200 (as rotas de ambientes ainda não existem).

- [ ] **Passo 3: Implementar serviço e controller**

`create`:
1. Busca a lista com `findInOffice` (404).
2. Se o nome já existe na lista, lança `conflict("name", ROOM_NAME_IN_USE)`.
3. Salva `new Room(list, name, findMaxPosition(list) + 1)`.
4. Chama `list.touch()`.
5. Retorna `RoomResponse.of(room)`.

O índice único no banco é a garantia real; a verificação do passo 2 só existe para dar uma mensagem amigável.

`rename`: busca o ambiente; verifica o nome com `existsByListAndNameIgnoreCaseAndIdNot`; chama `rename` e `touch`.

`delete`: busca o ambiente; chama `room.getList().touch()`; apaga (o banco apaga os produtos em cascata).

`reorder`:
1. Busca a lista.
2. Carrega os ambientes com `findByListOrderByPosition`.
3. A ordem só é válida se `roomIds` não tiver repetidos, tiver o mesmo tamanho e os mesmos ids dos ambientes da lista. Senão, lança `invalidField("roomIds", ROOM_ORDER_INCOMPLETE)`.
4. Chama `room.moveTo(roomIds.indexOf(room.getId()))` para cada ambiente.
5. Chama `touch` e devolve os ambientes na ordem nova.

Rotas no `RoomController`: `POST /api/lists/{listId}/rooms` (201), `PUT /api/lists/{listId}/room-order`, `PUT /api/rooms/{roomId}` e `DELETE /api/rooms/{roomId}` (204).

- [ ] **Passo 4: Rodar e ver passar**

Rodar: `./mvnw test -Dtest=RoomControllerTest`
Esperado: PASSA.

- [ ] **Passo 5: Verificar, revisar (fluxo de qualidade) e fazer o commit**

```bash
./mvnw verify
git add . && git commit -m "feat: add rooms API with ordering"
```

---

### Tarefa 10: API de produtos

**Arquivos:**
- Criar: `dto/ProductRequest.java`, `dto/ProductStatusRequest.java`, `service/ProductService.java`, `controller/ProductController.java`
- Modificar: `dto/ProductLinkDto.java`, `dto/Inputs.java`, `exception/ErrorMessages.java`, `support/ApiIntegrationTest.java`
- Teste: `controller/ProductControllerTest.java`

**Interfaces:**
- Consome: `ShoppingListRepository.findInOffice`, `RoomRepository.findById`, `ProductRepository.findInOffice`, `Product.update/markBought/changeQuantity`, `ShoppingList.touch`, `ProductResponse.of`, `ProductLinkDto.toModel`.
- Produz:
  - `Inputs.URL_PATTERN = "^https?://\\S+\\.\\S+$"`. Só aceita `http` e `https`, o que bloqueia `javascript:` no link público.
  - `ProductLinkDto`:
    - `url`: `@NotNull @Size(max = ProductLink.URL_MAX_LENGTH) @Pattern(regexp = Inputs.URL_PATTERN, message = ErrorMessages.LINK_URL_INVALID)`, com `text`;
    - `note`: `@Size(max = ProductLink.NOTE_MAX_LENGTH)`, com `optionalText`.
  - `ProductRequest(UUID roomId, String name, int quantity, BigDecimal unitPrice, String notes, boolean bought, List<ProductLinkDto> links)`:
    - `roomId`: `@NotNull(message = ErrorMessages.ROOM_REQUIRED)`;
    - `name`: `@NotBlank @Size(max = Product.NAME_MAX_LENGTH)`;
    - `quantity`: `@Min(Product.MIN_QUANTITY) @Max(Product.MAX_QUANTITY)`;
    - `unitPrice` (opcional): `@DecimalMin("0.00") @Digits(integer = 10, fraction = 2)`;
    - `notes`: `@Size(max = Product.NOTES_MAX_LENGTH)`, com `optionalText`;
    - `links`: `@Size(max = Product.MAX_LINKS, message = ErrorMessages.LINKS_TOO_MANY) List<@Valid ProductLinkDto>`; `null` vira `List.of()`.
  - `ProductStatusRequest(Boolean bought, Integer quantity)`: `quantity` com `@Min/@Max` como acima. Os dois são opcionais; o que vier `null` não muda.
  - `ProductService`: `ProductResponse create(UUID officeId, UUID listId, ProductRequest)`, `ProductResponse get(UUID officeId, UUID productId)`, `ProductResponse update(UUID officeId, UUID productId, ProductRequest)`, `ProductResponse updateStatus(UUID officeId, UUID productId, ProductStatusRequest)` e `void delete(UUID officeId, UUID productId)`.
  - `ErrorMessages`:
    - `ROOM_REQUIRED = "Escolha o ambiente do produto."`
    - `ROOM_NOT_IN_LIST = "Escolha um ambiente desta lista."`
    - `LINK_URL_INVALID = "Cole o link completo, começando com https://"`
    - `LINKS_TOO_MANY = "Adicione no máximo 10 links."`
  - `ApiIntegrationTest.createProduct(TestSession, UUID listId, UUID roomId, String name) : UUID`.

- [ ] **Passo 1: Escrever os testes que falham**

| Teste | Requisição | Esperado |
|---|---|---|
| `createProductWithPriceAndLinks` | POST `/api/lists/{listId}/products` `{roomId, name:"Batedeira", quantity:1, unitPrice:459.00, notes:"Para massas pesadas, escolher a opção 3.", bought:false, links:[{url:"https://meli.la/1sNwTbN", note:"Massas mais leves"}, {url:"https://meli.la/2az7TXp", note:""}]}` | 201; campos iguais aos enviados; `$.links[1].note` = null (texto vazio vira null); `$.imageUrl` = null |
| `createProductWithoutPriceKeepsNull` | sem `unitPrice` | 201; `$.unitPrice` = null; o GET da lista mostra `stats.estimatedTotal` = 0 |
| `createProductRequiresRoomOfTheSameList` | sem `roomId`; depois com `roomId` de outra lista do mesmo escritório | 400; `$.errors.roomId` = `Escolha o ambiente do produto.`; depois `Escolha um ambiente desta lista.` |
| `createProductValidatesInput` | `quantity:0`, `unitPrice:-1`, `links:[{url:"javascript:alert(1)"}]` | 400; `$.errors.quantity` = `Use um valor a partir de 1.`; `$.errors.unitPrice` = `Use um valor a partir de 0.00.`; `$.errors['links[0].url']` = `Cole o link completo, começando com https://` |
| `createProductRejectsMoreThanTenLinks` | 11 links válidos | 400; `$.errors.links` = `Adicione no máximo 10 links.` |
| `updateProductReplacesLinksAndMovesRoomInsideList` | PUT `/api/products/{id}` com outro ambiente da mesma lista e 1 link | 200; `$.roomId` novo; `$.links` com 1 item |
| `updateProductRejectsRoomOfAnotherList` | PUT com um ambiente de outra lista | 400; `$.errors.roomId` = `Escolha um ambiente desta lista.` |
| `patchChangesOnlyTheGivenField` | PATCH `{bought:true}`; depois PATCH `{quantity:3}` | primeiro: `bought` true e `quantity` 1; segundo: `bought` true e `quantity` 3 |
| `productChangesUpdateListStats` | marcar a Batedeira como comprada | o GET da lista mostra `boughtProducts` +1 e `remainingTotal` 459.00 menor |
| `deleteProduct` | DELETE `/api/products/{id}` | 204; GET → 404 |
| `productOfAnotherOfficeIsNotFound` | Marina: GET, PUT, PATCH e DELETE no produto da Paula; POST na lista da Paula | 404 |

- [ ] **Passo 2: Rodar e ver falhar**

Rodar: `./mvnw test -Dtest=ProductControllerTest`
Esperado: FALHA: status 404 em vez de 201 e 200 (as rotas de produtos ainda não existem).

- [ ] **Passo 3: Implementar serviço e controller**

`create`:
1. Busca a lista com `findInOffice` (404).
2. Chama `roomOfList(request.roomId(), list)`.
3. Salva `new Product(room, ..., links convertidos com toModel())`.
4. Chama `list.touch()`.
5. Retorna `ProductResponse.of(product)`.

`update`:
1. Busca o produto com `findInOffice`.
2. Chama `roomOfList(request.roomId(), product.getRoom().getList())`. O produto só muda de ambiente dentro da mesma lista.
3. Chama `product.update(...)`.
4. Chama `touch` na lista.
5. Retorna `ProductResponse.of(product)`.

`updateStatus`: aplica `markBought` e/ou `changeQuantity` só para os campos que não vieram `null`, depois chama `touch`.

`delete`: busca o produto, chama `touch` na lista e apaga.

`roomOfList(UUID roomId, ShoppingList list)` (privado): `roomRepository.findById(roomId).filter(room -> room.getList().getId().equals(list.getId())).orElseThrow(() -> ApiException.invalidField("roomId", ErrorMessages.ROOM_NOT_IN_LIST))`.

- [ ] **Passo 4: Rodar e ver passar**

Rodar: `./mvnw test -Dtest=ProductControllerTest`
Esperado: PASSA.

- [ ] **Passo 5: Verificar, revisar (fluxo de qualidade) e fazer o commit**

```bash
./mvnw verify
git add . && git commit -m "feat: add products API with links and purchase status"
```

---

### Tarefa 11: Imagens dos produtos

**Arquivos:**
- Criar: `dto/ProductImageResponse.java`, `dto/ImageContent.java`, `service/ProductImageService.java`, `controller/ProductImageController.java`
- Modificar: `repository/ProductImageRepository.java`, `exception/ApiException.java`, `exception/ErrorMessages.java`, `exception/GlobalExceptionHandler.java`, `config/SecurityConfig.java`
- Teste: `controller/ProductImageControllerTest.java`

**Interfaces:**
- Consome: `ProductRepository.findInOffice`, `ShoppingList.touch`, `ImageUrls.of`.
- Produz:
  - `ProductImageRepository.deleteByProductId(UUID productId)`, via `@Modifying @Query("delete from ProductImage i where i.productId = :productId")`. Comentário obrigatório: o delete em lote roda na hora; com `delete(entity)` o Hibernate faria o insert da imagem nova antes do delete e violaria `uk_product_images_product`.
  - `ProductImageResponse(String imageUrl)` e `ImageContent(String contentType, byte[] data)`.
  - `ProductImageService`:
    - `ProductImageResponse replace(UUID officeId, UUID productId, MultipartFile file)`
    - `void delete(UUID officeId, UUID productId)`
    - `ImageContent load(UUID imageId)`
    - constantes `MAX_IMAGE_BYTES = 5 * 1024 * 1024`, `JPEG_SIGNATURE = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF}` e `PNG_SIGNATURE = {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n'}`.
  - `ApiException.invalidImage()`: 400, `ErrorMessages.INVALID_IMAGE = "Escolha um arquivo de imagem (JPG ou PNG)."`
  - `ApiException.imageTooLarge()`: 413, `ErrorMessages.IMAGE_TOO_LARGE = "A imagem deve ter até 5 MB."`
- Endpoints:
  - `PUT /api/products/{id}/image` (multipart, `@RequestParam("file") MultipartFile`);
  - `DELETE /api/products/{id}/image` (204);
  - `GET /api/images/{imageId}`: público (adicionar `"/api/images/**"` aos `PUBLIC_PATHS`); responde `ResponseEntity<byte[]>` com o `Content-Type` salvo e `CacheControl.maxAge(Duration.ofDays(365)).cachePublic()`. O cache pode ser longo porque cada upload gera um id novo.

- [ ] **Passo 1: Escrever os testes que falham**

Upload no MockMvcTester: `mvc.put().uri("/api/products/{id}/image", id).multipart().file(new MockMultipartFile("file", "foto.png", "image/png", bytes))`.

| Teste | Requisição | Esperado |
|---|---|---|
| `uploadPngReturnsPublicImageUrl` | PUT com a assinatura PNG + 100 bytes | 200; `$.imageUrl` começa com `/api/images/`. GET nessa URL **sem token** → 200, `Content-Type` `image/png`, corpo igual ao enviado e `Cache-Control` contendo `max-age=31536000`. GET do produto → o mesmo `imageUrl` |
| `uploadReplacesPreviousImage` | segundo upload, agora JPEG | URL nova; GET na URL antiga → 404 |
| `uploadRejectsFileThatIsNotAnImage` | bytes `"hello"` enviados como `image/jpeg` | 400; `$.detail` = `Escolha um arquivo de imagem (JPG ou PNG).` |
| `uploadRejectsFileOver5MB` | 5 MB + 1 byte, começando com a assinatura PNG | 413; `$.detail` = `A imagem deve ter até 5 MB.` |
| `deleteImage` | DELETE `/api/products/{id}/image` | 204; `imageUrl` do produto = null; URL antiga → 404 |
| `imageOfAnotherOfficeCannotBeChanged` | Paula envia uma imagem (200); Marina faz PUT e DELETE na imagem desse produto | 404 nos dois; a URL da imagem da Paula continua → 200 |

O MockMvc não aplica o limite de multipart do servidor. Por isso, o serviço também confere o tamanho, e é essa conferência que o teste cobre. Em produção, o limite do servidor (`spring.servlet.multipart.max-file-size`) dispara `MaxUploadSizeExceededException`, que o handler converte no mesmo 413 com a mesma mensagem.

- [ ] **Passo 2: Rodar e ver falhar**

Rodar: `./mvnw test -Dtest=ProductImageControllerTest`
Esperado: FALHA: status 404 em vez de 200 no upload (a rota de imagem ainda não existe).

- [ ] **Passo 3: Implementar serviço, controller e handler**

`replace`:
1. Busca o produto com `findInOffice` (404).
2. Lê `file.getBytes()`. Se passar de `MAX_IMAGE_BYTES`, lança `imageTooLarge()`.
3. Descobre o tipo pelos primeiros bytes com `detectContentType(byte[]) : Optional<String>` (privado), que devolve `image/jpeg`, `image/png` ou vazio. Se vier vazio, lança `invalidImage()`. O `Content-Type` enviado pelo navegador é ignorado, porque qualquer um pode mentir nele.
4. Chama `deleteByProductId(product.getId())`.
5. Salva `new ProductImage(product.getId(), contentType, data)`.
6. Chama `touch` na lista.
7. Retorna `new ProductImageResponse(ImageUrls.of(image.getId()))`.

`delete`: busca o produto, chama `deleteByProductId` e `touch`.

`load`: `findById(imageId)` vira `ImageContent`, ou lança `notFound()`.

No `GlobalExceptionHandler`, sobrescreva `handleMaxUploadSizeExceededException` para responder 413 com `IMAGE_TOO_LARGE`.

- [ ] **Passo 4: Rodar e ver passar**

Rodar: `./mvnw test -Dtest=ProductImageControllerTest`
Esperado: PASSA.

- [ ] **Passo 5: Verificar, revisar (fluxo de qualidade) e fazer o commit**

```bash
./mvnw verify
git add . && git commit -m "feat: add product images stored in PostgreSQL"
```

---

### Tarefa 12: Link público da lista

**Arquivos:**
- Criar: `dto/PublicListResponse.java`, `dto/ShareTokenResponse.java`, `controller/PublicListController.java`
- Modificar: `repository/ShoppingListRepository.java`, `service/ShoppingListService.java`, `controller/ShoppingListController.java`, `config/SecurityConfig.java`
- Teste: `controller/PublicListControllerTest.java`

**Interfaces:**
- Consome: `OfficeRepository`, `UserRepository.findByOfficeIdOrderByNameAsc`, `SecureTokens.generate`, `ShoppingList.replaceShareToken`, `ProductLinkDto.of`.
- Produz:
  - `ShoppingListRepository.findByShareToken(String shareToken) : Optional<ShoppingList>`.
  - `PublicListResponse(String name, String description, List<PublicRoom> rooms, Signature signature)`, com os records aninhados:
    - `PublicRoom(String name, List<PublicProduct> products)`;
    - `PublicProduct(String name, int quantity, boolean bought, List<ProductLinkDto> links)`;
    - `Signature(String officeName, List<String> architectNames)`.

    A fábrica `static PublicListResponse of(ShoppingList list, Office office, List<User> members)` omite ambientes sem produtos, como a "Visão do cliente" do front. A resposta pública não leva ids, preços nem observações internas.
  - `ShareTokenResponse(String shareToken)`.
  - `ShoppingListService.getPublic(String shareToken) : PublicListResponse` e `ShoppingListService.rotateShareToken(UUID officeId, UUID listId) : ShareTokenResponse`.
- Endpoints:
  - `GET /api/public/lists/{shareToken}`: público (adicionar `"/api/public/**"` aos `PUBLIC_PATHS`);
  - `POST /api/lists/{id}/share-token`: gera um link novo e invalida o antigo.

- [ ] **Passo 1: Escrever os testes que falham**

| Teste | Requisição | Esperado |
|---|---|---|
| `publicListShowsOnlyClientFacingData` | escritório "Fluiar" com Paula e Isabela; lista com "Cozinha" (Batedeira com preço, observações e 2 links) e "Lavanderia" vazia; GET `/api/public/lists/{shareToken}` **sem token** | 200; `$.name` = nome da lista; `$.rooms` só com Cozinha; `$.rooms[0].products[0]` tem `name`, `quantity`, `bought` e `links`, e **não** tem `unitPrice`, `notes` nem `id` (`doesNotHavePath`); `$.signature.officeName` = `Fluiar`; `$.signature.architectNames` = `["Isabela Machado", "Paula Hooper"]` |
| `unknownShareTokenIsNotFound` | token aleatório | 404 |
| `rotateShareTokenInvalidatesOldLink` | POST `/api/lists/{id}/share-token` | 200; `$.shareToken` diferente do antigo; GET público com o antigo → 404; com o novo → 200 |
| `rotateShareTokenOfAnotherOfficeIsNotFound` | Marina faz POST na lista da Paula | 404; o link da Paula continua valendo (GET público com o token dela → 200) |

- [ ] **Passo 2: Rodar e ver falhar**

Rodar: `./mvnw test -Dtest=PublicListControllerTest`
Esperado: FALHA: o GET público recebe 401 em vez de 200 e 404 (a rota ainda não é pública), e o POST do link recebe 404 em vez de 200.

- [ ] **Passo 3: Implementar**

`getPublic`:
1. Busca a lista com `findByShareToken` (404).
2. Carrega o escritório pelo `client.officeId`.
3. Carrega os membros com `findByOfficeIdOrderByNameAsc`.
4. Retorna `PublicListResponse.of(list, office, members)`.

`rotateShareToken`: busca a lista com `findInOffice`, chama `replaceShareToken(SecureTokens.generate())` e devolve o token novo.

- [ ] **Passo 4: Rodar e ver passar**

Rodar: `./mvnw test -Dtest=PublicListControllerTest`
Esperado: PASSA.

- [ ] **Passo 5: Verificar, revisar (fluxo de qualidade) e fazer o commit**

```bash
./mvnw verify
git add . && git commit -m "feat: add public read-only shopping list link"
```

---

### Tarefa 13: Dashboard

**Arquivos:**
- Criar: `dto/DashboardResponse.java`, `service/DashboardService.java`, `controller/DashboardController.java`
- Teste: `controller/DashboardControllerTest.java`

**Interfaces:**
- Consome: `ClientRepository.findSummaries`, `ShoppingListRepository.findSummaries`, `ListSummaryResponse.isCompleted`, `Clock`.
- Produz:
  - `DashboardResponse(long clientCount, long clientsCreatedThisMonth, long listCount, long completedListCount, long listsWithPendingProductsCount, long totalProductCount, long pendingProductCount, List<ClientSummaryResponse> recentClients, List<ListSummaryResponse> recentLists)`.
  - `DashboardService.get(UUID officeId) : DashboardResponse`. Constante `RECENT_LIMIT = 5`.
- Endpoint: `GET /api/dashboard`.

- [ ] **Passo 1: Escrever os testes que falham**

| Teste | Dados | Esperado |
|---|---|---|
| `dashboardSummarizesOffice` | 2 clientes, um deles com `created_at` 40 dias no passado (`update clients set created_at = now() - interval '40 days' where id = ?`); listas: L1 vazia, L2 com 2 produtos (1 comprado), L3 com 1 produto comprado | `clientCount` 2; `clientsCreatedThisMonth` 1; `listCount` 3; `completedListCount` 1; `listsWithPendingProductsCount` 1; `totalProductCount` 3; `pendingProductCount` 1; `recentLists` com 3 itens, o mais recente primeiro |
| `recentItemsAreLimitedToFive` | 6 clientes | `clientCount` 6; `recentClients` com 5 itens |
| `emptyOfficeReturnsZeros` | só a conta | todos os números 0; `recentClients` e `recentLists` vazios |

- [ ] **Passo 2: Rodar e ver falhar**

Rodar: `./mvnw test -Dtest=DashboardControllerTest`
Esperado: FALHA: status 404 em vez de 200 (`/api/dashboard` ainda não existe).

- [ ] **Passo 3: Implementar**

O serviço carrega os dois resumos (uma consulta cada) e calcula os números em Java:
- `completedListCount` usa `isCompleted()`;
- `listsWithPendingProductsCount` conta as listas com `totalProducts > boughtProducts`;
- `clientsCreatedThisMonth` compara `YearMonth.from(createdAt.atZone(clock.getZone()))` com `YearMonth.now(clock)`. O mês é o de São Paulo;
- `recentClients` e `recentLists` são os primeiros `RECENT_LIMIT` itens, que já vêm ordenados por `updatedAt` decrescente.

- [ ] **Passo 4: Rodar e ver passar**

Rodar: `./mvnw test -Dtest=DashboardControllerTest`
Esperado: PASSA.

- [ ] **Passo 5: Verificar, revisar (fluxo de qualidade) e fazer o commit**

```bash
./mvnw verify
git add . && git commit -m "feat: add dashboard summary"
```

---

### Tarefa 14: Verificação final e revisão do backend completo

- [ ] **Passo 1: Rodar todos os testes do zero**

Rodar: `./mvnw clean verify`
Esperado: `BUILD SUCCESS`, sem testes ignorados.

- [ ] **Passo 2: Teste manual de ponta a ponta**

```bash
docker compose up -d
export JWT_SECRET=$(openssl rand -base64 48)
./mvnw spring-boot:run
```

Com `curl` (ou pelo Swagger em `http://localhost:8080/swagger-ui.html`), fazer na ordem:
1. Cadastro.
2. Criar cliente.
3. Criar lista.
4. Criar ambiente.
5. Criar produto com link.
6. Enviar uma imagem e abrir a URL dela no navegador.
7. Abrir `GET /api/public/lists/{shareToken}` sem token.
8. Pedir a recuperação de senha e conferir o e-mail no Mailpit (`http://localhost:8025`).

Esperado: tudo funciona sem erro 500 no log.

- [ ] **Passo 3: Revisão independente do backend inteiro**

Um `code-quality-reviewer` novo revisa `api/` inteiro contra este plano e o `engineering-guide.md`, com os resultados dos Passos 1 e 2. Corrigir todo achado `Critical` ou `Important` e obter re-revisão até `APPROVED`.

- [ ] **Passo 4: Commit final (se houve correções)**

```bash
git add . && git commit -m "chore: address final backend review findings"
```

---

## Impacto no frontend

Mudanças que o Next.js vai precisar para usar esta API. Não fazem parte deste plano. Quando forem feitas, seguir a skill `code-quality-next-js`.

- **Configuração e sessão.**
  - Variável `NEXT_PUBLIC_API_URL`.
  - Guardar o `accessToken` e enviá-lo como `Authorization: Bearer` em todas as chamadas, **exceto** `/api/auth/**`. Um token inválido nessas rotas faria o Spring Security responder 401.
  - Qualquer 401 manda para `/login`.
  - "Manter conectada" envia `rememberMe`.
- **Dados.**
  - Trocar `lib/data.js` pelas chamadas da tabela "Contrato da API".
  - Datas chegam em ISO-8601 e o front formata ("Hoje, 14:20", "Ontem", "27 out").
  - Telefone chega só com dígitos; mostrar com `maskPhone`.
  - Usar o campo `completed` no lugar de `bought === total` (lista vazia não é "Concluída").
- **Ambientes.**
  - O formulário de produto usa os ambientes da lista (`rooms[].id`), não mais `ROOM_NAMES`.
  - Falta UI para criar, renomear, ordenar e excluir ambientes.
- **Produto.**
  - Enviar só as linhas de link preenchidas.
  - A imagem é enviada depois de salvar o produto (PUT multipart).
  - Exibir com `NEXT_PUBLIC_API_URL + imageUrl`.
- **Configurações.**
  - A troca de e-mail é imediata, mas exige a senha atual; enviar `currentPassword` no `PUT /api/me` quando o e-mail mudar (o protótipo já mostra o campo).
  - Um 429 mostra o `detail` no toast.
  - A troca de senha devolve um token novo, que substitui o guardado.
- **Telas novas.**
  - Escritório: membros, convites e renomear.
  - `/convite?token=`: aceitar convite.
  - Página pública `/l/[shareToken]`: reaproveita `ClientView` e a assinatura vinda da API.
  - Botões "Copiar link" e "Gerar novo link" na lista.
- **Telas existentes.**
  - `/nova-senha?token=` lê o token e busca o e-mail da conta.
  - `ListSignature` passa a usar `signature` da API.
  - Remover `ProtoNav`.

---

## Fora do escopo e riscos aceitos

- **Proteção contra força bruta além do limite em memória**: o limite é por e-mail ou por conta e vale para cada instância da API. Ataques espalhados por muitos e-mails (credential stuffing) ou por várias instâncias pedem um limite na infraestrutura (proxy, Cloudflare, AWS WAF). Quem sabe um e-mail consegue bloquear o login dessa pessoa por até 15 minutos (risco aceito). Enquanto a capacidade estiver esgotada, chaves novas recebem 429; sem novas admissões, as entradas vencem em 15 minutos e são removidas na próxima requisição após o intervalo de limpeza (até 1 minuto adicional).
- Envio do link da lista por e-mail ao cliente e confirmação da troca de e-mail por link (decisão do usuário).
- Remover membros, papéis e permissões no escritório; mover uma conta para outro escritório.
- Excluir a própria conta.
- Trava otimista: duas pessoas editando o mesmo produto ao mesmo tempo, a última vence.
- Paginação de clientes e listas (rever se um escritório passar de ~1000 itens).
- Refresh token e logout no servidor. O "Sair" só apaga o token no navegador; a troca de senha revoga todos.
- Pipeline de CI, imagem de produção e deploy. Para gerar uma imagem, `./mvnw spring-boot:build-image` funciona sem Dockerfile.
- Atualização em tempo real entre colegas (é preciso recarregar a página).
