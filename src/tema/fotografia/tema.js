/* tema/fotografia/tema.js — GALERIA: o tema para quem publica imagens
   (12; TEMAS.md). Quase sem enfeite: a fotografia ocupa a largura toda, o
   texto encolhe para não competir com ela e a grade de cartões tem uma
   medida que o dono controla — quantas imagens quer por linha.

   Troca dois moldes base (`pagina` e `artigo`): a capa sobe para CIMA do
   título e passa a ser a primeira coisa da página. O Padrão recebe a capa e
   não a desenha, à espera de um tema que a queira (TEMAS.md §4).

   ⚠️ Uma limitação honesta: a LISTAGEM do blog não pode mostrar miniaturas.
   O contexto que o molde `blog` recebe não traz capa nenhuma (TEMAS.md §4) —
   só o bloco `[[artigos: … com-capa]]`, escrito numa página, é que traz. Quem
   quiser uma frente de galeria põe esse bloco na página inicial.
   Nenhum recurso externo (02 G.2.4); letras do sistema. */
const TemaFotografia = (function () {
  'use strict';

  const options = Object.freeze({
    fundo: Object.freeze({ tipo: 'escolha', rotulo: 'Fundo', padrao: 'preto',
      opcoes: Object.freeze([['branco', 'Branco'], ['cinza', 'Cinza claro'], ['preto', 'Preto']]),
      apoio: 'O preto é o fundo de sala de exposição: faz a cor da imagem saltar.' }),
    cor_destaque: Object.freeze({ tipo: 'cor', rotulo: 'Cor de destaque', padrao: '#c8a15a',
      apoio: 'Links e botões. Se ficar perto demais do fundo, o site clareia só o texto.' }),
    coluna_minima: Object.freeze({ tipo: 'medida', rotulo: 'Largura mínima de cada imagem na grade', padrao: 200,
      min: 140, max: 340, passo: 10, unidade: 'px',
      apoio: 'Quanto menor, mais imagens cabem por linha. A grade se ajusta sozinha ao tamanho da tela.' }),
    moldura: Object.freeze({ tipo: 'escolha', rotulo: 'Moldura das imagens', padrao: 'nenhuma',
      opcoes: Object.freeze([['nenhuma', 'Nenhuma'], ['fina', 'Fina'], ['larga', 'Larga']]) }),
    tamanho_texto: Object.freeze({ tipo: 'escolha', rotulo: 'Tamanho do texto', padrao: 'medio',
      opcoes: Object.freeze([['pequeno', 'Pequeno'], ['medio', 'Médio'], ['grande', 'Grande']]) }),
    largura: Object.freeze({ tipo: 'escolha', rotulo: 'Largura da página', padrao: 'media',
      opcoes: Object.freeze([['estreita', 'Estreita'], ['media', 'Média'], ['larga', 'Larga']]) }),
    altura_logo: Object.freeze({ tipo: 'medida', rotulo: 'Altura do logo', padrao: 32, min: 20, max: 96, passo: 2, unidade: 'px' })
  });

  const manifesto = Object.freeze({ id: 'fotografia', version: 1, nome: 'Galeria', autor: 'Nostermentor', engine_min: 1, options: options });

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

  const artigo = [
    '<article class="artigo">',
    '{{#capa}}<figure class="capa"><a class="ampliar" href="{{src}}" target="_blank" rel="noopener"><img src="{{src}}" alt="{{alt}}"{{#largura}} width="{{largura}}" height="{{altura}}"{{/largura}}></a>{{#legenda}}<figcaption>{{legenda}}</figcaption>{{/legenda}}</figure>',
    '{{/capa}}<h1>{{titulo}}</h1>',
    '<p class="meta"><time datetime="{{data_iso}}">{{data}}</time>{{#tem_tags}} · {{#tags}}{{#href}}<a class="etiqueta" href="{{href}}">{{nome}}</a>{{/href}}{{^href}}<span class="etiqueta">{{nome}}</span>{{/href}} {{/tags}}{{/tem_tags}}</p>',
    '{{{corpo}}}',
    '</article>',
    ''
  ].join('\n');

  const templates = Object.freeze(Object.assign({}, Temas.moldes, { pagina, artigo }));
  function resolver(opcoes) { return Temas.resolver(options, opcoes); }

  const FUNDOS = {
    preto:  { fundo: '#0b0b0b', tinta: '#eceae6', suave: '#8f8b85', linha: '#232322', bloco: '#151514', moldura: '#2b2b2a' },
    cinza:  { fundo: '#ececeb', tinta: '#1a1a19', suave: '#63625f', linha: '#d5d5d3', bloco: '#e0e0de', moldura: '#ffffff' },
    branco: { fundo: '#ffffff', tinta: '#141413', suave: '#6a6966', linha: '#e6e6e4', bloco: '#f5f5f3', moldura: '#ffffff' }
  };
  const MOLDURAS = { nenhuma: '0', fina: '6px', larga: '14px' };
  const TAMANHOS = { pequeno: 15, medio: 16, grande: 18 };
  const LARGURAS = { estreita: 560, media: 640, larga: 820 };
  const SANS = 'system-ui,-apple-system,"Segoe UI",Roboto,Ubuntu,"Noto Sans",sans-serif';

  function css(opcoes) {
    const v = resolver(opcoes);
    const f = FUNDOS[v.fundo];
    const C = Temas.cor;
    return [
      '/* Nostermentor — tema Galeria v1. Letras do sistema, nenhuma imagem de enfeite, nada vindo de fora. */',
      ':root{--fundo:' + f.fundo + ';--tinta:' + f.tinta + ';--suave:' + f.suave + ';--linha:' + f.linha + ';--bloco:' + f.bloco + ';--moldura-cor:' + f.moldura + ';' +
        '--acento:' + v.cor_destaque + ';--acento-legivel:' + C.acentoLegivel(v.cor_destaque, f.fundo) + ';--acento-texto:' + C.textoSobre(C.paraRgb(v.cor_destaque)) + ';' +
        '--moldura:' + MOLDURAS[v.moldura] + ';--coluna:' + v.coluna_minima + 'px;--sans:' + SANS + ';' +
        '--base:' + TAMANHOS[v.tamanho_texto] + 'px;--largura:' + LARGURAS[v.largura] + 'px;--logo-altura:' + v.altura_logo + 'px}',
      '*{box-sizing:border-box}',
      'html{-webkit-text-size-adjust:100%}',
      'body{margin:0;background:var(--fundo);color:var(--tinta);font-family:var(--sans);font-size:var(--base);line-height:1.68;overflow-wrap:anywhere}',
      'a{color:var(--acento-legivel);text-underline-offset:3px}',
      'img,video{max-width:100%;height:auto}',
      'code,pre{font-family:ui-monospace,Menlo,Consolas,"Liberation Mono",monospace;font-size:.92em}',
      'pre{overflow:auto;padding:14px;background:var(--bloco)}',
      'table{display:block;overflow-x:auto;overflow-wrap:normal;margin:0 0 1.5em}',
      'th,td{padding:7px 16px 7px 0;text-align:left;vertical-align:top;border-bottom:1px solid var(--linha)}',
      'blockquote{margin:1.5em 0;padding:0 0 0 1.1em;border-left:2px solid var(--linha);color:var(--suave)}',
      // Cabeçalho baixo e discreto: numa galeria, o que tem de crescer é a
      // imagem, e o Tor Browser dá 500 a 600 px de altura (TEMAS.md §7.1).
      '.cabecalho{max-width:var(--largura);margin:0 auto;padding:20px 18px 12px;display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:8px 20px}',
      '.marca{font-size:1.05em;line-height:1.4;font-weight:600;letter-spacing:.14em;text-transform:uppercase;text-decoration:none;color:var(--tinta)}',
      '.marca-logo{line-height:0;letter-spacing:normal;align-self:center}',
      '.marca-logo img{max-height:var(--logo-altura);max-width:100%;width:auto;height:auto;display:block}',
      '.menu{display:flex;flex-wrap:wrap;gap:2px 16px}',
      '.menu a{display:inline-block;padding:3px 0;text-decoration:none;font-size:.84em;letter-spacing:.1em;text-transform:uppercase;color:var(--suave)}',
      '.menu a[aria-current=page]{color:var(--tinta)}',
      '.principal{max-width:var(--largura);margin:0 auto;padding:14px 18px 44px}',
      'h1{font-size:1.45em;line-height:1.3;margin:0 0 .3em;font-weight:600;letter-spacing:-.01em}',
      'h2{font-size:1.15em;line-height:1.35;margin:1.8em 0 .4em;font-weight:600}',
      'h3{font-size:1.02em;margin:1.5em 0 .3em;font-weight:600}',
      '.meta{color:var(--suave);font-size:.86em;letter-spacing:.06em;margin:0 0 1.6em}',
      '.etiqueta{display:inline-block;padding:2px 8px;border:1px solid var(--linha);font-size:1em;letter-spacing:.04em;text-decoration:none;color:inherit;line-height:1.6}',
      'a.etiqueta:hover{border-color:var(--acento-legivel);color:var(--acento-legivel)}',
      '.cta{margin:1.6em 0}',
      '.botao{display:inline-block;padding:.55em 1.5em;background:var(--acento);color:var(--acento-texto);text-decoration:none;font-weight:600;letter-spacing:.05em;font-size:.94em}',
      // A capa é a primeira coisa da página e ocupa a coluna toda.
      '.capa{margin:0 0 1.2em;background:var(--moldura-cor);padding:var(--moldura)}',
      '.capa img{width:100%;height:auto;display:block}',
      '.capa figcaption{color:var(--suave);font-size:.86em;padding-top:8px}',
      '.ampliar{display:block;line-height:0;text-decoration:none;cursor:zoom-in}',
      '.galeria{margin:1.8em 0}',
      // ⚠️ `min(var(--coluna),100%)` e não `var(--coluna)`: a largura mínima da
      // coluna é escolha do dono e vai até 340 px, que NÃO CABE numa tela de
      // 320 — a grade respeitava o mínimo e a página passava a rolar para o
      // lado (38 px de estouro, medido em 2026-09-05). O `min()` deixa a
      // coluna encolher até à largura disponível quando não há espaço.
      '.cartoes{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(var(--coluna),100%),1fr));gap:10px}',
      '.cartao{margin:0;background:var(--moldura-cor);padding:var(--moldura)}',
      '.cartao-capa{display:block;line-height:0;margin:0}',
      '.cartao-capa img{width:100%;height:auto;display:block}',
      '.cartao-titulo{font-size:.94em;line-height:1.35;margin:.5em 0 0;font-weight:600}',
      '.cartao-titulo a{text-decoration:none;color:var(--tinta)}',
      '.cartao .meta{margin:0;font-size:.84em;letter-spacing:.04em}',
      '.cartao .resumo{margin:.2em 0 0;font-size:.88em;color:var(--suave)}',
      '.lista-artigos{list-style:none;margin:0;padding:0}',
      '.lista-artigos li{margin:0 0 1em;padding-bottom:1em;border-bottom:1px solid var(--linha)}',
      '.lista-artigos li:last-child{border-bottom:0}',
      '.lista-artigos h2{margin:0 0 .1em;font-size:1.08em}',
      '.lista-artigos h2 a{text-decoration:none;color:var(--tinta)}',
      '.lista-artigos time{color:var(--suave);font-size:.86em;letter-spacing:.05em}',
      // ⚠️ `em` COMPÕE: na listagem o `<time>` vive dentro do `<p class="meta">`,
      // que já reduziu o tamanho — reduzir outra vez dava 11,8 px no tema
      // Galeria e 12,0 no Neon, abaixo do piso de 12 (TEMAS.md §7.2 R5),
      // medido em 2026-09-05. Na seção "últimos artigos" o `<time>` é filho
      // direto do `<li>` e a redução acima é a que se quer; daí o escopo.
      '.lista-artigos .meta time{font-size:1em}',
      '.lista-artigos a,.ultimos p a,.blog>p a,.cartao-titulo a{display:inline-block;padding:3px 0}',
      // A data dentro de uma listagem não é a data de um artigo aberto: ali
      // ela abre espaço antes do texto, aqui separa duas linhas do mesmo
      // item. Sem esta regra herda a margem grande de `.meta` e a lista fica
      // com um buraco entre a data e o resumo — visto na captura, 2026-09-05.
      '.lista-artigos .meta{margin:0 0 .35em}',
      '.resumo{margin:.2em 0 0;color:var(--suave);font-size:.94em}',
      '.ultimos{margin-top:2.2em;padding-top:1.2em;border-top:1px solid var(--linha)}',
      '.ultimos h2{margin-top:0}',
      '.vazio{color:var(--suave)}',
      '.rodape{max-width:var(--largura);margin:0 auto;padding:16px 18px 40px;border-top:1px solid var(--linha);color:var(--suave);font-size:.86em;letter-spacing:.04em}',
      '.apoie h2{font-size:1em;margin:0 0 .3em;color:var(--tinta);letter-spacing:.06em}',
      '.credito{margin:1.2em 0 0}',
      ''
    ].join('\n');
  }

  return Object.freeze({ manifesto, templates, css, resolver });
})();
Temas.registar(TemaFotografia);
