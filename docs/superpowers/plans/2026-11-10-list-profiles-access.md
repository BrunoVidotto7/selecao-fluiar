# Perfis por lista e controle interno — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uma lista passa a ter um perfil principal (sempre editor) e outros perfis como leitor ou editor; cada editor tem a sua observação por produto; todos os perfis veem preços e notas internas; a lista ganha seis campos de controle interno; "Cliente" vira "Perfil" em todo texto visível.

**Architecture:** Duas tabelas novas: `list_members` (acesso por lista) e `product_client_notes` (uma observação por perfil e produto, que também guarda a revisão para os avisos). O principal continua em `shopping_lists.client_id`. `ShoppingList.roleOf(clientId)` é a única regra de acesso do perfil, usada por `ListAccessPolicy`, pelas leituras e pelas escritas do perfil. Os campos internos são um `@Embeddable ProjectInfo` em `shopping_lists`. Na UI, o formulário da lista grava acesso e controle interno juntos; as rotas `/clientes` viram `/perfis`.

**Tech Stack:** Java 25 / Spring Boot 4.1 / PostgreSQL 18 / Flyway / Testcontainers; Next.js 15 / React 19 / Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-10-list-profiles-access-design.md` (leia junto; este plano argumenta a partir dele).

## Global Constraints

- Texto visível em português do Brasil e sempre "perfil/perfis", nunca "cliente". Código, JSON, tabelas e caminhos da API continuam `client` (decisão do spec). Conta `CLIENT` não muda.
- Perfil principal: sempre editor. Outros perfis: `EDITOR` ou `READER`; padrão ao adicionar na UI: Leitor.
- Leitor: vê tudo que o editor vê (inclusive `unitPrice` e `notes` do produto); não marca comprado nem grava observação. Escrita de leitor → 403 com `detail` "Você só pode visualizar esta lista.".
- Perfil nunca recebe: campos de controle interno, `members`, níveis de acesso, `shareToken`, `clientChanges`.
- Lista de outro escritório ou sem acesso → 404. Perfil de outro escritório no corpo da lista → 400 no campo `members`.
- Controle interno, todos opcionais: `projectCode` (até 40), `contract` (até 120), `contractorName` (até 120), `contractorDocument` (CPF 11 dígitos ou CNPJ 14 caracteres, numérico ou alfanumérico, guardado sem pontuação e em maiúsculas), `siteZipCode` (8 dígitos, guardado sem traço), `siteAddress` (até 300).
- Mensagens exatas, iguais em `ErrorMessages.java` e `ui/nextjs/lib/validation.js`: CEP "Digite o CEP com 8 números, como 30140-071."; documento "Digite um CPF ou CNPJ válido."; principal obrigatório "Escolha o perfil principal desta lista."; perfil repetido "Cada perfil pode aparecer só uma vez."; perfil fora do escritório "Escolha um perfil do escritório."; leitor "Você só pode visualizar esta lista.".
- A arquiteta lê e exclui observações de perfis; não edita. Excluir não gera aviso e some com o aviso pendente.
- Tirar o acesso (ou deixar de ser principal sem virar outro perfil) apaga as observações do perfil naquela lista. Quem vira principal sai de `members`.
- Escritas de acesso e observação travam a lista antes (`ShoppingListRepository.findInOfficeForUpdate` e variantes).
- Sem dependências novas. Migração nova `V12__add_list_profiles.sql`; nunca editar migrações aplicadas.
- Processo (`AGENTS.md`): TDD, KISS, sem mudanças não relacionadas. **Commits só com autorização do usuário.** Mensagem: uma frase curta no imperativo terminada em ponto, com o trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `git status` antes de `git add`.
- Comandos: API em `api/` com `./mvnw`; UI em `ui/nextjs/` com `npm`. Antes de terminar: `./mvnw verify`, `npm test && npm run lint`, `npm run build` (rotas mudam).

## Review Focus

1. **O principal também aparece em `members` no corpo**: é descartado em silêncio, sem 400 e sem linha em `list_members`. Teste na Task 3.
2. **Trocar o principal por quem já era outro perfil**: ele sai de `members` e mantém as observações; o antigo principal perde acesso e as observações. Teste na Task 3.
3. **Leitor abre o link compartilhado e a foto do produto**: `/api/public/lists/{token}` e a imagem respondem 200. Teste na Task 4.
4. **Mesmo editor salva a observação duas vezes seguidas**: continua uma linha só em `product_client_notes`, e repetir o mesmo texto não gera aviso. Teste na Task 4.
5. **Perfil excluído na tela de perfis que era outro perfil de uma lista**: a lista continua, sem ele em `members`, e o aviso de compra feito por ele continua aparecendo sem nome (autor nulo, sem erro). Teste na Task 6.

---

### Task 1: Migração e entidades

**Files:**
- Create: `api/src/main/resources/db/migration/V12__add_list_profiles.sql`
- Create: `api/src/main/java/br/com/fluiar/selecao/model/ListRole.java`, `ListMember.java`, `ProductClientNote.java`, `ProjectInfo.java`
- Create: `api/src/main/java/br/com/fluiar/selecao/repository/ListMemberRepository.java`, `ProductClientNoteRepository.java`
- Modify: `model/ShoppingList.java`, `model/Product.java`, `model/ProductClientChanges.java`
- Test: `api/src/test/java/br/com/fluiar/selecao/repository/ListProfilesMigrationTest.java`

**Interfaces:**
- Produces:
  - `enum ListRole { EDITOR, READER }`
  - `ListMember(ShoppingList list, Client client, ListRole role)`; `getClient()`, `getRole()`, `changeRole(ListRole)`.
  - `ProjectInfo` (`@Embeddable` record): `projectCode, contract, contractorName, contractorDocument, siteZipCode, siteAddress`; constantes `PROJECT_CODE_MAX_LENGTH = 40`, `CONTRACT_MAX_LENGTH = 120`, `CONTRACTOR_NAME_MAX_LENGTH = 120`, `SITE_ADDRESS_MAX_LENGTH = 300`; `ProjectInfo.EMPTY`.
  - `ShoppingList`: `ShoppingList(Client, String name, String description, String shareToken, ProjectInfo)`; `update(String name, String description, Client client, ProjectInfo info)`; `getProjectInfo()` (nunca null: Hibernate devolve null quando as seis colunas são null, então retorne `ProjectInfo.EMPTY`); `List<ListMember> getMembers()`; `Optional<ListRole> roleOf(UUID clientId)` (`EDITOR` para o principal, o `role` do membro, vazio para os demais); `Set<UUID> replaceMembers(Map<Client, ListRole> wanted)` que remove quem saiu, troca o nível de quem ficou, adiciona quem entrou (compare por `client.getId()`; nunca remova e readicione o mesmo perfil, porque o Hibernate insere antes de apagar e quebraria o unique) e devolve os ids removidos.
  - `ProductClientNote(Product product, Client client)`; `getClient()`, `getText()`, `getRevision()`, `getChangedAt()`, `getUpdatedAt()`; `void change(String text, long revision, Instant changedAt)`. Quem chama compara o texto antes, para não gastar revisão quando nada mudou.
  - `Product`: remove `clientNotes` (String), `getClientNotes()`, `changeClientNotes`, `recordClientNotes`; ganha `@OneToMany(mappedBy = "product") @OrderBy("updatedAt") List<ProductClientNote> clientNotes` com `getClientNotes()`; `recordClientPurchase(long revision, Instant changedAt, boolean value, Client author)`.
  - `ProductClientChanges`: remove os campos de observação; ganha `@ManyToOne(fetch = LAZY) @JoinColumn(name = "client_purchase_client_id") Client clientPurchaseClient` com `getPurchaseAuthor()`.
  - `ListMemberRepository extends JpaRepository<ListMember, UUID>`.
  - `ProductClientNoteRepository extends JpaRepository<ProductClientNote, UUID>`: `Optional<ProductClientNote> findByProductIdAndClientId(UUID productId, UUID clientId)`; `@Modifying int deleteInList(UUID listId, Collection<UUID> clientIds)`; `@Modifying int deleteInOffice(UUID productId, UUID clientId, UUID officeId)`.

- [ ] **Step 1: Teste da migração.** Em `ListProfilesMigrationTest`, copie o padrão de `ProductCategoryMigrationTest.existingProductsMoveToOutros`: migre um schema separado `migration_check` até `target("11")`, semeie por `jdbc` um escritório, um perfil, uma lista, um ambiente e um produto com `client_notes = 'Prefiro preto'`, `client_notes_revision = 3`, `client_notes_changed_at = now()`, `client_purchase_revision = 2`, `client_purchase_changed_at = now()`, `client_purchase_value = true`, e um segundo produto sem observação e sem revisão; depois migre até o fim e verifique:
  - `product_client_notes` tem uma linha com `client_id` = principal da lista, `text = 'Prefiro preto'`, `revision = 3`.
  - `products.client_purchase_client_id` = principal.
  - produto sem observação e sem revisão não gera linha.
  - `list_members` existe com unique `(list_id, client_id)`; inserir duas vezes o mesmo par falha.
- [ ] **Step 2:** `./mvnw test -Dtest=ListProfilesMigrationTest`. Esperado: FAIL (tabela ausente).
- [ ] **Step 3: Escreva `V12__add_list_profiles.sql`:**
  - `list_members (id uuid pk, list_id → shopping_lists on delete cascade, client_id → clients on delete cascade, role varchar(16) not null check in ('EDITOR','READER'), created_at timestamptz not null, unique (list_id, client_id))` + índice em `client_id`.
  - `product_client_notes (id uuid pk, product_id → products on delete cascade, client_id → clients on delete cascade, text varchar(1000), revision bigint not null default 0 check >= 0, changed_at timestamptz, updated_at timestamptz not null, unique (product_id, client_id), check ((revision = 0 and changed_at is null) or (revision > 0 and changed_at is not null)))` + índice em `client_id`. `text` null com revisão > 0 significa "observação removida" pendente.
  - Copia: `insert ... select gen_random_uuid(), p.id, l.client_id, p.client_notes, p.client_notes_revision, p.client_notes_changed_at, p.updated_at from products p join rooms r ... join shopping_lists l ... where p.client_notes is not null or p.client_notes_revision > 0`.
  - `products`: adiciona `client_purchase_client_id uuid references clients(id) on delete set null`, preenche com o principal onde `client_purchase_revision > 0`; remove `ck_client_notes_change`, `client_notes`, `client_notes_revision`, `client_notes_changed_at`, `client_notes_value`.
  - `shopping_lists`: `project_code varchar(40)`, `contract varchar(120)`, `contractor_name varchar(120)`, `contractor_document varchar(14)`, `site_zip_code varchar(8)`, `site_address varchar(300)`, todos null.
- [ ] **Step 4:** Crie/ajuste as entidades e repositórios acima. Deixe compilando os chamadores atuais de `getClientNotes`/`changeClientNotes` com o mínimo (as Tasks 4 e 5 os reescrevem); o `ddl-auto: validate` precisa passar.
- [ ] **Step 5:** `./mvnw test -Dtest='ListProfilesMigrationTest,ClientAccountSchemaTest,ProductTest'`. Esperado: PASS.
- [ ] **Step 6:** Commit (com autorização): `Add list members, per-profile notes and project info tables.`

### Task 2: Validação do controle interno e mensagens

**Files:**
- Create: `api/src/main/java/br/com/fluiar/selecao/dto/ValidTaxDocument.java` (anotação + validador interno, no estilo de `ValidPassword`)
- Modify: `dto/Inputs.java`, `exception/ErrorMessages.java`
- Test: `api/src/test/java/br/com/fluiar/selecao/dto/ValidTaxDocumentTest.java`

**Interfaces:**
- Produces:
  - `Inputs.compactCode(String)`: `strip`, remove espaços, `.`, `-` e `/`, maiúsculas; vazio → null.
  - `@ValidTaxDocument` (aceita null) e `static boolean ValidTaxDocument.Validator.isValid(String compact)`.
  - `ErrorMessages.ZIP_CODE_INVALID`, `TAX_DOCUMENT_INVALID`, `LIST_MEMBER_DUPLICATED`, `LIST_MEMBER_NOT_IN_OFFICE`, `LIST_READ_ONLY` com os textos do Global Constraints; `LIST_CLIENT_REQUIRED` passa a "Escolha o perfil principal desta lista."; `CLIENT_ALREADY_ACTIVE` passa a "Este perfil já tem acesso ativo."; `INVITATION_EMAIL_IN_USE` passa a "Este e-mail já tem um convite para outro perfil.".
  - `ApiException.forbidden(String message)` (403, `detail` = mensagem).

- [ ] **Step 1: Teste.** `ValidTaxDocumentTest` com `isValid`:
  - válidos: `52998224725` (CPF), `11222333000181` (CNPJ), `12ABC34501DE35` (CNPJ alfanumérico, exemplo oficial da Receita).
  - inválidos: `52998224724`, `11111111111`, `11222333000180`, `12ABC34501DE36`, `00000000000000`, `1234567890` (10), `12ABC3450IDE35` (letra na posição de dígito verificador não é aceita: os dois últimos são sempre dígitos).
  - `Inputs.compactCode(" 12.abc.345/01de-35 ")` → `"12ABC34501DE35"`; `Inputs.compactCode("  ")` → null.
- [ ] **Step 2:** `./mvnw test -Dtest=ValidTaxDocumentTest`. Esperado: FAIL.
- [ ] **Step 3: Implemente.** CPF: 11 dígitos, não todos iguais, dois dígitos verificadores módulo 11 (pesos 10..2 e 11..2). CNPJ: 14 caracteres, os 12 primeiros `[0-9A-Z]`, os 2 últimos `[0-9]`, não todos iguais; valor de cada caractere = código ASCII − 48 (`'0'`→0, `'A'`→17); pesos da direita para a esquerda 2..9 repetindo; resto = soma % 11; dígito = resto < 2 ? 0 : 11 − resto; calcule o 13º sobre os 12 primeiros e o 14º sobre os 13.
- [ ] **Step 4:** `./mvnw test -Dtest=ValidTaxDocumentTest`. Esperado: PASS.
- [ ] **Step 5:** Commit (com autorização): `Validate CPF and CNPJ for list project info.`

### Task 3: API da arquiteta — acesso e controle interno na lista

**Files:**
- Create: `dto/ListMemberRequest.java`, `dto/ListMemberResponse.java`
- Modify: `dto/ShoppingListRequest.java`, `dto/ListDetailResponse.java`, `service/ShoppingListService.java`
- Test: `api/src/test/java/br/com/fluiar/selecao/controller/ShoppingListControllerTest.java`

**Interfaces:**
- Consumes: Task 1 (`replaceMembers`, `ProjectInfo`, `ProductClientNoteRepository.deleteInList`), Task 2 (`compactCode`, `@ValidTaxDocument`, mensagens).
- Produces:
  - `ListMemberRequest(@NotNull UUID clientId, @NotNull ListRole role)`.
  - `ShoppingListRequest(name, description, clientId, @Valid List<ListMemberRequest> members, projectCode, contract, contractorName, contractorDocument, siteZipCode, siteAddress)`: `members` null → `List.of()`; textos com `Inputs.optionalText`; `contractorDocument` e `siteZipCode` com `Inputs.compactCode`; `@Size` pelos limites de `ProjectInfo`; `siteZipCode` com `@Pattern(regexp = "^\\d{8}$", message = ZIP_CODE_INVALID)`; `contractorDocument` com `@ValidTaxDocument`. `ProjectInfo projectInfo()` monta o embeddable.
  - `ListMemberResponse(UUID clientId, String clientName, ListRole role)`, ordenado por nome.
  - `ListDetailResponse` ganha, no fim: `List<ListMemberResponse> members, String projectCode, String contract, String contractorName, String contractorDocument, String siteZipCode, String siteAddress`.

- [ ] **Step 1: Testes** em `ShoppingListControllerTest`:
  - `createsListWithMembersAndProjectInfo`: POST com dois perfis (`EDITOR`, `READER`) e os seis campos (`"30140-071"`, `"12.abc.345/01de-35"`) → 201; resposta com `members` ordenados por nome e `siteZipCode = "30140071"`, `contractorDocument = "12ABC34501DE35"`.
  - `updateReplacesMembers`: PUT trocando o nível de um, removendo outro e adicionando um terceiro → `members` exatamente o novo conjunto.
  - `principalInMembersIsIgnored` (Review Focus 1).
  - `promotingMemberToPrincipalKeepsTheirNotes` (Review Focus 2): perfil B é editor com observação; PUT com B como `clientId` e sem A em `members` → B fora de `members`, observação de B mantida, observação de A apagada.
  - `removingMemberDeletesTheirNotes`.
  - `rejectsDuplicateMember` → 400 `errors.members` = "Cada perfil pode aparecer só uma vez.".
  - `rejectsMemberFromAnotherOffice` → 400 `errors.members` = "Escolha um perfil do escritório.".
  - `rejectsInvalidZipAndDocument` → 400 com as duas mensagens; valores vazios → 201 com campos null.
  - `rejectsTooLongProjectFields` (41, 121, 121, 301).
- [ ] **Step 2:** `./mvnw test -Dtest=ShoppingListControllerTest`. Esperado: FAIL nos novos.
- [ ] **Step 3: Implemente** em `ShoppingListService.create/update`: carregar cada perfil com `clientRepository.findByIdAndOfficeId` (ausente → 400 `members`); repetido → 400 `members`; descartar o principal; sob a trava da lista, `replaceMembers`; apagar observações (`deleteInList`) dos ids removidos e do antigo principal quando ele não ficou em `members`; `list.update(..., request.projectInfo())`.
- [ ] **Step 4:** `./mvnw test -Dtest=ShoppingListControllerTest`. Esperado: PASS.
- [ ] **Step 5:** Commit (com autorização): `Let architects add profiles and project info to a list.`

### Task 4: API do perfil — acesso por papel, preços e observação própria

**Files:**
- Create: `dto/ClientNoteResponse.java`
- Modify: `security/ListAccessPolicy.java`, `service/ListAccessService.java`, `service/ProductImageService.java`, `service/ClientShoppingListService.java`, `dto/ClientListDetailResponse.java`, `repository/ShoppingListRepository.java` (`findClientSummaries`)
- Test: `controller/ClientShoppingListControllerTest.java`, `controller/PublicListControllerTest.java`, `controller/ProductImageControllerTest.java`

**Interfaces:**
- Consumes: `ShoppingList.roleOf`, `ProductClientNote`, `ProductClientNoteRepository.findByProductIdAndClientId`, `ApiException.forbidden`, `ErrorMessages.LIST_READ_ONLY`.
- Produces:
  - `ListAccessPolicy.permits(User user, ShoppingList list)`: mesmo escritório e (`ADMIN` ou `list.roleOf(user.getClientId()).isPresent()`). Remove a versão com `Client`.
  - `ClientNoteResponse(UUID clientId, String clientName, String text, Instant updatedAt)`; `static List<ClientNoteResponse> of(Product)` só com `text != null`.
  - `ClientListDetailResponse` ganha `UUID clientId` (o perfil que lê) e `boolean canEdit`; `ClientProduct` ganha `BigDecimal unitPrice`, `String notes`, e `clientNotes` vira `List<ClientNoteResponse>`. `of(ShoppingList, Office, List<User>, UUID clientId)` calcula `canEdit = roleOf(clientId) == EDITOR`; `ClientProduct.of(Product)`.
  - `findClientSummaries(officeId, clientId)`: listas em que o perfil é principal **ou** está em `list_members`.

- [ ] **Step 1: Testes.** Ajuste os que afirmavam a ausência de `notes`/`unitPrice` (agora presentes) e os que liam `clientNotes` como texto. Novos:
  - `memberListsAppearForEditorAndReader`; `readerSeesPricesAndInternalNotesButCannotEdit`: `canEdit = false`, PATCH e PUT de observação → 403 `detail` "Você só pode visualizar esta lista."; editor → `canEdit = true`.
  - `responseHidesProjectInfoAndMembers`: sem `members`, `projectCode`, `contractorDocument`, `shareToken`, `clientChanges`.
  - `eachEditorHasOwnNote`: A e B salvam; `clientNotes` tem duas entradas com `clientName`; B salvar não muda a de A.
  - `savingSameNoteTwiceKeepsOneRowAndNoNewRevision` (Review Focus 4).
  - `removedMemberGets404` (perfil retirado da lista → leitura e escrita 404).
  - `PublicListControllerTest.readerResolvesShareLink` e `ProductImageControllerTest.readerLoadsImage` (Review Focus 3).
- [ ] **Step 2:** `./mvnw test -Dtest='ClientShoppingListControllerTest,PublicListControllerTest,ProductImageControllerTest'`. Esperado: FAIL nos novos.
- [ ] **Step 3: Implemente.** Leitura: `roleOf` vazio → 404. Escrita: trava a lista, `roleOf` vazio → 404, `READER` → 403. `setPurchase` passa o `Client` autor para `recordClientPurchase`. `setClientNotes`: busca a `ProductClientNote` do perfil; se o texto pedido é igual ao atual (null quando não há linha), não faz nada; senão cria a linha quando falta e chama `change(text, list.nextClientChangeRevision(), clock.instant())`. Quando o texto vira null a linha fica (é o aviso "observação removida").
- [ ] **Step 4:** Mesmo comando. Esperado: PASS.
- [ ] **Step 5:** Commit (com autorização): `Give list profiles reader or editor access with their own notes.`

### Task 5: API da arquiteta — ler e excluir observações

**Files:**
- Modify: `dto/ProductResponse.java`, `controller/ProductController.java`, `service/ProductService.java`
- Test: `controller/ProductControllerTest.java`

**Interfaces:**
- Consumes: `ClientNoteResponse.of(Product)`, `ProductClientNoteRepository.deleteInOffice`.
- Produces: `ProductResponse.clientNotes` vira `List<ClientNoteResponse>`; remove `PUT /api/products/{productId}/client-notes`; adiciona `DELETE /api/products/{productId}/client-notes/{clientId}` → 204; `ProductService.deleteClientNote(UUID officeId, UUID productId, UUID clientId)` trava a lista do produto antes.

- [ ] **Step 1: Testes:** `adminSeesAllProfileNotesWithNames`; `adminDeletesProfileNote` (204, some da resposta, aviso pendente some do `clientChanges`); `deleteNoteOfAnotherOffice404`; `deleteMissingNote404`; `putClientNotesNoLongerExists` (405 ou 404, o que o Spring devolver; afirme que não é 2xx).
- [ ] **Step 2:** `./mvnw test -Dtest=ProductControllerTest`. Esperado: FAIL.
- [ ] **Step 3:** Implemente.
- [ ] **Step 4:** Mesmo comando. Esperado: PASS.
- [ ] **Step 5:** Commit (com autorização): `Let architects read and delete profile notes.`

### Task 6: Avisos com o perfil autor

**Files:**
- Modify: `dto/ClientChangesResponse.java`, `dto/ClientChangeSummaryResponse.java`, `service/ClientChangeService.java`, `repository/ClientChangeRepository.java`
- Test: `controller/ClientChangeControllerTest.java`, `repository/ClientChangeRepositoryTest.java`

**Interfaces:**
- Produces:
  - `ChangedProduct(UUID productId, PurchaseChange purchase, List<NotesChange> notes)` com `notes` omitido quando vazio (`NON_EMPTY`).
  - `PurchaseChange(long revision, Instant changedAt, boolean value, UUID clientId, String clientName)` (autor pode ser null).
  - `NotesChange(UUID clientId, String clientName, long revision, Instant changedAt, String value)` (`value` null = removida).
  - `ClientChangeSummaryResponse` ganha no fim `List<String> authorNames` (distintos, ordem alfabética, sem null).
- [ ] **Step 1: Testes:** duas observações pendentes de A e B no mesmo produto → `changedProductCount = 1`, `notesChangedCount = 2`, `authorNames = [A, B]`; compra marcada por B → `purchase.clientName = B`; observação removida por A → `notesRemovedCount = 1`; `markRead` zera tudo; perfil autor excluído → aviso de compra continua com `clientName` null (Review Focus 5) e a lista continua sem ele em `members`.
- [ ] **Step 2:** `./mvnw test -Dtest='ClientChangeControllerTest,ClientChangeRepositoryTest'`. Esperado: FAIL.
- [ ] **Step 3:** Reescreva `PENDING_SQL` como união de linhas de compra (`products`, autor `client_purchase_client_id`) e linhas de observação (`product_client_notes`), cada uma com `product_id`, tipo, valor, data e nome do autor; os contadores usam `count(distinct product_id)` e `count(*) filter (...)` por tipo; `authorNames` por `array_agg(distinct author_name) filter (where author_name is not null)`. `changesFor` lê `getClientChanges()` para compra e `getClientNotes()` com `revision > seen` para observações.
- [ ] **Step 4:** Mesmo comando. Esperado: PASS.
- [ ] **Step 5:** Commit (com autorização): `Show which profile made each change.`

### Task 7: API da página do perfil

**Files:**
- Create: `dto/ClientMemberListResponse.java`
- Modify: `dto/ClientDetailResponse.java`, `service/ClientService.java`, `repository/ListMemberRepository.java`
- Test: `controller/ClientControllerTest.java`

**Interfaces:**
- Produces: `ClientMemberListResponse(UUID id, String name, ListRole role)`; `ListMemberRepository.findMemberLists(UUID clientId, UUID officeId)` ordenado por nome da lista; `ClientDetailResponse` ganha no fim `List<ClientMemberListResponse> memberLists`.
- [ ] **Step 1: Teste:** perfil principal de uma lista e leitor em outra → `lists` tem a primeira, `memberLists` tem a segunda com `role = READER`; excluir esse perfil apaga a primeira lista e mantém a segunda.
- [ ] **Step 2:** `./mvnw test -Dtest=ClientControllerTest`. Esperado: FAIL.
- [ ] **Step 3:** Implemente.
- [ ] **Step 4:** `./mvnw verify`. Esperado: PASS (suíte toda da API).
- [ ] **Step 5:** Commit (com autorização): `Show the lists a profile was added to.`

### Task 8: UI — "Cliente" vira "Perfil" e rotas `/perfis`

**Files:**
- Move: `ui/nextjs/app/(app)/(admin)/clientes/` → `ui/nextjs/app/(app)/(admin)/perfis/`
- Modify: `ui/nextjs/next.config.mjs` (ou o arquivo existente) com `redirects()` permanentes `/clientes` → `/perfis` e `/clientes/:path*` → `/perfis/:path*`
- Modify: todos os arquivos que `grep -rln "[Cc]liente\|/clientes" ui/nextjs/app ui/nextjs/components ui/nextjs/lib ui/nextjs/test-support` encontrar, e os textos de `ErrorMessages` já trocados na Task 2 refletidos em `lib/validation.js`
- Modify docs: `README.md`, `AGENTS.md`, `ui/AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md` onde citam `/clientes`

**Interfaces:**
- Produces: rotas `/perfis`, `/perfis/novo`, `/perfis/[id]`, `/perfis/[id]/editar`. Nomes de componentes, pastas `components/clientes` e identificadores continuam iguais.

- [ ] **Step 1:** Atualize primeiro as expectativas dos testes (textos e `href`).
- [ ] **Step 2:** `npx vitest run`. Esperado: FAIL nos alterados.
- [ ] **Step 3:** `git mv` da pasta, troca de textos ("Clientes" → "Perfis", "cliente" → "perfil", "Ver como cliente" → "Ver como perfil", "Visão do cliente" → "Visão do perfil", "Alterações dos clientes" → "Alterações dos perfis", "Observação do cliente" → "Observação"), redirects.
- [ ] **Step 4:** `npm test && npm run lint`. Esperado: PASS. `grep -rn "[Cc]liente" ui/nextjs/app ui/nextjs/components ui/nextjs/lib` só pode achar nomes de código (não texto visível) — revise cada ocorrência.
- [ ] **Step 5:** Commit (com autorização): `Call clients profiles in the interface.`

### Task 9: UI — formulário da lista com perfis e controle interno

**Files:**
- Modify: `ui/nextjs/components/listas/Listas.js` (`ListForm`), `components/listas/actions.js` (`saveList`/`listBody`), `lib/validation.js`, `components/lista/ShoppingList.js` (bloco só de leitura de controle interno), `test-support/fixtures.js`
- Create: `ui/nextjs/components/listas/ListMembersField.js`
- Test: `components/listas/Listas.test.js`, `components/listas/actions.test.js`, `lib/validation.test.js`, `components/lista/ShoppingList.test.js`

**Interfaces:**
- Consumes: `ListDetailResponse.members` e os seis campos (Task 3).
- Produces:
  - `validation.js`: regras `zipCode: true` e `taxDocument: true` em `validateField`, mesmas mensagens e mesmo algoritmo da Task 2 (`validateTaxDocument(value)` exportado); constantes de tamanho 40/120/120/300.
  - `ListMembersField({ clients, principalId, value, onChange })`: `value` é `[{ clientId, role }]`; esconde o principal e os já escolhidos do seletor; nível padrão `READER`; rótulos "Leitor" / "Editor"; botão "Adicionar" e "Remover {nome}".
  - `saveList(id, input)` aceita e envia `members` e os seis campos (strings ou null), validando os tipos como hoje.
- [ ] **Step 1: Testes:** adicionar perfil (padrão Leitor), trocar para Editor, remover; principal não aparece como opção; trocar o principal para quem estava em outros perfis o tira de lá; CEP "3014-071" mostra "Digite o CEP com 8 números, como 30140-071."; documento "529.982.247-24" mostra "Digite um CPF ou CNPJ válido."; "12.ABC.345/01DE-35" aceito; erro `errors.members` da API aparece sob a área de perfis; bloco "Controle interno" aparece na página da lista só com os campos preenchidos.
- [ ] **Step 2:** `npx vitest run components/listas lib/validation.test.js components/lista/ShoppingList.test.js`. Esperado: FAIL.
- [ ] **Step 3:** Implemente com `useApiForm` + `Fields.js` (copie o padrão de `ClientForm`); `fieldMap` para os novos campos; textos: "Outros perfis com acesso", "Perfil principal (sempre editor)", "Controle interno", "Código do projeto", "Contrato", "Contratante", "CPF ou CNPJ do contratante", "CEP da obra", "Endereço da obra", todos os internos com `optional`.
- [ ] **Step 4:** Mesmo comando. Esperado: PASS.
- [ ] **Step 5:** Commit (com autorização): `Add profiles and project info to the list form.`

### Task 10: UI da arquiteta — observações por perfil e avisos com autor

**Files:**
- Create: `ui/nextjs/components/lista/ProfileNotes.js`
- Modify: `components/lista/RoomTable.js`, `components/lista/ShoppingList.js`, `components/lista/ClientView.js`, `components/lista/PrintSheet.js`, `components/produtos/ProductForm.js` (mostra `ProfileNotes` com exclusão na edição do produto), `components/produtos/actions.js` (troca `saveProductClientNotes` por `deleteProductClientNote`), `components/client-changes/ClientChangeDetails.js`, `components/client-changes/ClientChangesPanel.js`
- Test: os `*.test.js` desses arquivos

**Interfaces:**
- Consumes: `ProductResponse.clientNotes: [{ clientId, clientName, text, updatedAt }]`, `DELETE /api/products/{productId}/client-notes/{clientId}`, formatos da Task 6.
- Produces:
  - `deleteProductClientNote(listId, productId, clientId)` (Server Action, valida UUIDs e produto na lista como as vizinhas).
  - `ProfileNotes({ notes, productName, onDelete })`: lista "{clientName}: {text}"; com `onDelete`, botão "Excluir observação de {clientName}" com `useConfirm()`; sem `onDelete`, só leitura. Reutilizado nas Tasks 10 e 11.
- [ ] **Step 1: Testes:** RoomTable e a edição de produto (`ProductForm`) mostram as observações com nome, com botão de excluir e sem campo de edição; excluir pede confirmação e chama a action; ClientChangeDetails mostra "Alterado por {nome}" (sem nome: "Alterado por um perfil"), uma linha por observação; ClientChangesPanel mostra "Por {nomes}"; ClientView (visão do perfil) mostra preço e notas internas e as observações; PrintSheet lista "{nome}: {texto}".
- [ ] **Step 2:** `npx vitest run components/lista components/client-changes components/produtos`. Esperado: FAIL.
- [ ] **Step 3:** Implemente; remova o uso de `ProductClientNotesEditor` do `RoomTable`.
- [ ] **Step 4:** Mesmo comando. Esperado: PASS.
- [ ] **Step 5:** Commit (com autorização): `Show profile notes to architects and let them delete notes.`

### Task 11: UI do perfil — leitor, editor e observações

**Files:**
- Modify: `components/client-shopping/ClientShoppingList.js`, `components/lista/ProductClientNotesEditor.js`, `test-support/fixtures.js`
- Test: `components/client-shopping/ClientShoppingList.test.js`, `components/lista/ProductClientNotesEditor.test.js`

**Interfaces:**
- Consumes: `ClientListDetailResponse.clientId`, `canEdit`, `ClientProduct.unitPrice`, `notes`, `clientNotes` (lista), `ProfileNotes` (Task 10).
- Produces: `ProductClientNotesEditor({ productId, productName, clientId, clientNotes, onSave })`: `clientNotes` é o texto próprio; após salvar lê `result.data.clientNotes.find((n) => n.clientId === clientId)?.text ?? ''`.
- [ ] **Step 1: Testes:** `canEdit = false` → sem checkbox de comprado (mostra o mesmo indicador de `ClientView`) e sem editor; observações dos outros aparecem só leitura; `canEdit = true` → editor com o próprio texto, as dos outros abaixo; preço (`brl`) e notas internas aparecem para ambos.
- [ ] **Step 2:** `npx vitest run components/client-shopping components/lista/ProductClientNotesEditor.test.js`. Esperado: FAIL.
- [ ] **Step 3:** Implemente.
- [ ] **Step 4:** Mesmo comando. Esperado: PASS.
- [ ] **Step 5:** Commit (com autorização): `Let profiles read or edit a list by their access level.`

### Task 12: UI da página do perfil e verificação final

**Files:**
- Modify: `components/clientes/Clientes.js` (detalhe), `app/(app)/(admin)/perfis/[id]/page.js` se preciso
- Test: `components/clientes/Clientes.test.js`, `app/routes.test.js`

**Interfaces:**
- Consumes: `ClientDetailResponse.memberLists` (Task 7).
- [ ] **Step 1: Teste:** a página do perfil mostra a seção "Listas em que participa" com nome da lista (link para `/listas/{id}`) e "Leitor"/"Editor"; sem itens, a seção não aparece.
- [ ] **Step 2:** `npx vitest run components/clientes app/routes.test.js`. Esperado: FAIL.
- [ ] **Step 3:** Implemente.
- [ ] **Step 4:** Em `ui/nextjs/`: `npm test && npm run lint && npm run build` (pare o dev server antes). Em `api/`: `./mvnw verify`. Esperado: tudo PASS, só o ruído conhecido do `CLAUDE.md`.
- [ ] **Step 5:** Commit (com autorização): `Show on the profile page the lists they take part in.`
