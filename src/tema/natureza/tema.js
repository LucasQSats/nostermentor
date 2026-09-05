/* tema/natureza/tema.js — NATUREZA: verdes, terras e cantos que não são
   cantos (12; TEMAS.md). O arredondamento é ASSIMÉTRICO — cada caixa tem os
   cantos opostos diferentes, o que dá a forma irregular de uma folha em vez
   da pastilha certinha dos cartões de aplicação. O cabeçalho abre num
   degradê de horizonte.

   Troca um molde base (`pagina`): a capa da página é DESENHADA aqui. O tema
   Padrão recebe-a e não a mostra, de propósito, à espera de um tema que a
   queira (TEMAS.md §4) — este é um deles.
   Nenhum recurso externo (02 G.2.4); letras do sistema; só aritmética
   inteira na cor (TEMAS.md §9). */
const TemaNatureza = (function () {
  'use strict';

  const options = Object.freeze({
    paleta: Object.freeze({ tipo: 'escolha', rotulo: 'Paleta', padrao: 'folha',
      opcoes: Object.freeze([['terra', 'Terra'], ['musgo', 'Musgo'], ['folha', 'Folha']]) }),
    cor_destaque: Object.freeze({ tipo: 'cor', rotulo: 'Cor de destaque', padrao: '#2f6b3f',
      apoio: 'Links, botões e o degradê do cabeçalho. Se ficar perto demais do fundo, o site escurece só o texto.' }),
    cantos: Object.freeze({ tipo: 'medida', rotulo: 'Arredondamento', padrao: 18, min: 0, max: 40, passo: 2, unidade: 'px',
      apoio: 'Os cantos opostos de cada caixa recebem medidas diferentes — é isso que lhes dá a forma orgânica.' }),
    horizonte: Object.freeze({ tipo: 'escolha', rotulo: 'Degradê no cabeçalho', padrao: 'sim',
      opcoes: Object.freeze([['nao', 'Não'], ['sim', 'Sim']]) }),
    tamanho_texto: Object.freeze({ tipo: 'escolha', rotulo: 'Tamanho do texto', padrao: 'medio',
      opcoes: Object.freeze([['pequeno', 'Pequeno'], ['medio', 'Médio'], ['grande', 'Grande']]) }),
    largura: Object.freeze({ tipo: 'escolha', rotulo: 'Largura da página', padrao: 'media',
      opcoes: Object.freeze([['estreita', 'Estreita'], ['media', 'Média'], ['larga', 'Larga']]) }),
    altura_logo: Object.freeze({ tipo: 'medida', rotulo: 'Altura do logo', padrao: 44, min: 24, max: 96, passo: 2, unidade: 'px' })
  });

  const manifesto = Object.freeze({ id: 'natureza', version: 1, nome: 'Natureza', autor: 'Nostermentor', engine_min: 1, options: options });

  const pagina = [
    '<article class="pagina">',
    '{{#capa}}<figure class="capa"><img src="{{src}}" alt="{{alt}}"{{#largura}} width="{{largura}}" height="{{altura}}"{{/largura}}>{{#legenda}}<figcaption>{{legenda}}</figcaption>{{/legenda}}</figure>',
    '{{/capa}}<h1>{{titulo}}</h1>',
    '{{{corpo}}}',
    '</article>',
    '{{#ultimos}}<section class="ultimos">',
    '<h2>{{blog_titulo}}</h2>',
    '<ul class="lista-artigos">{{#artigos}}<li><a href="{{href}}">{{titulo}}</a> <time datetime="{{data_iso}}">{{data}}</time></li>',
    '{{/artigos}}</ul>',
    '<p><a href="{{blog_href}}">Ver tudo</a></p>',
    '</section>',
    '{{/ultimos}}',
    ''
  ].join('\n');

  const templates = Object.freeze(Object.assign({}, Temas.moldes, { pagina }));
  function resolver(opcoes) { return Temas.resolver(options, opcoes); }

  const PALETAS = {
    folha: { fundo: '#f6f8f2', tinta: '#1f2a1e', suave: '#5d6b58', linha: '#dbe3d3', bloco: '#eaf0e2', caixa: '#ffffff', ceu: '#dfeccf' },
    musgo: { fundo: '#f2f5f0', tinta: '#1c2620', suave: '#586359', linha: '#d5ded6', bloco: '#e5ece5', caixa: '#fbfdfa', ceu: '#d3e5d8' },
    terra: { fundo: '#faf5ee', tinta: '#2b2318', suave: '#6e6151', linha: '#e3d8c6', bloco: '#f0e7d8', caixa: '#fffdf9', ceu: '#f0dfc4' }
  };
  const TAMANHOS = { pequeno: 16, medio: 17, grande: 19 };
  const LARGURAS = { estreita: 620, media: 700, larga: 860 };
  const SANS = '"Segoe UI",system-ui,-apple-system,Roboto,Ubuntu,"Noto Sans",sans-serif';

  function css(opcoes) {
    const v = resolver(opcoes);
    const p = PALETAS[v.paleta];
    const C = Temas.cor;
    const legivel = C.acentoLegivel(v.cor_destaque, p.fundo);
    const topo = v.horizonte === 'sim' ? 'linear-gradient(to bottom,' + p.ceu + ',' + p.fundo + ')' : 'none';
    // Cantos opostos diferentes: é o que tira a forma de pastilha.
    const folha = 'var(--canto) calc(var(--canto) * 2) var(--canto) calc(var(--canto) * 2)';
    return [
      '/* Nostermentor — tema Natureza v1. Degradês de CSS, letras do sistema, nada vindo de outro servidor. */',
      ':root{--fundo:' + p.fundo + ';--tinta:' + p.tinta + ';--suave:' + p.suave + ';--linha:' + p.linha + ';--bloco:' + p.bloco + ';--caixa:' + p.caixa + ';' +
        '--acento:' + v.cor_destaque + ';--acento-legivel:' + legivel + ';--acento-texto:' + C.textoSobre(C.paraRgb(v.cor_destaque)) + ';' +
        '--canto:' + v.cantos + 'px;--sans:' + SANS + ';' +
        '--base:' + TAMANHOS[v.tamanho_texto] + 'px;--largura:' + LARGURAS[v.largura] + 'px;--logo-altura:' + v.altura_logo + 'px}',
      '*{box-sizing:border-box}',
      'html{-webkit-text-size-adjust:100%}',
      'body{margin:0;background-color:var(--fundo);background-image:' + topo + ';background-repeat:no-repeat;background-size:100% 320px;color:var(--tinta);font-family:var(--sans);font-size:var(--base);line-height:1.72;overflow-wrap:anywhere}',
      'a{color:var(--acento-legivel);text-underline-offset:3px}',
      'img,video{max-width:100%;height:auto}',
      'code,pre{font-family:ui-monospace,Menlo,Consolas,"Liberation Mono",monospace;font-size:.9em}',
      'code{background:var(--bloco);padding:1px 5px;border-radius:4px}',
      'pre{overflow:auto;padding:16px;background:var(--bloco);border-radius:' + folha + '}',
      'pre code{background:none;padding:0}',
      'table{display:block;overflow-x:auto;overflow-wrap:normal;margin:0 0 1.6em}',
      'th,td{padding:8px 16px 8px 0;text-align:left;vertical-align:top;border-bottom:1px solid var(--linha)}',
      'blockquote{margin:1.6em 0;padding:.7em 1.2em;border:0;border-left:4px solid var(--acento-legivel);background:var(--bloco);border-radius:0 var(--canto) var(--canto) 0;color:var(--suave)}',
      '.cabecalho{max-width:var(--largura);margin:0 auto;padding:30px 22px 18px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px 22px}',
      '.marca{font-size:1.42em;line-height:1.2;font-weight:700;letter-spacing:-.015em;text-decoration:none;color:var(--acento-legivel)}',
      '.marca-logo{line-height:0}',
      '.marca-logo img{max-height:var(--logo-altura);max-width:100%;width:auto;height:auto;display:block}',
      '.menu{display:flex;flex-wrap:wrap;gap:6px 8px}',
      '.menu a{display:inline-block;padding:4px 13px;border-radius:999px;text-decoration:none;font-size:.9em;line-height:1.6;color:var(--suave)}',
      '.menu a[aria-current=page]{background:var(--caixa);color:var(--tinta);font-weight:600}',
      '.principal{max-width:var(--largura);margin:0 auto;padding:22px 22px 52px}',
      'h1{font-size:1.95em;line-height:1.18;margin:0 0 .45em;font-weight:700;letter-spacing:-.022em}',
      'h2{font-size:1.34em;line-height:1.28;margin:1.8em 0 .45em;font-weight:700}',
      'h3{font-size:1.12em;margin:1.5em 0 .35em;font-weight:600}',
      '.meta{color:var(--suave);font-size:.9em;margin:0 0 1.7em}',
      '.etiqueta{display:inline-block;padding:2px 12px;border-radius:999px;background:var(--bloco);font-size:1em;text-decoration:none;color:inherit;line-height:1.6}',
      'a.etiqueta:hover{background:var(--acento);color:var(--acento-texto)}',
      '.cta{margin:1.8em 0}',
      '.botao{display:inline-block;padding:.62em 1.6em;border-radius:999px;background:var(--acento);color:var(--acento-texto);text-decoration:none;font-weight:700}',
      '.capa{margin:0 0 1.8em}',
      '.capa img{width:100%;height:auto;display:block;border-radius:' + folha + '}',
      '.capa figcaption{color:var(--suave);font-size:.88em;padding:8px 4px 0}',
      '.ampliar{display:block;line-height:0;text-decoration:none;cursor:zoom-in}',
      '.galeria{margin:2.2em 0}',
      '.cartoes{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:22px}',
      '.cartao{margin:0;background:var(--caixa);border-radius:' + folha + ';padding:14px}',
      '.cartao-capa{display:block;line-height:0;margin:0 0 .6em;border-radius:' + folha + ';overflow:hidden}',
      '.cartao-capa img{width:100%;height:auto;display:block}',
      '.cartao-titulo{font-size:1.05em;line-height:1.3;margin:0 0 .2em;font-weight:700}',
      '.cartao-titulo a{text-decoration:none;color:var(--tinta)}',
      '.cartao .meta{margin:0 0 .3em}',
      '.cartao .resumo{margin:0;font-size:.93em;color:var(--suave)}',
      '.lista-artigos{list-style:none;margin:0;padding:0}',
      '.lista-artigos li{margin:0 0 14px;padding:16px 18px;background:var(--caixa);border-radius:' + folha + '}',
      '.lista-artigos h2{margin:0 0 .15em;font-size:1.2em}',
      '.lista-artigos h2 a{text-decoration:none;color:var(--tinta)}',
      '.lista-artigos time{color:var(--suave);font-size:.9em}',
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
      '.resumo{margin:.3em 0 0;color:var(--suave)}',
      '.ultimos{margin-top:2.6em;padding-top:1.4em;border-top:2px solid var(--linha)}',
      '.ultimos h2{margin-top:0}',
      '.vazio{color:var(--suave)}',
      '.rodape{max-width:var(--largura);margin:0 auto;padding:18px 22px 48px;border-top:2px solid var(--linha);color:var(--suave);font-size:.89em}',
      '.apoie h2{font-size:1.05em;margin:0 0 .3em;color:var(--tinta)}',
      '.credito{margin:1.2em 0 0}',
      ''
    ].join('\n');
  }

  return Object.freeze({ manifesto, templates, css, resolver });
})();
Temas.registar(TemaNatureza);
