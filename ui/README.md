# Seleção Fluiar — telas do sistema de listas de compras

Protótipo visual (sem backend) do sistema para arquitetas e designers de interiores gerenciarem clientes e listas de compras. Todas as telas seguem a identidade da página original "Seleção Fluiar".

Este pacote tem duas versões das mesmas telas:

| Pasta | O que é | Para quem |
|---|---|---|
| `html/` | HTML + CSS + JavaScript puro. Abra `html/index.html` no navegador. | Avaliar o design rapidamente, sem instalar nada. |
| `nextjs/` | Next.js 15 (App Router) com React 19, dividido em componentes. | Base para o desenvolvedor implementar o sistema. |

Os dados são fictícios e nada é salvo. Botões e formulários funcionam só como protótipo (validação visual, avisos, confirmações).

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

### Estrutura

```
nextjs/
├── app/
│   ├── layout.js                  Fontes, estilos globais, avisos e modal
│   ├── styles/app.css             Design system (tokens de cor, tipografia, componentes)
│   ├── styles/lista.css           Regras da página original da lista
│   ├── (auth)/                    Telas de acesso (layout com painel da marca)
│   │   ├── login/  cadastro/  recuperar-senha/  nova-senha/
│   └── (app)/                     Telas internas (layout com menu lateral)
│       ├── dashboard/
│       ├── clientes/              lista · novo/ · [id]/ · [id]/editar/
│       ├── listas/                lista · nova/ · [id]/ · [id]/editar/
│       │   └── [id]/produtos/     novo/ · [produtoId]/editar/
│       └── configuracoes/
├── components/
│   ├── ui/            Icon, Button, Fields (inputs, senha, segmentado, busca), Display (cabeçalho, estado vazio, selos…)
│   ├── layout/        AppShell (menu desktop + gaveta mobile), AuthLayout, ProtoNav
│   ├── feedback/      FeedbackProvider: avisos (toast) e confirmação de exclusão
│   ├── forms/         useDemoForm: estado e validação dos formulários
│   ├── auth/          Formulários de login, cadastro e senha
│   ├── clientes/      Tabela, formulário e exclusão de clientes
│   ├── listas/        Tabela, cartões e formulário de listas
│   ├── lista/         Página da lista de compras (ShoppingList, RoomTable, ClientView…)
│   ├── produtos/      Formulário de produto
│   └── configuracoes/ Formulário de configurações
└── lib/
    ├── data.js        Dados fictícios — trocar pelas chamadas reais à API
    ├── format.js      Moeda, iniciais, máscara de telefone…
    └── validation.js  Regras de validação dos formulários
```

### Rotas

| Tela | Rota |
|---|---|
| Login | `/login` (erro: `/login?estado=erro`) |
| Cadastro | `/cadastro` |
| Recuperar senha | `/recuperar-senha` (enviado: `?estado=enviado`) |
| Nova senha | `/nova-senha` |
| Dashboard | `/dashboard` |
| Clientes | `/clientes` · `/clientes/novo` · `/clientes/[id]` · `/clientes/[id]/editar` |
| Listas | `/listas` · `/listas/nova` · `/listas/[id]` · `/listas/[id]/editar` |
| Produtos | `/listas/[id]/produtos/novo` · `/listas/[id]/produtos/[produtoId]/editar` |
| Configurações | `/configuracoes` |

Acrescente `?estado=vazio` ao dashboard, clientes, detalhe do cliente, listas e lista para ver os estados vazios.

### Para implementar de verdade

- Troque os dados de `lib/data.js` por chamadas à API ou ao banco de dados.
- Em `components/forms/useDemoForm.js`, o `setTimeout` simula o servidor; troque pela requisição real no `onSuccess`.
- Exclusões e marcações de "comprado" hoje só mudam o estado da tela; ligue-as à API.
- Todas as listas usam os mesmos produtos de exemplo (`SAMPLE_ROOMS`).
- Remova o `ProtoNav` (botão "Telas") do `app/layout.js` antes de publicar.
- Autenticação não está implementada: as telas de acesso apenas redirecionam.
