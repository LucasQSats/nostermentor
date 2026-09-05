# Temas do Nostermentor — especificação

> **RASCUNHO — 2026-09-05.** Este documento descreve o que um tema tem de ser
> para funcionar por inteiro com o Nostermentor. Só passa de rascunho a
> especificação quando um segundo tema, escrito por alguém que não escreveu o
> primeiro, o tiver usado de verdade. A secção 11 diz, sem rodeios, o que o
> app ainda não faz.

O que se quer é simples de enunciar: **qualquer pessoa com este documento à
frente consegue escrever o seu tema**, sem ler o código do app. Se alguma
secção exigir ler o código, a secção está incompleta — diga.

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
são proibidas, e a secção 8 explica cada uma.

O que o tema **controla**: a estrutura HTML de cada tipo de página (os
moldes), a folha de estilo, e as opções que oferece ao dono do site.

O que o tema **não controla**: o conteúdo (o dono escreve Markdown, e o app
transforma-o em HTML sem classe nenhuma), os caminhos dos arquivos gerados, o
`site.json`, e o filtro de segurança aplicado ao conteúdo.

## 2. Começar: o caminho mais curto

O tema mais simples é um tema **só de CSS**: copia os oito moldes do tema
Padrão como estão e escreve apenas a função `css(opcoes)`. Os moldes do
Padrão já produzem HTML com todas as classes da secção 5, e é nelas que a
folha de estilo se agarra.

O tema Padrão vive num único arquivo, `src/tema/padrao/tema.js`, e é o
exemplo de referência de tudo o que está aqui: quando este documento e o
arquivo divergirem, o arquivo está certo e este documento tem de ser
corrigido.

⚠️ Hoje o app **não troca de tema** (secção 11). Para experimentar um tema
agora, o caminho é editar esse arquivo e montar o app com `./monta_app.sh`.

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

O manifesto:

| Campo | Tipo | O que é |
|---|---|---|
| `id` | texto | identificador do tema; é o que vai em `site.theme.id` no `site.json`. Convenção: minúsculas, dígitos e hífen, como `padrao` (o código ainda não impõe formato) |
| `version` | inteiro | versão do tema; **sobe sempre que a folha de estilo ou um molde muda** (o Padrão está na 4). Só sobe, nunca desce |
| `nome` | texto | o nome que o painel mostra |
| `autor` | texto | quem o assina; "autor desconhecido" é um rótulo válido, omitir não é |
| `engine_min` | inteiro | a versão mínima do motor de geração que o tema exige (hoje só existe a 1) |
| `options` | objeto | as opções que o painel desenha, na ordem em que aparecem — secção 6 |

O `site.json` publicado guarda `theme: { id, version, options }`: o id do
tema, a versão com que o site foi publicado, e os valores que o dono escolheu.

## 4. Os oito moldes

Os moldes são **Mustache sem lógica**: `{{campo}}` insere o valor escapado
para HTML, `{{{campo}}}` insere-o cru (só para o que já vem sanitizado, como
`corpo` e `conteudo`), `{{#x}}…{{/x}}` repete ou condiciona, `{{^x}}…{{/x}}`
é o "senão". Não há funções, nem cálculos, nem acesso a nada fora do
contexto: **tudo o que o molde precisa chega pré-calculado.**

| Molde | Produz | Contexto que recebe |
|---|---|---|
| `layout` | a página HTML inteira, de `<!doctype>` a `</html>` | `lang`, `titulo_pagina`, `descricao`, `site_titulo`, `logo{src,alt,largura,altura}` ou `null`, `menu[]{href,rotulo,externo,atual}`, `conteudo` (HTML já pronto, vindo de um dos moldes abaixo), `doacoes{lightning_address}` ou `null`, `credito` (booleano) |
| `pagina` | o miolo de uma página fixa | `titulo`, `corpo` (HTML sanitizado do Markdown), `ultimos{blog_titulo,blog_href,artigos[]{href,titulo,data,data_iso}}` ou `null`, `capa{src,alt,largura,altura,legenda}` ou `null` |
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
comprido. A secção 7 diz o que se mediu e o que é obrigatório.

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
`resolver` compara cada valor com o manifesto e **descarta o que não bate**,
substituindo-o pelo padrão:

- uma `escolha` só aceita um dos valores da lista;
- uma `cor` só aceita exatamente `#` e seis dígitos hexadecimais;
- uma `medida` só aceita um inteiro entre `min` e `max`.

Sem isto, `cor_destaque: "red;background:url(https://…)"` viraria uma linha
da folha de estilo que o **leitor** baixa — injeção de CSS no site de quem
visita, que é precisamente o buraco de privacidade que a secção 8 fecha.

## 7. Responsividade: o que se mede, e o que é obrigatório

Responsividade aqui é **requisito de primeira classe, medido**, não
promessa. O teste `test/core/responsivo` gera um site com conteúdo de pior
caso, embute o CSS do tema, abre cada página em dez larguras nos dois
motores (Firefox e Chrome) e mede. Cada regra abaixo tem o número que a
justificou.

### 7.1 O piso é 320 px

A menor tela que o produto promete servir tem **320 px** de largura. As
larguras medidas:

| Largura | Porquê |
|---|---|
| 320 | telemóvel pequeno — o piso |
| 360, 390, 412 | telemóveis comuns |
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
| R3 | **Todo link tem pelo menos 24×24 px** de alvo em telemóvel (≤ 412 px) | caixa de cada `a` e `button`; WCAG 2.2 AA, critério 2.5.8 | links de lista com 20 px de altura; o menu passava (27 px), porque a caixa flexível engrossa os links |
| R4 | **Nenhuma imagem sai distorcida** | proporção desenhada vs. a dos atributos `width`/`height`, tolerância de 2 % | logo de 6:1 a 96 px ficava 280×96 (2,9:1) em 320 px |
| R5 | **Nenhum texto abaixo de 12 px** | `font-size` calculado de todo elemento com texto próprio | nenhum — passou |
| R6 | **Entre 45 e 90 caracteres por linha** em tela larga (≥ 1000 px), **na configuração padrão** do tema | largura útil da coluna ÷ largura real de uma letra média no tipo do corpo | ~96 com a largura "média" de 760 px em Georgia 17 px |

A configuração padrão é a que o tema entrega sem o dono tocar em nada. As
outras são escolha dele: a largura "larga" do Padrão dá ~95 caracteres com
texto grande, e isso fica registado, não reprovado.

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
imagens e vídeo, `flex-wrap` no cabeçalho e no menu, grelha `auto-fill` na
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
  ao mínimo da grelha. ⚠️ O Firefox quebra URLs nas barras por conta
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

Corre nos dois motores, em cerca de 25 s, e deixa na pasta de resultados
as capturas de 320, 390, 768 e 1280 px de cada página e um JSON com todas
as medidas. Nenhum número substitui o olho: **olhe para as capturas.**
Hoje o teste mede o tema Padrão; quando a troca de tema existir, medirá o
tema escolhido.

## 8. Segurança e privacidade — o porquê de cada regra

Estas regras vêm dos protocolos do projeto (`02` G.2). Aqui estão explicadas,
não decretadas.

1. **Tema é dado, não programa.** O painel nunca executa o tema: os moldes
   são texto para o Mustache preencher, a folha é texto para o site levar.
   As duas funções de um tema, `resolver` e `css`, correm dentro do app —
   por isso um tema **instalado pela rede** só poderá existir depois de
   haver um validador (secção 11); até lá, os temas são os que vêm com o
   app.
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
  diferir entre motores. O Padrão calcula o contraste com a fórmula inteira
  299/587/114 (brilho percebido, técnica AERT do W3C) e afasta a cor do
  fundo em passos de 5 % até haver 125 de distância — tudo em inteiros.
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
   A primeira prova o determinismo e a ausência de recursos externos; a
   segunda, a responsividade da secção 7.
2. **Procurar à mão o que o validador ainda não procura:** `http`, `url(`,
   `@import`, `<script`, `on[a-z]+=`, `javascript:` na saída de
   `css(opcoes)` e nos moldes.
3. **Abrir o site gerado no Tor Browser, no nível *Safest*,** numa janela de
   1000×500. É o leitor mais exigente que vai ter.
4. **Olhar as capturas** de 320 e 390 px. Os números da secção 7 dizem se
   nada estoura; só o olho diz se se lê bem.
5. **Trocar cada opção para o seu extremo** e repetir 3 e 4.

## 11. O que ainda não existe (e este documento não finge que existe)

- **O app não troca de tema.** O gerador chama o tema Padrão diretamente
  (10 pontos, mais 2 no painel) e ninguém lê `site.theme.id`. Este
  documento descreve o contrato que essa troca vai respeitar; a troca em si
  é trabalho por fazer.
- **Não há validador de pacote.** As regras da secção 8 são cumpridas pelo
  tema Padrão por construção e conferidas pela suíte; não há ainda código
  que as aplique a um tema vindo de fora.
- **Não há instalação de tema pela rede**, nem formato de pacote na rede
  definido. Nenhum kind de evento foi escolhido, e este documento **não
  inventa um**: quando houver, virá com a evidência que o justifica.
- **O painel de opções** já é genérico, mas só conheceu até hoje as oito
  opções do Padrão.

Quando algum destes itens deixar de ser verdade, esta secção encolhe e a
data do topo muda.
