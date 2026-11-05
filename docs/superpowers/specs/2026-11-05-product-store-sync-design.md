# Importação e atualização de produtos de lojas

Data: 2026-11-05. Estado: aprovado pelo usuário, incluindo as propostas técnicas e de comportamento; implementação não iniciada. O usuário solicitou execução em outra sessão com subagentes.

## Intenção e escopo acordado

A arquiteta cola o endereço de um produto para preencher nome, foto e preço e manter esses dados atualizados na lista. Atender inicialmente Moveca, Fonte do Sofá, Westwing, Abra Casa e Casavee. Mercado Livre e Shopee ficam fora.

O preço acompanhado é o valor total anunciado para a versão escolhida, sem desconto exclusivo de Pix, sem frete e sem cupons condicionais. Não confundir parcela com preço total nem preço riscado com preço vigente.

O usuário escolheu atualização diária em segundo plano, somente em listas com itens pendentes e abertas ou editadas por alguém do escritório ou pelo cliente nos últimos 30 dias. Consultas automáticas não contam como uso. Produtos comprados conservam os dados salvos. Ao reabrir uma lista inativa, ela volta a participar das próximas consultas.

## Abordagens consideradas

1. **Consulta diária em segundo plano — escolhida pelo usuário.** Mantém os dados salvos mesmo sem abrir a tela. Exige agendamento e registro de atividade humana.
2. **Consulta ao abrir a lista.** Reduz consultas a listas sem uso, mas o resultado pode chegar depois da abertura e não atualiza sem acesso. Não escolhida.

## Estado atual e restrições

- Next.js chama a API Spring Boot com sessão privada. Produtos, preços, links e imagens são persistidos pela API, com isolamento por escritório e bloqueio da lista antes de escritas em seus itens.
- O formulário permite vários links de compra. Há alterações locais ainda não commitadas para buscar/importar fotos pelo link; preservar esse trabalho e adaptar somente o necessário na implementação.
- A API aceita fotos JPG/PNG de até 5 MB, armazenadas no banco e acessadas pelo proxy privado existente. A área do cliente não recebe preços, fotos ou observações internas; manter esse contrato.
- Não há agendador nem registro de último acesso humano. `ShoppingList.updatedAt` também muda em escritas de produtos e imagens e não serve como evidência de uso humano.
- Usar Java/Spring, PostgreSQL/Flyway e Next.js atuais. Sem serviço externo, navegador automatizado ou dependência nova nesta proposta. Os contratos novos abaixo foram autorizados com a aprovação deste desenho, conforme `api/AGENTS.md`.

## Cadastro e vínculo com a loja

- Reaproveitar o campo de página do produto e oferecer a operação “Buscar produto”. O retorno preenche nome, preço e prévia da foto para conferência antes de salvar. Buscar não cria produto nem inicia atualização persistente.
- Um produto acompanha exatamente uma origem: endereço canônico, loja, identificador de produto e identificador da variante quando existir. Outros links continuam como alternativas de compra, sem disputar o preço acompanhado.
- A prévia identifica a condição do preço e a versão. Só habilitar sincronização quando produto, versão e preço forem identificados sem ambiguidade. Quando o link não distingue uma variante, resolver a escolha explicitamente antes de vincular; usar seleção simples com as opções obtidas da loja, sem presumir a mais barata.
- Na primeira importação a arquiteta pode corrigir os valores, mas o vínculo só fica ativo se os campos sincronizados corresponderem à prévia confirmada. Se preferir valores próprios, pode salvar como produto manual.
- Proposta técnica: produtos antigos permanecem manuais; nenhum vínculo será inferido dos links existentes. Podem ser vinculados explicitamente pela mesma busca na edição.
- Proposta de comportamento: editar manualmente nome, preço ou foto de um produto vinculado desliga a sincronização inteira desse produto, com aviso antes de salvar. Quantidade, ambiente, observações, compra e links alternativos não desligam. Uma nova busca e confirmação reativam o vínculo. Não criar configurações por campo nesta versão.
- Marcar comprado suspende as consultas sem apagar a origem. Desmarcar permite retomá-las se a lista continuar elegível. Não tentar reconstruir o preço efetivamente pago.
- Mostrar no formulário e no item da lista administrativa a origem, a última atualização completa e eventual falha/atualização parcial. A lista aberta não precisa se atualizar em tempo real; uma nova leitura mostra os dados salvos.

## Extração e fotos

Um serviço concreto na API realiza a consulta HTTP e outro componente interpreta os dados de produto. Cadastro e rotina diária usam a mesma extração, para evitar regras divergentes no Next.js e no Java. Não criar uma plataforma genérica de conectores.

Começar pelo JSON-LD `Product`/`Offer` da própria página, incluindo objetos aninhados e `@graph`. Selecionar pelo endereço e identificadores, rejeitando produtos recomendados, ofertas de outra variante e moedas diferentes de BRL. Ajustes específicos por loja só onde necessários para identificar a variante e o preço acordado; não assumir que qualquer `offers.price` é o preço sem Pix. Dados contraditórios ou ambíguos impedem a atualização do campo afetado.

Evidência de consultas diretas em 2026-11-05, sem garantir disponibilidade futura:

| Loja e exemplo | Evidência |
| --- | --- |
| [Moveca](https://moveca.com.br/products/banqueta-ocean) | JSON-LD com nome, imagem, oferta BRL e variante Shopify. |
| [Fonte do Sofá](https://fontedosofa.com.br/produtos/sofa-retratil-libano-linho-ou-veludo/) | Produto em `mainEntity`, outros produtos recomendados na mesma página e opções de tecido/tamanho/cor. Preço normal e Pix distintos. |
| [Westwing](https://www.westwing.com.br/p/mesa-de-cabeceira-greyz-castanho-e-champanhe/AP430CP46ZYQWW-1898884.html) | Produto e oferta BRL em `@graph`, com SKU e imagens. |
| [Abra Casa](https://www.abracasa.com.br/poltrona-orbe-giratoria-duna-botone/p?skuId=2009498) | JSON-LD com SKU `2009498`, imagem e oferta BRL. |
| [Casavee](https://www.casavee.com.br/mesa-lateral-cantik-79-5-cm-x-30-cm-mel-escuro-dourado) | JSON-LD com produto, SKU, imagem e oferta BRL. |

Baixar e persistir a imagem pelo mecanismo privado atual; não depender de carregar a foto diretamente da loja no navegador. A Fonte do Sofá anuncia WebP, mas o mesmo caminho com extensão JPG retornou JPEG válido na consulta direta; validar a imagem recebida, sem assumir sucesso pela extensão. Moveca retornou PNG, Casavee retornou JPEG, e os exemplos de Westwing/Abra Casa apontam para JPG. Manter JPG/PNG e o limite existente. Falhas de foto preservam a anterior e não impedem atualizar nome/preço válidos, com indicação de atualização parcial.

O coletor só recebe páginas HTTPS dos cinco domínios permitidos e variações `www` explicitamente necessárias. Cada redirecionamento e cada download de imagem passa por validação de destino e DNS, bloqueando redes privadas, locais e reservadas, credenciais em URL e portas não permitidas. Fixar a conexão ao endereço público validado para não reintroduzir resolução insegura. Não enviar JWT, cookies, dados de cliente nem cabeçalhos de sessão às lojas/CDNs. Aplicar limites efetivos durante a leitura, de tempo, bytes, redirecionamentos e chamadas. URLs extraídas do HTML não são confiáveis.

## Atividade humana e elegibilidade

Persistir atividade em registro próprio por lista, com exclusão em cascata. Usar o `Clock` injetado e comparar instantes: elegível quando `lastHumanActivityAt >= now - 30 dias` e existe produto não comprado. Não adicionar estado manual de lista ativa.

- Registrar criação e edições humanas bem-sucedidas da lista ou de seus ambientes/produtos/imagens, inclusive compras e observações feitas pelo cliente.
- Abertura significa montagem efetiva da tela de detalhe autenticada, registrada por uma ação explícita. Não contar metadados, pré-carregamento de links, listagens, leitura auxiliar de API nem varreduras do agendador.
- Verificar acesso antes de registrar a abertura. Uma pessoa de outro escritório/cliente recebe 404 sem alterar atividade. Atualizações concorrentes do registro usam o instante mais recente e não mudam `ShoppingList.updatedAt` apenas por abrir a tela.
- Migrar listas existentes sem inferir atividade humana de `updatedAt`: começam sem atividade conhecida e entram na rotina após a primeira abertura ou edição humana. Produtos continuam manuais até serem vinculados.
- Retomar uma lista não força consulta síncrona à loja nem bloqueia a abertura. Se o produto estiver vencido para consulta, a próxima execução do trabalhador o atende.

## Execução diária, persistência e concorrência

Proposta técnica: um trabalhador interno Spring verifica periodicamente produtos elegíveis com consulta vencida; cada produto é tentado no máximo uma vez a cada 24 horas, inclusive após falha. O intervalo curto da varredura é operacional, não muda a frequência diária por produto. Persistir vencimento/tentativa para sobreviver a reinícios e recuperar trabalho vencido quando a API voltar a rodar. A API precisa permanecer em execução para a rotina funcionar.

Persistir junto ao vínculo: origem/variante, sincronização habilitada, versão do vínculo, última tentativa, última sincronização completa, próxima tentativa e resultado resumido (`pending`, `ok`, `partial`, `failed`). O estado inicial é `pending`; a última sincronização completa só avança quando os três campos forem validados e persistidos. Tentativa sem mudança de valores também conta como sucesso. Não guardar o HTML ou um histórico de preços.

Reivindicar cada tentativa atomicamente no PostgreSQL com prazo de expiração, para impedir duplicação entre instâncias sem nova infraestrutura. Após queda, reivindicações expiradas voltam ao trabalho; aplicar limitação por loja, paginação e concorrência limitada. Uma loja indisponível não paralisa as outras. Os tamanhos e intervalos operacionais ficam para o implementador.

Consultar a rede fora da transação que bloqueia a lista. Para aplicar o resultado, bloquear primeiro a lista, recarregar o produto e revalidar escritório, existência, elegibilidade, estado de compra, vínculo habilitado e versão. Descartar resultado de vínculo substituído ou de uma edição manual posterior. Uma edição manual de campos sincronizados desabilita/invalida o vínculo mesmo se a chamada já estiver em andamento. Deleção, transferência de cliente e alterações concorrentes nunca podem ressuscitar itens nem restaurar estados antigos.

Alterações válidas de título/preço/foto podem atualizar a data de modificação normal da lista e seus totais, mas nunca o registro de atividade humana. Reutilizar as regras de persistência de imagem sem chamar um fluxo que registre atividade humana. Substituir imagem apenas se o conteúdo mudar; foto na mesma URL também deve ser reconsultada.

## Contrato proposto e responsabilidades

Todos os caminhos, campos e identificadores novos usam inglês; textos de interface e erros usam português. Preservar `ProblemDetail`, sessão httpOnly, perfis e DTOs restritos do cliente.

- `POST /api/product-imports/preview`, somente admin: recebe `{url, variantId?}` e retorna identificação da loja/produto, variantes quando necessário, nome, preço normal BRL, URL da imagem validada e estado de resolução. Não recebe escritório como autoridade do corpo.
- Acrescentar `storeSync` opcional às requisições administrativas de criação/edição: `null` desliga; objeto com `sourceUrl` e `variantId` vincula explicitamente. Campos ausentes preservam o vínculo em consumidores existentes, exceto quando uma alteração de nome/preço/foto exigir desativação. A API revalida origem e variante; não confiar no navegador para declarar que o vínculo é válido. A resolução exata da prévia confirmada e sua verificação no save ficam para o plano, sem aceitar nova origem com dados de outra prévia.
- Acrescentar `storeSync` opcional à resposta administrativa de produto com origem, variante, habilitação, última tentativa, última sincronização completa e estado. Não expor detalhes internos de erro/rede. Não alterar DTOs de cliente para expor preços, fotos ou metadados de sincronização.
- `POST /api/lists/{id}/activity` e `POST /api/client/lists/{listId}/activity`: sem corpo, registram abertura autorizada e retornam 204. O segundo exige propriedade além do escritório. Next chama o caminho fixo adequado através de Server Action; o navegador não recebe JWT.
- Novas migrações adicionam atividade, vínculo e estado de trabalho com índices para os filtros. Contratos de imagem existentes são preservados. Helpers de prévia e consulta não contam como atividade.

## Falhas, limites e decisões propostas pelo responsável técnico

- Falha, remoção do anúncio, preço ambíguo ou formato incompatível preservam o último dado do campo e registram estado legível. Não zerar preço nem apagar foto. Se não houver dados prévios suficientes, manter cadastro manual disponível.
- Sem confirmação antes de cada mudança diária: o vínculo confirmado autoriza substituição automática dos três campos, nas condições acima.
- Produtos manuais/antigos não se vinculam sozinhos; uma origem por item; edição manual dos campos sincronizados desliga o vínculo inteiro; retomada ocorre na próxima varredura. Estas propostas do responsável técnico foram aprovadas pelo usuário com este documento.
- Sem comparação automática entre lojas, alertas de preço, histórico, frete, login nas lojas ou atualização em tempo real. Não garantir funcionamento de todo o catálogo a partir dos cinco exemplos: variantes e layouts precisam de testes com amostras reais.
- Registrar resultados agregados, duração e falhas por loja, sem tokens, informações de cliente nem URLs completas com parâmetros. Não introduzir serviço de métricas ou alertas nesta versão.

## Aceitação e verificação da implementação futura

1. Prévia/importação de nome, preço na condição acordada e foto nos cinco exemplos; fixture de cada loja e testes contra seleção de recomendado, variante incorreta, parcela, preço Pix, moeda errada e dados contraditórios. Verificação manual dos exemplos reais como evidência adicional, sem rede externa na suíte determinística.
2. Relógio controlado comprova limite de 30 dias, abertura humana dos dois perfis, ausência de atividade por prefetch/metadados/rotina, intervalo de 24 horas, retomada, lista concluída e produto comprado. Desmarcar compra torna o produto elegível novamente.
3. Falha/resultado parcial preserva os últimos dados; imagem modificada na mesma URL é atualizada; produtos manuais e edições próprias são respeitados.
4. Casos de escritório/cliente alheio, SSRF/redirect/DNS, limites de leitura, reivindicação simultânea, expiração após queda e compra/edição/deleção durante coleta têm cobertura na camada responsável.
5. RED-GREEN-REFACTOR antes de alterar comportamento, revisão independente `code-quality-reviewer` após implementar e checks finais de `api/AGENTS.md` e `ui/AGENTS.md`. Neste documento só houve inspeção de fonte e consultas HTTP; testes/builds ainda não foram executados e não há alegação de implementação pronta.

## O que fica para o plano

Definir arquivos e migrações, formato detalhado dos DTOs/erros, tratamento de ausência versus `null`, validação da prévia no save, parâmetros operacionais e ordem de testes/implementação. Manter componentes concretos e existentes sempre que servirem à responsabilidade. Não adicionar dependências nem mudar controles de acesso sem autorização adicional específica se o plano demonstrar essa necessidade.
