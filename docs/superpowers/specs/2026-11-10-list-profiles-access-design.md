# Perfis por lista (leitor e editor) e controle interno da lista

Status: proposta para aprovação; implementação não iniciada.

## Intenção

Hoje cada lista pertence a um único cliente, e só esse cliente acessa a lista. Em vários projetos a arquiteta precisa encaminhar a lista para outras pessoas, por exemplo quem fará as compras ou os orçamentos. Algumas dessas pessoas podem ajudar (marcar comprado, escrever observação); outras só devem acompanhar.

Também falta, no cadastro da lista, um lugar para os dados internos do escritório sobre o projeto (código, contrato, obra, contratante).

## Decisões da conversa

- Não existe um tipo novo de pessoa. Todos são cadastros iguais, e na interface passam a se chamar **"perfil"** (não mais "cliente"), em todas as telas e no menu.
- Cada lista tem um **perfil principal** (o dono do projeto). Ele é sempre **editor**.
- A arquiteta pode adicionar **outros perfis** à lista, escolhendo para cada um **leitor** ou **editor**. O nível vale **por lista**: o mesmo perfil pode ser editor numa lista e leitor em outra.
- Todos os perfis precisam de cadastro (nome, e-mail, telefone), como os clientes de hoje.
- Só as arquitetas escolhem e veem o nível de acesso. O perfil não vê o rótulo "leitor/editor".
- **Editor:** marca produto como comprado / não comprado e escreve a sua observação. **Leitor:** só visualiza.
- Leitor e editor veem a mesma lista, **incluindo preços e notas internas dos produtos**. A única diferença é que só o editor marca comprado e escreve observação. Isso vale para todos os perfis, inclusive o principal de listas já existentes (hoje o cliente não vê preços nem notas internas).
- **Observação por perfil:** cada editor tem a sua observação em cada produto e vê as observações dos outros, com o nome de quem escreveu.
- O controle de acesso fica **no formulário da lista** (Nova lista / Editar lista), gravado junto no botão "Salvar lista" (opção A do esboço visual).
- A arquiteta **não edita** as observações dos perfis: ela só **lê** ou **exclui** a observação de qualquer perfil. A edição de observação que existe hoje no lado da arquiteta deixa de existir.
- O formulário da lista ganha a área **Controle interno**, visível só para as arquitetas, com campos todos **opcionais**:
  - código do projeto (texto);
  - contrato (texto);
  - contratante (nome em texto livre; pode ser diferente do perfil principal);
  - CPF ou CNPJ do contratante (um só campo);
  - CEP da obra;
  - endereço da obra (texto livre, sem preenchimento automático pelo CEP).

## Comportamento

### Renomeação para "perfil"

Todo texto que as pessoas leem troca "cliente(s)" por "perfil/perfis": menu, telas de cadastro, lista, detalhe e edição, filtros e títulos das listas, painel e avisos de alterações, dashboard, convite por e-mail, telas de convite e "Minhas listas", mensagens de validação e de erro. O código, a API e o banco continuam usando `client` (ver "Minhas decisões").

### Formulário da lista (só arquitetas)

Três blocos, gravados juntos em "Salvar lista":

1. **Dados da lista:** nome, descrição, perfil principal (seleção obrigatória, como hoje). Texto de apoio: o perfil principal é sempre editor.
2. **Outros perfis com acesso:** linhas com nome do perfil, seletor Leitor/Editor e botão de remover; abaixo, seleção de um perfil + seletor de nível + botão "Adicionar". O perfil principal não aparece nessa área nem pode ser escolhido nela. Um perfil aparece no máximo uma vez. Nível padrão ao adicionar: Leitor.
3. **Controle interno:** os seis campos opcionais acima.

### Lado do perfil ("Minhas listas")

- Um perfil logado vê em "Minhas listas" todas as listas em que é principal ou foi adicionado.
- Na lista, vê produtos com preços e notas internas.
- Editor: vê o botão de comprado e o campo da sua observação. Leitor: não vê esses controles.
- Abaixo de cada produto aparecem as observações dos outros perfis (só leitura), com o nome de quem escreveu. O editor edita apenas a sua.
- Um perfil nunca vê os campos de controle interno da lista nem quem mais tem acesso nem os níveis de acesso.
- O link de compartilhamento (`/l/[shareToken]`) continua funcionando: abre a lista para qualquer perfil com acesso a ela.

### Lado da arquiteta

- Na página da lista e na edição de produto, vê todas as observações dos perfis, cada uma com o nome do autor, e pode excluir qualquer uma delas (com confirmação). Não pode editar o texto.
- Excluir uma observação é ação da arquiteta e não gera aviso de alteração; se havia aviso pendente daquela observação, ele some.
- Os avisos de alterações passam a indicar qual perfil fez cada mudança (marcou/desmarcou comprado, alterou/removeu a observação).
- Na página da lista, os dados de controle interno preenchidos aparecem num bloco só de leitura.

### Comprado / não comprado

Continua sendo um único estado por produto, compartilhado. Qualquer editor pode marcar ou desmarcar.

## Regras

- O perfil principal e os outros perfis da lista têm que ser do mesmo escritório da lista.
- Lista de outro escritório, ou de que o perfil não participa: 404, como hoje.
- Leitor que tentar marcar comprado ou gravar observação pela API: recusado (ver "Minhas decisões").
- A arquiteta grava a lista com o conjunto completo de outros perfis (o formulário envia a lista inteira; a API substitui o conjunto atual).
- Tirar o acesso de um perfil, ou trocar o perfil principal, faz a pessoa deixar de ver a lista.
- Validação (mensagens iguais na UI em `lib/validation.js` e na API em `ErrorMessages.java` / `ValidationMessages.properties`):
  - CEP: 8 dígitos, aceitando digitado com ou sem traço; guardado só com dígitos.
  - CPF ou CNPJ: CPF com 11 dígitos, ou CNPJ com 14 caracteres, aceitando também o CNPJ alfanumérico da Receita Federal (12 letras ou números seguidos de 2 dígitos verificadores, emitido desde julho de 2026). Aceita pontuação; dígitos verificadores conferidos pela regra oficial de cada formato; guardado sem pontuação e com letras em maiúsculas.
  - Todos os campos internos aceitam vazio.
- Escritas de acesso e de observação seguem a trava da lista já usada nas escritas da lista (`ShoppingListRepository.findInOfficeForUpdate` e variantes).

## Dados (orientação)

- Nova tabela de acesso, por exemplo `list_members (list_id, client_id, role, created_at)`, chave `(list_id, client_id)`, `role` em `EDITOR`/`READER`, apagando junto com a lista e com o perfil. O principal continua em `shopping_lists.client_id` e não entra nessa tabela.
- Nova tabela de observações por perfil, por exemplo `product_client_notes (product_id, client_id, text, updated_at)`, chave `(product_id, client_id)`. A migração copia o `products.client_notes` existente para o perfil principal da lista de cada produto.
- O rastreamento de alterações para os avisos (`client_*_revision`, `client_*_changed_at`, `client_*_value`, `list_client_change_reads`) precisa passar a registrar o perfil autor. Observação passou a ser por perfil, então o registro de "observação alterada" deixa de ser um só por produto.
- Novas colunas opcionais em `shopping_lists` para o controle interno.
- Tudo por migração Flyway nova (`V12__...` em diante); nenhuma migração existente é alterada.

## Mudanças no contrato da API (aprovadas com este documento)

- Pedido de criar/editar lista ganha os outros perfis com nível e os seis campos internos; resposta de lista da arquiteta devolve esses dados.
- Respostas para o perfil (`/api/client/lists...`) passam a incluir preço e notas internas do produto, as observações de todos os perfis com nome do autor, e um indicador de que o perfil atual pode editar (sem expor "leitor/editor" como rótulo nem a lista de quem tem acesso). Não incluem os campos de controle interno.
- Respostas da arquiteta sobre produtos e avisos passam a trazer as observações e as mudanças com o perfil autor.
- O endpoint atual da arquiteta para editar a observação do cliente (`PUT /api/products/{productId}/client-notes`) é substituído por um endpoint para excluir a observação de um perfil específico.
- Nomes exatos de campos e caminhos ficam com o construtor, seguindo o padrão atual (inglês, records).

## Fora do escopo

- Aprovar/reprovar produtos.
- Novos níveis além de leitor e editor, ou permissões por produto/ambiente.
- Convite automático ao adicionar um perfil a uma lista (o convite continua manual, na página do perfil).
- Mudar o tipo `CLIENT` das contas, renomear tabelas, colunas, classes ou caminhos da API para "profile".
- Busca ou filtros pelos campos de controle interno.
- Preenchimento do endereço pelo CEP ou qualquer serviço externo.
- Histórico completo de observações ou de quem marcou comprado.

## O que seria um fracasso

- Um leitor conseguir marcar comprado ou gravar observação, mesmo chamando a API direto.
- Um perfil enxergar os campos de controle interno da lista ou o nível de acesso das pessoas.
- Um perfil ver lista de que não participa, ou de outro escritório.
- Observações existentes sumirem na migração.
- Sobrar "cliente" em texto visível depois da troca para "perfil".

## Minhas decisões (para conferir)

- O código, a API e o banco continuam chamando o cadastro de `client`; a troca para "perfil" é só no texto visível.
- As rotas da interface mudam de `/clientes...` para `/perfis...`, com redirecionamento permanente das rotas antigas.
- Leitor que tenta escrever pela API recebe 403 com mensagem "Você só pode visualizar esta lista." (a lista existe para ele, então 404 não faria sentido).
- Ao tirar o acesso de um perfil, ou trocá-lo de principal sem readicioná-lo, as observações dele naquela lista são apagadas junto, e os avisos pendentes sobre essas observações também somem.
- O campo de CPF/CNPJ aceita o CNPJ alfanumérico, além dos formatos numéricos.
- Se um perfil que era "outro perfil" vira o principal, ele sai da área de outros perfis automaticamente.
- A página do perfil mostra as listas em que ele é principal e, separadamente, as listas em que foi adicionado, com o nível de acesso.
- O filtro de listas por perfil considera só o perfil principal.
- Excluir um perfil continua apagando as listas em que ele é principal (comportamento atual); nas listas em que é outro perfil, só o acesso e as observações dele somem.
- Tamanhos máximos: código do projeto 40, contrato 120, contratante 120, endereço 300 caracteres.
- Nível padrão ao adicionar um perfil: Leitor.

## Deixado para o construtor

- Nomes exatos de tabelas, colunas, campos JSON e caminhos da API, seguindo os padrões do projeto.
- Como reorganizar o rastreamento de alterações para registrar o autor, desde que os avisos atuais continuem funcionando e mostrem o perfil.
- Layout fino do formulário e das observações, usando os componentes e estilos existentes.

## Testes esperados

- API: acesso de principal, editor adicionado e leitor; leitor recusado ao escrever; perfil sem acesso e outro escritório retornam 404; perfil de outro escritório não pode ser adicionado; migração das observações para o principal; campos internos validados e ausentes das respostas do perfil; preços e notas internas presentes nas respostas do perfil.
- UI: formulário com adição/remoção/troca de nível e campos internos; validação de CEP e CPF/CNPJ (incluindo CNPJ alfanumérico); leitor sem controles de edição; observações dos outros perfis com nome; arquiteta exclui mas não edita observação; textos com "perfil".
- API (complemento): arquiteta exclui a observação de um perfil; observação de outro escritório retorna 404; CPF, CNPJ numérico e CNPJ alfanumérico válidos e inválidos.
