# Temas do Nostermentor — especificação

> **RASCUNHO — 2026-09-05 (terceira revisão do dia: os três primeiros temas,
> a galeria, e agora a leva que levou o app de 4 a 21 temas); 2026-09-11: o
> campo `exclusivo` do manifesto, o `inicio` do molde de página e o filtro de
> medição por tema.** Este documento
> descreve o que um tema tem de ser para funcionar por inteiro com o
> Nostermentor. Só passa de rascunho a especificação quando um tema escrito
> por alguém de fora o tiver usado de verdade. A seção 11 diz, sem rodeios,
> o que o app ainda não faz.

O que se quer é simples de enunciar: **qualquer pessoa com este documento à
frente consegue escrever o seu tema**, sem ler o código do app. Se alguma
seção exigir ler o código, a seção está incompleta — diga.

---

## 1. O que é um tema aqui

Um tema é um **pacote de dados**: um manifesto, oito moldes de HTML e uma
função que devolve a folha de estilo. **Nunca é programa.** O painel de
administração não executa uma linha do tema, e o site publicado não tem uma
linha de script de ninguém.

Isto não é uma limitação técnica que um dia se levanta. É a razão de ser do
produto: quem publica com o Nostermentor está, em geral, a fazê-lo por trás
do Tor, e quem lê o site também. Um tema que executasse código no painel
teria a chave do dono ao alcance; um tema que trouxesse um recurso de outro
servidor entregaria o endereço de cada leitor a esse servidor. As duas coisas
são proibidas, e a seção 8 explica cada uma.

O que o tema **controla**: a estrutura HTML de cada tipo de página (os
moldes), a folha de estilo, e as opções que oferece ao dono do site.

O que o tema **não controla**: o conteúdo (o dono escreve Markdown, e o app
transforma-o em HTML sem classe nenhuma), os caminhos dos arquivos gerados, o
`site.json`, e o filtro de segurança aplicado ao conteúdo.

## 2. Começar: o caminho mais curto

O tema mais simples é um tema **só de CSS**: usa os oito moldes que o app já
traz e escreve apenas a função `css(opcoes)`.

```js
const templates = Temas.moldes;                    // os oito, como estão
```

E, se quiser trocar só um deles (desenhar a capa da página, pôr a data antes
do título, o que for):

```js
const templates = Object.freeze(Object.assign({}, Temas.moldes,
  { pagina: oMeuMoldeDePagina }));                  // troca só o que quiser
```

`Temas.moldes` vive em `src/core/temas.js` e é, byte a byte, o que o tema
Padrão sempre produziu. **Dos 21 temas, 18 usam o `layout` do core; três — o
Diário, o Jornal e o Moderno — têm `layout` próprio** (medido em 2026-09-05,
procurando `const layout = [` arquivo a arquivo). Os moldes escrevem HTML com todas as classes da
seção 5, e é nelas que a folha de estilo se agarra. **Dos 21 temas que o app
traz, 12 não trocam molde nenhum** — são só folha de estilo (contados pelo
sha256 do jogo de moldes de cada um, 2026-09-05).

⚠️ **Mexer num molde de `Temas.moldes` é mexer em 12 temas de uma vez**, e
obriga a subir a `version` de cada um: o site publicado é comparado por
sha256 arquivo a arquivo (seção 9), logo um byte diferente no molde
republica todas as páginas de todos os sites que o usem.

Cada tema vive num único arquivo, `src/tema/<id>/tema.js`, e termina por se
registar: `Temas.registar(TemaX)`. É só isso que o app precisa para o
oferecer na tela **Temas** — a montagem (`./monta_app.sh`) pega todos os
arquivos de `src/tema/`, e o registro (`src/core/temas.js`) é a única porta
entre o app e os temas.

O app traz **21 temas** para todos — e, desde 2026-09-11, um vigésimo segundo,
**Nostermentor**, reservado ao site oficial do projeto pelo campo `exclusivo`
(seção 3): não aparece na tela Temas de mais ninguém, e por isso não está na
tabela abaixo. É também o exemplo de um tema que usa o `inicio` (seção 4) para
fazer da capa uma vitrine. Os quatro primeiros são os exemplos de referência
mais completos (todos trocam moldes); os restantes mostram até onde se chega
sem trocar nenhum:

| id | Nome | O que é |
|---|---|---|
| `padrao` | Padrão | o tema de origem: sóbrio, uma coluna, oito opções |
| `diario` | Diário | folha de caderno pautada com margem vermelha; título numa etiqueta de capa, menu em separadores, data carimbada, fotografias "coladas" |
| `jornal` | Jornal | cabeçalho de banca entre filetes, menu como barra de seções, texto em colunas, capitular, primeira página em grade |
| `moderno` | Moderno | letra do sistema sem serifa, cabeçalho fixo com barra de cor, capa a toda a largura, cartões com sombra, claro/escuro/automático |
| `vintage` | Vintage | folha de rosto de 1900: simetria central, filete duplo, versaletes espaçados, florão tipográfico a abrir cada página |
| `livro` | Livro | a página impressa: margens largas, texto justificado, capitular, e o blog como um ÍNDICE com pontilhado |
| `mercado` | Mercado | jornal econômico: papel salmão, tinta azul-marinho, tabelas com algarismos de largura fixa e linhas alternadas, data antes do título |
| `panfleto` | Panfleto | a folha fotocopiada: tarja preta no cabeçalho, maiúsculas pesadas, barra grossa sob o título, carimbo inclinado na data, textura de fotocópia |
| `manifesto` | Manifesto | cartaz de causa: faixa em degradê a toda a largura, título enorme, citações do tamanho de um slogan |
| `terminal` | Terminal | console: tudo em largura fixa, `$` antes dos títulos, menu entre parênteses retos, cursor parado |
| `pixel` | Pixel | 8 bits: contornos grossos, sombra dura sem desfoque, cabeçalho como caixa de diálogo |
| `neon` | Neon | painel de instrumentos: escuro, cor que brilha, cantos cortados na diagonal com `clip-path`, grade de fundo |
| `defi` | DeFi | índigo profundo, degradê de duas cores que o dono escolhe, cartões redondos com halo, nome do site pintado com o degradê |
| `satoshi` | Satoshi | laranja e preto, e a lista de publicações como uma corrente de blocos ligados por um elo |
| `limpo` | Limpo | branco, muito ar, título grande, um acento discreto, sem caixas nem sombras |
| `minimo` | Mínimo | a ausência: sem cor de destaque, sem filetes, sem sombras, coluna estreita |
| `noturno` | Noturno | o escuro para LER: ardósia, texto quente em vez de branco puro, entrelinha larga, zero efeitos |
| `contraste` | Alto contraste | legibilidade acima de tudo: letra grande, preto/branco puros (ou amarelo sobre preto), contorno de foco grosso |
| `natureza` | Natureza | verdes e terras, cantos assimétricos de folha, degradê de horizonte, e a capa da página desenhada |
| `fotografia` | Galeria | para imagens: cromo mínimo, capa acima do título, grade densa cuja largura mínima o dono escolhe |
| `quadrinhos` | Quadrinhos | retícula de pontos, contornos pretos grossos, e o resumo dentro de um balão de fala com bico |

Quando este documento e um desses arquivos divergirem, o arquivo está certo
e este documento tem de ser corrigido.

## 3. O pacote e o manifesto

Um tema exporta um objeto congelado com quatro membros:

```
{
  manifesto,                       // quem é o tema e que opções oferece
  templates: { layout, pagina, artigo, blog, etiqueta, alias, botao, galeria },
  css(opcoes)      → string,       // a folha de estilo, função pura das opções
  resolver(opcoes) → objeto        // as opções validadas, todas preenchidas
}
```

Os `templates` são quase sempre `Temas.moldes`, ou uma cópia dele com um ou
outro molde trocado (seção 2). O que o app oferece a quem escreve um tema,
todo em `src/core/temas.js`, é só isto — e nada disto é obrigatório:

| | O que faz | Onde é obrigatório |
|---|---|---|
| `Temas.moldes` | os oito moldes base | — |
| `Temas.resolver(options, opcoes)` | valida as opções contra o manifesto e descarta o que não bate | a validação é obrigatória (seção 6); fazê-la à mão é permitido |
| `Temas.cor` | `paraRgb`, `paraHex`, `brilho`, `misturar`, `legivelSobre`, `textoSobre`, `acentoLegivel` — tudo em aritmética inteira | — (mas a regra dos inteiros é, seção 9) |
| `Temas.registar(tema)` | põe o tema no registro | sim, é a última linha do arquivo |

O manifesto:

| Campo | Tipo | O que é |
|---|---|---|
| `id` | texto | identificador do tema; é o que vai em `site.theme.id` no `site.json`. Convenção: minúsculas, dígitos e hífen, como `padrao` (o código ainda não impõe formato) |
| `version` | inteiro | versão do tema; **sobe sempre que a folha de estilo ou um molde muda** (o Padrão está na 4; os três novos na 1). Só sobe, nunca desce |
| `nome` | texto | o nome que o painel mostra |
| `autor` | texto | quem o assina; "autor desconhecido" é um rótulo válido, omitir não é |
| `engine_min` | inteiro | a versão mínima do motor de geração que o tema exige (hoje só existe a 1) |
| `options` | objeto | as opções que o painel desenha, na ordem em que aparecem — seção 6 |
| `exclusivo` | texto (opcional) | uma **npub**: só quem entra no painel com ela vê o tema na tela **Temas** (desde 2026-09-11 — é o caso do tema do site oficial do projeto). Esconder da escolha não é proibir o uso: o gerador desenha com o tema qualquer site que o nomeie. Ausente, todos o veem |

O `site.json` publicado guarda `theme: { id, version, options }`: o id do
tema, a versão com que o site foi publicado, e os valores que o dono escolheu.
Ao trocar de tema na tela **Temas**, o app grava o id novo e a `version` do
manifesto dele. As opções **são do tema, não do site**: as do tema anterior
não vão com ele. ✅ **Desde 2026-09-05 elas não se perdem** — ficam guardadas
numa gaveta local (`site.theme_memory`, que vai no backup e **nunca** no
`site.json` publicado) e **voltam sozinhas** se o dono voltar a este tema.
Para quem escreve um tema isto é transparente: continua a receber em
`options` só o que é seu.
Um `id` que este app não conhece não impede a publicação: o site sai com o
Padrão e a tela diz qual tema falta.

⚠️ **O `nome` e o `autor` do manifesto passaram a ser visíveis** (2026-09-05):
a tela Temas mostra um cartão por tema com o nome, o autor, a versão e uma
**pré-visualização do site de quem está escolhendo**, gerada com o seu tema.
Vale a pena que o `nome` seja curto e que o `autor` seja como quer ser
creditado — é o que aparece no cartão.

## 4. Os oito moldes

Os moldes são **Mustache sem lógica**: `{{campo}}` insere o valor escapado
para HTML, `{{{campo}}}` insere-o cru (só para o que já vem sanitizado, como
`corpo` e `conteudo`), `{{#x}}…{{/x}}` repete ou condiciona, `{{^x}}…{{/x}}`
é o "senão". Não há funções, nem cálculos, nem acesso a nada fora do
contexto: **tudo o que o molde precisa chega pré-calculado.**

| Molde | Produz | Contexto que recebe |
|---|---|---|
| `layout` | a página HTML inteira, de `<!doctype>` a `</html>` | `lang`, `titulo_pagina`, `descricao`, `site_titulo`, `logo{src,alt,largura,altura}` ou `null`, `favicon{src,tipo}` ou `null`, `menu[]{href,rotulo,externo,atual}`, `conteudo` (HTML já pronto, vindo de um dos moldes abaixo), `doacoes{lightning_address}` ou `null`, `credito` (booleano) |
| `pagina` | o miolo de uma página fixa | `titulo`, `corpo` (HTML sanitizado do Markdown), `ultimos{blog_titulo,blog_href,artigos[]{href,titulo,data,data_iso}}` ou `null`, `capa{src,alt,largura,altura,legenda}` ou `null`, `inicio` (booleano: esta página é a capa do site — desde 2026-09-11; um tema pode desenhar a capa como vitrine e as outras páginas como texto de ler, a partir do mesmo Markdown) |
| `artigo` | o miolo de um artigo | `titulo`, `data`, `data_iso`, `tem_tags`, `tags[]{nome,href}` (`href` é `null` quando a etiqueta não tem página), `capa{…}` ou `null`, `corpo` |
| `blog` | a listagem do blog | `blog_titulo`, `tem_artigos`, `artigos[]{href,titulo,data,data_iso,resumo}` |
| `etiqueta` | a listagem de uma etiqueta | `etiqueta` (nome a mostrar), `blog_titulo`, `blog_href`, `tem_artigos`, `artigos[]{…}` como no blog |
| `alias` | a página HTML inteira de um endereço antigo, que redireciona | `lang`, `titulo`, `destino` |
| `botao` | o bloco `[[botao: texto -> destino]]` escrito no Markdown | `texto`, `href`, `externo` |
| `galeria` | o bloco `[[artigos: …]]` escrito no Markdown | `tem_artigos`, `artigos[]{href,titulo,data,data_iso,resumo,capa{src,alt,largura,altura,href}` ou `null}` |

Notas que evitam surpresas:

- **`layout` é chamado uma vez por página**, com `conteudo` já preenchido por
  `pagina`, `artigo`, `blog` ou `etiqueta`. `alias` é a exceção: produz a
  página inteira sozinho, sem `layout`, porque é um stub de redirecionamento.
- ⚠️ **Quem troca o `layout` herda o `<head>` inteiro, e com ele obrigações
  que não são visuais.** Hoje são duas: o `<link rel="stylesheet">` do tema e
  o `<link rel="icon">` do ícone da aba (`{{#favicon}}`). Um tema que copie um
  `layout` antigo e esqueça a segunda linha gera um site **sem ícone**, e nada
  quebra — simplesmente não aparece.
  ➜ **Isto já aconteceu connosco, em 2026-09-05:** ao pôr o ícone no molde do
  core, a afirmação escrita era *"nenhum tema troca o `layout`, logo uma linha
  serve os 21"*. Era **falsa**: o Diário, o Jornal e o Moderno — os três
  primeiros temas escritos — têm `layout` próprio. Quem a escreveu procurou
  `layout:` e não viu o `const layout = [...]` seguido de `{ layout, … }` na
  forma abreviada. **Quem apanhou foi o teste**, que mede os 21 e não lê a
  fonte (`test/core/gerador.test.js`, caso do favicon). A lição é a mesma da
  T12: *uma afirmação sobre N temas mede-se nos N.*
- **`alias` (a página de redirecionamento) NÃO leva ícone**, e é decisão:
  ninguém a vê — ela salta para outro endereço num piscar —, e um `<link>`
  ali custaria a cada leitor um pedido a mais por nada.
- **A capa chega ao molde `pagina` e o tema Padrão não a desenha, de
  propósito** (decisão de 2026-08-31). É um dado à espera de um tema que a
  queira: basta acrescentar o bloco `{{#capa}}…{{/capa}}`.
- **O `href` de `botao` já foi validado** pelo app: é um caminho do próprio
  site ou um endereço `http(s)`. Um `javascript:` nunca chega ao molde. Ainda
  assim, o molde deve inserir `href` com `{{href}}` (escapado), nunca cru.
- **A `data` vem formatada** pelo app (por omissão `AAAA-MM-DD`; com a hora,
  se o dono ligar essa opção). `data_iso` é o valor para `datetime=`.
- **Os blocos `botao` e `galeria` nascem dentro do `corpo`**, no ponto em que
  o dono escreveu o marcador; o tema não os posiciona.

## 5. As classes CSS que são contrato

Quem escreve um tema só de CSS tem **estas classes, e só estas**, produzidas
pelos moldes do Padrão:

```
.cabecalho  .marca  .marca-logo  .menu  .principal  .rodape  .apoie  .credito
.pagina  .artigo  .blog  .etiqueta-pagina  .ultimos  .lista-artigos  .meta
.resumo  .vazio  .capa  .etiqueta  .cta  .botao
.galeria  .cartoes  .cartao  .cartao-capa  .cartao-titulo  .ampliar
```

E tem os elementos que o Markdown do dono produz **sem classe nenhuma**,
dentro de `.principal`: `h1`–`h6`, `p`, `ul`/`ol`/`li`, `blockquote`,
`pre`/`code`, `table`/`thead`/`tbody`/`tr`/`th`/`td`, `img`, `video`, `a`,
`hr`, `strong`, `em`.

⚠️ **É aqui que mora o risco de responsividade.** O tema não controla o que
o dono escreve, mas responde por como isso aparece: uma tabela de sete
colunas, uma palavra sem espaços, uma URL colada, um bloco de código
comprido. A seção 7 diz o que se mediu e o que é obrigatório.

Também são contrato os atributos que os moldes escrevem e que a folha pode
usar: `aria-current="page"` no item de menu da página atual, `rel="external
noopener noreferrer"` em links para fora, `width`/`height` em toda imagem
cujo tamanho o app conhece, `loading="lazy"` nas imagens da galeria,
`target="_blank"` no link `.ampliar` da capa.

## 6. As opções

As opções são o que a aba *Aparência* do painel desenha. O painel é
genérico: lê o manifesto e desenha um controlo por opção, na ordem em que
estão. Três tipos existem:

| Tipo | Campos | Exemplo no Padrão |
|---|---|---|
| `escolha` | `rotulo`, `padrao`, `opcoes` (lista de pares `[valor, rótulo]`), `apoio` (texto de ajuda, opcional) | `esquema`: claro / creme / escuro |
| `cor` | `rotulo`, `padrao` (`#rrggbb`), `apoio` | `cor_destaque` |
| `medida` | `rotulo`, `padrao`, `min`, `max`, `passo`, `unidade`, `apoio` | `altura_logo`: 28 a 96 px, de 2 em 2 |

O Padrão oferece oito: `esquema`, `cor_destaque`, `fonte_texto`,
`fonte_titulos`, `tamanho_texto`, `largura`, `cantos`, `altura_logo`. Um tema
pode oferecer as que quiser, com os nomes que quiser — o app não conhece
nome nenhum.

**A regra que não se negocia: o tema valida as SUAS opções.** Os valores que
chegam a `css(opcoes)` vêm do `site.json` que estava na rede, ou de um
backup. São **dados**, escritos por quem os quis escrever. A função
`resolver` do tema compara cada valor com o manifesto e **descarta o que não
bate**, substituindo-o pelo padrão (os quatro temas fazem-no chamando o
validador genérico `Temas.resolver(options, opcoes)`, que aplica estas
regras a partir do manifesto — mas é o tema que o exporta e chama):

- uma `escolha` só aceita um dos valores da lista;
- uma `cor` só aceita exatamente `#` e seis dígitos hexadecimais;
- uma `medida` só aceita um inteiro entre `min` e `max`.

Sem isto, `cor_destaque: "red;background:url(https://…)"` viraria uma linha
da folha de estilo que o **leitor** baixa — injeção de CSS no site de quem
visita, que é precisamente o buraco de privacidade que a seção 8 fecha.

## 7. Responsividade: o que se mede, e o que é obrigatório

Responsividade aqui é **requisito de primeira classe, medido**, não
promessa. O teste `test/core/responsivo` gera um site com conteúdo de pior
caso **com cada tema registado**, embute o CSS, abre cada página em dez
larguras nos dois motores (Firefox e Chrome) e mede. Um tema novo entra na
medição só por se registar. Cada regra abaixo tem o número que a justificou.

### 7.1 O piso é 320 px

A menor tela que o produto promete servir tem **320 px** de largura. As
larguras medidas:

| Largura | Porquê |
|---|---|
| 320 | celular pequeno — o piso |
| 360, 390, 412 | celulares comuns |
| 768 | tablet ao alto |
| 800 | Tor Browser em tela pequena |
| **1000 × 500** | **Tor Browser em janela solta** — medido em 2026-09-05, Tails 7.11, tela 1280×800 |
| **1200 × 600** | **Tor Browser maximizado** — medido na mesma bancada; é também o que o painel assume desde 2026-08-25 |
| 1280 | portátil |
| 1920 | monitor |

As duas medidas do Tor são o detalhe que só este produto tem de olhar. O Tor
Browser arredonda a área da página a múltiplos de 200×100 px (letterboxing,
documentação do Tor Project consultada em 2026-09-05), para que o tamanho da
janela não identifique quem lê. **O leitor típico deste produto está entre
1000 e 1200 px de largura, com 500 a 600 px de altura** — pouco espaço
vertical: um cabeçalho alto come um terço da tela.

### 7.2 As regras, com os números

| # | Regra | Como se mede | O que a primeira medição achou no Padrão (2026-09-05) |
|---|---|---|---|
| R1 | **A página nunca rola para o lado**, em nenhuma largura | `scrollWidth` do documento ≤ largura da janela | tabela de 7 colunas: 310 px de estouro em 320; palavra sem espaços: até 1280 px |
| R2 | **Nenhum elemento passa da borda direita** | toda caixa visível termina antes da borda; exceção: o que está dentro de uma caixa que rola e cabe (o `pre`) | além dos acima, o título de artigo sem espaços nas listagens e na galeria |
| R3 | **Todo alvo que não está numa frase tem pelo menos 24×24 px** em celular (≤ 412 px) | caixa de cada `a` e `button`; WCAG 2.2 AA, critério 2.5.8 | links de lista com 20 px de altura; o menu passava (27 px), porque a caixa flexível engrossa os links |
| R4 | **Nenhuma imagem sai distorcida** | proporção desenhada vs. a dos atributos `width`/`height`, tolerância de 2 % | logo de 6:1 a 96 px ficava 280×96 (2,9:1) em 320 px |
| R5 | **Nenhum texto abaixo de 12 px** | `font-size` calculado de todo elemento com texto próprio | nenhum — passou |
| R6 | **Entre 45 e 90 caracteres por linha** em tela larga (≥ 1000 px), **na configuração padrão** do tema | largura do primeiro parágrafo de texto corrido (o primeiro fragmento, para contar a COLUNA num tema com colunas) ÷ largura real de uma letra média no tipo do corpo | ~96 com a largura "média" de 760 px em Georgia 17 px. Hoje: Padrão ~88, Diário ~85, Jornal ~75 (em colunas), Moderno ~84 |

A configuração padrão é a que o tema entrega sem o dono tocar em nada. As
outras são escolha dele: a largura "larga" do Padrão dá ~95 caracteres com
texto grande, e isso fica registado, não reprovado.

⚠️ **A exceção "inline" da R3, e é preciso conhecê-la ou reprova-se tudo.**
A WCAG 2.5.8 isenta o alvo que está *"numa frase, ou cujo tamanho é limitado
pela entrelinha do texto que não é alvo"* — ou seja, **um link no meio de um
parágrafo**. Medido em 2026-09-05: esses ficam entre **17 e 23 px de altura
nos 21 temas, o Padrão incluído**, e está certo assim; inflá-los partiria a
entrelinha do texto. O que a regra exige são os alvos que **não** estão numa
frase: o nome do site, os itens de menu, os títulos das listagens, as
etiquetas, os botões.

### 7.2-bis O caso que a bancada NÃO cobre — e que passou a ser medido

⚠️ **Achado em 2026-09-05, ao escrever 17 temas de uma vez.** A bancada da
§7.3 tem **sempre um logo**, porque o logo largo é o pior caso da R4. Mas o
logo é **opcional**, e um site novo não tem nenhum: o cabeçalho mostra o
**nome do site em texto**, que a bancada nunca media. E as duas configurações
medidas são a padrão e o **extremo**, que para o tamanho do texto é a letra
**maior** — a letra **pequena** também nunca era medida.

O tema Mínimo falhava nas duas coisas ao mesmo tempo: o nome do site dava
**270 × 19 px**, abaixo dos 24 da R3, e **nenhum caso da suíte dava por
isso**. Há agora um caso que gera, por tema, a capa **sem logo e com todas as
opções no mínimo**, em 320 e 390 px, e mede os alvos que não estão numa frase.

➜ **A lição, que vale para além dos temas: uma bancada de "pior caso" é
sempre o pior caso DE ALGUMA COISA.** A desta suíte é o pior caso do conteúdo
(palavras que não quebram, tabelas largas, logos desproporcionados) — não o
das *opções*, nem o da *ausência* de conteúdo opcional.

### 7.3 O conteúdo de pior caso

O teste não mede uma página bonita. Mede uma página com: uma palavra sem
espaços que não cabe em 320 px; uma URL crua e longa; uma tabela de sete
colunas; um bloco de código de uma linha comprida; citação e lista; uma
imagem de 1600×900; uma imagem de outro servidor; os blocos `[[botao:]]` e
`[[artigos:]]`; um menu de oito itens com rótulos longos; um título de
artigo que não cabe numa linha; um título sem espaços; um logo de 1200×200.
E mede tudo duas vezes: com as opções padrão e com o extremo que as opções
permitem (escuro, texto grande, largura larga, logo a 96 px).

Se o seu tema passa nisto, passa no que o dono vai escrever.

### 7.4 O que o Padrão teve de mudar, e que vale como receita

Tudo o que se segue veio da medição. **Nenhuma `@media` foi precisa**: a
adaptação é fluida por construção (`meta viewport`, `max-width:100%` em
imagens e vídeo, `flex-wrap` no cabeçalho e no menu, grade `auto-fill` na
galeria, `max-width` na coluna). Isto é um resultado, não uma exigência — um
tema pode usar `@media` à vontade.

- **Tabela**: `table{display:block;overflow-x:auto;overflow-wrap:normal}`.
  O Markdown não permite embrulhar a tabela noutra caixa, logo é ela própria
  que rola. O `overflow-wrap:normal` é obrigatório aqui: com a quebra em
  qualquer ponto herdada do corpo, o motor prefere esmagar as células
  ("Seg/und/a") a rolar.
- **Palavra sem espaços, URL, título sem espaços**: `overflow-wrap:anywhere`
  no `body`. Só parte uma palavra quando ela não cabe de outra forma, e
  conta na largura mínima — é o que deixa o cartão da galeria encolher até
  ao mínimo da grade. ⚠️ O Firefox quebra URLs nas barras por conta
  própria; o Chrome não. Não contar com isso.
- **Alvo de toque**: os links de lista (`.lista-artigos a`, `.ultimos p a`,
  `.blog>p a`, `.cartao-titulo a`) são `display:inline-block;padding:2px 0`.
  Um link de texto em Georgia 17 px tem 20 px; os 4 px de folga chegam aos
  24 sem a linha crescer.
- **Logo**: `max-height` em vez de `height` fixa, com `width:auto;height:auto;
  max-width:100%`. Com as duas restrições o motor mantém a proporção; com
  a altura fixa, a `max-width` esmagava o logo largo em tela estreita.
- **Coluna**: a largura "média" passou de 760 para 700 px (~88 caracteres).
- **Bloco de código**: `pre{overflow:auto}` já chegava — confirmado.

### 7.5 Correr o teste

```
NOSTERMENTOR_SUITES=core/responsivo test/roda.sh
```

Corre nos dois motores e mede **6 páginas × 10 larguras × 2 motores por
tema** — 120 medições por tema, **1260 páginas por motor** com 21 temas.
`NOSTERMENTOR_TEMAS=<id>` (desde 2026-09-11) mede só esse tema — o site de
pior caso é gerado para todos, mas só esse tema é medido: uns 30 segundos
por motor em vez de perto de uma hora. A mesma regra do motor: ⚠️ nunca fechar
trabalho com o filtro ligado.
`NOSTERMENTOR_MOTORES=chrome` corre num motor só, o que serve para afinar um
tema; ⚠️ **nunca fechar trabalho com um motor só** — metade das correções de
tema deste projeto vieram de o Firefox e o Chrome discordarem (§7.4).

⚠️ **A suíte teve de aprender a reciclar o navegador para acabar.** Abrir e
fechar 1260 páginas no mesmo contexto levou o **Firefox a 9,6 GB de RSS**
numa máquina de 15,5 GB: a suíte não deu erro — **parou de progredir** e foi
preciso matá-la (medido em 2026-09-05, na primeira tentativa de correr os 21
temas). O contexto é agora fechado de 40 em 40 páginas. ➜ **Uma suíte que
cresce linearmente com o número de temas encontra um teto que não é o
relógio.**

Eram ~100 s com quatro temas; com 21 são **perto de uma hora nos dois motores** (medido em 2026-09-05: a suíte completa do projeto, 702 casos, fecha em pouco mais disso), e deixa mais de mil capturas na pasta de resultados
(320, 390, 768 e 1280 px de cada página de cada tema,
`responsivo-<tema>-<página>-<largura>-<motor>.png`) e um JSON com todas as
medidas. ⚠️ **É a suíte mais cara do projeto, e é linear no número de temas:**
ao escrever um tema, correr esta suíte sozinha e só no fim a suíte completa. Nenhum número substitui o olho: **olhe para as
capturas.** Foi a captura, não o número, que pegou a tabela esmagada no
Padrão e as etiquetas coladas no Jornal.

## 8. Segurança e privacidade — o porquê de cada regra

Estas regras vêm dos protocolos do projeto (`02` G.2). Aqui estão explicadas,
não decretadas.

1. **Tema é dado, não programa.** O painel nunca executa o tema: os moldes
   são texto para o Mustache preencher, a folha é texto para o site levar.
   As duas funções de um tema, `resolver` e `css`, correm dentro do app —
   por isso um tema **instalado pela rede** só poderá existir depois de
   haver um validador (seção 11); até lá, os temas são os quatro que vêm
   com o app.
2. **Zero recursos externos.** Nenhuma URL absoluta em `src`, `href`,
   `url()` ou `@import` da folha. O motivo é o leitor: uma fonte do Google,
   um ícone de um CDN, um pixel de estatística — cada um deles **entrega ao
   servidor de terceiro o endereço IP e a hora de cada visita**. Este
   produto existe para que quem lê não seja visto; um tema que puxe um
   recurso de fora anula isso sem que o dono do site sequer saiba. Daí só
   famílias de letra do sistema, nunca `@font-face`.
3. **Sem `<script>`, sem `on*=`, sem `javascript:`, sem `<iframe>` nem
   `<object>`.** O site publicado não tem uma linha de script de qualquer
   forma: o Tor Browser no nível *Safest* desliga o JavaScript, e o site tem
   de ficar igual com e sem ele. Um tema que dependesse de script seria um
   tema que parte de propósito para o leitor mais cauteloso.
4. **`window.nostr` é um vetor.** Um script no site publicado poderia pedir
   uma assinatura à extensão Nostr do visitante — inclusive à do próprio
   dono, ao visitar o seu site. É a segunda razão para a regra 3.
5. **Atualização só da mesma npub, com versão que só sobe.** Quando os temas
   chegarem pela rede, um tema só se atualiza com um pacote assinado pela
   mesma chave que publicou a versão instalada, e com `version` maior.
   Impede que alguém publique "a versão 5" do tema de outra pessoa.
6. **Limites de tamanho e de número de arquivos** por pacote — defesa
   contra um pacote que rebente a memória do painel.
7. **Autoria à vista.** A npub do autor (e o NIP-05, se houver) aparece na
   instalação. "Autor desconhecido" é um rótulo que se mostra, não uma
   omissão.

## 9. Determinismo

O site gerado é publicado por hash: cada arquivo tem um sha256, e é ele que
diz se o arquivo mudou. Por isso **as mesmas opções têm de dar exatamente os
mesmos bytes**, hoje, amanhã, no Firefox, no Chrome e no Tor Browser.

- `css(opcoes)` é uma **função pura**: só depende do argumento. Nada de
  `Date`, `Math.random`, `navigator`, locale, hora, nem leitura de DOM.
- **Só aritmética inteira.** `Math.pow` e as operações de vírgula flutuante
  não têm a precisão fixada pela especificação do JavaScript e podem
  diferir entre motores. O contraste calcula-se com a fórmula inteira
  299/587/114 (brilho percebido, técnica AERT do W3C), afastando a cor do
  fundo em passos de 5 % até haver 125 de distância — tudo em inteiros.
  **`Temas.cor` já traz isso feito** (`acentoLegivel(cor, fundo)` devolve a
  cor do dono já legível sobre o fundo; `textoSobre(rgb)` devolve preto ou
  branco para pôr POR CIMA de uma cor cheia). Um tema pode fazer as contas à
  mão — o que não pode é usar vírgula flutuante.
- **Ordem fixa.** Nada de `localeCompare` para ordenar (depende do locale
  do motor); comparar por code point. O app já ordena listas e etiquetas
  assim antes de as entregar ao molde.
- **Saída em UTF-8, sem BOM, só `\n`.** O app garante isso ao gravar; o
  tema não deve introduzir `\r`.

O teste `core/gerador` gera o site duas vezes, em ordens diferentes, nos
dois motores, e compara os hashes. Um tema que falhe aí falha em produção.

## 10. Como testar o próprio tema antes de o oferecer a alguém

1. **Montar e correr as duas suítes** que julgam o tema:
   `NOSTERMENTOR_SUITES=core/gerador,core/responsivo test/roda.sh`.
   A primeira percorre todos os temas registados e prova, de cada um: os
   oito moldes, o CSS sem recurso externo, o lixo nas opções a voltar ao
   padrão, os mesmos bytes em qualquer ordem de entrada, o HTML sem script,
   as classes de contrato e os mesmos caminhos gerados. A segunda, a
   responsividade da seção 7. Um tema registado entra nas duas sozinho.
2. **Procurar à mão o que o validador ainda não procura:** `http`, `url(`,
   `@import`, `<script`, `on[a-z]+=`, `javascript:` na saída de
   `css(opcoes)` e nos moldes.
3. **Abrir o site gerado no Tor Browser, no nível *Safest*,** numa janela de
   1000×500. É o leitor mais exigente que vai ter.
4. **Olhar as capturas** de 320 e 390 px. Os números da seção 7 dizem se
   nada estoura; só o olho diz se se lê bem.
5. **Trocar cada opção para o seu extremo** e repetir 3 e 4.

## 11. O que ainda não existe (e este documento não finge que existe)

- **Não há validador de pacote.** As regras da seção 8 são cumpridas
  pelos 21 temas por construção e conferidas pela suíte; não há ainda
  código que as aplique a um tema vindo de fora. Por isso **só os temas que
  vêm com o app existem**: o registro é preenchido pelos arquivos de
  `src/tema/`, na montagem.
- **Não há instalação de tema pela rede**, nem formato de pacote na rede
  definido. Nenhum kind de evento foi escolhido, e este documento **não
  inventa um**: quando houver, virá com a evidência que o justifica.
- **`engine_min` ainda não é conferido**: só existe a versão 1 do motor.
- **A troca de tema existe desde 2026-09-05**: o gerador lê `site.theme.id`
  pelo registro e a prévia usa o tema escolhido. Nesse mesmo dia a escolha
  mudou de lugar: era um `<select>` na aba *Aparência* e passou a ser a tela
  **Temas**, uma galeria com um cartão e uma pré-visualização por tema (a aba
  *Aparência* ficou com os ajustes do tema em uso). ✅ **E desde o mesmo dia
  ela guarda as opções de cada tema**: trocar e voltar devolve o que estava
  (seção 3).
- **Não há como enviar um tema pelo painel.** A tela Temas tem o cartão
  "Enviar um tema" **desligado**, e diz porquê: sem o validador acima, um tema
  de fora poderia buscar um recurso a um servidor e entregar-lhe o IP de cada
  leitor do site (seção 8). Enquanto isso, um tema novo entra como os 21
  que existem — um arquivo em `src/tema/<id>/tema.js`, montado com o app.
- **Os sinais decorativos que alguns temas põem com `content` não estão
  marcados como decorativos.** O Terminal escreve `$` antes dos títulos, `##`
  antes dos subtítulos e `[` `]` à volta dos itens de menu; o Vintage põe um
  florão acima de cada título; o Satoshi pode pôr um `₿` antes do nome do
  site. **Isto é CSS, não HTML** — o texto do dono continua intacto e a
  ferramenta de busca lê o que ele escreveu. Mas **vários leitores de tela
  anunciam o `content` de um `::before`**, e quem ouve a página ouviria
  "cifrão, título do artigo". A correção é a forma alternativa da propriedade
  (`content: "$\A0" / ""`, que declara o texto alternativo vazio), suportada
  no Firefox 97+ e no Chrome 77+ — logo também no Tor Browser atual. **Não foi
  feita ainda**: a medição de responsividade desta leva correu contra a versão
  sem ela, e mexer no CSS depois de medir era descrever código que não tinha
  sido medido. ⚠️ Fica como primeiro trabalho de tema da próxima vez; o tema
  **Alto contraste**, que é o que existe para quem depende disto, **não usa
  `content` decorativo nenhum**.

- **A listagem do blog não tem capas.** O contexto do molde `blog` traz
  `href`, `titulo`, `data`, `data_iso` e `resumo`, e mais nada (seção 4) —
  um tema de fotografia não consegue pôr miniaturas na listagem. Quem quiser
  uma frente com imagens usa o bloco `[[artigos: … com-capa]]` numa página,
  que é o único lugar onde a capa chega ao molde. **É limitação do contrato,
  não do tema**; se algum dia mudar, muda aqui.
- **O custo da galeria cresce com o número de temas, e está medido.** A tela
  Temas gera o site uma vez por jogo de moldes e mostra uma prévia por
  cartão. Medido em 2026-09-05, no Chrome da máquina de dev: com 50 artigos,
  gerar para os 21 temas levava 229 ms (contra 40 ms dos 4 antigos) — daí a
  memória por jogo de moldes; e **as prévias custam +177 MB de memória com 21
  temas, contra +121 MB com 4** (soma do RSS da árvore de processos do
  Chrome; `performance.memory` não serve, porque cada prévia corre no seu
  próprio processo). ⚠️ **Cresce muito abaixo do linear, mas cresce** — se um
  dia forem 50 temas, a tela precisa de carregar as prévias à medida que se
  rola até elas.

Quando algum destes itens deixar de ser verdade, esta seção encolhe e a
data do topo muda.
