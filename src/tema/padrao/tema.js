/* tema/padrao/tema.js — o tema embutido da v1 (06 §5.3; 02 G.2): um pacote
   de DADOS — manifesto, templates Mustache logic-less e o CSS. Nada aqui
   executa no painel; o gerador (core/gerador.js) preenche as lacunas. Zero
   recursos externos (G.2.4): nenhuma URL absoluta em src, href, url() ou
   @import — um pixel remoto desanonimizaria o leitor, e por isso as fontes
   são SEMPRE famílias do sistema, nunca @font-face. O crédito do rodapé é
   texto, sem link (o projeto ainda não tem endereço público). A folha de
   estilo vai para /tema/estilo.css (13 §5.1).

   24 (2026-09-01) — O CSS DEIXOU DE SER TEXTO FIXO E VIROU MOLDE.
   `css` era uma string constante; agora é `css(opcoes)`, uma função pura de
   `site.theme.options` (13 §3). É o pré-requisito técnico de `06` §5.3.2 (a):
   quem escrever um tema "só CSS" herda estes moldes, e a troca de tema passa
   a ter o que trocar. Três regras que valem para qualquer tema futuro:

   1. **O tema valida as SUAS opções; o core não conhece nome nenhum.** O que
      chega em `opcoes` vem de `site.json` (rede) ou de um backup — é DADO
      (02 G.0). Valor que não bate exatamente com o que o manifesto declara
      é DESCARTADO e substituído pelo padrão. É esta função que impede um
      `cor_destaque: "red;background:url(https://…)"` de virar folha de
      estilo — sem ela, a opção seria injeção de CSS no site do LEITOR, que
      é precisamente o buraco de privacidade que G.2.4 existe para fechar.
   2. **Só aritmética inteira.** Nada de `Math.pow` na conta de contraste: a
      precisão de `Math.pow` não é fixada pela spec do JS e pode diferir
      entre motores, o que partiria os bytes determinísticos de 13 §5.2.
      Por isso o brilho percebido é a fórmula inteira 299/587/114.
   3. **Legibilidade é garantia, não sorte.** O dono escolhe uma cor livre; o
      tema afasta-a do fundo até haver distância suficiente antes de a usar
      em texto, e escolhe preto ou branco para o texto sobre ela.

   12 (2026-09-05) — RESPONSIVIDADE MEDIDA, NÃO PROMETIDA. `test/core/responsivo`
   mede o site gerado em 9 larguras (320 a 1920 px) nos dois motores, com o
   conteúdo de pior caso. O que a primeira medição achou, e o que mudou aqui:
   - tabela GFM de 7 colunas terminava em 364 px numa tela de 320 → `table`
     rola dentro da própria caixa, como o `pre` já fazia;
   - palavra sem espaços, URL crua e título sem espaços passavam da borda até
     1280 px (o Firefox quebra URLs nas barras por conta própria; o Chrome
     não — regra que não se pode assumir) → `overflow-wrap:anywhere` no corpo,
     que também deixa o cartão da galeria encolher até ao mínimo da grelha;
   - links de lista tinham 20 px de altura (WCAG 2.2 pede 24) → inline-block
     com 2 px de folga em cima e em baixo; o menu já passava (27 px), porque
     a caixa flexível engrossa os links sozinha;
   - logo de 6:1 a 96 px ficava 280×96 numa tela de 320 (2,9:1) → altura
     MÁXIMA em vez de altura fixa: quando a largura não chega, encolhe a
     direito;
   - a largura "média" (760 px) dava ~96 caracteres por linha em Georgia
     17 px; passou a 700 (~88). A "larga" continua a 900 — é escolha
     consciente do dono do site, e a regra de 45–90 vale para o padrão.
   Continua sem uma única `@media`: a adaptação é fluida por construção. */
const TemaPadrao = (function () {
  'use strict';

  // As opções que a aba Aparência (T7) desenha. O renderizador é genérico:
  // lê daqui, não de uma lista no core (06 §5.3). Ordem = ordem na tela.
  const options = Object.freeze({
    esquema: Object.freeze({ tipo: 'escolha', rotulo: 'Fundo da página', padrao: 'claro',
      opcoes: Object.freeze([['claro', 'Claro'], ['creme', 'Creme'], ['escuro', 'Escuro']]),
      apoio: 'Fundo, cor do texto e cor das linhas mudam juntos, para o texto nunca ficar ilegível.' }),
    cor_destaque: Object.freeze({ tipo: 'cor', rotulo: 'Cor de destaque', padrao: '#2271b1',
      apoio: 'Links, botões e detalhes. Se a cor ficar perto demais do fundo, o site clareia ou escurece só o texto — a cor cheia continua nos botões.' }),
    fonte_texto: Object.freeze({ tipo: 'escolha', rotulo: 'Letra do texto', padrao: 'serifa',
      opcoes: Object.freeze([['serifa', 'Serifa'], ['sem-serifa', 'Sem serifa']]),
      apoio: 'Só letras que já existem no computador de quem lê — buscar uma fonte na internet entregaria o visitante ao servidor da fonte.' }),
    fonte_titulos: Object.freeze({ tipo: 'escolha', rotulo: 'Letra dos títulos e do menu', padrao: 'sem-serifa',
      opcoes: Object.freeze([['igual', 'A mesma do texto'], ['serifa', 'Serifa'], ['sem-serifa', 'Sem serifa']]) }),
    tamanho_texto: Object.freeze({ tipo: 'escolha', rotulo: 'Tamanho do texto', padrao: 'medio',
      opcoes: Object.freeze([['pequeno', 'Pequeno'], ['medio', 'Médio'], ['grande', 'Grande']]),
      apoio: 'Títulos, datas e rodapé acompanham.' }),
    largura: Object.freeze({ tipo: 'escolha', rotulo: 'Largura da página', padrao: 'media',
      opcoes: Object.freeze([['estreita', 'Estreita'], ['media', 'Média'], ['larga', 'Larga']]) }),
    cantos: Object.freeze({ tipo: 'escolha', rotulo: 'Cantos', padrao: 'retos',
      opcoes: Object.freeze([['retos', 'Retos'], ['arredondados', 'Arredondados']]),
      apoio: 'Vale para blocos de código, etiquetas e botões.' }),
    altura_logo: Object.freeze({ tipo: 'medida', rotulo: 'Altura do logo', padrao: 44,
      min: 28, max: 96, passo: 2, unidade: 'px',
      apoio: 'A largura acompanha sozinha, sem distorcer. Envie uma imagem com pelo menos o dobro desta altura — telas densas mostram o dobro dos pontos.' })
  });

  const manifesto = Object.freeze({
    id: 'padrao', version: 4, nome: 'Padrão', autor: 'Nostermentor', engine_min: 1,
    options: options
  });

  // Os oito moldes deste tema são os MOLDES BASE do app (`Temas.moldes`, em
  // core/temas.js): estavam aqui e mudaram de sítio em 2026-09-05, byte a
  // byte, quando o app passou de quatro para vinte e um temas. O Padrão usa-os
  // como estão — é dele que saíram —, e qualquer tema pode partir deles e
  // trocar só o molde que quiser. As classes que a folha de estilo abaixo
  // persegue são as que esses moldes escrevem (TEMAS.md §5).

  // --- opções → valores seguros -------------------------------------------
  // Regra 1 do cabeçalho: nada que não bate com o manifesto entra no CSS.
  const RE_COR = /^#[0-9a-fA-F]{6}$/;
  function valor(nome, bruto) {
    const o = options[nome];
    if (!o) return null;
    if (o.tipo === 'escolha') return o.opcoes.some(x => x[0] === bruto) ? bruto : o.padrao;
    if (o.tipo === 'cor') return (typeof bruto === 'string' && RE_COR.test(bruto)) ? bruto.toLowerCase() : o.padrao;
    if (o.tipo === 'medida') {
      const n = typeof bruto === 'number' ? bruto : parseInt(bruto, 10);
      return (Number.isInteger(n) && n >= o.min && n <= o.max) ? n : o.padrao;
    }
    return o.padrao;
  }
  // → { nome: valor } com TODAS as opções resolvidas (nunca undefined)
  function resolver(opcoes) {
    const o = opcoes && typeof opcoes === 'object' ? opcoes : {};
    const saida = {};
    for (const nome of Object.keys(options)) saida[nome] = valor(nome, o[nome]);
    return saida;
  }

  // --- cor: só inteiros (regra 2 do cabeçalho) ----------------------------
  // As funções e as duas constantes que as regem (125, o limiar de
  // "brightness difference" da técnica AERT do W3C; 128, o meio da escala)
  // viviam aqui e passaram para `Temas.cor` em 2026-09-05, quando o app foi
  // de 4 para 21 temas e cada um trazia a sua cópia. A fórmula é a mesma,
  // inteira, e os bytes gerados são os mesmos — conferido pelo sha256 do
  // site de exemplo da suíte, que não mudou.
  const C = Temas.cor;
  const CLARO = C.CLARO;
  const paraRgb = C.paraRgb, paraHex = C.paraHex, brilho = C.brilho, legivelSobre = C.legivelSobre;

  // --- tabelas de valor: escolha → CSS ------------------------------------
  const ESQUEMAS = {
    claro:  { fundo: '#fbfbfa', tinta: '#1d2327', suave: '#646970', linha: '#dcdcde', bloco: '#f0f0f1' },
    creme:  { fundo: '#f7f3ea', tinta: '#2b2417', suave: '#6b6151', linha: '#e0d7c6', bloco: '#efe8da' },
    escuro: { fundo: '#16181d', tinta: '#e6e7e9', suave: '#a2a7ae', linha: '#333840', bloco: '#22262d' }
  };
  const FONTES = {
    serifa: 'Georgia,"Times New Roman",serif',
    'sem-serifa': 'system-ui,-apple-system,"Segoe UI",Roboto,Ubuntu,"Noto Sans",sans-serif'
  };
  const TAMANHOS = { pequeno: 16, medio: 17, grande: 19 };
  const LARGURAS = { estreita: 640, media: 700, larga: 900 };
  const CANTOS = { retos: '0', arredondados: '6px' };
  const CANTOS_PILULA = { retos: '3px', arredondados: '999px' };

  // A folha de estilo do site, como função pura das opções (13 §5.2: mesmas
  // opções = mesmos bytes, em qualquer motor).
  function css(opcoes) {
    const v = resolver(opcoes);
    const e = ESQUEMAS[v.esquema];
    const fundo = paraRgb(e.fundo);
    const acento = paraRgb(v.cor_destaque);
    const fonteTexto = FONTES[v.fonte_texto];
    const fonteTitulos = v.fonte_titulos === 'igual' ? fonteTexto : FONTES[v.fonte_titulos];
    return [
      '/* Nostermentor — tema Padrão v4. Sem fontes remotas, sem imagens externas. */',
      ':root{' +
        '--fundo:' + e.fundo + ';--tinta:' + e.tinta + ';--suave:' + e.suave + ';--linha:' + e.linha + ';--bloco:' + e.bloco + ';' +
        '--acento:' + v.cor_destaque + ';--acento-legivel:' + paraHex(legivelSobre(acento, fundo)) + ';' +
        '--acento-texto:' + (brilho(acento) >= CLARO ? '#111111' : '#ffffff') + ';' +
        '--fonte-texto:' + fonteTexto + ';--fonte-titulos:' + fonteTitulos + ';' +
        '--base:' + TAMANHOS[v.tamanho_texto] + 'px;--largura:' + LARGURAS[v.largura] + 'px;' +
        '--canto:' + CANTOS[v.cantos] + ';--canto-pilula:' + CANTOS_PILULA[v.cantos] + ';' +
        '--logo-altura:' + v.altura_logo + 'px}',
      '*{box-sizing:border-box}',
      'html{-webkit-text-size-adjust:100%}',
      // longhand de propósito: o atalho `font:` com var() já foi fonte de
      // surpresa entre motores, e aqui os bytes têm de render o mesmo em todos.
      // `overflow-wrap:anywhere` (e não `break-word`): só parte uma palavra
      // quando ela não cabe de outra forma, E conta na largura mínima — é o
      // que deixa o cartão da galeria encolher até ao mínimo da grelha em vez
      // de a esticar. Herdado por tudo o que o Markdown produz.
      'body{margin:0;background:var(--fundo);color:var(--tinta);font-family:var(--fonte-texto);font-size:var(--base);line-height:1.6;overflow-wrap:anywhere}',
      'a{color:var(--acento-legivel)}',
      'img,video{max-width:100%;height:auto}',
      'code,pre{font-family:ui-monospace,Menlo,Consolas,"Liberation Mono",monospace;font-size:.92em}',
      'pre{overflow:auto;padding:12px;background:var(--bloco);border-radius:var(--canto)}',
      // A tabela vem do Markdown sem caixa à volta, logo é ela própria que
      // rola: `display:block` faz dela um bloco da largura da coluna, com a
      // grelha dentro a rolar quando não cabe (7 colunas em 320 px). E volta
      // a `overflow-wrap:normal`: com a quebra em qualquer ponto herdada do
      // corpo, o motor preferia esmagar as células ("Seg/und/a", medido em
      // 2026-09-05) a rolar. Dentro da tabela o estouro já está contido.
      'table{display:block;overflow-x:auto;overflow-wrap:normal}',
      'blockquote{margin:1em 0;padding:0 0 0 1em;border-left:4px solid var(--linha);color:var(--suave)}',
      '.cabecalho,.principal,.rodape{max-width:var(--largura);margin:0 auto;padding:0 20px}',
      '.cabecalho{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px 20px;padding-top:24px;padding-bottom:16px;border-bottom:1px solid var(--linha);font-family:var(--fonte-titulos)}',
      '.marca{font-size:1.3em;font-weight:700;text-decoration:none;color:var(--tinta)}',
      // 38 — altura fixa, largura livre: trata logo horizontal e quadrado sem
      // distorcer nem cortar. `align-self` porque o cabeçalho alinha por baseline.
      '.marca-logo{line-height:0;align-self:center}',
      // Altura MÁXIMA, não fixa: com `width:auto;height:auto` o motor resolve
      // as duas restrições (max-height e max-width) mantendo a proporção —
      // com `height` fixa, a `max-width` esmagava o logo largo em tela estreita.
      '.marca-logo img{max-height:var(--logo-altura);max-width:100%;width:auto;height:auto;display:block}',
      '.menu{display:flex;flex-wrap:wrap;gap:4px 16px}',
      '.menu a{text-decoration:none}',
      '.menu a[aria-current=page]{font-weight:700;color:var(--tinta)}',
      '.principal{padding-top:24px;padding-bottom:40px}',
      'h1,h2,h3{font-family:var(--fonte-titulos)}',
      'h1{font-size:1.9em;line-height:1.2;margin:0 0 .5em}',
      'h2{font-size:1.4em;line-height:1.25;margin:1.4em 0 .5em}',
      'h3{font-size:1.18em;margin:1.3em 0 .5em}',
      '.meta{color:var(--suave);font-size:.88em;margin:0 0 1.2em;font-family:var(--fonte-titulos)}',
      // ⚠️ `em` COMPÕE: a etiqueta vive dentro de `.meta`, que já é .88em, e o
      // h2 do apoio dentro do rodapé, que já é .82em. Os valores abaixo são
      // relativos ao PAI, não ao corpo — 13px e 16px com o tamanho médio.
      '.etiqueta{display:inline-block;padding:1px 8px;border:1px solid var(--linha);border-radius:var(--canto-pilula);font-size:.87em}',
      // 37 — o CTA é LINK com aparência de botão: o site publicado continua sem
      // uma linha de script. O molde que o vai produzir ainda não existe (falta
      // a 30, o marcador); a aparência, que é o que a 24 devia entregar, existe.
      '.botao{display:inline-block;padding:.6em 1.2em;border-radius:var(--canto);background:var(--acento);color:var(--acento-texto);text-decoration:none;font-family:var(--fonte-titulos);font-weight:700}',
      // 30 — a galeria: grelha que se adapta sozinha, sem media query e sem JS.
      // `auto-fill` com mínimo de 220px dá 2 colunas na largura estreita e 3 na
      // larga; num telemóvel cai para 1 sem regra nenhuma a mais.
      '.cta{margin:1.5em 0}',
      '.galeria{margin:2em 0}',
      '.cartoes{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:20px}',
      '.cartao{margin:0}',
      '.cartao-capa{display:block;line-height:0;margin:0 0 .5em;border-radius:var(--canto);overflow:hidden}',
      '.cartao-capa img{width:100%;height:auto;display:block}',
      '.cartao-titulo{font-size:1.05em;margin:0 0 .2em}',
      '.cartao-titulo a{text-decoration:none}',
      '.cartao .meta{margin:0 0 .4em}',
      '.cartao .resumo{margin:0;font-size:.92em}',
      // 40 — a etiqueta virou link e tem de continuar a PARECER etiqueta: a cor
      // de link por cima da pílula fazia-a saltar do resto de `.meta`.
      'a.etiqueta{text-decoration:none;color:inherit}',
      'a.etiqueta:hover{border-color:var(--acento-legivel);color:var(--acento-legivel)}',
      '.etiqueta-pagina .lista-artigos{margin-top:1em}',
      '.capa{margin:0 0 1.5em}',
      '.capa figcaption{color:var(--suave);font-size:.82em}',
      /* imagem clicável (06 §4): abre o arquivo em tamanho real, sem script */
      '.ampliar{display:inline-block;line-height:0;text-decoration:none;cursor:zoom-in}',
      // Alvo de toque (WCAG 2.2, 2.5.8): um link de texto em Georgia 17 px tem
      // 20 px de altura; 2 px de folga em cima e em baixo chegam aos 24.
      // `inline-block` para a folga contar na caixa; a linha (27 px) não cresce.
      '.lista-artigos a,.ultimos p a,.blog>p a,.cartao-titulo a{display:inline-block;padding:2px 0}',
      '.lista-artigos{list-style:none;margin:0;padding:0}',
      '.lista-artigos li{margin:0 0 1.2em}',
      '.lista-artigos h2{margin:0 0 .2em}',
      '.lista-artigos time{color:var(--suave);font-size:.88em;font-family:var(--fonte-titulos)}',
      '.resumo{margin:.3em 0 0}',
      '.ultimos{margin-top:2.5em;padding-top:1em;border-top:1px solid var(--linha)}',
      '.vazio{color:var(--suave)}',
      '.rodape{padding-top:16px;padding-bottom:32px;border-top:1px solid var(--linha);color:var(--suave);font-size:.82em;font-family:var(--fonte-titulos)}',
      '.apoie h2{font-size:1.15em;margin:0 0 .3em}',
      '.credito{margin:1em 0 0}',
      ''
    ].join('\n');
  }

  return Object.freeze({ manifesto, templates: Temas.moldes, css, resolver });
})();
Temas.registar(TemaPadrao);
