/* tema/quadrinhos/tema.js — QUADRINHOS: retícula de pontos, contornos pretos
   grossos e o resumo de cada publicação dentro de um BALÃO DE FALA com bico
   (12; TEMAS.md). A retícula é um `radial-gradient` repetido e o bico do
   balão são dois triângulos feitos de bordas — nem um `url()`, nem uma
   imagem, nem uma letra buscada fora (02 G.2.4).

   Troca dois moldes base (`blog` e `etiqueta`): o resumo passa a vir sempre
   dentro de um `<span class="balao">`, porque um balão precisa de uma caixa
   própria para o bico se agarrar.
   A letra é `Comic Sans MS` onde existir, com uma cadeia de alternativas do
   sistema por baixo — em Linux, onde ela costuma faltar, cai numa arredondada
   do sistema em vez de partir. */
const TemaQuadrinhos = (function () {
  'use strict';

  const options = Object.freeze({
    papel: Object.freeze({ tipo: 'escolha', rotulo: 'Papel', padrao: 'creme',
      opcoes: Object.freeze([['branco', 'Branco'], ['ceu', 'Céu'], ['creme', 'Creme']]) }),
    cor_destaque: Object.freeze({ tipo: 'cor', rotulo: 'Cor de destaque', padrao: '#ffc300',
      apoio: 'A sombra dos títulos, os botões e o realce do menu.' }),
    pontos: Object.freeze({ tipo: 'escolha', rotulo: 'Retícula de pontos', padrao: 'media',
      opcoes: Object.freeze([['nenhuma', 'Nenhuma'], ['fina', 'Fina'], ['media', 'Média']]),
      apoio: 'Os pontinhos da impressão em quadrinhos. São desenhados pelo site, sem imagem.' }),
    balao: Object.freeze({ tipo: 'escolha', rotulo: 'Resumos em balão de fala', padrao: 'sim',
      opcoes: Object.freeze([['nao', 'Não'], ['sim', 'Sim']]) }),
    tamanho_texto: Object.freeze({ tipo: 'escolha', rotulo: 'Tamanho do texto', padrao: 'medio',
      opcoes: Object.freeze([['pequeno', 'Pequeno'], ['medio', 'Médio'], ['grande', 'Grande']]) }),
    largura: Object.freeze({ tipo: 'escolha', rotulo: 'Largura da página', padrao: 'media',
      opcoes: Object.freeze([['estreita', 'Estreita'], ['media', 'Média'], ['larga', 'Larga']]) }),
    altura_logo: Object.freeze({ tipo: 'medida', rotulo: 'Altura do logo', padrao: 44, min: 24, max: 96, passo: 2, unidade: 'px' })
  });

  const manifesto = Object.freeze({ id: 'quadrinhos', version: 1, nome: 'Quadrinhos', autor: 'Nostermentor', engine_min: 1, options: options });

  const lista = '<ul class="lista-artigos">{{#artigos}}<li><h2><a href="{{href}}">{{titulo}}</a></h2><p class="meta"><time datetime="{{data_iso}}">{{data}}</time></p>{{#resumo}}<p class="resumo"><span class="balao">{{resumo}}</span></p>{{/resumo}}</li>\n{{/artigos}}</ul>';

  const blog = [
    '<section class="blog">',
    '<h1>{{blog_titulo}}</h1>',
    '{{^tem_artigos}}<p class="vazio">Ainda não há nada por aqui.</p>',
    '{{/tem_artigos}}' + lista,
    '</section>',
    ''
  ].join('\n');

  const etiqueta = [
    '<section class="blog etiqueta-pagina">',
    '<h1>Etiqueta: {{etiqueta}}</h1>',
    '{{^tem_artigos}}<p class="vazio">Nada com esta etiqueta.</p>',
    '{{/tem_artigos}}' + lista,
    '<p><a href="{{blog_href}}">{{blog_titulo}}</a></p>',
    '</section>',
    ''
  ].join('\n');

  const templates = Object.freeze(Object.assign({}, Temas.moldes, { blog, etiqueta }));
  function resolver(opcoes) { return Temas.resolver(options, opcoes); }

  const PAPEIS = {
    branco: { fundo: '#ffffff', tinta: '#111111', suave: '#4d4d4d', caixa: '#ffffff', ponto: 'rgba(0,0,0,.10)' },
    creme:  { fundo: '#fdf4dc', tinta: '#14110b', suave: '#4f4735', caixa: '#fffdf6', ponto: 'rgba(180,110,0,.16)' },
    ceu:    { fundo: '#dcf0fb', tinta: '#0d1b25', suave: '#3d5261', caixa: '#f4fbff', ponto: 'rgba(0,90,150,.13)' }
  };
  const PONTOS = { nenhuma: 0, fina: 7, media: 10 };
  const TAMANHOS = { pequeno: 16, medio: 17, grande: 19 };
  const LARGURAS = { estreita: 620, media: 700, larga: 860 };
  const LETRA = '"Comic Sans MS","Chalkboard SE","Comic Neue",ui-rounded,"Segoe UI",system-ui,sans-serif';

  function css(opcoes) {
    const v = resolver(opcoes);
    const p = PAPEIS[v.papel];
    const C = Temas.cor;
    const passo = PONTOS[v.pontos];
    // A retícula: um ponto a cada `passo` px. Sem retícula, `background-image`
    // fica em `none` e não há regra a mais para escrever.
    const retic = passo
      ? { img: 'radial-gradient(' + p.ponto + ' 1.6px,transparent 1.7px)', tam: passo + 'px ' + passo + 'px' }
      : { img: 'none', tam: 'auto' };
    return [
      '/* Nostermentor — tema Quadrinhos v1. Retícula e balões são CSS; nenhuma imagem, nenhuma letra vinda de fora. */',
      ':root{--fundo:' + p.fundo + ';--tinta:' + p.tinta + ';--suave:' + p.suave + ';--caixa:' + p.caixa + ';' +
        '--acento:' + v.cor_destaque + ';--acento-legivel:' + C.acentoLegivel(v.cor_destaque, p.fundo) + ';--acento-texto:' + C.textoSobre(C.paraRgb(v.cor_destaque)) + ';' +
        '--bico:' + (v.balao === 'sim' ? 'block' : 'none') + ';--letra:' + LETRA + ';' +
        '--base:' + TAMANHOS[v.tamanho_texto] + 'px;--largura:' + LARGURAS[v.largura] + 'px;--logo-altura:' + v.altura_logo + 'px}',
      '*{box-sizing:border-box}',
      'html{-webkit-text-size-adjust:100%}',
      'body{margin:0;background-color:var(--fundo);background-image:' + retic.img + ';background-size:' + retic.tam + ';color:var(--tinta);font-family:var(--letra);font-size:var(--base);line-height:1.65;overflow-wrap:anywhere}',
      'a{color:var(--tinta);text-decoration-thickness:2px;text-underline-offset:3px}',
      'img,video{max-width:100%;height:auto}',
      'code,pre{font-family:ui-monospace,Menlo,Consolas,"Liberation Mono",monospace;font-size:.9em}',
      'pre{overflow:auto;padding:14px;background:var(--caixa);border:3px solid var(--tinta);border-radius:10px}',
      'table{display:block;overflow-x:auto;overflow-wrap:normal;margin:0 0 1.5em;border-collapse:collapse;background:var(--caixa)}',
      'th,td{padding:7px 14px;text-align:left;vertical-align:top;border:3px solid var(--tinta)}',
      'thead th{background:var(--acento);color:var(--acento-texto)}',
      'blockquote{margin:1.5em 0;padding:.8em 1.1em;background:var(--caixa);border:3px solid var(--tinta);border-radius:20px}',
      'blockquote p{margin:0}',
      '.cabecalho{max-width:var(--largura);margin:20px auto 0;padding:14px 18px;background:var(--acento);color:var(--acento-texto);border:4px solid var(--tinta);border-radius:14px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px 18px}',
      '.marca{font-size:1.6em;line-height:1.15;font-weight:700;text-transform:uppercase;letter-spacing:-.01em;text-decoration:none;color:var(--acento-texto)}',
      '.marca-logo{line-height:0}',
      '.marca-logo img{max-height:var(--logo-altura);max-width:100%;width:auto;height:auto;display:block}',
      '.menu{display:flex;flex-wrap:wrap;gap:8px}',
      '.menu a{display:inline-block;padding:3px 11px;background:var(--caixa);color:var(--tinta);border:3px solid var(--tinta);border-radius:999px;text-decoration:none;font-size:.86em;font-weight:700;line-height:1.6}',
      '.menu a[aria-current=page]{background:var(--tinta);color:var(--caixa)}',
      '.principal{max-width:var(--largura);margin:0 auto;padding:26px 18px 44px}',
      'h1{font-size:2em;line-height:1.12;margin:0 0 .4em;font-weight:700;text-transform:uppercase;letter-spacing:-.015em;text-shadow:3px 3px 0 var(--acento)}',
      'h2{font-size:1.34em;line-height:1.22;margin:1.6em 0 .4em;font-weight:700;text-transform:uppercase}',
      'h3{font-size:1.1em;margin:1.4em 0 .35em;font-weight:700}',
      '.meta{color:var(--suave);font-size:.88em;margin:0 0 1.4em;font-weight:700}',
      '.etiqueta{display:inline-block;padding:2px 10px;background:var(--caixa);border:3px solid var(--tinta);border-radius:999px;font-size:1em;font-weight:700;text-decoration:none;color:var(--tinta);line-height:1.5}',
      'a.etiqueta:hover{background:var(--acento);color:var(--acento-texto)}',
      '.cta{margin:1.6em 0}',
      '.botao{display:inline-block;padding:.5em 1.5em;background:var(--acento);color:var(--acento-texto);border:4px solid var(--tinta);border-radius:999px;text-decoration:none;font-weight:700;text-transform:uppercase;box-shadow:4px 4px 0 var(--tinta)}',
      '.capa{margin:0 0 1.5em;border:4px solid var(--tinta);border-radius:12px;overflow:hidden;background:var(--caixa)}',
      '.capa img{width:100%;height:auto;display:block}',
      '.capa figcaption{padding:8px 12px;font-size:.88em;font-weight:700;border-top:3px solid var(--tinta)}',
      '.ampliar{display:block;line-height:0;text-decoration:none;cursor:zoom-in}',
      '.galeria{margin:2em 0}',
      '.cartoes{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:20px}',
      '.cartao{margin:0;background:var(--caixa);border:4px solid var(--tinta);border-radius:12px;padding:12px}',
      '.cartao-capa{display:block;line-height:0;margin:0 0 .5em;border:3px solid var(--tinta);border-radius:8px;overflow:hidden}',
      '.cartao-capa img{width:100%;height:auto;display:block}',
      '.cartao-titulo{font-size:1.05em;line-height:1.25;margin:0 0 .2em;font-weight:700;text-transform:uppercase}',
      '.cartao-titulo a{text-decoration:none}',
      '.cartao .meta{margin:0 0 .3em}',
      '.cartao .resumo{margin:0;font-size:.92em}',
      '.lista-artigos{list-style:none;margin:0;padding:0}',
      '.lista-artigos li{margin:0 0 1.8em}',
      '.lista-artigos h2{margin:0 0 .1em;font-size:1.26em;text-shadow:2px 2px 0 var(--acento)}',
      '.lista-artigos h2 a{text-decoration:none}',
      '.lista-artigos time{color:var(--suave);font-size:.9em;font-weight:700}',
      // ⚠️ `em` COMPÕE: na listagem o `<time>` vive dentro do `<p class="meta">`,
      // que já reduziu o tamanho — reduzir outra vez dava 11,8 px no tema
      // Galeria e 12,0 no Neon, abaixo do piso de 12 (TEMAS.md §7.2 R5),
      // medido em 2026-09-05. Na secção "últimos artigos" o `<time>` é filho
      // direto do `<li>` e a redução acima é a que se quer; daí o escopo.
      '.lista-artigos .meta time{font-size:1em}',
      '.lista-artigos a,.ultimos p a,.blog>p a,.cartao-titulo a{display:inline-block;padding:3px 0}',
      // A data dentro de uma listagem não é a data de um artigo aberto: ali
      // ela abre espaço antes do texto, aqui separa duas linhas do mesmo
      // item. Sem esta regra herda a margem grande de `.meta` e a lista fica
      // com um buraco entre a data e o resumo — visto na captura, 2026-09-05.
      '.lista-artigos .meta{margin:0 0 .35em}',
      '.resumo{margin:.5em 0 0}',
      // --- O BALÃO DE FALA --------------------------------------------------
      // `inline-block` para a caixa se ajustar ao texto e nunca passar da
      // largura da coluna. O bico são dois triângulos de bordas, um preto
      // (o contorno) e um da cor da caixa por cima, deslocado 4 px.
      '.balao{display:inline-block;position:relative;max-width:100%;background:var(--caixa);border:3px solid var(--tinta);border-radius:18px;padding:9px 14px;margin-bottom:14px}',
      '.balao::before{content:"";display:var(--bico);position:absolute;left:26px;bottom:-17px;width:0;height:0;border:9px solid transparent;border-top:17px solid var(--tinta)}',
      '.balao::after{content:"";display:var(--bico);position:absolute;left:30px;bottom:-9px;width:0;height:0;border:5px solid transparent;border-top:11px solid var(--caixa)}',
      '.ultimos{margin-top:2.4em;padding-top:1.2em;border-top:4px solid var(--tinta)}',
      '.ultimos h2{margin-top:0}',
      '.vazio{font-weight:700}',
      '.rodape{max-width:var(--largura);margin:0 auto;padding:14px 18px 40px;border-top:4px solid var(--tinta);color:var(--suave);font-size:.88em;font-weight:700}',
      '.apoie h2{font-size:1.05em;margin:0 0 .3em;color:var(--tinta);text-shadow:none}',
      '.apoie code{font-weight:400}',
      '.credito{margin:1em 0 0}',
      ''
    ].join('\n');
  }

  return Object.freeze({ manifesto, templates, css, resolver });
})();
Temas.registar(TemaQuadrinhos);
