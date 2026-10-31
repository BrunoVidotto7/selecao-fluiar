# Seleção Fluiar — clientes e listas de compras

Interface para arquitetas e designers de interiores gerenciarem clientes e listas
de compras por ambiente. A aplicação Next.js usa a API REST em `../api/` para
autenticação e persistência, mantendo a identidade da página original "Seleção Fluiar".

Este pacote tem duas versões:

| Pasta | O que é | Para quem |
|---|---|---|
| `html/` | HTML + CSS + JavaScript puro. Abra `html/index.html` no navegador. | Avaliar o design rapidamente, sem instalar nada. |
| `nextjs/` | Next.js 15 (App Router) com React 19, integrado à API. | Usar e desenvolver o sistema persistente. |

Somente a versão HTML continua sendo um protótipo com dados fictícios. A versão
Next.js não usa dados de demonstração nem simula salvamentos.

---

## Versão HTML (`html/`)

```
html/
├── index.html              Mapa de telas
├── login.html, cadastro.html, recuperar-senha.html, nova-senha.html
├── dashboard.html, clientes.html, cliente.html, cliente-form.html
├── listas.html, lista.html, lista-form.html, produto-form.html
├── configuracoes.html
└── assets/
    ├── app.css             Estilos compartilhados (tokens + componentes)
    ├── lista.css           Regras da página original da lista
    └── app.js              Menu, avisos, modal de exclusão, validação, busca
```

Estados extras pelo final do endereço: `#vazio` (estados vazios), `#editar` (formulários em modo edição), `#erro` (login), `#enviado` (recuperação de senha).

---

## Versão Next.js (`nextjs/`)

Requer Node.js 22.22.2 (linha 22), 24.15 (linha 24) ou 26 e mais recente.

```bash
cd nextjs
npm install
npm run dev        # abre em http://localhost:3000
```

Para produção: `npm run build` e `npm start`.
Pare o servidor de desenvolvimento antes do build: ambos gravam em `.next/`.

### Configuração da API

A integração usa chamadas no servidor Next.js. Configure a origem da API em
`nextjs/.env.local`, sem o sufixo `/api`:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8080
```

Para usar os fluxos integrados localmente, a API precisa estar em execução. Ela exige
JDK 25, Docker, PostgreSQL, Mailpit e a variável `JWT_SECRET`. Siga as instruções de
[`../api/README.md`](../api/README.md) antes de iniciar o Next.js. Os testes unitários
da interface simulam a API e não precisam desses serviços.

O JWT fica somente no cookie httpOnly `fluiar_session`, nunca no armazenamento do
navegador ou nas respostas das ações. O cookie de sessão não tem prazo persistente;
ao escolher lembrar o acesso, ele usa o `expiresAt` enviado pela API. Apenas ações
do servidor podem gravar ou apagar esse cookie, não a renderização de páginas.

### Fluxos persistentes

- Cadastro e login abrem a área privada do escritório. Recuperação de senha usa
  o link `/nova-senha?token=...` enviado por e-mail; envio e reenvio aguardam a API.
- Clientes têm suas próprias listas. Crie uma lista, abra **Gerenciar ambientes**
  e adicione, renomeie ou reordene os ambientes antes de cadastrar produtos.
- Clientes, listas, ambientes e produtos usam UUIDs da API. A pré-seleção de
  ambiente usa `?ambiente=<UUID>`; a de cliente usa `?cliente=<UUID>`.
- Produtos guardam quantidade, preço opcional, observações internas e links de
  loja com suas notas. O formulário salva o produto antes de enviar/remover a
  imagem. Se a imagem falhar, o produto já salvo permanece e a tentativa seguinte
  reutiliza seu UUID, sem duplicá-lo.
- Quantidade e marcação de compra aguardam a gravação. Um rascunho de quantidade
  inválido não vira uma compra. Produtos e totais exibidos vêm das leituras
  atualizadas da API, não de cálculos otimistas.
- **Configurações** salva perfil e senha separadamente. Alterar a senha substitui
  o cookie pelo novo token antes de anunciar sucesso. Sair limpa a sessão.
- Formulários usam `useApiForm`, ações do servidor e mensagens da API. Falhas
  mostram `detail` no aviso e `errors[field]` junto ao campo. Duplicatas ficam
  bloqueadas durante o envio; sair da tela descarta avisos e navegação tardios.

### Compartilhar com o cliente

1. Na lista, mesmo vazia, clique em **Copiar link**. Isso copia o endereço público
   `/l/<token>` na origem do frontend, sem gerar outro token.
2. Quem abrir o endereço não precisa entrar. A página mostra nome e descrição da
   lista, ambientes com produtos, quantidades, compras, links e notas das lojas,
   além do nome do escritório e de seus membros.
3. A página pública não mostra preços, imagens, IDs, observações internas ou dados
   de contato do cliente. Não tem edição, navegação privada nem envia a sessão à
   API. Cada leitura é sem cache; token inexistente, inválido ou antigo retorna 404.
4. **Gerar novo link** pede confirmação: o endereço anterior deixará de funcionar.
   Só após a API confirmar a alteração o novo token passa a ser mostrado e copiado.
   Envie o novo endereço ao cliente. Uma falha mantém o link anterior.
5. Se a área de transferência for negada ou indisponível, selecione o campo
   **Link público** e copie manualmente. O aplicativo não anuncia uma cópia que falhou.
6. Se a leitura da API falhar, **Tentar novamente** solicita uma nova leitura no
   servidor e reinicia a tela de erro.

### Convites pelo Mailpit

Com a API e o Next.js em execução conforme a configuração acima:

1. Entre com uma conta em `/login`, abra `/escritorio` e envie um convite para um
   e-mail que ainda não tenha conta.
2. Abra o Mailpit em `http://localhost:8025`, encontre a mensagem de convite e abra
   o link completo `/convite?token=...`. O link vale por 7 dias; reenviar o convite
   para o mesmo e-mail no mesmo escritório invalida o link anterior.
3. Confira o escritório, quem convidou e o e-mail fixo. Informe seu nome e uma
   senha, confirme-a e clique em **Criar conta e aceitar convite**. Não há escolha
   de outro e-mail ou escritório.
4. A aceitação cria a conta convidada e entra nela neste navegador, com cookie de
   sessão não persistente. Se já havia outra conta conectada, somente a sessão
   deste navegador é substituída: a conta anterior não é movida nem modificada.
   Apenas abrir o link não troca a sessão.
5. Para conferir os dados compartilhados, abra a mesma lista com as duas contas
   do escritório, usando navegadores ou perfis separados.
6. Reabra um link já aceito, revogue um convite pendente ou teste o link antigo
   após um reenvio. A página deve pedir um novo convite, sem formulário de conta.
   Se o link for revogado entre a abertura e o envio, a aceitação deve falhar sem
   trocar a sessão. Um e-mail que ganhou uma conta nesse intervalo também não
   permite a aceitação. Falhas da API não devem indicar sucesso; na leitura,
   use **Tentar novamente** após o serviço voltar.

### Estrutura

```
nextjs/
├── app/
│   ├── layout.js                  Fontes, estilos globais, avisos e modal
│   ├── styles/app.css             Design system (tokens de cor, tipografia, componentes)
│   ├── styles/lista.css           Regras da página original da lista
│   ├── (auth)/                    Telas de acesso (layout com painel da marca)
│   │   ├── login/  cadastro/  recuperar-senha/  nova-senha/  convite/
│   ├── l/[shareToken]/            Lista pública somente para leitura
│   └── (app)/                     Telas internas (layout com menu lateral)
│       ├── dashboard/
│       ├── clientes/              lista · novo/ · [id]/ · [id]/editar/
│       ├── listas/                lista · nova/ · [id]/ · [id]/editar/
│       │   ├── [id]/ambientes/    Gerenciamento de ambientes
│       │   └── [id]/produtos/     novo/ · [produtoId]/editar/
│       ├── configuracoes/
│       └── escritorio/
├── components/
│   ├── ui/            Icon, Button, Fields (inputs, senha, segmentado, busca), Display (cabeçalho, estado vazio, selos…)
│   ├── layout/        AppShell (menu desktop + gaveta mobile), AuthLayout
│   ├── feedback/      FeedbackProvider: avisos (toast) e confirmação de exclusão
│   ├── forms/         useApiForm: formulários assíncronos e erros por campo
│   ├── auth/          Formulários de login, cadastro e senha
│   ├── clientes/      Tabela, formulário e exclusão de clientes
│   ├── listas/        Tabela, cartões e formulário de listas
│   ├── ambientes/     Criação, nomes e ordem dos ambientes
│   ├── lista/         Lista privada, exibição pública e controles de compartilhamento
│   ├── produtos/      Formulário de produto
│   └── configuracoes/ Formulário de configurações
├── lib/
│   ├── api.server.js      Chamadas HTTP na origem fixa da API e erros esperados
│   ├── session.server.js  Cookie de sessão httpOnly
│   ├── route-input.js     Validação completa de UUIDs e tokens opacos
│   ├── format.js          Moeda, iniciais, máscara de telefone…
│   └── validation.js      Regras de validação dos formulários
└── test-support/fixtures.js  Dados com o formato da API, somente para testes
```

### Rotas

| Tela | Rota |
|---|---|
| Login | `/login` |
| Cadastro | `/cadastro` |
| Recuperar senha | `/recuperar-senha` |
| Nova senha | `/nova-senha?token=...` |
| Convite | `/convite?token=...` |
| Dashboard | `/dashboard` |
| Clientes | `/clientes` · `/clientes/novo` · `/clientes/[id]` · `/clientes/[id]/editar` |
| Listas | `/listas` · `/listas/nova` · `/listas/[id]` · `/listas/[id]/editar` |
| Ambientes | `/listas/[id]/ambientes` |
| Produtos | `/listas/[id]/produtos/novo` · `/listas/[id]/produtos/[produtoId]/editar` |
| Lista pública | `/l/[shareToken]` |
| Configurações | `/configuracoes` |
| Escritório e convites | `/escritorio` |

Estados vazios e erros vêm da API. Os antigos parâmetros `?estado=` não controlam
a aplicação Next.js.

### Testes e verificações

Execute em `ui/nextjs/` a partir da raiz do repositório, ou em `nextjs/` a partir
desta pasta:

```bash
npx vitest run components/lista/ShareControls.test.js  # teste afetado durante a implementação
npx vitest run components/forms/useApiForm.test.js    # envios assíncronos e erros
npm run lint
npm test
npm run build                                        # após parar o servidor de desenvolvimento
```

Os testes usam Vitest, Testing Library e jsdom, com DTOs completos em
`test-support/fixtures.js`. Não há testes automatizados de ponta a ponta; verificar
o fluxo real e o layout no navegador continua necessário. Na execução dividida
por tarefas, o controlador reúne as verificações finais completas.

Leia [`AGENTS.md`](AGENTS.md) antes de editar. Não adicione ou atualize dependências
nem ferramentas sem aprovação; quando aprovado, use versões exatas publicadas há
pelo menos 7 dias. Não grave segredos ou edite arquivos gerados. Preserve o
histórico de revisão em `nextjs/docs/quality-ledger.md`.

Avisos conhecidos e aceitos: duas ocorrências de `no-img-element` no lint
(`RoomTable.js` e `ProductForm.js`), inferência da raiz do workspace no build
e o aviso de PostCSS dentro do Next 15. Não os corrija como efeito colateral.
