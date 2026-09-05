/* tema/moderno/tema.js — MODERNO: o site como um produto digital (12;
   TEMAS.md). Letra do sistema sem serifa, títulos grandes, cabeçalho fixo no
   topo, cartões com cantos redondos e sombra suave, capa em toda a largura,
   esquema claro/escuro/automático (o automático segue a preferência do
   sistema de quem lê — a única `@media` deste tema, e é de cor, não de
   largura). Pacote de DADOS: manifesto, oito moldes e `css(opcoes)` pura.
   Zero recursos externos; famílias do sistema; só inteiros na cor. */
const TemaModerno = (function () {
  'use strict';

  const options = Object.freeze({
    esquema: Object.freeze({ tipo: 'escolha', rotulo: 'Esquema de cores', padrao: 'automatico',
      opcoes: Object.freeze([['claro', 'Claro'], ['escuro', 'Escuro'], ['automatico', 'Automático (segue o sistema de quem lê)']]) }),
    cor_destaque: Object.freeze({ tipo: 'cor', rotulo: 'Cor de destaque', padrao: '#6d28d9',
      apoio: 'Links, botões e a barra do topo.' }),
    cantos: Object.freeze({ tipo: 'escolha', rotulo: 'Cantos', padrao: 'redondos',
      opcoes: Object.freeze([['suaves', 'Suaves'], ['redondos', 'Redondos']]) }),
    densidade: Object.freeze({ tipo: 'escolha', rotulo: 'Espaçamento', padrao: 'arejado',
      opcoes: Object.freeze([['compacto', 'Compacto'], ['arejado', 'Arejado']]) }),
    tamanho_texto: Object.freeze({ tipo: 'escolha', rotulo: 'Tamanho do texto', padrao: 'medio',
      opcoes: Object.freeze([['pequeno', 'Pequeno'], ['medio', 'Médio'], ['grande', 'Grande']]) }),
    largura: Object.freeze({ tipo: 'escolha', rotulo: 'Largura do texto', padrao: 'media',
      opcoes: Object.freeze([['estreita', 'Estreita'], ['media', 'Média'], ['larga', 'Larga']]),
      apoio: 'Só o texto: a capa e os cartões usam sempre a tela toda.' }),
    altura_logo: Object.freeze({ tipo: 'medida', rotulo: 'Altura do logo', padrao: 36, min: 24, max: 72, passo: 2, unidade: 'px' })
  });
  const manifesto = Object.freeze({ id: 'moderno', version: 1, nome: 'Moderno', autor: 'Nostermentor', engine_min: 1, options: options });

  const layout = [
    '<!doctype html>',
    '<html lang="{{lang}}">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>{{titulo_pagina}}</title>',
    '{{#descricao}}<meta name="description" content="{{descricao}}">',
    // O ícone da aba. Este tema tem molde próprio, logo repete a linha que
    // vive em core/temas.js (TEMAS.md §2: quem substitui o layout herda a
    // obrigação). Sem ícone escolhido, não sai <link> nenhum.
    '{{/descricao}}{{#favicon}}<link rel="icon" href="{{src}}"{{#tipo}} type="{{tipo}}"{{/tipo}}>',
    '{{/favicon}}<link rel="stylesheet" href="/tema/estilo.css">',
    '</head>',
    '<body>',
    '<header class="cabecalho">',
    '<div class="barra">{{#logo}}<a class="marca marca-logo" href="/index.html"><img src="{{src}}" alt="{{alt}}"{{#largura}} width="{{largura}}" height="{{altura}}"{{/largura}}></a>',
    '{{/logo}}{{^logo}}<a class="marca" href="/index.html">{{site_titulo}}</a>',
    '{{/logo}}<nav class="menu" aria-label="Menu">{{#menu}}<a href="{{href}}"{{#externo}} rel="external noopener noreferrer"{{/externo}}{{#atual}} aria-current="page"{{/atual}}>{{rotulo}}</a>{{/menu}}</nav></div>',
    '</header>',
    '<main class="principal">',
    '{{{conteudo}}}',
    '</main>',
    '<footer class="rodape">',
    '<div class="barra">{{#doacoes}}<section class="apoie"><h2>Apoie este site</h2><p>Endereço Lightning: <code>{{lightning_address}}</code></p></section>',
    '{{/doacoes}}{{#credito}}<p class="credito">Publicado com Nostermentor</p>',
    '{{/credito}}</div></footer>',
    '</body>',
    '</html>',
    ''
  ].join('\n');

  // `.miolo` é a coluna de leitura; a capa (`.heroi`) sai dela e ocupa a largura toda
  const pagina = [
    '<article class="pagina">',
    '{{#capa}}<figure class="capa heroi"><img src="{{src}}" alt="{{alt}}"{{#largura}} width="{{largura}}" height="{{altura}}"{{/largura}}>{{#legenda}}<figcaption>{{legenda}}</figcaption>{{/legenda}}</figure>',
    '{{/capa}}<div class="miolo">',
    '<h1>{{titulo}}</h1>',
    '{{{corpo}}}',
    '</div>',
    '</article>',
    '{{#ultimos}}<section class="ultimos"><div class="miolo">',
    '<h2>{{blog_titulo}}</h2>',
    '<ul class="lista-artigos">{{#artigos}}<li><a href="{{href}}">{{titulo}}</a> <time datetime="{{data_iso}}">{{data}}</time></li>',
    '{{/artigos}}</ul>',
    '<p><a class="mais" href="{{blog_href}}">Todos os artigos →</a></p>',
    '</div></section>',
    '{{/ultimos}}',
    ''
  ].join('\n');

  const artigo = [
    '<article class="artigo">',
    '{{#capa}}<figure class="capa heroi"><a class="ampliar" href="{{src}}" target="_blank" rel="noopener"><img src="{{src}}" alt="{{alt}}"{{#largura}} width="{{largura}}" height="{{altura}}"{{/largura}}></a>{{#legenda}}<figcaption>{{legenda}}</figcaption>{{/legenda}}</figure>',
    '{{/capa}}<div class="miolo">',
    '<h1>{{titulo}}</h1>',
    '<p class="meta"><time datetime="{{data_iso}}">{{data}}</time>{{#tem_tags}} {{#tags}}{{#href}}<a class="etiqueta" href="{{href}}">{{nome}}</a>{{/href}}{{^href}}<span class="etiqueta">{{nome}}</span>{{/href}} {{/tags}}{{/tem_tags}}</p>',
    '{{{corpo}}}',
    '</div>',
    '</article>',
    ''
  ].join('\n');

  // a listagem é uma grade de cartões, na largura toda
  const blog = [
    '<section class="blog">',
    '<div class="miolo"><h1>{{blog_titulo}}</h1></div>',
    '{{^tem_artigos}}<div class="miolo"><p class="vazio">Nenhum artigo ainda.</p></div>',
    '{{/tem_artigos}}<ul class="lista-artigos cartoes">{{#artigos}}<li class="cartao"><h2 class="cartao-titulo"><a href="{{href}}">{{titulo}}</a></h2><p class="meta"><time datetime="{{data_iso}}">{{data}}</time></p>{{#resumo}}<p class="resumo">{{resumo}}</p>{{/resumo}}</li>',
    '{{/artigos}}</ul>',
    '</section>',
    ''
  ].join('\n');

  const etiqueta = [
    '<section class="blog etiqueta-pagina">',
    '<div class="miolo"><h1>{{etiqueta}}</h1><p class="meta">Etiqueta</p></div>',
    '{{^tem_artigos}}<div class="miolo"><p class="vazio">Nenhum artigo com esta etiqueta.</p></div>',
    '{{/tem_artigos}}<ul class="lista-artigos cartoes">{{#artigos}}<li class="cartao"><h2 class="cartao-titulo"><a href="{{href}}">{{titulo}}</a></h2><p class="meta"><time datetime="{{data_iso}}">{{data}}</time></p>{{#resumo}}<p class="resumo">{{resumo}}</p>{{/resumo}}</li>',
    '{{/artigos}}</ul>',
    '<div class="miolo"><p><a class="mais" href="{{blog_href}}">← {{blog_titulo}}</a></p></div>',
    '</section>',
    ''
  ].join('\n');

  const botao = [
    '<p class="cta"><a class="botao" href="{{href}}"{{#externo}} rel="external noopener noreferrer"{{/externo}}>{{texto}}</a></p>',
    ''
  ].join('\n');

  const galeria = [
    '<section class="galeria">',
    '{{^tem_artigos}}<p class="vazio">Nenhum artigo ainda.</p>',
    '{{/tem_artigos}}<ul class="cartoes">{{#artigos}}<li class="cartao">{{#capa}}<a class="cartao-capa" href="{{href}}"><img src="{{src}}" alt="{{alt}}"{{#largura}} width="{{largura}}" height="{{altura}}"{{/largura}} loading="lazy"></a>',
    '{{/capa}}<div class="cartao-texto"><h3 class="cartao-titulo"><a href="{{href}}">{{titulo}}</a></h3><p class="meta"><time datetime="{{data_iso}}">{{data}}</time></p>{{#resumo}}<p class="resumo">{{resumo}}</p>{{/resumo}}</div></li>',
    '{{/artigos}}</ul>',
    '</section>',
    ''
  ].join('\n');

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

  function resolver(opcoes) { return Temas.resolver(options, opcoes); }

  // As contas de cor vivem no registro (`Temas.cor`, core/temas.js): estavam
  // copiadas dentro de cada tema e mudaram de lugar em 2026-09-05, quando o
  // app passou a ter 21 temas. Mesma fórmula inteira, mesmos bytes.
  const C = Temas.cor;
  const paraRgb = C.paraRgb, paraHex = C.paraHex, brilho = C.brilho, legivelSobre = C.legivelSobre;

  const CLARO = { fundo: '#ffffff', tinta: '#0f172a', suave: '#64748b', linha: '#e2e8f0', bloco: '#f1f5f9', cartao: '#ffffff', sombra: 'rgba(15,23,42,.08)' };
  const ESCURO = { fundo: '#0b1020', tinta: '#e5e7eb', suave: '#9ca3af', linha: '#1f2937', bloco: '#111827', cartao: '#111827', sombra: 'rgba(0,0,0,.5)' };
  const TAMANHOS = { pequeno: 16, medio: 17, grande: 19 };
  const LARGURAS = { estreita: 640, media: 720, larga: 860 };
  const CANTOS = { suaves: '6px', redondos: '16px' };
  const ESPACO = { compacto: 16, arejado: 28 };

  // as variáveis de um esquema, para pôr em :root ou dentro da @media
  function vars(e, acento) {
    const fundo = paraRgb(e.fundo);
    return '--fundo:' + e.fundo + ';--tinta:' + e.tinta + ';--suave:' + e.suave + ';--linha:' + e.linha + ';--bloco:' + e.bloco + ';--cartao:' + e.cartao + ';--sombra:' + e.sombra + ';' +
      '--acento-legivel:' + paraHex(legivelSobre(acento, fundo));
  }

  function css(opcoes) {
    const v = resolver(opcoes);
    const acento = paraRgb(v.cor_destaque);
    const base = v.esquema === 'escuro' ? ESCURO : CLARO;
    const sans = 'system-ui,-apple-system,"Segoe UI",Roboto,Ubuntu,"Noto Sans",Arial,sans-serif';
    return [
      '/* Nostermentor — tema Moderno v1. Sem fontes remotas, sem imagens externas. */',
      ':root{' + vars(base, acento) + ';--acento:' + v.cor_destaque + ';--acento-texto:' + (brilho(acento) >= 128 ? '#111111' : '#ffffff') + ';' +
        '--base:' + TAMANHOS[v.tamanho_texto] + 'px;--largura:' + LARGURAS[v.largura] + 'px;--canto:' + CANTOS[v.cantos] + ';--espaco:' + ESPACO[v.densidade] + 'px;--logo-altura:' + v.altura_logo + 'px}',
      v.esquema === 'automatico' ? '@media (prefers-color-scheme:dark){:root{' + vars(ESCURO, acento) + '}}' : '/* esquema fixo */',
      v.esquema === 'automatico' ? ':root{color-scheme:light dark}' : ':root{color-scheme:' + (v.esquema === 'escuro' ? 'dark' : 'light') + '}',
      '*{box-sizing:border-box}',
      'html{-webkit-text-size-adjust:100%}',
      'body{margin:0;background:var(--fundo);color:var(--tinta);font-family:' + sans + ';font-size:var(--base);line-height:1.65;overflow-wrap:anywhere}',
      'a{color:var(--acento-legivel)}',
      'img,video{max-width:100%;height:auto;border-radius:var(--canto)}',
      'code,pre{font-family:ui-monospace,Menlo,Consolas,"Liberation Mono",monospace;font-size:.92em}',
      'code{background:var(--bloco);padding:1px 5px;border-radius:4px}',
      'pre{overflow:auto;padding:14px 16px;background:var(--bloco);border-radius:var(--canto)}',
      'pre code{background:none;padding:0}',
      'blockquote{margin:1.2em 0;padding:.6em 1em;border-left:4px solid var(--acento);background:var(--bloco);border-radius:0 var(--canto) var(--canto) 0;color:var(--suave)}',
      'table{display:block;overflow-x:auto;overflow-wrap:normal;margin:1em 0}',
      'th,td{padding:8px 12px;text-align:left;border-bottom:1px solid var(--linha)}',
      'th{background:var(--bloco)}',
      'hr{border:0;border-top:1px solid var(--linha);margin:2em 0}',
      // --- cabeçalho fixo com a barra de acento ------------------------------------
      '.cabecalho{position:sticky;top:0;z-index:2;background:var(--fundo);border-top:4px solid var(--acento);border-bottom:1px solid var(--linha)}',
      '.barra{max-width:1200px;margin:0 auto;padding:10px 20px;display:flex;flex-wrap:wrap;align-items:center;gap:8px 20px}',
      '.marca{font-weight:800;font-size:1.25em;letter-spacing:-.01em;text-decoration:none;color:var(--tinta)}',
      '.marca-logo{line-height:0}',
      '.marca-logo img{max-height:var(--logo-altura);max-width:100%;width:auto;height:auto;display:block;border-radius:0}',
      '.menu{display:flex;flex-wrap:wrap;gap:4px;margin-left:auto}',
      '.menu a{display:inline-block;padding:4px 12px;border-radius:999px;text-decoration:none;color:var(--tinta);font-size:.92em;line-height:1.6}',
      '.menu a:hover{background:var(--bloco)}',
      '.menu a[aria-current=page]{background:var(--acento);color:var(--acento-texto);font-weight:600}',
      // --- o miolo ---------------------------------------------------------------------
      '.principal{padding:var(--espaco) 0 calc(var(--espaco) * 2)}',
      '.miolo{max-width:var(--largura);margin:0 auto;padding:0 20px}',
      'h1,h2,h3{font-weight:800;letter-spacing:-.02em;line-height:1.15}',
      // `clamp`: 2,4em no monitor, mas nunca acima de 8 % da largura da tela — em
      // 320 px um título comprido de 41 px ocupava oito linhas
      'h1{font-size:clamp(1.7em,8vw,2.4em);margin:.3em 0 .4em}',
      'h2{font-size:1.5em;margin:1.4em 0 .5em}',
      'h3{font-size:1.15em;margin:1.2em 0 .4em}',
      '.meta{color:var(--suave);font-size:.88em;margin:0 0 1.5em;display:flex;flex-wrap:wrap;gap:6px;align-items:center}',
      '.etiqueta{display:inline-block;padding:2px 10px;border-radius:999px;background:var(--bloco);font-size:.87em;line-height:20px;text-decoration:none;color:inherit}',
      'a.etiqueta:hover{background:var(--acento);color:var(--acento-texto)}',
      // a capa a toda a largura, com cantos, dentro de uma faixa de 1200
      '.heroi{max-width:1200px;margin:0 auto var(--espaco);padding:0 20px}',
      '.heroi img{display:block;width:100%;height:auto;border-radius:var(--canto);box-shadow:0 10px 30px var(--sombra)}',
      '.heroi figcaption{color:var(--suave);font-size:.85em;padding-top:8px;text-align:center}',
      '.ampliar{display:block;line-height:0;text-decoration:none;cursor:zoom-in}',
      '.botao{display:inline-block;padding:.7em 1.4em;border-radius:999px;background:var(--acento);color:var(--acento-texto);text-decoration:none;font-weight:700;box-shadow:0 6px 16px var(--sombra)}',
      '.cta{margin:1.6em 0}',
      '.mais{font-weight:600;text-decoration:none}',
      // --- cartões: listagem, galeria -------------------------------------------------
      '.cartoes{list-style:none;margin:0 auto;padding:0 20px;max-width:1200px;display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:20px}',
      '.blog .cartoes{margin-top:var(--espaco)}',
      '.cartao{margin:0;background:var(--cartao);border:1px solid var(--linha);border-radius:var(--canto);box-shadow:0 4px 14px var(--sombra);padding:18px;display:flex;flex-direction:column}',
      '.galeria .cartao{padding:0;overflow:hidden}',
      '.cartao-capa{display:block;line-height:0}',
      '.cartao-capa img{width:100%;height:auto;display:block;border-radius:0}',
      '.cartao-texto{padding:14px 18px 18px}',
      '.cartao-titulo{font-size:1.15em;margin:0 0 .3em}',
      '.cartao .meta{margin:0 0 .5em}',
      '.cartao .resumo{margin:0;font-size:.95em;color:var(--suave)}',
      '.lista-artigos a,.ultimos p a,.blog>p a,.cartao-titulo a,.mais{display:inline-block;padding:2px 0;text-decoration:none;color:var(--tinta)}',
      '.cartao-titulo a:hover,.lista-artigos a:hover{color:var(--acento-legivel)}',
      '.ultimos .lista-artigos{list-style:none;margin:0;padding:0}',
      '.ultimos .lista-artigos li{margin:0;padding:8px 0;border-bottom:1px solid var(--linha);display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px 12px}',
      '.ultimos .lista-artigos time{color:var(--suave);font-size:.88em}',
      '.ultimos{margin-top:calc(var(--espaco) * 1.5)}',
      '.resumo{margin:.3em 0 0}',
      '.vazio{color:var(--suave)}',
      '.galeria{margin:1.5em 0}',
      '.galeria .cartoes{padding:0}',
      // --- rodapé -------------------------------------------------------------------------
      '.rodape{border-top:1px solid var(--linha);color:var(--suave);font-size:.85em}',
      '.rodape .barra{display:block;padding:20px}',
      '.apoie h2{font-size:1.1em;margin:0 0 .3em}',
      '.credito{margin:1em 0 0}',
      ''
    ].join('\n');
  }

  return Object.freeze({ manifesto, templates: Object.freeze({ layout, pagina, artigo, blog, etiqueta, alias, botao, galeria }), css, resolver });
})();
Temas.registar(TemaModerno);
