# Acesso de clientes às listas de compras

Data: 2026-11-04. Estado: aprovado pelo usuário, incluindo a correção de nomes em inglês; implementação não iniciada.

## Intenção

Transformar a lista hoje apenas visualizada pelo cliente em uma área privada de acompanhamento de compras. O cliente acessa somente suas listas, marca produtos comprados e escreve observações por produto. O admin acompanha e também pode alterar essas informações.

## Decisões do usuário

- Reaproveitar o login atual, com perfis `ADMIN` e `CLIENT`.
- Provisionar o admin diretamente no banco.
- Criar acesso de cliente exclusivamente por convite do admin, enviado por e-mail. O cliente define a senha ao aceitar.
- Permitir ao cliente marcar/desmarcar compras e editar observações em cada produto de suas listas.
- Permitir ao admin consultar todas as listas de seus clientes e alterar compras e observações.
- Impedir consulta e edição de listas de outros clientes, inclusive por acesso direto à API.
- Manter a identidade visual existente; não criar mockups.
- Usar inglês em todo código desta mudança, incluindo rotas, arquivos, componentes, funções, variáveis, comentários, testes e contratos. Somente os textos exibidos ao usuário na UI ficam em português.

As decisões técnicas e os detalhes de comportamento abaixo foram propostos pelo responsável pelo desenho e aprovados pelo usuário com este documento.

## Estado atual e restrições

O frontend Next.js já utiliza a API Spring Boot, embora o `AGENTS.md` da raiz ainda descreva uma integração pendente. A API autentica usuários por JWT e separa recursos por escritório. `User` e `Client` são entidades distintas; cada lista já pertence a um cliente.

Já existem envio de e-mails, convites para membros do escritório, recuperação de senha, marcação de compra e bloqueio transacional da lista antes de alterar produtos. Não existem perfis nem vínculo entre uma conta e um cadastro de cliente.

O caminho `/l/[shareToken]` e a API `/api/public/lists/{shareToken}` atualmente permitem consulta sem login. Imagens em `/api/images/{imageId}` também são públicas. Esses acessos precisam ser protegidos como parte da privacidade solicitada.

Usar Java, Spring Security, PostgreSQL, Flyway, Next.js e os componentes atuais. Não adicionar dependências. Criar novas migrações, sem alterar as existentes. Todo código novo ou alterado deve usar inglês; somente os textos exibidos na UI ficam em português, incluindo mensagens de validação e erros destinados à interface. Manter `ProblemDetail` nos erros. A instrução do usuário prevalece sobre a convenção antiga de nomes de rotas e comentários em português na UI. A renomeação geral dos caminhos preexistentes não faz parte desta mudança.

## Abordagens consideradas

1. **Login compartilhado com perfis e vínculo explícito ao cliente — escolhida pelo usuário.** Reutiliza autenticação, sessão e recuperação de senha. Exige autorização por perfil e proprietário em todas as operações. É a menor mudança coerente com a aplicação atual.
2. **Autenticação separada para clientes.** Separa contas administrativas e de clientes, mas duplica fluxos de autenticação e manutenção. Não foi escolhida.

## Contas e isolamento

- Acrescentar `role` em `users`. Uma conta `CLIENT` possui vínculo explícito e único com um cadastro de cliente do mesmo escritório; `ADMIN` não possui esse vínculo.
- Garantir no banco os invariantes de perfil, unicidade e escritório do vínculo. Não descobrir propriedade comparando e-mails nem aceitar `clientId`, `officeId` ou `role` enviados pelo cliente como identidade autenticada.
- Manter um escritório e um cliente por conta de cliente e a unicidade global de e-mail de login já existente. Compartilhamento de conta entre escritórios ou entre clientes fica fora do escopo.
- Preservar o isolamento entre escritórios: o admin vê todos os clientes do seu escritório, sem se tornar um superadmin global.
- Migrar os usuários atuais para `ADMIN`, preservando contas e senhas. Invalidar sessões antigas na transição para que tokens sem o novo contexto de autorização não continuem válidos.
- Contas administrativas futuras são inseridas diretamente no banco com hash compatível com o codificador atual. Documentar uma inserção operacional parametrizada, sem senha padrão, segredo versionado ou criação automática de admin a cada inicialização. O provisionamento efetivo em produção não faz parte desta mudança.
- Desativar o cadastro público na interface e na API. Nenhum corpo de requisição de cadastro ou aceite pode escolher o perfil `ADMIN`.
- Desativar a criação de membros do escritório por convite e invalidar convites antigos de membros na migração. O escritório mantém nome e membros administrativos existentes; o fluxo de convite passa a ser exclusivo de clientes.
- A enumeração de membros e a assinatura das listas incluem somente admins, nunca clientes.

## Convite e primeiro acesso

1. O admin cadastra o cliente e prepara suas listas, como hoje.
2. Na página do cliente, envia um convite ao e-mail do cadastro. O cliente recebe acesso a todas as listas ligadas ao seu cadastro, inclusive as criadas depois.
3. O link abre a aceitação do convite, identifica escritório e e-mail convidado e solicita senha e confirmação. O nome vem do cadastro do cliente. Não é possível substituir destinatário, cliente ou perfil pelo formulário.
4. O aceite cria a conta `CLIENT`, consome o convite e inicia a sessão na área do cliente.

Reaproveitar a infraestrutura atual de convites, acrescentando o vínculo obrigatório ao cliente e adaptando os contratos. Não manter um segundo mecanismo de autenticação.

- Manter validade de sete dias, hash do token no banco e consumo único. Reenvio invalida o link anterior; revogação impede aceite. Expiração e mensagens seguem os padrões existentes.
- Exibir ao admin os estados sem convite, pendente, expirado e acesso ativo, com envio, reenvio e revogação de convite pendente.
- Bloquear convites para um cliente com acesso ativo ou para e-mail já utilizado por outra conta; não vincular silenciosamente uma conta existente. Não impor unicidade nova aos e-mails de contato de todos os clientes existentes.
- Se o admin alterar o e-mail de contato enquanto houver convite pendente, invalidá-lo; um novo envio usa o novo endereço.
- Depois da ativação, e-mail de contato do cadastro e e-mail da conta são conceitos distintos. Alterar o contato não transfere acesso. Exibir o e-mail da conta ativa ao admin; mudança do e-mail de login exige o fluxo de conta já existente com senha atual.
- Falha no envio não deve produzir sucesso na interface. Preservar a semântica transacional e de reenvio já utilizada pelo projeto.
- Aceite concorrente, reenvio e revogação não podem criar duas contas nem reaproveitar token. A exclusão do cliente elimina seus convites e sua conta de cliente; sessões deixam de valer.

## Área do cliente

- Usar o mesmo login. Encaminhar `ADMIN` ao dashboard e `CLIENT` a `/my-lists`, também após aceite do convite. O rótulo visível na UI é “Minhas listas”.
- Reutilizar tipografia, cores, componentes, navegação responsiva, mensagens e estados vazios atuais.
- Oferecer navegação para Minhas listas, Configurações da própria conta e Sair. Ocultar ações e páginas administrativas e bloqueá-las também no servidor.
- Listar todas as listas do cliente autenticado, sem necessidade de publicar uma lista individualmente. Sem listas, mostrar um estado vazio; sem produtos, informar que a lista ainda está sendo preparada.
- Ao abrir `/my-lists/[id]`, apresentar ambientes, produtos, quantidades e links, preservando o conteúdo da visão de cliente atual. Preços, imagens e notas internas continuam fora dessa visão.
- Permitir marcar e desmarcar comprado e salvar ou apagar a observação do cliente por produto. Não permitir alterar nome, quantidade, preço, links, notas internas, ambientes ou estrutura da lista.
- Reutilizar filtros Todos, Pendentes e Comprados e contagens coerentes com os produtos salvos.
- A observação é um texto atual, não uma conversa: um campo por produto, até 1.000 caracteres, com espaços externos normalizados e vazio representado por `null`. Exibir e tratar como texto, sem HTML.
- Usar salvamento explícito da observação e salvamento imediato da marcação de compra. Aguardar confirmação da API antes de anunciar sucesso, impedir envio duplicado e manter o texto para nova tentativa em caso de erro.
- Não persistir rascunhos, listas ou credenciais em armazenamento do navegador. Manter o JWT no cookie httpOnly atual.

## Área do admin e persistência

Adicionar `clientNotes` ao produto, separado de `notes` e das observações dos links. Preservar notas existentes. Admin e cliente compartilham o mesmo `bought` e o mesmo `clientNotes`; o admin pode editar ambos na lista administrativa.

Manter as demais funções administrativas de cadastro, ambientes, produtos e listas. Identificar o novo campo como “Observação do cliente”. Na prévia “Ver como cliente”, apresentar os campos visíveis ao cliente sem permitir alterações acidentais pela prévia.

Atualizar lista, contagens e totais após uma gravação. Alterações de outra sessão aparecem na próxima leitura/atualização; sincronização em tempo real e histórico de autoria não entram nesta entrega.

Todas as alterações internas da lista continuam obtendo o bloqueio transacional da lista antes de carregar e alterar os produtos. Aplicar somente os campos efetivamente enviados: uma gravação de observação não pode sobrescrever a compra, nem a edição administrativa de estrutura sobrescrever uma observação lida antes. Para duas escritas no mesmo campo, prevalece a última gravação concluída.

Se o admin transferir uma lista para outro cliente do mesmo escritório, o acesso muda para o novo proprietário imediatamente nas próximas operações. Compras e observações acompanham a lista; a transferência não copia nem mantém acesso ao antigo dono.

## Autorização, API e links existentes

Centralizar a identificação do usuário autenticado com seu perfil, escritório e cliente. Não usar somente `officeId` para autorizar um cliente, pois dois clientes podem pertencer ao mesmo escritório. Manter autorização e consulta de propriedade na API, além dos controles de navegação no Next.js.

| Operação | Admin | Cliente |
| --- | --- | --- |
| Clientes, dashboard, escritório, gestão de listas/produtos/ambientes | Apenas no próprio escritório | Sem acesso |
| Consultar listas e produtos pela área do cliente | Pode usar área administrativa | Somente do próprio cadastro |
| Marcar compra e editar observação do cliente | Nas listas do escritório | Somente nas próprias listas |
| Convidar, reenviar e revogar convite pendente | Para seus clientes | Sem acesso |
| Perfil, e-mail e senha da própria conta | Permitido | Permitido |
| Listas ou produtos de outro escritório | Sem acesso | Sem acesso |

Regras de contrato propostas, a detalhar no plano:

- Preservar os caminhos administrativos existentes, protegendo-os por `ADMIN`. Acesso de `CLIENT` a operação exclusivamente administrativa retorna 403.
- Acrescentar endpoints fixos sob `/api/client` para listar listas próprias, consultar uma lista e alterar `bought`/`clientNotes` de um produto. Não aceitar alterações de outros campos. DTOs de cliente expõem apenas os dados necessários à sua visão, sem contatos de outros clientes, notas internas ou credenciais de compartilhamento.
- Recurso inexistente ou de outro cliente/escritório retorna 404, inclusive em alterações e resolução de links. Ausência de autenticação em recurso protegido retorna 401. JSON inválido ou tentativa de enviar campos não permitidos retorna 400, sem alteração parcial.
- Acrescentar o perfil e o vínculo de cliente às respostas autenticadas necessárias ao frontend; manter as informações de escritório existentes. Preservar validação de senha, expiração do JWT e recuperação de senha.
- Adaptar convites para emissão pelo admin a um cliente explícito e aceite exclusivamente como `CLIENT`. A aceitação e inspeção do token permanecem públicas; a consulta do token não revela listas.
- `/l/[shareToken]` continua resolvendo links antigos, mas exige login. Resolver o token no servidor e verificar admin do escritório ou cliente proprietário antes de ler qualquer dado; depois encaminhar à lista correspondente. Após login, tentar retornar ao link original usando apenas destino local validado. A posse do token, sozinha, não concede acesso.
- A API antiga `/api/public/lists/{shareToken}` também deixa de permitir leitura anônima. Não pode sobrar uma rota alternativa pública para dados das listas.
- Renomear “Link público” para “Link da lista” e explicar que o acesso exige login e permissão. Preservar copiar e rotacionar link para admins.
- Proteger a leitura das imagens pela API com as mesmas regras de proprietário. Para o `<img>` administrativo, usar uma rota de servidor Next.js de mesma origem que leia o cookie e encaminhe o JWT à API fixa. A rota não aceita URL arbitrária e não usa cache público; a API também deixa de anunciar cache público. Não introduzir JWT em URL nem tornar o cookie acessível por JavaScript.
- Rejeitar acesso a imagens de terceiros e usuário removido; não alterar nem apagar o conteúdo de imagens já armazenadas. Cópias já baixadas ou previamente armazenadas em cache público não podem ser recolhidas retroativamente.

## Validação da entrega futura

O plano deve conter testes de comportamento que falhem antes da implementação, usando a infraestrutura existente.

- Dois clientes no mesmo escritório e um terceiro em outro: isolamento em listagem, detalhe, escrita por produto, link por token e imagens. Trocar IDs ou adulterar o corpo não concede acesso.
- Cliente não consegue usar endpoints administrativos, convidar pessoas, criar contas públicas ou escolher/alterar o próprio perfil.
- Convite enviado ao cliente correto; definição de senha; vínculo com o cadastro; login; sessão; recuperação e troca de senha; token expirado, revogado, reutilizado e substituído por reenvio.
- E-mail em uso, cliente já ativo, mudança de contato com convite pendente e operações concorrentes de aceite/reenvio/revogação.
- Admin vê e altera compra e observação; cliente altera somente os campos permitidos; texto é validado e notas internas não vazam.
- Bloqueio transacional e gravações parciais preservam alterações concorrentes de campos diferentes.
- Exclusão do cliente revoga acesso e convites; transferência de lista muda o proprietário; assinatura e membros do escritório não incluem clientes.
- Links antigos e imagens deixam de funcionar anonimamente; proxy de imagens exige sessão, propriedade e cache privado.
- Interface segue o perfil, mantém estados de carregamento/erro, salva com confirmação e preserva observação digitada em falhas.
- Migração preserva contas, listas, compras e notas; instrui o novo login e o provisionamento administrativo.

Executar os checks obrigatórios das aplicações alteradas: `./mvnw verify` na API; testes, lint e build em `ui/nextjs`. Fazer revisão independente conforme as regras do repositório e conferir telas em desktop e celular.

## Fora do escopo e decisões deixadas ao plano

Fora do escopo: cadastro público, convite de novos admins, superadmin entre escritórios, vários usuários por cliente, chat, histórico/auditoria por alteração, notificações de compras, novos serviços, novas dependências e atualização em tempo real.

O plano escolherá os nomes finais dos endpoints e DTOs novos, a divisão de componentes e serviços, os índices e as restrições SQL concretas e o procedimento de inserção parametrizada de admin. Essas escolhas devem preservar os comportamentos acima, a arquitetura existente e a simplicidade exigida pelo projeto. Não executar migrações nem inserir contas em produção nesta etapa.
