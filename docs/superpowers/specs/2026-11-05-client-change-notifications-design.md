# Alterações dos clientes e leitura por arquiteta

Status: proposta para aprovação; implementação não iniciada.

## Intenção

Permitir que as arquitetas identifiquem quais clientes alteraram suas listas e localizem os produtos alterados, sem conferir todas as listas manualmente. Cada arquiteta acompanha suas próprias pendências.

## Decisões da conversa

- Mostrar um resumo das alterações dos clientes e destacar os produtos dentro da lista.
- Abrir a lista resolve as pendências apenas para a arquiteta que abriu.
- Usar a opção 1: guardar a última alteração de cada campo, agrupando os produtos, sem histórico completo.
- O esboço visual foi aprovado como direção: resumo por cliente/lista, tipos de alteração e destaques na lista. Ele usa dados fictícios e não altera o produto.

## Abordagens consideradas

1. Última alteração por campo de produto e posição de leitura por arquiteta/lista. Mantém o estado necessário para resumo e destaque, com armazenamento proporcional aos produtos e leitores, sem guardar todas as ações. Escolhida pela pessoa usuária.
2. Histórico de todas as ações. Permitiria reconstruir mudanças intermediárias e consultar uma linha do tempo, mas acrescentaria armazenamento e regras sem necessidade para o objetivo atual.

## Escopo e limites

Entram alterações reais feitas por contas CLIENT nos dois campos já editáveis: `bought` e `clientNotes`, incluindo desmarcar uma compra e remover uma observação. Uma requisição que repete o valor atual, após a normalização existente, não gera novidade. Alterações administrativas e sincronizações de lojas não geram novidades de cliente.

Não entram histórico completo, comparação antes/depois, e-mail, notificações externas, atualização em tempo real, novos campos editáveis pelo cliente ou mudanças nas permissões existentes. A implantação não inventa pendências retroativas a partir de `updatedAt`.

Evitar confundir novidades com produtos que ainda faltam comprar. Preservar os indicadores e filtros existentes; acrescentar o resumo de novidades sem substituir o resumo de compras. O esboço não autoriza redesenhar o dashboard ou renomear todos os filtros.

## Comportamento

### Resumo na visão geral

Acrescentar uma seção “Alterações dos clientes” ao dashboard administrativo, com a quantidade total de listas com novidades para a usuária autenticada. Cada entrada representa uma lista e mostra cliente, nome da lista, quantidade de produtos distintos alterados, contagem por tipo de alteração, horário da última alteração ainda não vista e link “Abrir lista”.

Contar produtos distintos: um produto com compra e observação alteradas conta uma vez no total de produtos e uma vez em cada categoria aplicável. Para compra, distinguir marcado como comprado e desmarcado; para notas, distinguir alteração e remoção. Agrupar ações repetidas do mesmo campo pela última ação do cliente. Ordenar pela última novidade, com UUID da lista como desempate estável. Mostrar 20 listas por página, com navegação para todas as demais; o total não se limita à página.

Sem pendências, mostrar “Tudo em dia! Você já viu as alterações dos seus clientes.”. Falha na consulta deve ter estado de erro e tentativa novamente, nunca parecer ausência de novidades. Nomes e contatos extras não são necessários.

### Abertura da lista

Qualquer abertura da tela administrativa de detalhe da lista, por qualquer caminho, apresenta as novidades posteriores à leitura anterior da arquiteta. Após montar a lista no navegador, enviar automaticamente a confirmação de leitura até a revisão capturada naquela abertura. Ler metadados, pré-carregar links ou consultar a lista na API não confirma leitura.

O resumo deixa de contar essas novidades para essa arquiteta. As outras arquitetas não são afetadas. Os destaques permanecem durante essa visita, mesmo após atualizações de props causadas por uma edição ou `router.refresh`. Ao sair e abrir novamente, essas mesmas novidades não ficam destacadas. Uma atualização completa do navegador é uma nova abertura.

Cada produto alterado recebe destaque de fundo/borda, texto “Alterado pelo cliente”, tipo e horário da última alteração de cada campo ainda não visto. A observação atual continua no editor existente. Se ambos os campos mudaram, mostrar ambos. A indicação não depende apenas de cor. Os filtros existentes continuam funcionando e os destaques reaparecem ao retornar a um filtro que mostra o produto.

Uma mudança que chegar depois da revisão capturada não é confirmada por aquela visita nem por seus refreshes; continua pendente para a próxima abertura. Não há polling. Se a confirmação falhar, manter os destaques e informar que não foi possível marcar as alterações como vistas, com ação de tentar novamente para a mesma revisão. Só afirmar que foram vistas após sucesso.

### Casos adicionais — decisões propostas pelo assistente

- A primeira abertura considera todas as mudanças de cliente registradas desde a implantação, inclusive para uma arquiteta recém-cadastrada; ausência de leitura equivale à revisão zero.
- Se o cliente mudar e depois desfizer um campo antes da leitura, ainda existe novidade: mostrar sua última ação, sem reconstruir as intermediárias.
- Se a arquiteta editar um campo depois do cliente, isso não apaga a novidade nem se apresenta como ação do cliente. A descrição usa o último valor enviado pelo cliente e o produto/editor mostra o valor atual; quando divergirem, rotular o valor da ação como “Última alteração do cliente”, evitando atribuir ao cliente a edição administrativa posterior.
- Excluir um produto ou ambiente remove suas novidades do resumo; excluir lista/cliente remove também os dados de leitura associados. Não manter pendências sem um produto existente para abrir.
- Leituras em várias abas avançam somente para a maior revisão confirmada; uma resposta atrasada nunca regride a leitura. Abas já abertas mantêm seus destaques locais daquela visita.

Essas decisões completam casos não especificados na conversa e fazem parte da aprovação solicitada.

## Estado atual e integração

`ClientShoppingListService` já separa as escritas de compra e observação e bloqueia a lista antes do produto. Essas operações são os pontos de registro. `ListActivityService` registra uso da lista, inclusive aberturas; não identifica campo, autora ou leitura individual e não será usado como fonte das novidades.

`DashboardService` hoje retorna estatísticas de compras e cinco clientes/listas recentes. Acrescentar a seção independente de novidades sem derivá-la desses cinco registros. A página administrativa usa `getList` tanto no detalhe quanto nos metadados, portanto nenhum desses GETs pode limpar novidades. O componente `ListActivity` mantém a finalidade existente; a confirmação de novidades é uma operação distinta.

## Persistência proposta

Usar uma revisão inteira crescente por lista, incrementada apenas em mudanças reais de cliente, sob o bloqueio já existente. Para cada par produto/campo, guardar somente a última revisão, instante obtido do `Clock` e valor enviado pelo cliente (`boolean` para compra, texto anulável para observação). Limitar aos dois campos conhecidos; não criar um mecanismo genérico de auditoria.

Guardar a maior revisão vista por par usuária administrativa/lista, com chave única e exclusão em cascata. Uma alteração é nova quando sua revisão supera essa posição. Na ausência de linha, usar zero. Revisões, em vez de horários, evitam perder escritas com o mesmo instante. Horários servem apenas à apresentação.

Registro da alteração e edição do produto são atômicos. Confirmação da leitura é idempotente, monotônica e limitada à revisão informada, sem avançar implicitamente até a revisão atual do servidor. Consultas de detalhe retornam produtos, novidades e revisão de abertura de uma mesma visão consistente; o implementador escolhe o mecanismo transacional respeitando a ordem de bloqueios existente.

Consultas de resumo devem agregar no banco por escritório/usuária e paginar listas, sem carregar todas as listas e produtos em Java ou fazer uma consulta por entrada. Índices devem atender os acessos por lista, produto e usuária. Adicionar migração Flyway nova; não alterar migrações existentes. Não migrar atividades antigas para novidades.

## Contrato de API proposto — sujeito à aprovação deste desenho

Preservar campos, status e formatos existentes. Acrescentar somente:

- `GET /api/client-changes?page=0`: ADMIN, página de 20 listas; resposta com `pendingListCount`, `page`, `pageSize` e `items`. Cada item tem `listId`, `listName`, `clientId`, `clientName`, `changedProductCount`, `purchaseMarkedCount`, `purchaseUnmarkedCount`, `notesChangedCount`, `notesRemovedCount` e `lastChangedAt`. As contagens refletem apenas campos ainda não vistos pela usuária autenticada. Página inválida segue a validação/ProblemDetail existente; página além do fim retorna itens vazios.
- Campo adicional `clientChanges` em `GET /api/lists/{id}`: `{ observedRevision, products }`. Cada entrada de `products` contém `productId` e os campos novos `purchase` e/ou `notes`, cada um com `revision`, `changedAt` e `value`; só incluir campos posteriores à leitura anterior. Sem novidades, `products` é vazio, mas `observedRevision` continua presente.
- `POST /api/lists/{id}/client-changes/read`: corpo estrito `{ observedRevision }`, inteiro não negativo; responde 204. Validar que a revisão não supera a atual. Usuária e escritório vêm da sessão, nunca do corpo. Somente ADMIN; lista de outro escritório responde 404.

Os novos dados de leitura são pessoais mesmo entre integrantes do mesmo escritório. DTOs/rotas de cliente não recebem os campos administrativos. Server Actions validam UUID e corpo, aguardam a escrita e invalidam as leituras afetadas conforme os padrões existentes. Não usar `localStorage`, cookie de leitura ou estado global de processo.

Não mudar CORS, autenticação, tempo de sessão ou dependências. A aprovação do documento deverá cobrir explicitamente os acréscimos acima, conforme `api/AGENTS.md`.

## Validação exigida na implementação

Aplicar RED-GREEN-REFACTOR e revisão independente conforme as regras do projeto. Cobrir mudanças e repetições de cada campo; ambos os campos no mesmo produto; agrupamento de ações; remoção de nota; reversão de compra; edições administrativas; leituras independentes de duas arquitetas; várias listas; primeira leitura; acesso entre escritórios e papéis; exclusões; paginação e totais.

Cobrir a revisão de abertura contra uma escrita posterior e confirmações concorrentes/atrasadas; GET e pré-carregamento não limpam leitura. Na UI, conferir confirmação após montagem, falha e retry, destaque estável durante refresh/filtros e limpeza na próxima abertura, resumo com link, paginação, vazio e erro. Conferir desktop e celular, teclado e contraste usando os tokens existentes.

Enquanto iterar, executar apenas o teste afetado; antes de concluir, executar a definição de pronto de UI e API, além da revisão independente do código final. Este desenho e o esboço não são evidência de testes da funcionalidade.

## Tamanho e decisões deixadas ao implementador

É uma funcionalidade em UI e API, com migração, consultas, operações de leitura e testes; não é apenas um selo visual. Manter Java/Spring/PostgreSQL e Next.js/JavaScript atuais, sem novas dependências.

O implementador define nomes internos de tabelas/classes, organização mínima dos componentes, mecanismo de consistência transacional e índices concretos. Preservar as regras descritas, os padrões existentes e as fronteiras de escritório. A próxima etapa, após aprovação, é escrever o plano de implementação.
