/* tema/livro/tema.js — LIVRO: a página de um livro impresso (12; TEMAS.md).
   Margens largas, texto justificado, capitular na primeira letra e o blog
   desenhado como um ÍNDICE — título, pontilhado, página. Feito para quem
   escreve textos longos e quer que se leiam de uma sentada.

   Troca quatro dos oito moldes base (`pagina`, `artigo`, `blog`, `etiqueta`):
   o corpo do texto ganha um `<div class="corpo">` à volta, porque a capitular
   precisa de saber qual é o PRIMEIRO parágrafo do texto do dono e não o
   parágrafo da data; e a listagem passa a ter título, pontilhado e data na
   mesma linha, que é o que faz um índice parecer um índice.
   O pontilhado é uma borda, não uma imagem (02 G.2.4). */
const TemaLivro = (function () {
  'use strict';

  const options = Object.freeze({
    papel: Object.freeze({ tipo: 'escolha', rotulo: 'Papel', padrao: 'creme',
      opcoes: Object.freeze([['branco', 'Branco'], ['creme', 'Creme'], ['marfim', 'Marfim']]) }),
    cor_tinta: Object.freeze({ tipo: 'cor', rotulo: 'Cor dos títulos e links', padrao: '#7a2d1e' }),
    alinhamento: Object.freeze({ tipo: 'escolha', rotulo: 'Alinhamento do texto', padrao: 'justificado',
      opcoes: Object.freeze([['esquerda', 'Alinhado à esquerda'], ['justificado', 'Justificado']]),
      apoio: 'Justificado é o do livro impresso: as linhas terminam todas no mesmo lugar.' }),
    capitular: Object.freeze({ tipo: 'escolha', rotulo: 'Capitular', padrao: 'sim',
      opcoes: Object.freeze([['nao', 'Não'], ['sim', 'Sim']]),
      apoio: 'A letra grande com que começa o texto, como no primeiro parágrafo de um capítulo.' }),
    tamanho_texto: Object.freeze({ tipo: 'escolha', rotulo: 'Tamanho do texto', padrao: 'medio',
      opcoes: Object.freeze([['pequeno', 'Pequeno'], ['medio', 'Médio'], ['grande', 'Grande']]) }),
    largura: Object.freeze({ tipo: 'escolha', rotulo: 'Largura da mancha', padrao: 'media',
      opcoes: Object.freeze([['estreita', 'Estreita'], ['media', 'Média'], ['larga', 'Larga']]),
      apoio: 'A "mancha" é a área que o texto ocupa na folha.' }),
    altura_logo: Object.freeze({ tipo: 'medida', rotulo: 'Altura do logo', padrao: 36, min: 24, max: 96, passo: 2, unidade: 'px' })
  });

  const manifesto = Object.freeze({ id: 'livro', version: 1, nome: 'Livro', autor: 'Nostermentor', engine_min: 1, options: options });

  const pagina = [
    '<article class="pagina">',
    '<h1>{{titulo}}</h1>',
    '{{#capa}}<figure class="capa"><img src="{{src}}" alt="{{alt}}"{{#largura}} width="{{largura}}" height="{{altura}}"{{/largura}}>{{#legenda}}<figcaption>{{legenda}}</figcaption>{{/legenda}}</figure>',
    '{{/capa}}<div class="corpo">{{{corpo}}}</div>',
    '</article>',
    '{{#ultimos}}<section class="ultimos">',
    '<h2>{{blog_titulo}}</h2>',
    '<ul class="lista-artigos">{{#artigos}}<li><span class="indice"><a href="{{href}}">{{titulo}}</a><span class="pontilhado"></span><time datetime="{{data_iso}}">{{data}}</time></span></li>',
    '{{/artigos}}</ul>',
    '<p><a href="{{blog_href}}">Índice completo</a></p>',
    '</section>',
    '{{/ultimos}}',
    ''
  ].join('\n');

  const artigo = [
    '<article class="artigo">',
    '<h1>{{titulo}}</h1>',
    '<p class="meta"><time datetime="{{data_iso}}">{{data}}</time>{{#tem_tags}} · {{#tags}}{{#href}}<a class="etiqueta" href="{{href}}">{{nome}}</a>{{/href}}{{^href}}<span class="etiqueta">{{nome}}</span>{{/href}} {{/tags}}{{/tem_tags}}</p>',
    '{{#capa}}<figure class="capa"><a class="ampliar" href="{{src}}" target="_blank" rel="noopener"><img src="{{src}}" alt="{{alt}}"{{#largura}} width="{{largura}}" height="{{altura}}"{{/largura}}></a>{{#legenda}}<figcaption>{{legenda}}</figcaption>{{/legenda}}</figure>',
    '{{/capa}}<div class="corpo">{{{corpo}}}</div>',
    '</article>',
    ''
  ].join('\n');

  const lista = '<ul class="lista-artigos">{{#artigos}}<li><span class="indice"><a href="{{href}}">{{titulo}}</a><span class="pontilhado"></span><time datetime="{{data_iso}}">{{data}}</time></span>{{#resumo}}<p class="resumo">{{resumo}}</p>{{/resumo}}</li>\n{{/artigos}}</ul>';

  const blog = [
    '<section class="blog">',
    '<h1>{{blog_titulo}}</h1>',
    '{{^tem_artigos}}<p class="vazio">Nenhum capítulo ainda.</p>',
    '{{/tem_artigos}}' + lista,
    '</section>',
    ''
  ].join('\n');

  const etiqueta = [
    '<section class="blog etiqueta-pagina">',
    '<h1>Etiqueta: {{etiqueta}}</h1>',
    '{{^tem_artigos}}<p class="vazio">Nenhum texto com esta etiqueta.</p>',
    '{{/tem_artigos}}' + lista,
    '<p><a href="{{blog_href}}">{{blog_titulo}}</a></p>',
    '</section>',
    ''
  ].join('\n');

  const templates = Object.freeze(Object.assign({}, Temas.moldes, { pagina, artigo, blog, etiqueta }));
  function resolver(opcoes) { return Temas.resolver(options, opcoes); }

  const PAPEIS = {
    branco: { papel: '#ffffff', tinta: '#22201d', suave: '#6e6a64', linha: '#ddd8d0', bloco: '#f3f1ee' },
    creme:  { papel: '#f9f4e8', tinta: '#2a2418', suave: '#6f6653', linha: '#ded4be', bloco: '#efe8d8' },
    marfim: { papel: '#fdfaf3', tinta: '#241f18', suave: '#6d6659', linha: '#e2dbcc', bloco: '#f4efe3' }
  };
  const TAMANHOS = { pequeno: 16, medio: 18, grande: 20 };
  const LARGURAS = { estreita: 580, media: 660, larga: 800 };

  function css(opcoes) {
    const v = resolver(opcoes);
    const p = PAPEIS[v.papel];
    const C = Temas.cor;
    return [
      '/* Nostermentor — tema Livro v1. Letras do sistema, pontilhado feito de borda, nenhuma imagem. */',
      ':root{--papel:' + p.papel + ';--tinta:' + p.tinta + ';--suave:' + p.suave + ';--linha:' + p.linha + ';--bloco:' + p.bloco + ';' +
        '--acento:' + v.cor_tinta + ';--acento-legivel:' + C.acentoLegivel(v.cor_tinta, p.papel) + ';--acento-texto:' + C.textoSobre(C.paraRgb(v.cor_tinta)) + ';' +
        '--alinha:' + (v.alinhamento === 'justificado' ? 'justify' : 'left') + ';' +
        '--capitular:' + (v.capitular === 'sim' ? '3.1em' : '1em') + ';--capitular-flutua:' + (v.capitular === 'sim' ? 'left' : 'none') + ';' +
        '--base:' + TAMANHOS[v.tamanho_texto] + 'px;--largura:' + LARGURAS[v.largura] + 'px;--logo-altura:' + v.altura_logo + 'px}',
      '*{box-sizing:border-box}',
      'html{-webkit-text-size-adjust:100%}',
      'body{margin:0;background:var(--papel);color:var(--tinta);font-family:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;font-size:var(--base);line-height:1.7;overflow-wrap:anywhere}',
      'a{color:var(--acento-legivel)}',
      'img,video{max-width:100%;height:auto}',
      'code,pre{font-family:ui-monospace,Menlo,Consolas,"Liberation Mono",monospace;font-size:.9em}',
      'pre{overflow:auto;padding:14px;background:var(--bloco)}',
      'table{display:block;overflow-x:auto;overflow-wrap:normal;margin:0 0 1.6em}',
      'th,td{padding:5px 14px 5px 0;text-align:left;vertical-align:top;border-bottom:1px solid var(--linha)}',
      'blockquote{margin:1.6em 0 1.6em 1.6em;padding:0;border:0;font-style:italic;color:var(--suave)}',
      // A mancha: margens largas de livro. 32px em celular, 56 acima —
      // sem `@media`: o padding cresce com a letra, não com a tela.
      '.cabecalho{max-width:var(--largura);margin:0 auto;padding:34px 24px 12px;display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:6px 20px;border-bottom:1px solid var(--linha)}',
      '.marca{font-size:1.15em;letter-spacing:.16em;text-transform:uppercase;text-decoration:none;color:var(--tinta)}',
      '.marca-logo{line-height:0;letter-spacing:normal;align-self:center}',
      '.marca-logo img{max-height:var(--logo-altura);max-width:100%;width:auto;height:auto;display:block}',
      '.menu{display:flex;flex-wrap:wrap;gap:2px 18px}',
      '.menu a{display:inline-block;padding:3px 0;text-decoration:none;font-size:.94em;letter-spacing:.06em;font-variant:small-caps}',
      '.menu a[aria-current=page]{color:var(--tinta);font-weight:700}',
      '.principal{max-width:var(--largura);margin:0 auto;padding:40px 24px 56px}',
      'h1{font-size:1.85em;line-height:1.25;margin:0 0 .6em;font-weight:400;letter-spacing:.01em}',
      'h2{font-size:1.3em;line-height:1.3;margin:1.8em 0 .5em;font-weight:400;font-variant:small-caps;letter-spacing:.05em}',
      'h3{font-size:1.1em;margin:1.5em 0 .4em;font-style:italic;font-weight:400}',
      '.meta{color:var(--suave);font-size:.9em;margin:0 0 2em;font-variant:small-caps;letter-spacing:.07em}',
      '.etiqueta{display:inline-block;padding:2px 8px;font-size:1em;border:1px solid var(--linha);text-decoration:none;color:inherit;line-height:1.5}',
      // O corpo do texto: justificado e com capitular no primeiro parágrafo.
      // `hyphens:auto` evita os rios que o justificado abre em coluna estreita.
      '.corpo{text-align:var(--alinha);hyphens:auto}',
      '.corpo>p{margin:0 0 1.1em}',
      '.corpo>p+p{text-indent:1.4em}',
      '.corpo>p:first-of-type::first-letter{float:var(--capitular-flutua);font-size:var(--capitular);line-height:.86;padding:.05em .1em 0 0;color:var(--acento-legivel)}',
      '.corpo>p:first-of-type{text-indent:0}',
      // ⚠️ O justificado é para o TEXTO CORRIDO e mais nada. Os blocos que o
      // dono insere no meio do corpo — o botão e a galeria de artigos —
      // nascem dentro de `.corpo` e herdavam-no: visto na captura de
      // 2026-09-05, os títulos dos cartões saíam com as palavras esticadas.
      '.corpo .galeria,.corpo .cta,.corpo table{text-align:left}',
      '.cta{margin:1.8em 0;text-align:center}',
      '.botao{display:inline-block;padding:.5em 1.4em;border:1px solid var(--acento);background:var(--acento);color:var(--acento-texto);text-decoration:none;font-variant:small-caps;letter-spacing:.08em}',
      '.capa{margin:0 0 1.8em}',
      '.capa img{width:100%;height:auto;display:block}',
      '.capa figcaption{color:var(--suave);font-size:.88em;font-style:italic;padding-top:8px;text-align:center}',
      '.ampliar{display:inline-block;line-height:0;text-decoration:none;cursor:zoom-in}',
      '.galeria{margin:2em 0}',
      '.cartoes{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:24px}',
      '.cartao{margin:0}',
      '.cartao-capa{display:block;line-height:0;margin:0 0 .6em}',
      '.cartao-capa img{width:100%;height:auto;display:block}',
      '.cartao-titulo{font-size:1.02em;line-height:1.35;margin:0 0 .2em;font-weight:400}',
      '.cartao .meta{margin:0 0 .3em}',
      '.cartao .resumo{margin:0;font-size:.92em}',
      // O ÍNDICE: título, pontilhado que estica, data. `flex-wrap` deixa a
      // data cair para a linha seguinte em telas estreitas, em vez de espremer.
      '.lista-artigos{list-style:none;margin:0;padding:0}',
      '.lista-artigos li{margin:0 0 1.1em}',
      '.indice{display:flex;flex-wrap:wrap;align-items:baseline;gap:0 .6em}',
      '.indice a{text-decoration:none;display:inline-block;padding:3px 0}',
      '.indice .pontilhado{flex:1 1 2em;min-width:2em;align-self:center;border-bottom:1px dotted var(--linha)}',
      '.indice time{color:var(--suave);font-size:.9em;font-variant:small-caps;letter-spacing:.06em}',
      '.resumo{margin:.2em 0 0;color:var(--suave);font-size:.94em}',
      '.ultimos{margin-top:3em;padding-top:1.4em;border-top:1px solid var(--linha)}',
      '.ultimos h2{margin-top:0}',
      // ⚠️ `.cartao-titulo a` TEM de estar aqui: a listagem deste tema usa
      // `.indice a` (que já tem folga), mas a galeria do bloco `[[artigos:]]`
      // usa `.cartao-titulo a`, e sem isto ele ficava inline com 21 px de
      // altura — medido em 2026-09-05, contra os 24 da WCAG 2.2 (2.5.8).
      '.blog>p a,.ultimos p a,.cartao-titulo a,.lista-artigos a{display:inline-block;padding:3px 0}',
      '.vazio{color:var(--suave);font-style:italic}',
      '.rodape{max-width:var(--largura);margin:0 auto;padding:18px 24px 44px;border-top:1px solid var(--linha);color:var(--suave);font-size:.88em}',
      '.apoie h2{font-size:1.05em;margin:0 0 .3em}',
      '.credito{margin:1em 0 0;font-style:italic}',
      ''
    ].join('\n');
  }

  return Object.freeze({ manifesto, templates, css, resolver });
})();
Temas.registar(TemaLivro);
