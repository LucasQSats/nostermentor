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
      em texto, e escolhe preto ou branco para o texto sobre ela. */
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
    id: 'padrao', version: 2, nome: 'Padrão', autor: 'Nostermentor', engine_min: 1,
    options: options
  });

  // Layout de toda página HTML. Contexto (todo pré-calculado pelo gerador —
  // logic-less): lang, titulo_pagina, descricao, site_titulo, logo {src, alt,
  // largura, altura} | null, menu[] {href, rotulo, externo, atual}, conteudo
  // (HTML já sanitizado), doacoes {lightning_address} | null, credito (bool).
  // 38 — o logo SUBSTITUI o título no cabeçalho e o título vai para o `alt`:
  // o leitor vê a marca, o buscador e o leitor de ecrã continuam a ler o nome
  // do site (03 §1.1). Sem logo, o cabeçalho é o texto de sempre.
  const layout = [
    '<!doctype html>',
    '<html lang="{{lang}}">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>{{titulo_pagina}}</title>',
    '{{#descricao}}<meta name="description" content="{{descricao}}">',
    '{{/descricao}}<link rel="stylesheet" href="/tema/estilo.css">',
    '</head>',
    '<body>',
    '<header class="cabecalho">',
    '{{#logo}}<a class="marca marca-logo" href="/index.html"><img src="{{src}}" alt="{{alt}}"{{#largura}} width="{{largura}}" height="{{altura}}"{{/largura}}></a>',
    '{{/logo}}{{^logo}}<a class="marca" href="/index.html">{{site_titulo}}</a>',
    '{{/logo}}<nav class="menu" aria-label="Menu">{{#menu}}<a href="{{href}}"{{#externo}} rel="external noopener noreferrer"{{/externo}}{{#atual}} aria-current="page"{{/atual}}>{{rotulo}}</a>{{/menu}}</nav>',
    '</header>',
    '<main class="principal">',
    '{{{conteudo}}}',
    '</main>',
    '<footer class="rodape">',
    '{{#doacoes}}<section class="apoie"><h2>Apoie este site</h2><p>Endereço Lightning: <code>{{lightning_address}}</code></p></section>',
    '{{/doacoes}}{{#credito}}<p class="credito">Publicado com Nostermentor</p>',
    '{{/credito}}</footer>',
    '</body>',
    '</html>',
    ''
  ].join('\n');

  // Página fixa. Contexto: titulo, corpo (HTML sanitizado), ultimos
  // {blog_titulo, blog_href, artigos[] {href, titulo, data, data_iso}} | null,
  // capa {src, alt, largura, altura, legenda} | null.
  // 35 — a capa CHEGA aqui e este tema não a desenha, de propósito: a decisão
  // do dono (2026-08-31) é que ela seja dado para os temas que virão. Um tema
  // que a queira só precisa de acrescentar o bloco `{{#capa}}`.
  const pagina = [
    '<article class="pagina">',
    '<h1>{{titulo}}</h1>',
    '{{{corpo}}}',
    '</article>',
    '{{#ultimos}}<section class="ultimos">',
    '<h2>{{blog_titulo}}</h2>',
    '<ul class="lista-artigos">{{#artigos}}<li><a href="{{href}}">{{titulo}}</a> <time datetime="{{data_iso}}">{{data}}</time></li>',
    '{{/artigos}}</ul>',
    '<p><a href="{{blog_href}}">Todos os artigos</a></p>',
    '</section>',
    '{{/ultimos}}',
    ''
  ].join('\n');

  // Artigo. Contexto: titulo, data, data_iso, tem_tags, tags[] {nome},
  // capa {src, alt, largura, altura, legenda} | null, corpo.
  const artigo = [
    '<article class="artigo">',
    '<h1>{{titulo}}</h1>',
    '<p class="meta"><time datetime="{{data_iso}}">{{data}}</time>{{#tem_tags}} · {{#tags}}<span class="etiqueta">{{nome}}</span> {{/tags}}{{/tem_tags}}</p>',
    '{{#capa}}<figure class="capa"><a class="ampliar" href="{{src}}" target="_blank" rel="noopener"><img src="{{src}}" alt="{{alt}}"{{#largura}} width="{{largura}}" height="{{altura}}"{{/largura}}></a>{{#legenda}}<figcaption>{{legenda}}</figcaption>{{/legenda}}</figure>',
    '{{/capa}}{{{corpo}}}',
    '</article>',
    ''
  ].join('\n');

  // Listagem do blog. Contexto: blog_titulo, tem_artigos, artigos[]
  // {href, titulo, data, data_iso, resumo}.
  const blog = [
    '<section class="blog">',
    '<h1>{{blog_titulo}}</h1>',
    '{{^tem_artigos}}<p class="vazio">Nenhum artigo ainda.</p>',
    '{{/tem_artigos}}<ul class="lista-artigos">{{#artigos}}<li><h2><a href="{{href}}">{{titulo}}</a></h2><p class="meta"><time datetime="{{data_iso}}">{{data}}</time></p>{{#resumo}}<p class="resumo">{{resumo}}</p>{{/resumo}}</li>',
    '{{/artigos}}</ul>',
    '</section>',
    ''
  ].join('\n');

  // Stub de redirecionamento para caminhos antigos (13 §4.0 aliases; L1 de 08).
  // Contexto: lang, titulo, destino.
  const alias = [
    '<!doctype html>',
    '<html lang="{{lang}}">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta http-equiv="refresh" content="0; url={{destino}}">',
    '<title>{{titulo}}</title>',
    '</head>',
    '<body>',
    '<p>Esta página mudou de endereço: <a href="{{destino}}">{{destino}}</a></p>',
    '</body>',
    '</html>',
    ''
  ].join('\n');

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
  const BRANCO = [255, 255, 255], PRETO = [0, 0, 0];
  // 125 é o limiar de "brightness difference" da técnica AERT do W3C — número
  // conhecido, não inventado aqui. Escolhido por ser calculável só com
  // inteiros: o critério da WCAG 2 (razão de contraste 4,5:1) precisa de
  // `Math.pow(x, 2.4)`, cuja precisão a spec do JS NÃO fixa — e isto entra em
  // arquivo publicado, onde os bytes têm de bater entre motores (13 §5.2).
  const DISTANCIA_MIN = 125;
  const CLARO = 128;                    // meio da escala: acima disto a cor pede texto preto
  function paraRgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function paraHex(c) { return '#' + c.map(n => n.toString(16).padStart(2, '0')).join(''); }
  function brilho(c) { return Math.round((299 * c[0] + 587 * c[1] + 114 * c[2]) / 1000); }
  function misturar(a, b, p) { return [0, 1, 2].map(i => Math.round((a[i] * (100 - p) + b[i] * p) / 100)); }
  // Afasta o acento do fundo em passos de 5% até dar para ler. Determinístico
  // e limitado: no pior caso devolve o extremo (preto ou branco).
  function legivelSobre(acento, fundo) {
    const alvo = brilho(fundo) >= CLARO ? PRETO : BRANCO, bf = brilho(fundo);
    for (let p = 0; p <= 100; p += 5) {
      const c = misturar(acento, alvo, p);
      if (Math.abs(brilho(c) - bf) >= DISTANCIA_MIN) return c;
    }
    return alvo;
  }

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
  const LARGURAS = { estreita: 640, media: 760, larga: 900 };
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
      '/* Nostermentor — tema Padrão v2. Sem fontes remotas, sem imagens externas. */',
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
      'body{margin:0;background:var(--fundo);color:var(--tinta);font-family:var(--fonte-texto);font-size:var(--base);line-height:1.6}',
      'a{color:var(--acento-legivel)}',
      'img,video{max-width:100%;height:auto}',
      'code,pre{font-family:ui-monospace,Menlo,Consolas,"Liberation Mono",monospace;font-size:.92em}',
      'pre{overflow:auto;padding:12px;background:var(--bloco);border-radius:var(--canto)}',
      'blockquote{margin:1em 0;padding:0 0 0 1em;border-left:4px solid var(--linha);color:var(--suave)}',
      '.cabecalho,.principal,.rodape{max-width:var(--largura);margin:0 auto;padding:0 20px}',
      '.cabecalho{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px 20px;padding-top:24px;padding-bottom:16px;border-bottom:1px solid var(--linha);font-family:var(--fonte-titulos)}',
      '.marca{font-size:1.3em;font-weight:700;text-decoration:none;color:var(--tinta)}',
      // 38 — altura fixa, largura livre: trata logo horizontal e quadrado sem
      // distorcer nem cortar. `align-self` porque o cabeçalho alinha por baseline.
      '.marca-logo{line-height:0;align-self:center}',
      '.marca-logo img{height:var(--logo-altura);width:auto;max-width:100%;display:block}',
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
      '.capa{margin:0 0 1.5em}',
      '.capa figcaption{color:var(--suave);font-size:.82em}',
      /* imagem clicável (06 §4): abre o arquivo em tamanho real, sem script */
      '.ampliar{display:inline-block;line-height:0;text-decoration:none;cursor:zoom-in}',
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

  return Object.freeze({ manifesto, templates: Object.freeze({ layout, pagina, artigo, blog, alias }), css, resolver });
})();
