/* tema/diario/tema.js — DIÁRIO: o site como um caderno (12; TEMAS.md).
   Uma folha pautada com margem vermelha, o título do site numa etiqueta de
   capa, o menu em separadores, cada artigo é uma "entrada" com a data
   carimbada antes do título. Pacote de DADOS: manifesto, oito moldes
   Mustache logic-less e `css(opcoes)`, função pura das opções (TEMAS.md §9).
   As pautas e a margem são gradientes CSS — nenhum `url()`, nenhum recurso
   externo (02 G.2.4); as letras são famílias do sistema. Só aritmética
   inteira na cor. Sem uma única `@media`: a folha encolhe com a tela. */
const TemaDiario = (function () {
  'use strict';

  const options = Object.freeze({
    papel: Object.freeze({ tipo: 'escolha', rotulo: 'Papel', padrao: 'pautado',
      opcoes: Object.freeze([['pautado', 'Pautado (linhas)'], ['quadriculado', 'Quadriculado'], ['liso', 'Liso']]),
      apoio: 'As linhas são desenhadas pelo próprio site, sem imagem nenhuma.' }),
    tom: Object.freeze({ tipo: 'escolha', rotulo: 'Tom do papel', padrao: 'creme',
      opcoes: Object.freeze([['branco', 'Branco'], ['creme', 'Creme'], ['amarelo', 'Amarelo de bloco']]) }),
    cor_tinta: Object.freeze({ tipo: 'cor', rotulo: 'Cor da tinta', padrao: '#1f3a8a',
      apoio: 'A caneta: títulos, links e o carimbo da data. O texto corrido fica sempre em tinta escura, para continuar legível.' }),
    cor_capa: Object.freeze({ tipo: 'cor', rotulo: 'Cor da capa', padrao: '#5b3a29',
      apoio: 'O fundo ao redor da folha, e a etiqueta do cabeçalho.' }),
    tamanho_texto: Object.freeze({ tipo: 'escolha', rotulo: 'Tamanho do texto', padrao: 'medio',
      opcoes: Object.freeze([['pequeno', 'Pequeno'], ['medio', 'Médio'], ['grande', 'Grande']]) }),
    largura: Object.freeze({ tipo: 'escolha', rotulo: 'Largura da folha', padrao: 'media',
      opcoes: Object.freeze([['estreita', 'Estreita'], ['media', 'Média'], ['larga', 'Larga']]) }),
    altura_logo: Object.freeze({ tipo: 'medida', rotulo: 'Altura do logo', padrao: 40, min: 24, max: 96, passo: 2, unidade: 'px',
      apoio: 'O logo entra na etiqueta da capa, no lugar do título.' })
  });
  const manifesto = Object.freeze({ id: 'diario', version: 1, nome: 'Diário', autor: 'Nostermentor', engine_min: 1, options: options });

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
    '{{#logo}}<a class="marca marca-logo" href="/index.html"><img src="{{src}}" alt="{{alt}}"{{#largura}} width="{{largura}}" height="{{altura}}"{{/largura}}></a>',
    '{{/logo}}{{^logo}}<a class="marca" href="/index.html">{{site_titulo}}</a>',
    '{{/logo}}<nav class="menu" aria-label="Menu">{{#menu}}<a href="{{href}}"{{#externo}} rel="external noopener noreferrer"{{/externo}}{{#atual}} aria-current="page"{{/atual}}>{{rotulo}}</a>{{/menu}}</nav>',
    '</header>',
    '<main class="principal">',
    '{{{conteudo}}}',
    '</main>',
    '<footer class="rodape">',
    '{{#doacoes}}<section class="apoie"><h2>Apoie este diário</h2><p>Endereço Lightning: <code>{{lightning_address}}</code></p></section>',
    '{{/doacoes}}{{#credito}}<p class="credito">Publicado com Nostermentor</p>',
    '{{/credito}}</footer>',
    '</body>',
    '</html>',
    ''
  ].join('\n');

  // A capa da página é desenhada aqui (o Padrão não a desenha): uma
  // fotografia colada na folha, com moldura branca.
  const pagina = [
    '<article class="pagina">',
    '<h1>{{titulo}}</h1>',
    '{{#capa}}<figure class="capa colada"><img src="{{src}}" alt="{{alt}}"{{#largura}} width="{{largura}}" height="{{altura}}"{{/largura}}>{{#legenda}}<figcaption>{{legenda}}</figcaption>{{/legenda}}</figure>',
    '{{/capa}}{{{corpo}}}',
    '</article>',
    '{{#ultimos}}<section class="ultimos">',
    '<h2>Últimas entradas</h2>',
    '<ul class="lista-artigos">{{#artigos}}<li><time datetime="{{data_iso}}" class="carimbo">{{data}}</time> <a href="{{href}}">{{titulo}}</a></li>',
    '{{/artigos}}</ul>',
    '<p><a href="{{blog_href}}">{{blog_titulo}} — todas as entradas</a></p>',
    '</section>',
    '{{/ultimos}}',
    ''
  ].join('\n');

  // A entrada: a data carimbada ANTES do título, como num diário.
  const artigo = [
    '<article class="artigo">',
    '<p class="meta"><time datetime="{{data_iso}}" class="carimbo">{{data}}</time></p>',
    '<h1>{{titulo}}</h1>',
    '{{#capa}}<figure class="capa colada"><a class="ampliar" href="{{src}}" target="_blank" rel="noopener"><img src="{{src}}" alt="{{alt}}"{{#largura}} width="{{largura}}" height="{{altura}}"{{/largura}}></a>{{#legenda}}<figcaption>{{legenda}}</figcaption>{{/legenda}}</figure>',
    '{{/capa}}{{{corpo}}}',
    '{{#tem_tags}}<p class="meta etiquetas">{{#tags}}{{#href}}<a class="etiqueta" href="{{href}}">{{nome}}</a>{{/href}}{{^href}}<span class="etiqueta">{{nome}}</span>{{/href}} {{/tags}}</p>',
    '{{/tem_tags}}</article>',
    ''
  ].join('\n');

  const blog = [
    '<section class="blog">',
    '<h1>{{blog_titulo}}</h1>',
    '{{^tem_artigos}}<p class="vazio">Ainda não há entradas.</p>',
    '{{/tem_artigos}}<ul class="lista-artigos">{{#artigos}}<li><time datetime="{{data_iso}}" class="carimbo">{{data}}</time><h2><a href="{{href}}">{{titulo}}</a></h2>{{#resumo}}<p class="resumo">{{resumo}}</p>{{/resumo}}</li>',
    '{{/artigos}}</ul>',
    '</section>',
    ''
  ].join('\n');

  const etiqueta = [
    '<section class="blog etiqueta-pagina">',
    '<h1>Etiqueta: {{etiqueta}}</h1>',
    '{{^tem_artigos}}<p class="vazio">Nenhuma entrada com esta etiqueta.</p>',
    '{{/tem_artigos}}<ul class="lista-artigos">{{#artigos}}<li><time datetime="{{data_iso}}" class="carimbo">{{data}}</time><h2><a href="{{href}}">{{titulo}}</a></h2>{{#resumo}}<p class="resumo">{{resumo}}</p>{{/resumo}}</li>',
    '{{/artigos}}</ul>',
    '<p><a href="{{blog_href}}">{{blog_titulo}}</a></p>',
    '</section>',
    ''
  ].join('\n');

  const botao = [
    '<p class="cta"><a class="botao" href="{{href}}"{{#externo}} rel="external noopener noreferrer"{{/externo}}>{{texto}}</a></p>',
    ''
  ].join('\n');

  // As fotografias coladas: grade de "polaroids" com a data escrita por baixo.
  const galeria = [
    '<section class="galeria">',
    '{{^tem_artigos}}<p class="vazio">Ainda não há entradas.</p>',
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

  const TONS = {
    branco: { papel: '#ffffff', pauta: '#c9d6ea', tinta: '#1d2327', suave: '#5f6670' },
    creme: { papel: '#fbf6e9', pauta: '#cfd8e6', tinta: '#2b2417', suave: '#6b6151' },
    amarelo: { papel: '#fdf3b5', pauta: '#b9c4d8', tinta: '#2b2417', suave: '#6b6151' }
  };
  const TAMANHOS = { pequeno: 16, medio: 17, grande: 19 };
  const LARGURAS = { estreita: 620, media: 720, larga: 860 };
  // a pauta: uma linha a cada 28 px (a altura de linha do corpo)
  const PAUTAS = {
    pautado: 'repeating-linear-gradient(to bottom,transparent 0 27px,var(--pauta) 27px 28px)',
    quadriculado: 'repeating-linear-gradient(to bottom,transparent 0 27px,var(--pauta) 27px 28px),repeating-linear-gradient(to right,transparent 0 27px,var(--pauta) 27px 28px)',
    liso: 'none'
  };

  function css(opcoes) {
    const v = resolver(opcoes);
    const t = TONS[v.tom];
    const papel = paraRgb(t.papel), tinta = paraRgb(v.cor_tinta), capa = paraRgb(v.cor_capa);
    const margem = 'linear-gradient(to right,transparent 48px,#d9534f 48px,#d9534f 50px,transparent 50px)';
    const fundo = PAUTAS[v.papel] === 'none' ? margem : margem + ',' + PAUTAS[v.papel];
    return [
      '/* Nostermentor — tema Diário v1. Sem fontes remotas, sem imagens: as pautas são gradientes. */',
      ':root{--papel:' + t.papel + ';--pauta:' + t.pauta + ';--tinta:' + t.tinta + ';--suave:' + t.suave + ';' +
        '--caneta:' + paraHex(legivelSobre(tinta, papel)) + ';--caneta-cheia:' + v.cor_tinta + ';' +
        '--capa:' + v.cor_capa + ';--capa-texto:' + (brilho(capa) >= 128 ? '#111111' : '#ffffff') + ';' +
        '--base:' + TAMANHOS[v.tamanho_texto] + 'px;--largura:' + LARGURAS[v.largura] + 'px;--logo-altura:' + v.altura_logo + 'px}',
      '*{box-sizing:border-box}',
      'html{-webkit-text-size-adjust:100%}',
      'body{margin:0;background:var(--capa);color:var(--tinta);font-family:Georgia,"Times New Roman",serif;font-size:var(--base);line-height:28px;overflow-wrap:anywhere}',
      'a{color:var(--caneta)}',
      'img,video{max-width:100%;height:auto}',
      'code,pre{font-family:ui-monospace,Menlo,Consolas,"Liberation Mono",monospace;font-size:.92em}',
      'pre{overflow:auto;padding:12px;background:rgba(0,0,0,.05);border:1px dashed var(--pauta)}',
      'blockquote{margin:0 0 28px;padding:0 0 0 1em;border-left:3px solid var(--caneta);font-style:italic;color:var(--suave)}',
      'table{display:block;overflow-x:auto;overflow-wrap:normal;margin:0 0 28px}',
      'th,td{padding:0 12px 0 0;text-align:left;vertical-align:top}',
      // --- a capa do caderno: etiqueta + separadores ------------------------
      '.cabecalho{max-width:var(--largura);margin:0 auto;padding:28px 16px 0;display:flex;flex-wrap:wrap;align-items:flex-end;gap:12px 20px}',
      '.marca{display:inline-block;background:var(--papel);color:var(--tinta);padding:10px 22px;border:2px solid rgba(0,0,0,.25);border-radius:3px;font-size:1.35em;line-height:1.2;font-weight:700;text-decoration:none;box-shadow:2px 2px 0 rgba(0,0,0,.2)}',
      '.marca-logo{line-height:0;padding:8px 14px}',
      '.marca-logo img{max-height:var(--logo-altura);max-width:100%;width:auto;height:auto;display:block}',
      '.menu{display:flex;flex-wrap:wrap;gap:6px;margin-left:auto}',
      '.menu a{display:inline-block;background:rgba(255,255,255,.75);color:var(--tinta);text-decoration:none;padding:4px 12px;border-radius:6px 6px 0 0;border:1px solid rgba(0,0,0,.2);border-bottom:0;font-size:.92em;line-height:1.5}',
      '.menu a[aria-current=page]{background:var(--papel);font-weight:700}',
      // --- a folha ----------------------------------------------------------
      '.principal{max-width:var(--largura);margin:0 auto;padding:28px 20px 56px 60px;background-color:var(--papel);background-image:' + fundo + ';background-attachment:local;box-shadow:0 2px 12px rgba(0,0,0,.35)}',
      'h1,h2,h3{font-family:"Segoe Script","Bradley Hand","Noto Sans",cursive;color:var(--caneta);font-weight:700}',
      'h1{font-size:1.9em;line-height:1.2;margin:0 0 28px}',
      'h2{font-size:1.35em;line-height:28px;margin:28px 0 0}',
      'h3{font-size:1.1em;line-height:28px;margin:28px 0 0}',
      'p,ul,ol{margin:0 0 28px}',
      '.meta{color:var(--suave);font-size:.88em}',
      '.carimbo{display:inline-block;border:2px solid var(--caneta);color:var(--caneta);border-radius:4px;padding:0 8px;font-family:"Segoe Script","Bradley Hand","Noto Sans",cursive;font-size:.85em;line-height:24px;transform:rotate(-2deg);margin-right:8px}',
      '.etiqueta{display:inline-block;padding:0 8px;border:1px solid var(--caneta);border-radius:999px;font-size:.87em;line-height:24px;text-decoration:none;color:inherit}',
      'a.etiqueta:hover{background:var(--caneta);color:var(--papel)}',
      '.botao{display:inline-block;padding:.5em 1.2em;background:var(--caneta-cheia);color:var(--capa-texto);border-radius:4px;text-decoration:none;font-weight:700;box-shadow:2px 2px 0 rgba(0,0,0,.25)}',
      '.cta{margin:0 0 28px}',
      // fotografias coladas
      '.capa,.colada{margin:0 0 28px;display:inline-block;max-width:100%;background:#fff;padding:8px 8px 14px;box-shadow:1px 2px 6px rgba(0,0,0,.3)}',
      '.colada img{display:block;max-width:100%;height:auto}',
      '.capa figcaption{color:var(--suave);font-size:.82em;line-height:1.4;padding-top:6px;font-family:"Segoe Script","Bradley Hand","Noto Sans",cursive}',
      '.ampliar{display:inline-block;line-height:0;text-decoration:none;cursor:zoom-in}',
      '.galeria{margin:0 0 28px}',
      '.cartoes{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:20px}',
      '.cartao{margin:0;background:#fff;padding:8px 8px 12px;box-shadow:1px 2px 6px rgba(0,0,0,.3)}',
      '.cartao-capa{display:block;line-height:0;margin:0 0 8px}',
      '.cartao-capa img{width:100%;height:auto;display:block}',
      '.cartao-titulo{font-size:1.05em;line-height:1.3;margin:0 0 4px}',
      '.cartao .meta{margin:0 0 4px;line-height:1.4}',
      '.cartao .resumo{margin:0;font-size:.92em;line-height:1.4}',
      // listas de entradas
      '.lista-artigos{list-style:none;margin:0 0 28px;padding:0}',
      '.lista-artigos li{margin:0 0 28px}',
      '.lista-artigos h2{margin:0;line-height:28px}',
      '.lista-artigos a,.ultimos p a,.blog>p a,.cartao-titulo a{display:inline-block;padding:2px 0;line-height:24px}',
      '.resumo{margin:0}',
      '.ultimos{margin-top:28px;border-top:2px solid var(--caneta);padding-top:0}',
      '.vazio{color:var(--suave)}',
      // rodapé: fora da folha, sobre a capa
      '.rodape{max-width:var(--largura);margin:0 auto;padding:20px 16px 40px;color:var(--capa-texto);font-size:.85em;line-height:1.5;opacity:.85}',
      '.rodape a{color:inherit}',
      '.apoie h2{font-family:inherit;color:inherit;font-size:1.1em;line-height:1.4;margin:0 0 .3em}',
      '.credito{margin:1em 0 0}',
      ''
    ].join('\n');
  }

  return Object.freeze({ manifesto, templates: Object.freeze({ layout, pagina, artigo, blog, etiqueta, alias, botao, galeria }), css, resolver });
})();
Temas.registar(TemaDiario);
