/* tema/nostermentor/tema.js — NOSTERMENTOR: o tema do SITE OFICIAL do
   projeto (2026-09-11). É EXCLUSIVO: o manifesto nomeia a npub do site
   oficial e a galeria (T12) só o mostra para ela — decisão do dono: "tema do
   nostermentor é exclusivo e não aparece em mais nenhum lugar". Fora isso,
   é um tema como os outros: pacote de DADOS (manifesto, oito moldes,
   `css(opcoes)` pura), e passa pelas mesmas provas da suíte.

   A ideia é a da marca do projeto: uma gráfica
   dentro de uma pasta — tinta índigo sobre papel quente. Títulos com serifa
   na cor da tinta (cara de publicação, não de aplicativo), texto sem serifa.
   As assinaturas, nenhuma com imagem nem script:
    · a RETÍCULA — pontos de meio-tom esmaecendo atrás da abertura da capa
      do site: o gesto da impressão, feito com gradientes;
    · o TRAÇO — o risco contínuo do logotipo vira a barra sob os títulos, o
      sublinhado do item de menu atual e a linha que liga os passos;
    · as MARCAS DE CORTE — os cantos de gráfica em volta das imagens;
    · o FÓLIO — as seções da capa numeradas como numa revista ("01 —");
    · o CARIMBO — o botão principal com sombra dura, que afunda ao clicar;
    · o COLOFÃO — o rodapé diz como o site foi composto, e é verdade.
   A página inicial vira vitrine a partir do MESMO Markdown das outras,
   pelo `inicio` que o gerador passa ao molde de página: a lista vira
   cartões, a lista numerada vira passos, a citação vira uma faixa de
   tinta — sem uma classe no conteúdo.

   ⚠️ O que o Tor Browser impõe, lido no código dele (15.0, Firefox ESR 140;
   pesquisa de 2026-09-11):
    · no nível Safest TODO SVG é desligado — o logo e o ícone do site
      oficial são PNG/WebP, e este tema não desenha nada em SVG;
    · `prefers-color-scheme` responde sempre "claro" — o papel é o que o
      leitor de Tor vê; o esquema automático é um extra para quem não usa Tor;
    · no Linux/Tails as únicas letras latinas são Arimo, Tinos e Cousine, só
      em Regular e Bold — as pilhas acabam nelas, e os pesos são 400 e 700;
    · `prefers-reduced-motion` responde sempre "não": o movimento é pouco e
      curto por construção, não por pedido de quem lê.
   Os sinais decorativos com `content` (fólios, números dos passos, aspas da
   faixa) levam texto alternativo vazio (`content: "…" / ""`, Firefox 128+,
   Chrome 77+, Safari 17.4+, conferido no MDN BCD em 2026-09-11): o leitor de
   tela não os lê em voz alta.
   Zero recursos externos (TEMAS.md §8): letras do sistema, nenhuma url(). */
const TemaNostermentor = (function () {
  'use strict';

  const options = Object.freeze({
    esquema: Object.freeze({ tipo: 'escolha', rotulo: 'Esquema de cores', padrao: 'claro',
      opcoes: Object.freeze([['claro', 'Claro (papel)'], ['automatico', 'Automático (segue o sistema de quem lê)']]),
      apoio: 'O Tor Browser pede sempre o claro; o automático só escurece o site para quem pediu o modo escuro no sistema.' }),
    altura_logo: Object.freeze({ tipo: 'medida', rotulo: 'Altura do logo', padrao: 34, min: 24, max: 56, passo: 2, unidade: 'px' })
  });
  const manifesto = Object.freeze({ id: 'nostermentor', version: 1, nome: 'Nostermentor', autor: 'Nostermentor', engine_min: 1,
    // A npub do site oficial do projeto: só ela vê este tema na galeria.
    exclusivo: 'npub1j5tad3x8msv4sy6qnvyrcgvjhfjmlmh32l75kgch2jkqdgfudzaq2wmx2k',
    options: options });

  // Os links do menu, iguais nos três lugares onde aparecem: cabeçalho, menu
  // do celular e rodapé.
  const LINKS = '{{#menu}}<a href="{{href}}"{{#externo}} rel="external noopener noreferrer"{{/externo}}{{#atual}} aria-current="page"{{/atual}}>{{rotulo}}</a>{{/menu}}';
  const IMG = '<img src="{{src}}" alt="{{alt}}"{{#largura}} width="{{largura}}" height="{{altura}}"{{/largura}}>';

  // O menu do celular é um <details>: abre e fecha sem uma linha de script,
  // e no nível Safest do Tor Browser continua funcionando. No computador,
  // o <nav class="menu"> de sempre; a folha de estilo mostra um ou outro.
  const layout = [
    '<!doctype html>',
    '<html lang="{{lang}}">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>{{titulo_pagina}}</title>',
    '{{#descricao}}<meta name="description" content="{{descricao}}">',
    // Molde próprio: repete a obrigação do ícone da aba (TEMAS.md §2).
    '{{/descricao}}{{#favicon}}<link rel="icon" href="{{src}}"{{#tipo}} type="{{tipo}}"{{/tipo}}>',
    '{{/favicon}}<link rel="stylesheet" href="/tema/estilo.css">',
    '</head>',
    '<body>',
    '<a class="pular" href="#conteudo">Pular para o conteúdo</a>',
    '<header class="cabecalho">',
    '<div class="faixa cabecalho-faixa">',
    '{{#logo}}<a class="marca marca-logo" href="/index.html">' + IMG + '</a>',
    '{{/logo}}{{^logo}}<a class="marca" href="/index.html">{{site_titulo}}</a>',
    '{{/logo}}<nav class="menu" aria-label="Menu">' + LINKS + '</nav>',
    '<details class="menu-movel"><summary>Menu</summary><nav aria-label="Menu">' + LINKS + '</nav></details>',
    '</div>',
    '</header>',
    '<main class="principal" id="conteudo">',
    '{{{conteudo}}}',
    '</main>',
    '<footer class="rodape">',
    '<div class="faixa rodape-faixa">',
    '<p class="rodape-marca">{{#logo}}<a class="marca-logo" href="/index.html">' + IMG + '</a>{{/logo}}{{^logo}}<a href="/index.html">{{site_titulo}}</a>{{/logo}}</p>',
    '<nav class="rodape-menu" aria-label="Rodapé">' + LINKS + '</nav>',
    '{{#doacoes}}<section class="apoie"><h2>Apoie este site</h2><p>Endereço Lightning: <code>{{lightning_address}}</code></p></section>',
    // O colofão: a linha "Publicado com Nostermentor" dita por inteiro, e
    // tudo nela é verdade para qualquer site com este tema.
    '{{/doacoes}}{{#credito}}<p class="credito">Composto em letras do sistema, sem uma linha de JavaScript, e publicado no Nostr com o Nostermentor.</p>',
    '{{/credito}}</div>',
    '</footer>',
    '</body>',
    '</html>',
    ''
  ].join('\n');

  // `inicio` (o gerador diz que esta página é a capa do site) acrescenta uma
  // classe, e é a folha de estilo que faz da capa uma vitrine.
  const pagina = [
    '<article class="pagina{{#inicio}} inicio{{/inicio}}">',
    '{{#capa}}<figure class="capa">' + IMG + '{{#legenda}}<figcaption>{{legenda}}</figcaption>{{/legenda}}</figure>',
    '{{/capa}}<h1>{{titulo}}</h1>',
    '{{{corpo}}}',
    '</article>',
    '{{#ultimos}}<section class="ultimos">',
    '<h2>{{blog_titulo}}</h2>',
    '<ul class="lista-artigos">{{#artigos}}<li><a href="{{href}}">{{titulo}}</a> <time datetime="{{data_iso}}">{{data}}</time></li>',
    '{{/artigos}}</ul>',
    '<p><a class="mais" href="{{blog_href}}">Todos os artigos</a></p>',
    '</section>',
    '{{/ultimos}}',
    ''
  ].join('\n');

  // A data e as etiquetas ANTES do título, como sobretítulo.
  const artigo = [
    '<article class="artigo">',
    '<header class="artigo-topo">',
    '<p class="meta"><time datetime="{{data_iso}}">{{data}}</time>{{#tem_tags}}{{#tags}} {{#href}}<a class="etiqueta" href="{{href}}">{{nome}}</a>{{/href}}{{^href}}<span class="etiqueta">{{nome}}</span>{{/href}}{{/tags}}{{/tem_tags}}</p>',
    '<h1>{{titulo}}</h1>',
    '</header>',
    '{{#capa}}<figure class="capa"><a class="ampliar" href="{{src}}" target="_blank" rel="noopener">' + IMG + '</a>{{#legenda}}<figcaption>{{legenda}}</figcaption>{{/legenda}}</figure>',
    '{{/capa}}{{{corpo}}}',
    '</article>',
    ''
  ].join('\n');

  const blog = [
    '<section class="blog">',
    '<h1>{{blog_titulo}}</h1>',
    '{{^tem_artigos}}<p class="vazio">Nenhum artigo ainda.</p>',
    '{{/tem_artigos}}<ul class="lista-artigos">{{#artigos}}<li><p class="meta"><time datetime="{{data_iso}}">{{data}}</time></p><h2><a href="{{href}}">{{titulo}}</a></h2>{{#resumo}}<p class="resumo">{{resumo}}</p>{{/resumo}}</li>',
    '{{/artigos}}</ul>',
    '</section>',
    ''
  ].join('\n');

  const etiqueta = [
    '<section class="blog etiqueta-pagina">',
    '<p class="meta">Etiqueta</p>',
    '<h1>{{etiqueta}}</h1>',
    '{{^tem_artigos}}<p class="vazio">Nenhum artigo com esta etiqueta.</p>',
    '{{/tem_artigos}}<ul class="lista-artigos">{{#artigos}}<li><p class="meta"><time datetime="{{data_iso}}">{{data}}</time></p><h2><a href="{{href}}">{{titulo}}</a></h2>{{#resumo}}<p class="resumo">{{resumo}}</p>{{/resumo}}</li>',
    '{{/artigos}}</ul>',
    '<p><a class="mais" href="{{blog_href}}">Todos os artigos</a></p>',
    '</section>',
    ''
  ].join('\n');

  const galeria = [
    '<section class="galeria">',
    '{{^tem_artigos}}<p class="vazio">Nenhum artigo ainda.</p>',
    '{{/tem_artigos}}<ul class="cartoes">{{#artigos}}<li class="cartao">{{#capa}}<a class="cartao-capa" href="{{href}}"><img src="{{src}}" alt="{{alt}}"{{#largura}} width="{{largura}}" height="{{altura}}"{{/largura}} loading="lazy"></a>',
    '{{/capa}}<div class="cartao-texto"><p class="meta"><time datetime="{{data_iso}}">{{data}}</time></p><h3 class="cartao-titulo"><a href="{{href}}">{{titulo}}</a></h3>{{#resumo}}<p class="resumo">{{resumo}}</p>{{/resumo}}</div></li>',
    '{{/artigos}}</ul>',
    '</section>',
    ''
  ].join('\n');

  // O botão e o redirecionamento são os do core, sem mudança.
  const botao = Temas.moldes.botao;
  const alias = Temas.moldes.alias;

  function resolver(opcoes) { return Temas.resolver(options, opcoes); }

  // As letras. Só famílias do sistema (TEMAS.md §8), numa ordem escolhida
  // pelo que o Tor Browser tem (código dele, 15.0/ESR 140). Texto: a Noto
  // Sans — a do logotipo — onde existir (o Tor Browser no Windows a traz);
  // a "Segoe UI" pelo nome e a Arimo ANTES do `system-ui`, porque o
  // `system-ui` do Tor Browser dá Arial no Windows e há relato de dar Tinos
  // no Linux. Títulos: a pilha "Transitional" (Charter no macOS, Sitka no
  // Windows), que no Linux/Tails acaba na Tinos.
  const SANS = '"Noto Sans","Segoe UI",Arimo,system-ui,-apple-system,Roboto,"Helvetica Neue",Arial,sans-serif';
  const SERIFA = 'Charter,"Bitstream Charter","Sitka Heading","Sitka Text",Cambria,"Noto Serif",Georgia,Tinos,"Times New Roman",serif';
  const MONO = 'ui-monospace,"Cascadia Code","Source Code Pro",Menlo,Consolas,"DejaVu Sans Mono","Noto Sans Mono","Liberation Mono",Cousine,monospace';

  // As cores da marca, medidas na identidade visual do projeto: o texto a 15,68:1
  // sobre o papel, o suave a 6,24:1, a tinta a 9,06:1, a tinta escura (os
  // títulos) a 12,2:1; o branco sobre a tinta a 9,95:1; o texto da faixa
  // escura a 14,11:1, o suave dela a 9,42:1.
  const CLARO = Object.freeze({ papel: '#F7F4EE', superficie: '#FFFFFF', texto: '#1C1B19', titulo: '#1D2C5C', suave: '#5F5A51', linha: '#E2DCD0',
    marca: '#2A3F7E', 'marca-clara': '#AEBDEA', destaque: '#ECEFF7', barra: '#18203A',
    'barra-texto': '#EEF0F6', 'barra-suave': '#BFC6DA', corte: '#8A8478', ponto: 'rgba(42,63,126,.15)',
    'sombra-forte': 'rgba(24,32,58,.30)', 'botao-fundo': '#2A3F7E', 'botao-texto': '#FFFFFF', 'botao-hover': '#1D2C5C', carimbo: '#1D2C5C', codigo: '#ECEFF7' });
  // O escuro é a mesma tinta de noite: o fundo vem da barra e a marca passa
  // à Clara, que é a regra 3 da identidade visual (sobre fundo escuro, nunca
  // a Tinta — 2,1:1).
  const ESCURO = Object.freeze({ papel: '#0F1426', superficie: '#161D35', texto: '#ECEEF5', titulo: '#F3F5FB', suave: '#B4BCD2', linha: '#28314F',
    marca: '#AEBDEA', 'marca-clara': '#AEBDEA', destaque: '#1B2443', barra: '#090D1A',
    'barra-texto': '#ECEEF5', 'barra-suave': '#B4BCD2', corte: '#5D6788', ponto: 'rgba(174,189,234,.10)',
    'sombra-forte': 'rgba(0,0,0,.60)', 'botao-fundo': '#AEBDEA', 'botao-texto': '#0F1426', 'botao-hover': '#D2DAF4', carimbo: '#05070F', codigo: '#1B2443' });
  function vars(e) { return Object.keys(e).map(k => '--' + k + ':' + e[k]).join(';'); }

  // As marcas de corte: um "L" em cada canto, oito linhas de 1 px feitas com
  // gradientes (nenhuma imagem).
  function marcasDeCorte(lado) {
    const l = 'linear-gradient(var(--corte),var(--corte))';
    return [['left', 'top'], ['right', 'top'], ['left', 'bottom'], ['right', 'bottom']]
      .map(c => l + ' ' + c[0] + ' ' + c[1] + '/' + lado + ' 1px no-repeat,' + l + ' ' + c[0] + ' ' + c[1] + '/1px ' + lado + ' no-repeat').join(',');
  }

  function css(opcoes) {
    const v = resolver(opcoes);
    const auto = v.esquema === 'automatico';
    return [
      '/* Nostermentor — tema Nostermentor v1. Sem fontes remotas, sem imagens externas, sem script. */',
      ':root{' + vars(CLARO) + ';--logo-altura:' + v.altura_logo + 'px;--margem:clamp(1rem,4vw,2.5rem);--texto-larg:42rem;--larga:1180px;color-scheme:' + (auto ? 'light dark' : 'light') + '}',
      auto ? '@media (prefers-color-scheme:dark){:root{' + vars(ESCURO) + '}.cabecalho .marca-logo img{filter:brightness(0) invert(1)}}' : '/* esquema: claro */',
      // --- base ------------------------------------------------------------------
      '*,*::before,*::after{box-sizing:border-box}',
      'html{-webkit-text-size-adjust:100%;text-size-adjust:100%}',
      'body{margin:0;background:var(--papel);color:var(--texto);font-family:' + SANS + ';font-size:clamp(1rem,.95rem + .25vw,1.0625rem);line-height:1.65;overflow-wrap:anywhere;-webkit-font-smoothing:antialiased}',
      '::selection{background:var(--marca);color:var(--papel)}',
      'a{color:var(--marca);text-decoration-thickness:.08em;text-underline-offset:.2em;text-decoration-color:color-mix(in srgb,var(--marca) 40%,transparent)}',
      'a:hover{text-decoration-color:currentColor}',
      ':focus-visible{outline:3px solid var(--marca);outline-offset:3px;border-radius:6px}',
      'img,video{max-width:100%;height:auto}',
      // Títulos com serifa, na tinta; peso 700 porque a Tinos (Tor no Linux)
      // só tem Regular e Bold, e espaçamento contido — o −0,04em das letras
      // de vitrine cola as letras de sistema.
      'h1,h2{font-family:' + SERIFA + ';font-weight:700;color:var(--titulo);line-height:1.1;letter-spacing:-.015em;text-wrap:balance;margin:0}',
      'h3,h4{font-weight:700;color:var(--texto);line-height:1.25;letter-spacing:-.01em;text-wrap:balance;margin:0}',
      'h1{font-size:clamp(2.1rem,1.4rem + 2.6vw,3.3rem)}',
      'h2{font-size:clamp(1.5rem,1.2rem + 1.1vw,1.95rem)}',
      'h3{font-size:1.18rem}',
      'p,ul,ol,dl,pre,table,blockquote,figure,details{margin:0 0 1.2em}',
      'ul,ol{padding-left:1.35em}',
      'li{margin:.35em 0}',
      'li::marker{color:var(--marca)}',
      'strong{font-weight:700;color:var(--texto)}',
      'hr{border:0;width:3.5rem;height:.3rem;border-radius:99px;background:var(--marca);margin:3em auto}',
      'blockquote{padding:.1em 0 .1em 1.2em;border-left:.3rem solid var(--marca);font-family:' + SERIFA + ';font-style:italic;font-size:1.15em;line-height:1.5}',
      'blockquote>:last-child{margin-bottom:0}',
      'code,kbd,pre{font-family:' + MONO + ';font-size:.9em}',
      'code{background:var(--codigo);padding:.1em .38em;border-radius:6px}',
      'pre{overflow:auto;padding:1.05rem 1.25rem;background:var(--barra);color:var(--barra-texto);border-radius:14px;line-height:1.55}',
      'pre code{background:none;padding:0;color:inherit;font-size:.95em}',
      // A tabela rola sozinha (o Markdown não deixa envolvê-la em outro elemento); `normal` e não
      // `anywhere`, senão o motor esmaga as células em vez de rolar (TEMAS.md §7.4).
      'table{display:block;overflow-x:auto;overflow-wrap:normal;border-collapse:collapse;font-size:.95em}',
      'th,td{padding:.6em .9em;text-align:left;border-bottom:1px solid var(--linha)}',
      'thead th{font-size:.78rem;text-transform:uppercase;letter-spacing:.07em;color:var(--suave);border-bottom:2px solid var(--texto)}',
      'figure{margin:1.8em 0}',
      'figcaption{color:var(--suave);font-size:.875rem;margin-top:.65rem;text-align:center}',
      // As perguntas frequentes: <details> no conteúdo, abre e fecha sem script.
      'details{border-top:1px solid var(--linha);border-bottom:1px solid var(--linha)}',
      'details+details{border-top:0;margin-top:-1.2em}',
      'summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:1rem;min-height:3.25rem;padding:.6rem 0;font-weight:700;color:var(--texto)}',
      'summary::-webkit-details-marker{display:none}',
      'summary::after{content:"";flex:none;width:.55rem;height:.55rem;margin-right:.3rem;border-right:2px solid var(--marca);border-bottom:2px solid var(--marca);transform:rotate(45deg) translateY(-2px);transition:transform .15s ease}',
      'details[open]>summary::after{transform:rotate(-135deg) translateX(-2px)}',
      'details>:not(summary){color:var(--suave);margin:0 0 1rem}',
      '.ampliar{display:inline-block;line-height:0;cursor:zoom-in;text-decoration:none}',
      '.principal img{border-radius:12px}',
      '.pular{position:absolute;left:1rem;top:-6rem;z-index:10;padding:.75rem 1.1rem;background:var(--barra);color:var(--barra-texto);border-radius:10px;font-weight:700;text-decoration:none}',
      '.pular:focus{top:1rem}',
      // --- a faixa: a largura máxima do site -------------------------------------------
      '.faixa{max-width:var(--larga);margin:0 auto;padding-inline:var(--margem)}',
      // --- cabeçalho (NÃO fixo: o Tor Browser dá 500 a 600 px de altura) ---------------
      '.cabecalho{position:relative;z-index:3;border-bottom:1px solid var(--linha)}',
      '.cabecalho-faixa{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.75rem 1.5rem;min-height:4.5rem;padding-block:.6rem}',
      '.marca{display:inline-flex;align-items:center;min-height:2.75rem;min-width:0;font-weight:700;font-size:1.2rem;letter-spacing:-.01em;color:var(--texto);text-decoration:none}',
      '.marca-logo{line-height:0;min-width:0}',
      '.marca-logo img{display:block;max-height:var(--logo-altura);max-width:100%;width:auto;height:auto;border-radius:0}',
      '.menu{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:.2rem .3rem}',
      '.menu a{position:relative;display:inline-flex;align-items:center;min-height:2.5rem;padding:0 .8rem;border-radius:10px;color:var(--texto);font-weight:600;font-size:.95rem;text-decoration:none}',
      '.menu a:hover{background:var(--destaque);color:var(--marca)}',
      '.menu a[aria-current=page]{color:var(--marca)}',
      '.menu a[aria-current=page]::after{content:"";position:absolute;left:.8rem;right:.8rem;bottom:.3rem;height:3px;border-radius:99px;background:var(--marca)}',
      '.menu-movel{display:none}',
      '.menu-movel>summary{display:inline-flex;justify-content:flex-start;gap:.6rem;min-height:2.75rem;padding:0 1rem;border:1px solid var(--linha);border-radius:12px;background:var(--superficie)}',
      '.menu-movel>summary::after{display:none}',
      '.menu-movel>summary::before{content:"";width:1.05rem;height:.8rem;background:linear-gradient(currentColor,currentColor) 0 0/100% 2px no-repeat,linear-gradient(currentColor,currentColor) 0 50%/100% 2px no-repeat,linear-gradient(currentColor,currentColor) 0 100%/100% 2px no-repeat}',
      '.menu-movel[open]>summary{background:var(--destaque);border-color:var(--marca);color:var(--marca)}',
      '.menu-movel>nav{position:absolute;left:0;right:0;top:100%;display:flex;flex-direction:column;padding:.4rem var(--margem) 1.2rem;background:var(--papel);border-bottom:1px solid var(--linha);box-shadow:0 30px 40px -30px var(--sombra-forte)}',
      '.menu-movel>nav a{display:flex;align-items:center;min-height:3rem;border-bottom:1px solid var(--linha);color:var(--texto);font-weight:600;text-decoration:none}',
      '.menu-movel>nav a[aria-current=page]{color:var(--marca)}',
      '.cabecalho details,.cabecalho details+details{border:0;margin:0}',
      '@media (max-width:760px){.menu{display:none}.menu-movel{display:block;flex:none}.cabecalho-faixa{flex-wrap:nowrap}}',
      // --- o miolo -------------------------------------------------------------------------
      '.principal{padding-block:clamp(2.25rem,5vw,3.75rem) clamp(3.5rem,8vw,6rem)}',
      '.principal>*{max-width:var(--larga);margin-inline:auto;padding-inline:var(--margem)}',
      '.pagina>*,.artigo>*,.blog>*,.ultimos>*{max-width:var(--texto-larg);margin-inline:auto}',
      '.pagina:not(.inicio)>h1,.blog>h1{margin-bottom:1.6rem}',
      '.pagina:not(.inicio)>h1::after,.blog>h1::after{content:"";display:block;width:3.25rem;height:.3rem;border-radius:99px;background:var(--marca);margin-top:1.1rem}',
      '.pagina:not(.inicio)>h1+p{font-size:1.18em;color:var(--suave);line-height:1.6}',
      '.pagina>h2,.artigo>h2{margin:2.2em auto .6em}',
      '.pagina>h3,.artigo>h3{margin:1.8em auto .5em}',
      '.capa{margin:0 auto 2.25rem}',
      '.pagina>.capa{max-width:none}',
      '.artigo>.capa{max-width:56rem}',
      '.capa img{display:block;width:100%;height:auto;border-radius:18px;box-shadow:0 30px 60px -40px var(--sombra-forte)}',
      '.capa .ampliar{display:block}',
      // uma lista cujos itens trazem imagem vira grade de provas, com as marcas de corte
      '.pagina>ul:has(>li>.ampliar){max-width:none;list-style:none;padding:0;margin:2.5rem 0;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,16rem),1fr));gap:2.25rem 1.75rem}',
      '.pagina>ul:has(>li>.ampliar)>li{margin:0;color:var(--suave);font-size:.95rem;line-height:1.5}',
      '.pagina>ul:has(>li>.ampliar)>li>.ampliar{position:relative;display:block;margin-bottom:.95rem}',
      '.pagina>ul:has(>li>.ampliar)>li>.ampliar::after{content:"";position:absolute;inset:-.55rem;pointer-events:none;background:' + marcasDeCorte('.7rem') + '}',
      '.pagina>ul:has(>li>.ampliar)>li img{display:block;width:100%;border-radius:4px;box-shadow:0 0 0 1px var(--linha),0 18px 36px -28px var(--sombra-forte)}',
      '.pagina>ul:has(>li>.ampliar)>li>strong{display:block;font-size:1.05rem;margin-bottom:.15rem}',
      // --- a CAPA DO SITE (`inicio`): vitrine a partir do mesmo Markdown --------------
      '.principal:has(>.inicio){position:relative;isolation:isolate;padding-top:clamp(2.5rem,7vw,6rem)}',
      '.principal:has(>.inicio)::before{content:"";position:absolute;z-index:-1;left:0;right:0;top:0;height:46rem;pointer-events:none;background-image:radial-gradient(circle,var(--ponto) 1.2px,transparent 1.7px);background-size:15px 15px;-webkit-mask-image:radial-gradient(ellipse 60% 62% at 50% 0,#000 18%,transparent 72%);mask-image:radial-gradient(ellipse 60% 62% at 50% 0,#000 18%,transparent 72%)}',
      '.principal:has(>.inicio)::after{content:"";position:absolute;z-index:-2;left:0;right:0;top:0;height:40rem;pointer-events:none;background:radial-gradient(ellipse 55% 60% at 50% 0,var(--destaque),transparent 72%)}',
      '.inicio{text-align:center;counter-reset:secao}',
      '.inicio>*{text-align:left}',
      // o título da capa encolhe também quando falta ALTURA: no Tor Browser a
      // 1000×500 a abertura inteira, com os botões, tem de caber sem rolar
      '.inicio>h1{max-width:17ch;margin:0 auto 1.3rem;text-align:center;font-size:clamp(2.25rem,min(1.2rem + 4.4vw,10.5vh),4.5rem);line-height:1.04;letter-spacing:-.02em}',
      '.inicio>h1+p{max-width:38rem;margin:0 auto 1.9rem;text-align:center;color:var(--suave);font-size:clamp(1.08rem,1rem + .5vw,1.3rem);line-height:1.55}',
      '.inicio .cta{margin:.4rem .45rem}',
      // a linha curta depois dos botões ("Grátis · Sem cadastro…"); o
      // `:not(.cta)` impede a regra de pegar o SEGUNDO botão, que também é <p>
      '.inicio>h1+p+.cta+.cta+p:not(.cta),.inicio>h1+p+.cta+p:not(.cta){max-width:38rem;margin:1.4rem auto 0;text-align:center;font-family:' + MONO + ';font-size:.8rem;letter-spacing:.06em;text-transform:uppercase;color:var(--suave)}',
      // as imagens da capa: moldura e marcas de corte
      '.inicio>p:has(>.ampliar){max-width:none;margin:clamp(2.5rem,6vw,4.5rem) auto 0;padding:clamp(.9rem,2.2vw,1.6rem);background:' + marcasDeCorte('1.1rem') + '}',
      '.inicio>p:has(>.ampliar)>.ampliar{display:block;overflow:hidden;border-radius:14px;background:var(--superficie);box-shadow:0 0 0 1px var(--linha),0 40px 80px -40px var(--sombra-forte)}',
      '.inicio>p:has(>.ampliar) img{display:block;width:100%;border-radius:0}',
      // os títulos de seção, com o fólio por cima
      '.inicio>h2{counter-increment:secao;max-width:24ch;margin:clamp(4.5rem,10vw,8rem) auto 1rem;text-align:center;font-size:clamp(1.85rem,1.25rem + 2.4vw,3rem)}',
      '.inicio>h2::before{content:counter(secao,decimal-leading-zero) " \\2014";content:counter(secao,decimal-leading-zero) " \\2014"/"";display:block;margin:0 auto 1.1rem;font-family:' + MONO + ';font-size:.8rem;font-weight:700;letter-spacing:.14em;color:var(--marca)}',
      '.inicio>h2+p{max-width:38rem;margin:0 auto 2.4rem;text-align:center;color:var(--suave);font-size:1.12rem}',
      // a lista vira cartões, cada um aberto pelo traço
      '.inicio>ul{max-width:none;list-style:none;padding:0;margin:0 auto 1rem;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,16.5rem),1fr));gap:1rem}',
      '.inicio>ul>li{margin:0;padding:1.5rem 1.4rem 1.55rem;background:var(--superficie);border:1px solid var(--linha);border-radius:18px;color:var(--suave);line-height:1.55;box-shadow:0 22px 44px -36px var(--sombra-forte)}',
      '.inicio>ul>li::before{content:"";display:block;width:2rem;height:.25rem;margin-bottom:1.1rem;border-radius:99px;background:var(--marca)}',
      '.inicio>ul>li>strong:first-child{display:block;margin-bottom:.35rem;font-size:1.1rem;letter-spacing:-.01em}',
      // a lista numerada vira passos, ligados pelo traço (vertical no celular)
      '.inicio>ol{max-width:none;list-style:none;padding:0;margin:0 auto 1rem;display:grid;gap:2rem;counter-reset:passo}',
      '.inicio>ol>li{counter-increment:passo;position:relative;margin:0;padding-left:4.4rem;min-height:3rem;color:var(--suave);line-height:1.55}',
      '.inicio>ol>li::before{content:counter(passo);content:counter(passo)/"";position:absolute;left:0;top:0;z-index:1;display:grid;place-items:center;width:3rem;height:3rem;border-radius:50%;background:var(--papel);border:2px solid var(--marca);color:var(--marca);font-family:' + SERIFA + ';font-weight:700;font-size:1.3rem}',
      '.inicio>ol>li:not(:last-child)::after{content:"";position:absolute;left:calc(1.5rem - 1px);top:3rem;bottom:-2rem;width:2px;border-radius:2px;background:var(--marca);opacity:.35}',
      '.inicio>ol>li>strong:first-child{display:block;margin-bottom:.3rem;padding-top:.6rem;font-size:1.1rem}',
      '@media (min-width:900px){.inicio>ol{grid-template-columns:repeat(3,minmax(0,1fr))}.inicio>ol>li{padding:4.4rem 0 0}.inicio>ol>li:not(:last-child)::after{left:3.5rem;right:-1.5rem;top:calc(1.5rem - 1px);bottom:auto;width:auto;height:2px}.inicio>ol>li>strong:first-child{padding-top:0}}',
      // a citação vira a faixa de tinta, de ponta a ponta da tela
      '.inicio>blockquote{max-width:none;margin:clamp(4.5rem,10vw,8rem) 0 0;padding:clamp(3.5rem,8vw,6rem) 0;border:0;background:var(--barra);box-shadow:0 0 0 100vmax var(--barra);clip-path:inset(0 -100vmax);color:var(--barra-texto);text-align:center}',
      '.inicio>blockquote::before{content:"\\201C";content:"\\201C"/"";display:block;margin-bottom:1rem;font-family:' + SERIFA + ';font-size:5rem;font-style:normal;line-height:.5;color:var(--marca-clara)}',
      '.inicio>blockquote>p{max-width:30ch;margin:0 auto;font-size:clamp(1.5rem,1.05rem + 2.3vw,2.6rem);line-height:1.28;text-wrap:balance;color:var(--barra-texto)}',
      '.inicio>blockquote>p+p{max-width:none;margin-top:1.6rem;font-family:' + SANS + ';font-style:normal;font-size:.95rem;color:var(--barra-suave)}',
      '.inicio>blockquote a{color:var(--marca-clara)}',
      // --- botões: o carimbo (o segundo seguido é o secundário) -------------------------
      '.cta{display:inline-block;margin:.5rem .75rem .5rem 0}',
      '.botao{display:inline-flex;align-items:center;gap:.6rem;min-height:3rem;padding:.8rem 1.4rem;border-radius:10px;background:var(--botao-fundo);color:var(--botao-texto);font-weight:700;line-height:1.2;text-decoration:none;box-shadow:.22rem .22rem 0 var(--carimbo);transition:transform .12s ease,box-shadow .12s ease,background-color .12s ease}',
      '.botao::after{content:"";width:.45rem;height:.45rem;border-top:2px solid currentColor;border-right:2px solid currentColor;transform:rotate(45deg)}',
      '.botao:hover{background:var(--botao-hover);color:var(--botao-texto);transform:translate(-1px,-1px);box-shadow:.3rem .3rem 0 var(--carimbo)}',
      '.botao:active{transform:translate(.22rem,.22rem);box-shadow:0 0 0 var(--carimbo)}',
      '.cta+.cta .botao{background:var(--papel);color:var(--marca);box-shadow:inset 0 0 0 1.5px var(--marca)}',
      '.cta+.cta .botao:hover{background:var(--destaque);color:var(--marca);box-shadow:inset 0 0 0 1.5px var(--marca)}',
      '.cta+.cta .botao:active{transform:none}',
      // --- listagens, etiquetas, datas ------------------------------------------------------
      '.meta{display:flex;flex-wrap:wrap;align-items:center;gap:.4rem .6rem;margin:0 0 1rem;font-family:' + MONO + ';font-size:.8rem;letter-spacing:.05em;text-transform:uppercase;color:var(--suave)}',
      '.etiqueta{display:inline-flex;align-items:center;justify-content:center;min-height:1.75rem;min-width:1.75rem;padding:0 .7rem;border-radius:99px;background:var(--destaque);color:var(--marca);font-weight:600;text-decoration:none}',
      'a.etiqueta:hover{background:var(--marca);color:var(--papel)}',
      '.artigo-topo{margin-bottom:2rem}',
      '.artigo-topo>.meta{margin-bottom:.8rem}',
      '.blog>.meta{margin-bottom:.6rem}',
      // `margin-block` e não `margin`: a lista é filha da coluna e fica centrada nela
      '.lista-artigos{list-style:none;padding:0;margin-block:0}',
      '.blog>.lista-artigos>li{margin:0;padding:1.6rem 0;border-top:1px solid var(--linha)}',
      '.blog>.lista-artigos>li:last-child{border-bottom:1px solid var(--linha)}',
      '.blog>.lista-artigos .meta{margin:0 0 .4rem}',
      '.blog>.lista-artigos h2{margin:0 0 .45rem;font-size:clamp(1.35rem,1.1rem + .9vw,1.7rem)}',
      '.blog>.lista-artigos h2 a,.cartao-titulo a,.ultimos .lista-artigos a,.mais{display:inline-block;padding:2px 0;color:var(--titulo);text-decoration:none}',
      '.blog>.lista-artigos h2 a:hover,.cartao-titulo a:hover,.ultimos .lista-artigos a:hover{color:var(--marca)}',
      '.mais{color:var(--marca);font-weight:700}',
      '.resumo{margin:0;color:var(--suave)}',
      '.vazio{color:var(--suave);font-style:italic}',
      '.blog>p{margin-top:1.5rem}',
      '.ultimos{margin-top:clamp(3rem,7vw,5rem)}',
      '.ultimos>h2{margin-bottom:1rem}',
      '.ultimos .lista-artigos>li{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:.2rem 1rem;margin:0;padding:.75rem 0;border-bottom:1px solid var(--linha)}',
      '.ultimos .lista-artigos>li>a{font-weight:600}',
      '.ultimos time{font-family:' + MONO + ';font-size:.8rem;color:var(--suave)}',
      '.ultimos>p{margin-top:1.2rem}',
      // --- cartões: a galeria de artigos --------------------------------------------------
      '.galeria{margin:2.2rem auto}',
      '.pagina>.galeria,.artigo>.galeria{max-width:none}',
      // na capa, poucos cartões ficam ao centro, debaixo do título centrado
      '.inicio .cartoes{grid-template-columns:repeat(auto-fit,minmax(min(100%,17rem),22rem));justify-content:center}',
      '.cartoes{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,17rem),1fr));gap:1.25rem}',
      '.cartao{margin:0;display:flex;flex-direction:column;overflow:hidden;background:var(--superficie);border:1px solid var(--linha);border-radius:18px;box-shadow:0 24px 44px -38px var(--sombra-forte);transition:transform .2s ease,box-shadow .2s ease}',
      '.cartao:hover{transform:translateY(-3px);box-shadow:0 30px 54px -34px var(--sombra-forte)}',
      '.cartao-capa{display:block;line-height:0}',
      '.cartao-capa img{display:block;width:100%;height:auto;border-radius:0}',
      '.cartao-texto{display:flex;flex-direction:column;gap:.35rem;padding:1.1rem 1.25rem 1.35rem}',
      '.cartao-titulo{margin:0;font-family:' + SERIFA + ';font-size:1.25rem;line-height:1.2}',
      '.cartao .meta{margin:0}',
      '.cartao .resumo{font-size:.95rem}',
      // --- rodapé: a faixa de tinta, com o colofão --------------------------------------
      '.rodape{background:radial-gradient(ellipse 60% 90% at 85% 0,rgba(174,189,234,.12),transparent 70%),var(--barra);color:var(--barra-suave);font-size:.95rem}',
      '.rodape-faixa{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:1rem 2.5rem;padding-block:clamp(2.75rem,6vw,4.25rem)}',
      '.rodape a{color:var(--barra-texto);text-decoration:none}',
      '.rodape a:hover{text-decoration:underline}',
      '.rodape-marca{margin:0;font-weight:700;font-size:1.25rem}',
      '.rodape-marca>a{display:inline-flex;align-items:center;min-height:2.75rem}',
      '.rodape .marca-logo img{filter:brightness(0) invert(1)}',
      '.rodape-menu{display:flex;flex-wrap:wrap;gap:.1rem 1.4rem}',
      '.rodape-menu a{display:inline-flex;align-items:center;min-height:2.5rem}',
      '.rodape-menu a[aria-current=page]{color:var(--marca-clara)}',
      '.apoie h2{margin:0 0 .4rem;font-family:' + SANS + ';font-size:1rem;color:var(--barra-texto)}',
      '.apoie p{margin:0}',
      '.apoie code{background:rgba(255,255,255,.08);color:var(--barra-texto)}',
      '.credito{flex:1 1 100%;margin:0;padding-top:1.4rem;border-top:1px solid rgba(255,255,255,.12);font-family:' + MONO + ';font-size:.8rem;letter-spacing:.03em}',
      '@media (prefers-reduced-motion:reduce){*,*::before,*::after{transition:none!important}}',
      ''
    ].join('\n');
  }

  return Object.freeze({ manifesto, templates: Object.freeze({ layout, pagina, artigo, blog, etiqueta, alias, botao, galeria }), css, resolver });
})();
Temas.registar(TemaNostermentor);
