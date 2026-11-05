# Client Change Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar alterações dos clientes no dashboard e na lista, com leitura automática e independente por arquiteta.

**Architecture:** Guardar a última mudança de compra e observação no próprio produto, com uma revisão crescente por lista. Uma tabela guarda a maior revisão vista por usuária/lista. GETs retornam uma visão consistente sem limpar pendências; uma Server Action confirma somente a revisão capturada quando a lista foi aberta no navegador.

**Tech Stack:** Java 25, Spring Boot 4.1, PostgreSQL 18, Flyway, Next.js 15, React 19, JavaScript, JUnit/MockMvcTester e Vitest/Testing Library existentes.

**Spec:** `docs/superpowers/specs/2026-11-05-client-change-notifications-design.md`.

## Global Constraints

- “Manter Java/Spring/PostgreSQL e Next.js/JavaScript atuais, sem novas dependências.”
- “Adicionar migração Flyway nova; não alterar migrações existentes.”
- “Não mudar CORS, autenticação, tempo de sessão ou dependências.”
- “Não usar `localStorage`, cookie de leitura ou estado global de processo.”
- “Ler metadados, pré-carregar links ou consultar a lista na API não confirma leitura.”
- “Não migrar atividades antigas para novidades.”
- Textos de interface em português brasileiro; código, novos caminhos e campos em inglês. Preservar rotas legadas, compras, sincronização de lojas e atividade humana existentes.
- Ler root, `api/AGENTS.md` e `ui/AGENTS.md`; aplicar `code-quality` e seu `engineering-guide.md` na implementação. Sem commits de UI sem pedido explícito; os pontos de entrega abaixo não autorizam commits automáticos.
- A pessoa usuária aprovou o desenho e seus acréscimos de contrato. Este turno produz somente o plano, conforme a correção “o plano”.

## Review Focus

- Uma gravação repetida após normalização não deve gerar outra novidade: teste de integração na tarefa 1.
- Uma edição administrativa posterior não pode ser atribuída ao cliente: testar snapshot separado do valor atual na tarefa 2 e sua apresentação na tarefa 5.
- Confirmações fora de ordem e mudanças posteriores à abertura não podem perder pendências: testes de API na tarefa 3 e de refresh na tarefa 5.
- Pré-carregamento e metadados não podem resolver avisos antes da visita: API na tarefa 2 e página/ação na tarefa 5.
- Muitos clientes, exclusões e mudanças durante paginação não podem produzir totais truncados ou entradas órfãs: tarefa 4; ordenação é estável por timestamp e UUID, sem promessa de snapshot entre navegações de páginas diferentes.

## Mapa de arquivos e interfaces comuns

Arquivos da API abaixo são relativos a `api/src/main/java/br/com/fluiar/selecao/`; testes têm o mesmo pacote em `api/src/test/java/br/com/fluiar/selecao/`. Caminhos da UI são relativos a `ui/nextjs/`.

- `model/ProductClientChanges.java` (novo embeddable): revisões, horários e valores das últimas ações do cliente. `model/Product.java` incorpora o embeddable; `model/ShoppingList.java` fornece a revisão crescente.
- `repository/ClientChangeRepository.java` (novo, `JdbcTemplate` como `ListActivityRepository`): cursor de leitura e consulta paginada/agregada; não altera produtos.
- `service/ClientChangeService.java` (novo): consulta de novidades e confirmação de leitura; `ClientShoppingListService` registra mudanças nos modelos dentro da transação existente.
- DTOs novos: `ClientChangesResponse`, `ClientChangePageResponse`, `ClientChangeSummaryResponse`, `ClientChangeReadRequest`. `ListDetailResponse` recebe somente o campo administrativo `clientChanges`.
- `controller/ClientChangeController.java` (novo): resumo paginado e confirmação; `ShoppingListController` passa a usuária autenticada ao GET de detalhe.
- `components/client-changes/` (novo): consultas e ação no servidor, painel de resumo, ciclo de leitura por visita e apresentação das mudanças. `ShoppingList` mantém a visita e passa as novidades a `RoomTable`.
- Dashboard acrescenta o painel; página da lista continua somente lendo dados no servidor. Estilos reutilizam tokens e classes atuais, com adições pequenas.

Contrato compartilhado, sem campos genéricos de auditoria:

```text
ClientChangesResponse(long observedRevision, List<ChangedProduct> products)
ChangedProduct(UUID productId, PurchaseChange purchase, NotesChange notes)
PurchaseChange(long revision, Instant changedAt, boolean value)
NotesChange(long revision, Instant changedAt, String value) // value pode ser null
ClientChangeReadRequest(Long observedRevision) // obrigatório, inteiro >= 0
ClientChangePageResponse(long pendingListCount, int page, int pageSize,
                        List<ClientChangeSummaryResponse> items)
ClientChangeSummaryResponse(UUID listId, String listName, UUID clientId, String clientName,
  long changedProductCount, long purchaseMarkedCount, long purchaseUnmarkedCount,
  long notesChangedCount, long notesRemovedCount, Instant lastChangedAt)
```

`purchase`/`notes` ausentes ficam omitidos do JSON; a ação de remoção de observação deve ter objeto `notes` presente com `value: null`. Usar os mesmos nomes e formatos em JSDoc e fixtures.

## Tarefa 1: Registrar somente mudanças reais do cliente

**Arquivos:** criar `api/src/main/resources/db/migration/V9__add_client_change_notifications.sql` e `model/ProductClientChanges.java`; modificar `model/Product.java`, `model/ShoppingList.java`, `service/ClientShoppingListService.java`; modificar `service/ClientShoppingListServiceTest.java` e `controller/ClientShoppingListControllerTest.java` nos testes. Reconfirmar que V9 está livre antes de criar a migração.

**Interfaces:** `ShoppingList.nextClientChangeRevision(): long`, `getClientChangeRevision(): long`; `Product.recordClientPurchase(long revision, Instant changedAt, boolean value)` e `recordClientNotes(long revision, Instant changedAt, String value)`; `Product.getClientChanges(): ProductClientChanges`. Registro é separado dos métodos administrativos existentes.

- [ ] Escrever testes de endpoint existente para compra, desmarcação, observação normalizada e remoção; usar `JdbcTemplate` para verificar o estado persistido depois das requisições. Exemplo de asserção RED após a compra: `assertThat(jdbc.queryForMap("select * from products where id = ?", productId)).containsEntry("client_purchase_revision", 1L);`. Antes da migração, a consulta existe e falha por ausência da entrada esperada, sem erro de compilação.
- [ ] Executar em `api/`: `./mvnw test -Dtest=ClientShoppingListControllerTest`; registrar falha na asserção nova, preservando validação/ownership existentes.
- [ ] Adicionar `shopping_lists.client_change_revision bigint not null default 0`; em products, `client_purchase_revision` e `client_notes_revision` bigint não negativos default 0, `client_purchase_changed_at`/`client_notes_changed_at` timestamptz, `client_purchase_value` boolean anulável e `client_notes_value varchar(1000)` anulável. Criar `list_client_change_reads(user_id uuid references users(id) on delete cascade, list_id uuid references shopping_lists(id) on delete cascade, seen_revision bigint not null check(seen_revision >= 0), primary key(user_id,list_id))`, mais índice de `list_id` para cascatas. Revisão zero significa sem ação; manter coerência entre revisão positiva e timestamp/valor de compra.
- [ ] Incorporar os seis campos pelo embeddable. Na escrita CLIENT, depois dos locks atuais e antes de mudar o produto, comparar o valor normalizado com o atual; só se houver mudança, obter a próxima revisão da lista e registrar instante do `Clock` injetado e valor do pedido. Preservar `list.touch()`, atividade humana e invalidação de store sync existentes.
- [ ] Acrescentar testes que repetem compra e observação normalizada e verificam revisão inalterada; alterar os dois campos e verificar revisões 1 e 2; mudar/desfazer e verificar somente o último valor. Fixar `testClock` para provar que duas ações no mesmo instante ainda recebem revisões distintas. Contas ADMIN e sincronização não preenchem os novos campos.
- [ ] Executar cada classe afetada separadamente enquanto iterar; entregar ambas verdes. Não criar endpoint de histórico.

## Tarefa 2: Retornar novidades por leitora sem resolver no GET

**Arquivos:** criar `dto/ClientChangesResponse.java`, `repository/ClientChangeRepository.java`, `service/ClientChangeService.java`; modificar `dto/ListDetailResponse.java`, `service/ShoppingListService.java`, `controller/ShoppingListController.java`; testar em `controller/ShoppingListControllerTest.java` e `controller/ClientShoppingListControllerTest.java`.

**Interfaces:** `ClientChangeRepository.seenRevision(UUID userId, UUID listId): long`; `ClientChangeService.changesFor(ShoppingList list, UUID userId): ClientChangesResponse`; `ShoppingListService.get(UUID officeId, UUID userId, UUID listId): ListDetailResponse`. `ListDetailResponse.of(list)` continua válido para criação/edição, preenchendo `clientChanges` vazio com a revisão atual; o GET usa uma fábrica/sobrecarga com as novidades pessoais.

- [ ] Escrever `listGetReturnsClientChangesWithoutConsumingThem`: criar cliente/lista/produto e fazer uma compra CLIENT; duas leituras ADMIN sucessivas devem conter `$.clientChanges.observedRevision == 1`, produto correto e `purchase.value == true`. Uma segunda ADMIN do escritório deve obter as mesmas novidades. Exemplo: `assertThat(readJson(result, "$.clientChanges.products[0].productId")).isEqualTo(productId.toString());`.
- [ ] Executar `./mvnw test -Dtest=ShoppingListControllerTest`; confirmar RED por JSON ausente, sem mudar previamente o contrato.
- [ ] Implementar o DTO tipado e a leitura de cursor, zero por ausência. Montar novidades somente para campos cuja revisão excede o cursor. Usar `@CurrentUserId` no controller; manter isolamento por `@CurrentOfficeId` e a fábrica de 404 existente. GET de detalhe usa transação read-only `REPEATABLE_READ`, cobrindo cursor, revisão, produtos e montagem dos DTOs, sem gravar leitura nem tomar lock de escrita. Leitura JDBC participa da mesma transação do datasource atual.
- [ ] Testar primeira abertura, ausência de novidades e produto com ambos os campos. Fazer ADMIN editar o valor atual depois do cliente; resposta de produto deve mostrar valor administrativo e `clientChanges` deve preservar a última ação CLIENT. Exemplo: `assertThat(readJson(result, "$.clientChanges.products[0].notes.value")).isEqualTo("Prefiro preto");` mesmo que `rooms[*].products[*].clientNotes` agora seja outro texto.
- [ ] Confirmar que DTO CLIENT continua sem `clientChanges`; outra conta cliente e outro escritório não ganham acesso. Fazer leitura durante escrita concorrente controlada com os helpers existentes: revisão e valores devem pertencer ao mesmo snapshot, nunca misturar antes/depois. Usar barreiras/transações, sem sleeps de sincronização.
- [ ] Executar os testes afetados separadamente até GREEN; atualizar todos os callers Java da assinatura `get`, sem alterar endpoints de criação/edição.

## Tarefa 3: Confirmar leitura individual até a revisão observada

**Arquivos:** criar `dto/ClientChangeReadRequest.java`, `controller/ClientChangeController.java`, `controller/ClientChangeControllerTest.java` nos testes; modificar `repository/ClientChangeRepository.java`, `service/ClientChangeService.java`; acrescentar mensagens em `exception/ErrorMessages.java` se necessário.

**Interfaces:** `ClientChangeService.markRead(UUID officeId, UUID userId, UUID listId, long observedRevision): void`; `ClientChangeRepository.advanceRead(UUID userId, UUID listId, long observedRevision): void`; `POST /api/lists/{id}/client-changes/read` responde 204 com corpo estrito `{ observedRevision }`.

- [ ] Escrever `openingListMarksOnlyThisArchitectsObservedRevision`: após mudança, confirmar revisão 1 como Ana; GET de Ana deve retornar `products` vazio, GET de Beatriz deve manter um produto. Executar `./mvnw test -Dtest=ClientChangeControllerTest` e registrar RED por HTTP 404 em vez de 204.
- [ ] Implementar parsing estrito à semelhança de `ProductClientNotesRequest`: rejeitar corpo ausente, campo ausente/extra, null, string, boolean, fracionário, negativo e número fora do intervalo de `long`, sem truncar. Revisão maior que a atual retorna 400 `ProblemDetail` com `errors.observedRevision`; UUID inexistente/de outro escritório retorna 404; CLIENT retorna 403 e ausência de sessão 401.
- [ ] Na transação de confirmação, bloquear a lista via `findInOfficeForUpdate`, validar a revisão e executar upsert com `greatest(existing.seen_revision, excluded.seen_revision)`. Controller chama somente um método de serviço. A operação não altera `updatedAt`, produto ou atividade humana.
- [ ] Testar confirmação 1, nova escrita 2, confirmação atrasada 1 e GET: revisão 2 continua pendente. Confirmar 2 e depois 1: cursor permanece 2. Repetir confirmação e confirmar zero devem ser idempotentes. Exercitar chamadas concorrentes usando helpers reais, com ordem lista → leitura, sem novos mocks de contexto.
- [ ] Testar duas listas e duas leitoras, nova administradora, tentativa de injetar userId/officeId e leitura HTTP sem confirmação. Executar a classe até GREEN.

## Tarefa 4: Consultar o resumo agregado e paginado

**Arquivos:** criar `dto/ClientChangePageResponse.java`, `dto/ClientChangeSummaryResponse.java`; modificar `repository/ClientChangeRepository.java`, `service/ClientChangeService.java`, `controller/ClientChangeController.java` e seu teste.

**Interfaces:** `ClientChangeService.list(UUID officeId, UUID userId, int page): ClientChangePageResponse`; `ClientChangeRepository.summaries(UUID officeId, UUID userId, int page, int pageSize): List<ClientChangeSummaryResponse>` e `pendingListCount(UUID officeId, UUID userId): long`; `GET /api/client-changes?page=0`, `PAGE_SIZE = 20`.

- [ ] Escrever teste após três ações: compra e observação no produto A e desmarcação no B. Resumo deve ter uma lista, dois produtos distintos, uma compra marcada, uma desmarcada e uma observação alterada: `assertThat(jsonMapper.readTree(result.getResponse().getContentAsString()).at("/items/0/changedProductCount").asLong()).isEqualTo(2L);`. Para números, usar árvore JSON; `readJson` do suporte atual retorna String. Executar a classe e registrar RED por endpoint/asserção antes de implementar.
- [ ] Agregar em SQL com joins products → rooms → lists → clients, escopo do escritório e left join no cursor da usuária. Cada contagem e máximo de timestamp considera somente os campos posteriores ao cursor. Usar os snapshots CLIENT, não os valores administrativos atuais; notes com revisão positiva e valor null contam como remoção. Ordenar `lastChangedAt desc, listId asc`; paginação parametrizada, calcular offset em `long`, sem interpolar entradas do usuário.
- [ ] Obter total e página na mesma transação read-only `REPEATABLE_READ`. Rejeitar `page` negativo, não inteiro e fora de `int` com 400; omissão usa zero. Página além do fim retorna `items: []` com total correto. Não carregar agregados completos na JVM para paginar.
- [ ] Testar 21 listas pendentes: primeira página 20, segunda 1, total 21 nas duas, ordenação determinística em empate. Após confirmação por Ana, só o resumo dela diminui. Escritório alheio não aparece. Após exclusão de produto, ambiente, lista e cliente, verificar agregados e cascatas pela API/banco; leitura antiga sem novos produtos não conta como pendência.
- [ ] Examinar o plano SQL com dados representativos e índices existentes de rooms/list e products/room; incluir índice adicional na migração nova somente se o acesso demonstrar necessidade. Executar a classe até GREEN.

## Tarefa 5: Destacar mudanças e confirmar ao abrir a lista

**Arquivos:** criar `components/client-changes/actions.js`, `actions.test.js`, `useClientChangeVisit.js`, `useClientChangeVisit.test.js`, `ClientChangeDetails.js`; modificar `components/listas/queries.server.js`, `components/lista/ShoppingList.js`, `ShoppingList.test.js`, `RoomTable.js`, `RoomTable.test.js`, `app/styles/lista.css`, `test-support/fixtures.js`. Criar `app/(app)/(admin)/listas/[id]/page.test.js` se ainda ausente.

**Interfaces:** `markClientChangesRead(listId, observedRevision): Promise<ActionResult<void>>`; `useClientChangeVisit(listId, clientChanges): { changesByProduct, readStatus, retry }`, com `readStatus` em `pending | success | error`. `ClientChangeDetails({ change, product })` mostra ação, horário e eventual valor CLIENT diferente do atual. `RoomTable` recebe `changesByProduct` como prop opcional; chamadas existentes continuam funcionando.

- [ ] Acrescentar testes de `ShoppingList` com fixture de novidades: após montagem, ação recebe exatamente UUID e revisão inicial; rerender com `clientChanges.products: []` deve manter “Alterado pelo cliente”. Escrever teste de página/`generateMetadata` que faz leitura mas não chama a ação. Executar o arquivo afetado em `ui/nextjs/`: `npx vitest run components/lista/ShoppingList.test.js`; confirmar RED por ação/destaque ausente, não por import inexistente.
- [ ] Implementar Server Action com `actionResult`, validação de UUID e revisão inteira segura não negativa; enviar somente `{ observedRevision }` ao POST aprovado. Após sucesso invalidar somente `/dashboard`; não invalidar a página de lista inteira para confirmar a própria leitura. Não redirecionar, não gravar cookie e não tocar a ação de atividade existente. Testar payload permitido, erros, valores inválidos e invalidação somente após sucesso.
- [ ] Implementar hook dentro do dono da lista já keyed por UUID. Capturar uma vez `clientChanges` com inicialização de estado/ref por montagem, fora das linhas filtráveis; congelar seus produtos e revisão pelo tempo daquela visita. A confirmação parte do efeito após montagem, uma vez por tentativa (incluindo StrictMode), nunca do render/servidor. Em refresh manter captura antiga; numa nova montagem capturar a nova. Se não há novidades, não enviar confirmação desnecessária.
- [ ] Exibir aviso pendente neutro; só anunciar sucesso após a ação concluir. Falha esperada ou de transporte mostra mensagem de erro e botão “Tentar novamente” usando a revisão original; bloquear repetição simultânea. Respeitar `unstable_rethrow`, lifecycle e supressão de feedback após unmount existentes. Testar promises deferred, erro/retry, unmount, reentrada e StrictMode sem temporizadores falsos.
- [ ] Passar `changesByProduct` a `RoomTable`, preservar classe `done`, adicionar classe de destaque e texto por campo. Mostrar marcação/desmarcação, alteração/remoção da nota e horário local; quando snapshot CLIENT divergir do valor atual, explicar com “Última alteração do cliente” e mostrar esse snapshot como texto React escapado. Não substituir o editor ou atribuir a mudança administrativa ao cliente.
- [ ] Testar produto com ambos os campos, nota removida, snapshot divergente, texto com markup, item comprado, troca de filtros e refresh depois de edição. Fazer uma mudança posterior à captura no rerender e verificar que nenhuma confirmação da revisão nova é enviada. Novidades de produto excluído não criam linha fantasma.
- [ ] Adicionar somente estilos necessários em `lista.css`, marcados com comentário “novo”, usando tokens existentes em claro/escuro e destaque compreensível sem cor. Executar cada arquivo de teste afetado até GREEN.

## Tarefa 6: Mostrar resumo e paginação no dashboard

**Arquivos:** criar `components/client-changes/queries.server.js`, `queries.server.test.js`, `ClientChangesPanel.js`, `ClientChangesPanel.test.js`; modificar `app/(app)/(admin)/dashboard/page.js`, `page.test.js`, `app/styles/app.css`, `test-support/fixtures.js`. Usar helper de formatação local em `components/client-changes/change-format.js` e teste adjacente caso os dois componentes compartilhem regras de plural/data/tipo.

**Interfaces:** `getClientChangePage(page = 0): Promise<ClientChangePageResponse>`; `ClientChangesPanel({ result })`, com `result` como `ActionResult<ClientChangePageResponse>`. Página lê `searchParams.changesPage`, inicializa página zero para entrada de UI inválida e gera links `/dashboard?changesPage=N`. Payload API inválido continua sendo erro da consulta, não vazio.

- [ ] Escrever teste de painel com cliente/lista/tipos/horário, link “Abrir lista” para `/listas/<UUID>`, total 21 com 20 entradas e navegação seguinte. Testar vazio com texto “Tudo em dia! Você já viu as alterações dos seus clientes.”. Antes de criar o componente, acrescentar teste de dashboard que espera heading “Alterações dos clientes”; executar `npx vitest run 'app/(app)/(admin)/dashboard/page.test.js'` e registrar RED na asserção de UI.
- [ ] Ler resumo no Server Component, junto aos pedidos atuais; usar `actionResult` somente para isolar `ApiError` dessa seção e manter redirects/erros inesperados. Não mover JWT ou carregamento inicial para o cliente. Atualizar mocks de fetch por URL exata e teste de concorrência para incluir `/api/client-changes?page=0`, sem mascarar falhas com respostas genéricas.
- [ ] Inserir seção antes dos cartões de recentes, preservando cabeçalho, três estatísticas de compras e telas iniciais atuais. Mostrar contador específico de listas com novidades, sem reutilizar `pendingProductCount`. Renderizar toda a página retornada e contagens por tipo, inclusive remoção; esconder categorias com zero, não os totais da página.
- [ ] Para erro, mostrar detalhe seguro e botão “Tentar novamente” com `router.refresh()` dentro de transition; proteger envio repetido. Para navegação de páginas, links preservam somente parâmetros reconhecidos necessários. Testar erro/retry sem mensagem de vazio, totais independentes do tamanho de items, última página e página vazia após leitura concorrente; permitir retorno à primeira/anterior sem travar a navegação.
- [ ] Executar os arquivos afetados individualmente até GREEN. Conferir estilos responsivos e tokens sem redesenhar as demais áreas.

## Tarefa 7: Verificação final e revisão independente

**Arquivos:** somente correções diretamente necessárias nos anteriores. Não criar documento de auditoria extra para registrar o processo.

- [ ] Revisar cobertura da spec e registrar RED/GREEN realmente executados. Não alegar testes de concorrência, browser ou integração que apenas foram inspecionados.
- [ ] Verificar ambiente: JDK 25, Docker/Testcontainers disponível e Node na faixa de `ui/AGENTS.md`. Em `api/`, executar `./mvnw verify`: `BUILD SUCCESS`, zero falhas, erros ou testes pulados. Não preparar LocalStack; não é parte da funcionalidade.
- [ ] Em `ui/nextjs/`, executar `npm run lint` (zero erros, somente os dois avisos conhecidos), `npm test` (todos verdes) e `npm run build` (mudança de página/route exige build). Parar dev server antes do build. Não ampliar para upgrades ou advisories conhecidos.
- [ ] Conferir manualmente em desktop e celular: duas arquitetas no mesmo escritório, cliente alterando compra/observação, resumo, leitura individual, destaques na visita, ida/volta, mudança posterior e paginação; teclado e contraste. Se ferramenta/ambiente não permitir uma verificação mandatória, registrar a limitação, sem afirmar conclusão.
- [ ] Usar exatamente um `code-quality-reviewer` independente e read-only por vez para o conjunto API/UI; fornecer base real, arquivos finais, spec/plano, regras e resultados factuais. Não pedir edits, builds/testes ou delegação. Validar achados; corrigir e pedir ao mesmo revisor rechecagem dos bloqueantes, sem enfraquecer testes ou regras.
- [ ] Encerrar somente com critérios obrigatórios verificados, sem achados bloqueantes e resultados válidos para o código final. Rodar `git diff --check` e `git status --short`; não adicionar `.superpowers/` nem artefatos gerados. Relatar comportamento entregue, verificações e limitações reais. Commit de código somente quando solicitado.

## Auto-revisão do plano

- Escopo e contratos: tarefas 1–4 cobrem persistência, agrupamento, identidade, APIs e paginação; tarefas 5–6 cobrem montagem, destaques e resumo. Tarefa 7 mantém as verificações obrigatórias.
- Consistência: mesma revisão por lista em todos os caminhos; payload e confirmação usam `observedRevision`; consulta personalizada nunca marca leitura. Ações repetidas e edições administrativas têm testes explícitos.
- Simplicidade: dois campos fixos incorporados ao produto, uma tabela de cursores, uma consulta agregada e um ciclo de estado por visita. Sem histórico genérico, dependências ou migração de dados antigos.
- Handoff: execução sugerida diretamente nesta sessão com `superpowers:executing-plans`, seguida de um revisor independente do conjunto. As tarefas dependem das mesmas interfaces e não precisam de implementadores paralelos.
