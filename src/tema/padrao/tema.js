/* tema/padrao/tema.js — o tema embutido da v1 (06 §5.3; 02 G.2): um pacote
   de DADOS — manifesto, templates Mustache logic-less e CSS como strings.
   Nada aqui executa no painel; o gerador (core/gerador.js) preenche as
   lacunas. Zero recursos externos (G.2.4): nenhuma URL absoluta em src,
   href, url() ou @import — um pixel remoto desanonimizaria o leitor. O
   crédito do rodapé é texto, sem link (o projeto ainda não tem endereço
   público). A folha de estilo vai para /tema/estilo.css (13 §5.1). */
const TemaPadrao = (function () {
  'use strict';

  const manifesto = Object.freeze({
    id: 'padrao', version: 1, nome: 'Padrão', autor: 'Nostermentor', engine_min: 1,
    // opções que o dono pode ajustar em T7 §Aparência (M5); o core não as valida
    options: Object.freeze({})
  });

  // Layout de toda página HTML. Contexto (todo pré-calculado pelo gerador —
  // logic-less): lang, titulo_pagina, descricao, site_titulo, menu[] {href,
  // rotulo, externo, atual}, conteudo (HTML já sanitizado), doacoes
  // {lightning_address} | null, credito (bool).
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
    '<a class="marca" href="/index.html">{{site_titulo}}</a>',
    '<nav class="menu" aria-label="Menu">{{#menu}}<a href="{{href}}"{{#externo}} rel="external noopener noreferrer"{{/externo}}{{#atual}} aria-current="page"{{/atual}}>{{rotulo}}</a>{{/menu}}</nav>',
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

  const css = [
    '/* Nostermentor — tema Padrão v1. Sem fontes remotas, sem imagens externas. */',
    ':root{--fundo:#fbfbfa;--papel:#fff;--tinta:#1d2327;--suave:#646970;--linha:#dcdcde;--acento:#2271b1}',
    '*{box-sizing:border-box}',
    'html{-webkit-text-size-adjust:100%}',
    'body{margin:0;background:var(--fundo);color:var(--tinta);font:17px/1.6 Georgia,"Times New Roman",serif}',
    'a{color:var(--acento)}',
    'img,video{max-width:100%;height:auto}',
    'code,pre{font-family:ui-monospace,Menlo,Consolas,"Liberation Mono",monospace;font-size:.92em}',
    'pre{overflow:auto;padding:12px;background:#f0f0f1;border-radius:4px}',
    'blockquote{margin:1em 0;padding:0 0 0 1em;border-left:4px solid var(--linha);color:var(--suave)}',
    '.cabecalho,.principal,.rodape{max-width:760px;margin:0 auto;padding:0 20px}',
    '.cabecalho{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px 20px;padding-top:24px;padding-bottom:16px;border-bottom:1px solid var(--linha);font-family:system-ui,-apple-system,"Segoe UI",Roboto,Ubuntu,"Noto Sans",sans-serif}',
    '.marca{font-size:22px;font-weight:700;text-decoration:none;color:var(--tinta)}',
    '.menu{display:flex;flex-wrap:wrap;gap:4px 16px}',
    '.menu a{text-decoration:none}',
    '.menu a[aria-current=page]{font-weight:700;color:var(--tinta)}',
    '.principal{padding-top:24px;padding-bottom:40px}',
    'h1{font-size:32px;line-height:1.2;margin:0 0 .5em}',
    'h2{font-size:24px;line-height:1.25;margin:1.4em 0 .5em}',
    'h3{font-size:20px;margin:1.3em 0 .5em}',
    '.meta{color:var(--suave);font-size:15px;margin:0 0 1.2em;font-family:system-ui,sans-serif}',
    '.etiqueta{display:inline-block;padding:1px 8px;border:1px solid var(--linha);border-radius:12px;font-size:13px}',
    '.capa{margin:0 0 1.5em}',
    '.capa figcaption{color:var(--suave);font-size:14px}',
    /* imagem clicável (06 §4): abre o arquivo em tamanho real, sem script */
    '.ampliar{display:inline-block;line-height:0;text-decoration:none;cursor:zoom-in}',
    '.lista-artigos{list-style:none;margin:0;padding:0}',
    '.lista-artigos li{margin:0 0 1.2em}',
    '.lista-artigos h2{margin:0 0 .2em}',
    '.lista-artigos time{color:var(--suave);font-size:15px;font-family:system-ui,sans-serif}',
    '.resumo{margin:.3em 0 0}',
    '.ultimos{margin-top:2.5em;padding-top:1em;border-top:1px solid var(--linha)}',
    '.vazio{color:var(--suave)}',
    '.rodape{padding-top:16px;padding-bottom:32px;border-top:1px solid var(--linha);color:var(--suave);font-size:14px;font-family:system-ui,sans-serif}',
    '.apoie h2{font-size:16px;margin:0 0 .3em}',
    '.credito{margin:1em 0 0}',
    ''
  ].join('\n');

  return Object.freeze({ manifesto, templates: Object.freeze({ layout, pagina, artigo, blog, alias }), css });
})();
