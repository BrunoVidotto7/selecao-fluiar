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

Em produção, defina também `TRUSTED_CLIENT_IP_HEADER` (somente no servidor Next, nunca `NEXT_PUBLIC_`) com
`x-forwarded-for` (usa a última entrada) ou `x-real-ip`. O proxy na frente do Next deve sobrescrever esse
cabeçalho; sem a variável, o Next não repassa o endereço do navegador e a API aplica só os limites por e-mail.

Para usar os fluxos integrados localmente, a API precisa estar em execução. Ela exige
JDK 25, Docker, PostgreSQL, Mailpit e a variável `JWT_SECRET`. Siga as instruções de
[`../api/README.md`](../api/README.md) antes de iniciar o Next.js. Os testes unitários
da interface simulam a API e não precisam desses serviços.

O JWT fica somente no cookie httpOnly `fluiar_session`, nunca no armazenamento do
navegador ou nas respostas das ações. O cookie de sessão não tem prazo persistente;
ao escolher lembrar o acesso, ele usa o `expiresAt` enviado pela API. Apenas ações
do servidor podem gravar ou apagar esse cookie, não a renderização de páginas.

### Fluxos persistentes

- O login direciona administradores à área do escritório e clientes a `/minhas-listas`.
  Contas de administrador são inseridas no banco; clientes entram por convite. Não há cadastro público.
  Recuperação de senha usa
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

### Acesso do cliente e compartilhamento

1. O administrador abre o cadastro do cliente e usa **Acesso do cliente** para enviar
   um convite ao e-mail cadastrado. Pode reenviar ou revogar um convite pendente.
2. No Mailpit (`http://localhost:8025`), abra `/invitation?token=...`. O cliente
   define somente sua senha. O link vale por 7 dias; reenvio invalida o anterior.
3. Após aceitar, o cliente vê suas listas em `/minhas-listas`, marca ou desmarca compras
   e salva observações por produto. O administrador acompanha e altera esses dados
   na lista administrativa. Observações internas permanecem separadas.
4. Outro cliente, mesmo do mesmo escritório, não pode ler nem alterar essa lista.
   Preços e observações internas não aparecem na visão do cliente.
5. **Copiar link** copia `/l/<token>`. O endereço exige login e verifica a propriedade
   da lista; possuir o link não concede acesso. **Gerar novo link** invalida o anterior.
6. Mudanças no e-mail de contato invalidam convites pendentes. Uma conta já ativa
   mantém seu próprio e-mail de login, mostrado no cadastro do cliente.

Para conferir o fluxo real, use perfis de navegador separados para administrador e
clientes. Confira um link revogado, expirado e aceito, a troca do contato antes da
aceitação e a recusa de acesso à lista de outro cliente. Leituras com falha oferecem
**Tentar novamente**; envios com falha preservam os rascunhos.

### Estrutura

```
nextjs/
├── app/
│   ├── layout.js                  Fontes, estilos globais, avisos e modal
│   ├── styles/app.css             Design system (tokens de cor, tipografia, componentes)
│   ├── styles/lista.css           Regras da página original da lista
│   ├── (auth)/                    Telas de acesso (layout com painel da marca)
│   │   ├── login/  cadastro/  recuperar-senha/  nova-senha/  invitation/
│   ├── l/[shareToken]/            Resolução de link com login e autorização
│   └── (app)/                     Telas internas (layout com menu lateral)
│       ├── minhas-listas/              Listas do cliente e detalhe [id]/
│       ├── (admin)/               Agrupa as rotas administrativas abaixo
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
│   ├── auth/          Formulários de login e senha
│   ├── clientes/      Tabela, formulário e exclusão de clientes
│   ├── listas/        Tabela, cartões e formulário de listas
│   ├── ambientes/     Criação, nomes e ordem dos ambientes
│   ├── lista/         Lista administrativa, observações e compartilhamento
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
| Cadastro antigo | `/cadastro` redireciona ao login |
| Recuperar senha | `/recuperar-senha` |
| Nova senha | `/nova-senha?token=...` |
| Convite | `/invitation?token=...` (endereço antigo redireciona) |
| Dashboard | `/dashboard` |
| Clientes | `/clientes` · `/clientes/novo` · `/clientes/[id]` · `/clientes/[id]/editar` |
| Listas | `/listas` · `/listas/nova` · `/listas/[id]` · `/listas/[id]/editar` |
| Ambientes | `/listas/[id]/ambientes` |
| Produtos | `/listas/[id]/produtos/novo` · `/listas/[id]/produtos/[produtoId]/editar` |
| Listas do cliente | `/minhas-listas` · `/minhas-listas/[id]` |
| Link com acesso restrito | `/l/[shareToken]` |
| Configurações | `/configuracoes` |
| Escritório | `/escritorio` |

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
(`ProductThumb.js` e `ProductForm.js`), inferência da raiz do workspace no build
e o aviso de PostCSS dentro do Next 15. Não os corrija como efeito colateral.
