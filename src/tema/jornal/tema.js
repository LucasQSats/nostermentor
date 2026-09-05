/* tema/jornal/tema.js — JORNAL: o site como uma página de jornal (12;
   TEMAS.md). Cabeçalho de banca com o título do site entre filetes, o menu
   como barra de seções, o corpo do artigo em colunas que se dobram sozinhas
   com a largura da tela (`column-width`: em celular é uma, no monitor são
   duas ou três — sem `@media`), capitular no primeiro parágrafo, listagem em
   primeira página. Pacote de DADOS: manifesto, oito moldes e `css(opcoes)`
   pura. Zero recursos externos; famílias de letra do sistema; inteiros. */
const TemaJornal = (function () {
  'use strict';

  const options = Object.freeze({
    papel: Object.freeze({ tipo: 'escolha', rotulo: 'Papel', padrao: 'jornal',
      opcoes: Object.freeze([['branco', 'Branco'], ['jornal', 'Papel de jornal']]) }),
    cor_destaque: Object.freeze({ tipo: 'cor', rotulo: 'Cor de destaque', padrao: '#8b1a1a',
      apoio: 'Links, filetes de seção e o botão.' }),
    colunas: Object.freeze({ tipo: 'escolha', rotulo: 'Colunas no texto', padrao: 'automaticas',
      opcoes: Object.freeze([['uma', 'Uma só'], ['automaticas', 'Quantas couberem'], ['estreitas', 'Estreitas, quantas couberem']]),
      apoio: 'Em celular é sempre uma coluna; em tela larga o texto se divide como num jornal.' }),
    capitular: Object.freeze({ tipo: 'escolha', rotulo: 'Letra capitular', padrao: 'sim',
      opcoes: Object.freeze([['sim', 'Sim'], ['nao', 'Não']]),
      apoio: 'A primeira letra do artigo, grande, ocupando três linhas.' }),
    tamanho_texto: Object.freeze({ tipo: 'escolha', rotulo: 'Tamanho do texto', padrao: 'medio',
      opcoes: Object.freeze([['pequeno', 'Pequeno'], ['medio', 'Médio'], ['grande', 'Grande']]) }),
    largura: Object.freeze({ tipo: 'escolha', rotulo: 'Largura da página', padrao: 'larga',
      opcoes: Object.freeze([['media', 'Média'], ['larga', 'Larga'], ['total', 'Toda a tela']]) }),
    altura_logo: Object.freeze({ tipo: 'medida', rotulo: 'Altura do logo', padrao: 64, min: 32, max: 120, passo: 2, unidade: 'px',
      apoio: 'O logo ocupa o lugar do título no cabeçalho de banca.' })
  });
  const manifesto = Object.freeze({ id: 'jornal', version: 1, nome: 'Jornal', autor: 'Nostermentor', engine_min: 1, options: options });

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
    '<div class="banca">{{#logo}}<a class="marca marca-logo" href="/index.html"><img src="{{src}}" alt="{{alt}}"{{#largura}} width="{{largura}}" height="{{altura}}"{{/largura}}></a>',
    '{{/logo}}{{^logo}}<a class="marca" href="/index.html">{{site_titulo}}</a>',
    '{{/logo}}</div>',
    '<nav class="menu" aria-label="Menu">{{#menu}}<a href="{{href}}"{{#externo}} rel="external noopener noreferrer"{{/externo}}{{#atual}} aria-current="page"{{/atual}}>{{rotulo}}</a>{{/menu}}</nav>',
    '</header>',
    '<main class="principal">',
    '{{{conteudo}}}',
    '</main>',
    '<footer class="rodape">',
    '{{#doacoes}}<section class="apoie"><h2>Apoie este jornal</h2><p>Endereço Lightning: <code>{{lightning_address}}</code></p></section>',
    '{{/doacoes}}{{#credito}}<p class="credito">Publicado com Nostermentor</p>',
    '{{/credito}}</footer>',
    '</body>',
    '</html>',
    ''
  ].join('\n');

  // `.corpo` embrulha o texto: é nele que as colunas se aplicam. A capa da
  // página é desenhada (fotografia de abertura, com legenda).
  const pagina = [
    '<article class="pagina">',
    '<h1>{{titulo}}</h1>',
    '{{#capa}}<figure class="capa"><img src="{{src}}" alt="{{alt}}"{{#largura}} width="{{largura}}" height="{{altura}}"{{/largura}}>{{#legenda}}<figcaption>{{legenda}}</figcaption>{{/legenda}}</figure>',
    '{{/capa}}<div class="corpo">',
    '{{{corpo}}}',
    '</div>',
    '</article>',
    '{{#ultimos}}<section class="ultimos">',
    '<h2>{{blog_titulo}}</h2>',
    '<ul class="lista-artigos">{{#artigos}}<li><h3><a href="{{href}}">{{titulo}}</a></h3><p class="meta"><time datetime="{{data_iso}}">{{data}}</time></p></li>',
    '{{/artigos}}</ul>',
    '<p><a href="{{blog_href}}">Todas as notícias</a></p>',
    '</section>',
    '{{/ultimos}}',
    ''
  ].join('\n');

  const artigo = [
    '<article class="artigo">',
    '<h1>{{titulo}}</h1>',
    '<p class="meta"><time datetime="{{data_iso}}">{{data}}</time>{{#tem_tags}} · {{#tags}}{{#href}}<a class="etiqueta" href="{{href}}">{{nome}}</a>{{/href}}{{^href}}<span class="etiqueta">{{nome}}</span>{{/href}} {{/tags}}{{/tem_tags}}</p>',
    '{{#capa}}<figure class="capa"><a class="ampliar" href="{{src}}" target="_blank" rel="noopener"><img src="{{src}}" alt="{{alt}}"{{#largura}} width="{{largura}}" height="{{altura}}"{{/largura}}></a>{{#legenda}}<figcaption>{{legenda}}</figcaption>{{/legenda}}</figure>',
    '{{/capa}}<div class="corpo capitular">',
    '{{{corpo}}}',
    '</div>',
    '</article>',
    ''
  ].join('\n');

  // primeira página: a mais recente em destaque, as outras em grade
  const blog = [
    '<section class="blog">',
    '<h1>{{blog_titulo}}</h1>',
    '{{^tem_artigos}}<p class="vazio">Nenhuma notícia ainda.</p>',
    '{{/tem_artigos}}<ul class="lista-artigos">{{#artigos}}<li><h2><a href="{{href}}">{{titulo}}</a></h2><p class="meta"><time datetime="{{data_iso}}">{{data}}</time></p>{{#resumo}}<p class="resumo">{{resumo}}</p>{{/resumo}}</li>',
    '{{/artigos}}</ul>',
    '</section>',
    ''
  ].join('\n');

  const etiqueta = [
    '<section class="blog etiqueta-pagina">',
    '<h1>Seção: {{etiqueta}}</h1>',
    '{{^tem_artigos}}<p class="vazio">Nenhuma notícia nesta seção.</p>',
    '{{/tem_artigos}}<ul class="lista-artigos">{{#artigos}}<li><h2><a href="{{href}}">{{titulo}}</a></h2><p class="meta"><time datetime="{{data_iso}}">{{data}}</time></p>{{#resumo}}<p class="resumo">{{resumo}}</p>{{/resumo}}</li>',
    '{{/artigos}}</ul>',
    '<p><a href="{{blog_href}}">{{blog_titulo}}</a></p>',
    '</section>',
    ''
  ].join('\n');

  const botao = [
    '<p class="cta"><a class="botao" href="{{href}}"{{#externo}} rel="external noopener noreferrer"{{/externo}}>{{texto}}</a></p>',
    ''
  ].join('\n');

  const galeria = [
    '<section class="galeria">',
    '{{^tem_artigos}}<p class="vazio">Nenhuma notícia ainda.</p>',
    '{{/tem_artigos}}<ul class="cartoes">{{#artigos}}<li class="cartao">{{#capa}}<a class="cartao-capa" href="{{href}}"><img src="{{src}}" alt="{{alt}}"{{#largura}} width="{{largura}}" height="{{altura}}"{{/largura}} loading="lazy"></a>',
    '{{/capa}}<h3 class="cartao-titulo"><a href="{{href}}">{{titulo}}</a></h3><p class="meta"><time datetime="{{data_iso}}">{{data}}</time></p>{{#resumo}}<p class="resumo">{{resumo}}</p>{{/resumo}}</li>',
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

  const PAPEIS = {
    branco: { fundo: '#ffffff', tinta: '#111111', suave: '#555555', linha: '#111111', bloco: '#f2f2f2' },
    jornal: { fundo: '#f3efe6', tinta: '#1a1a1a', suave: '#5a554b', linha: '#1a1a1a', bloco: '#e9e3d6' }
  };
  const TAMANHOS = { pequeno: 16, medio: 17, grande: 19 };
  const LARGURAS = { media: 900, larga: 1100, total: 1600 };
  // largura de coluna: 22em ≈ 50 caracteres em serifa 17 px; 'uma' desliga
  const COLUNAS = { uma: 'none', automaticas: '22em', estreitas: '17em' };

  function css(opcoes) {
    const v = resolver(opcoes);
    const p = PAPEIS[v.papel];
    const fundo = paraRgb(p.fundo), acento = paraRgb(v.cor_destaque);
    const serifa = '"Times New Roman",Times,Georgia,serif';
    return [
      '/* Nostermentor — tema Jornal v1. Sem fontes remotas, sem imagens externas. */',
      ':root{--fundo:' + p.fundo + ';--tinta:' + p.tinta + ';--suave:' + p.suave + ';--linha:' + p.linha + ';--bloco:' + p.bloco + ';' +
        '--acento:' + v.cor_destaque + ';--acento-legivel:' + paraHex(legivelSobre(acento, fundo)) + ';--acento-texto:' + (brilho(acento) >= 128 ? '#111111' : '#ffffff') + ';' +
        '--base:' + TAMANHOS[v.tamanho_texto] + 'px;--largura:' + LARGURAS[v.largura] + 'px;--logo-altura:' + v.altura_logo + 'px;--coluna:' + COLUNAS[v.colunas] + '}',
      '*{box-sizing:border-box}',
      'html{-webkit-text-size-adjust:100%}',
      'body{margin:0;background:var(--fundo);color:var(--tinta);font-family:' + serifa + ';font-size:var(--base);line-height:1.5;overflow-wrap:anywhere}',
      'a{color:var(--acento-legivel)}',
      'img,video{max-width:100%;height:auto}',
      'code,pre{font-family:ui-monospace,Menlo,Consolas,"Liberation Mono",monospace;font-size:.9em}',
      'pre{overflow:auto;padding:10px;background:var(--bloco);border-top:1px solid var(--linha);border-bottom:1px solid var(--linha)}',
      'blockquote{margin:1em 0;padding:.2em 1em;border-left:3px solid var(--acento);font-style:italic;font-size:1.05em}',
      'table{display:block;overflow-x:auto;overflow-wrap:normal;border-top:2px solid var(--linha);border-bottom:2px solid var(--linha);margin:1em 0}',
      'th,td{padding:4px 12px 4px 0;text-align:left;vertical-align:top;border-bottom:1px solid var(--bloco)}',
      // --- o cabeçalho de banca --------------------------------------------
      '.cabecalho{max-width:var(--largura);margin:0 auto;padding:20px 20px 0}',
      '.banca{text-align:center;border-top:4px double var(--linha);border-bottom:1px solid var(--linha);padding:14px 0 10px}',
      '.marca{font-size:2.6em;line-height:1.1;font-weight:700;letter-spacing:.02em;text-transform:uppercase;text-decoration:none;color:var(--tinta)}',
      '.marca-logo{display:inline-block;line-height:0}',
      '.marca-logo img{max-height:var(--logo-altura);max-width:100%;width:auto;height:auto;display:inline-block}',
      '.menu{display:flex;flex-wrap:wrap;justify-content:center;gap:0;border-bottom:3px double var(--linha);padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:.8em;text-transform:uppercase;letter-spacing:.08em}',
      '.menu a{display:inline-block;padding:4px 12px;text-decoration:none;color:var(--tinta);border-left:1px solid var(--linha);line-height:1.6}',
      '.menu a:first-child{border-left:0}',
      '.menu a[aria-current=page]{font-weight:700;color:var(--acento-legivel)}',
      // --- o miolo -------------------------------------------------------------
      '.principal{max-width:var(--largura);margin:0 auto;padding:20px 20px 40px}',
      'h1,h2,h3{font-family:' + serifa + ';font-weight:700;line-height:1.15}',
      'h1{font-size:2.4em;margin:0 0 .3em}',
      'h2{font-size:1.5em;margin:1.2em 0 .4em}',
      'h3{font-size:1.15em;margin:1.2em 0 .4em}',
      '.meta{font-family:Arial,Helvetica,sans-serif;font-size:.8em;text-transform:uppercase;letter-spacing:.06em;color:var(--suave);border-top:1px solid var(--linha);border-bottom:1px solid var(--linha);padding:4px 0;margin:0 0 1em}',
      // as etiquetas em versaletes corriam juntas ("PÃO RECEITAS …"): folga e filete
      '.etiqueta{text-decoration:none;color:inherit;display:inline-block;padding:2px 0;margin-right:.7em;line-height:20px;border-bottom:1px dotted var(--suave)}',
      'a.etiqueta:hover{border-bottom-color:var(--acento-legivel);color:var(--acento-legivel)}',
      // as colunas: `column-width` dobra sozinha — uma em celular, mais em tela larga
      '.corpo{column-width:var(--coluna);column-gap:2em;column-rule:1px solid var(--bloco);text-align:justify;hyphens:auto}',
      '.corpo>*{break-inside:avoid}',
      '.corpo>p{margin:0 0 1em}',
      '.corpo>h2,.corpo>h3{break-after:avoid}',
      '.corpo img{display:block}',
      v.capitular === 'sim' ? '.capitular>p:first-of-type::first-letter{float:left;font-size:3.2em;line-height:.85;padding:.05em .1em 0 0;font-weight:700;color:var(--acento-legivel)}' : '/* sem capitular */',
      '.capa{margin:0 0 1em}',
      '.capa img{display:block;width:100%;height:auto}',
      '.capa figcaption{font-family:Arial,Helvetica,sans-serif;font-size:.78em;color:var(--suave);padding-top:4px;border-bottom:1px solid var(--bloco)}',
      '.ampliar{display:block;line-height:0;text-decoration:none;cursor:zoom-in}',
      '.botao{display:inline-block;padding:.5em 1.2em;background:var(--acento);color:var(--acento-texto);text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:.06em;font-size:.85em}',
      '.cta{margin:1.2em 0}',
      // --- primeira página: grade com filetes ---------------------------------
      '.lista-artigos{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:0 28px}',
      '.lista-artigos li{margin:0;padding:12px 0 16px;border-bottom:1px solid var(--linha)}',
      '.lista-artigos li:first-child{grid-column:1/-1}',
      '.lista-artigos li:first-child h2{font-size:2em}',
      '.lista-artigos h2{margin:0 0 .3em;font-size:1.3em}',
      '.lista-artigos h3{margin:0 0 .2em}',
      '.lista-artigos .meta{border:0;padding:0;margin:0 0 .4em}',
      '.lista-artigos a,.ultimos p a,.blog>p a,.cartao-titulo a{display:inline-block;padding:2px 0;text-decoration:none;color:var(--tinta)}',
      '.lista-artigos a:hover,.cartao-titulo a:hover{color:var(--acento-legivel)}',
      '.resumo{margin:0;color:var(--suave)}',
      '.ultimos{margin-top:2em;border-top:3px double var(--linha);padding-top:.5em}',
      '.ultimos .lista-artigos li:first-child{grid-column:auto}',
      '.ultimos .lista-artigos li:first-child h2{font-size:1.3em}',
      '.vazio{color:var(--suave)}',
      '.galeria{margin:1.5em 0}',
      '.cartoes{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:20px}',
      '.cartao{margin:0;border-top:2px solid var(--linha);padding-top:8px}',
      '.cartao-capa{display:block;line-height:0;margin:0 0 .5em}',
      '.cartao-capa img{width:100%;height:auto;display:block}',
      '.cartao-titulo{font-size:1.1em;margin:0 0 .2em}',
      '.cartao .meta{border:0;padding:0;margin:0 0 .3em}',
      '.cartao .resumo{margin:0;font-size:.92em}',
      // --- rodapé ---------------------------------------------------------------
      '.rodape{max-width:var(--largura);margin:0 auto;padding:12px 20px 32px;border-top:3px double var(--linha);font-family:Arial,Helvetica,sans-serif;font-size:.8em;color:var(--suave)}',
      '.apoie h2{font-size:1.15em;margin:0 0 .3em}',
      '.credito{margin:1em 0 0}',
      ''
    ].join('\n');
  }

  return Object.freeze({ manifesto, templates: Object.freeze({ layout, pagina, artigo, blog, etiqueta, alias, botao, galeria }), css, resolver });
})();
Temas.registar(TemaJornal);
