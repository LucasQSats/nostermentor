/* tema/panfleto/tema.js — PANFLETO: a folha fotocopiada que se passa de mão
   em mão (12; TEMAS.md). Alto contraste, título em maiúsculas pesadas, uma
   barra preta grossa em vez de filete, a data carimbada de esguelha na cor de
   alarme e a textura de fotocópia por baixo de tudo. É o tema para quem
   publica o que não o deixam publicar em outro lugar.

   ⚠️ O nome é "Panfleto" e não "Anti-censura" de propósito: `03` §1.2.1
   proíbe este projeto de prometer conteúdo "incensurável", porque a promessa
   é falsa onde importa — o acesso passa por gateways, que são servidores
   comuns em jurisdições comuns e podem bloquear amanhã. O tema tem o VISUAL
   do panfleto; não vende uma garantia que o produto não dá.

   A textura é um gradiente repetido, não uma imagem: nenhum `url()`, nenhum
   recurso de outro servidor (02 G.2.4). Letras do sistema. */
const TemaPanfleto = (function () {
  'use strict';

  const options = Object.freeze({
    papel: Object.freeze({ tipo: 'escolha', rotulo: 'Papel', padrao: 'fotocopia',
      opcoes: Object.freeze([['branco', 'Branco'], ['fotocopia', 'Cinza de fotocópia'], ['amarelo', 'Amarelo de panfleto']]) }),
    cor_alerta: Object.freeze({ tipo: 'cor', rotulo: 'Cor de alarme', padrao: '#d0021b',
      apoio: 'O carimbo da data, o contorno dos botões e os links. Se ficar perto demais do papel, o site escurece só o texto.' }),
    textura: Object.freeze({ tipo: 'escolha', rotulo: 'Textura de fotocópia', padrao: 'leve',
      opcoes: Object.freeze([['nenhuma', 'Nenhuma'], ['leve', 'Leve'], ['forte', 'Forte']]),
      apoio: 'As riscas diagonais de uma folha copiada muitas vezes. São desenhadas pelo site, sem imagem nenhuma.' }),
    titulos: Object.freeze({ tipo: 'escolha', rotulo: 'Títulos', padrao: 'gritados',
      opcoes: Object.freeze([['normais', 'Normais'], ['gritados', 'EM MAIÚSCULAS']]) }),
    tamanho_texto: Object.freeze({ tipo: 'escolha', rotulo: 'Tamanho do texto', padrao: 'medio',
      opcoes: Object.freeze([['pequeno', 'Pequeno'], ['medio', 'Médio'], ['grande', 'Grande']]) }),
    largura: Object.freeze({ tipo: 'escolha', rotulo: 'Largura da página', padrao: 'media',
      opcoes: Object.freeze([['estreita', 'Estreita'], ['media', 'Média'], ['larga', 'Larga']]) }),
    altura_logo: Object.freeze({ tipo: 'medida', rotulo: 'Altura do logo', padrao: 44, min: 24, max: 96, passo: 2, unidade: 'px' })
  });

  const manifesto = Object.freeze({ id: 'panfleto', version: 1, nome: 'Panfleto', autor: 'Nostermentor', engine_min: 1, options: options });

  // A data vem ANTES do título e é o carimbo. As etiquetas descem para o pé
  // da folha, como as palavras de ordem no fim de um panfleto.
  const artigo = [
    '<article class="artigo">',
    '<p class="meta"><time datetime="{{data_iso}}" class="carimbo">{{data}}</time></p>',
    '<h1>{{titulo}}</h1>',
    '{{#capa}}<figure class="capa"><a class="ampliar" href="{{src}}" target="_blank" rel="noopener"><img src="{{src}}" alt="{{alt}}"{{#largura}} width="{{largura}}" height="{{altura}}"{{/largura}}></a>{{#legenda}}<figcaption>{{legenda}}</figcaption>{{/legenda}}</figure>',
    '{{/capa}}{{{corpo}}}',
    '{{#tem_tags}}<p class="meta etiquetas">{{#tags}}{{#href}}<a class="etiqueta" href="{{href}}">{{nome}}</a>{{/href}}{{^href}}<span class="etiqueta">{{nome}}</span>{{/href}} {{/tags}}</p>',
    '{{/tem_tags}}</article>',
    ''
  ].join('\n');

  const lista = '<ul class="lista-artigos">{{#artigos}}<li><time datetime="{{data_iso}}" class="carimbo">{{data}}</time><h2><a href="{{href}}">{{titulo}}</a></h2>{{#resumo}}<p class="resumo">{{resumo}}</p>{{/resumo}}</li>\n{{/artigos}}</ul>';

  const blog = [
    '<section class="blog">',
    '<h1>{{blog_titulo}}</h1>',
    '{{^tem_artigos}}<p class="vazio">Nada publicado ainda.</p>',
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

  const templates = Object.freeze(Object.assign({}, Temas.moldes, { artigo, blog, etiqueta }));
  function resolver(opcoes) { return Temas.resolver(options, opcoes); }

  const PAPEIS = {
    branco:    { papel: '#ffffff', tinta: '#0a0a0a', suave: '#4a4a4a', linha: '#000000', bloco: '#ededed' },
    fotocopia: { papel: '#e9e7e2', tinta: '#111111', suave: '#4d4b47', linha: '#000000', bloco: '#dbd8d1' },
    amarelo:   { papel: '#f7e96a', tinta: '#111111', suave: '#4b4623', linha: '#000000', bloco: '#eddc4e' }
  };
  const TEXTURAS = {
    nenhuma: 'none',
    leve: 'repeating-linear-gradient(115deg,rgba(0,0,0,.035) 0 1px,transparent 1px 7px)',
    forte: 'repeating-linear-gradient(115deg,rgba(0,0,0,.075) 0 2px,transparent 2px 6px)'
  };
  const TAMANHOS = { pequeno: 16, medio: 17, grande: 19 };
  // ⚠️ Estas medidas são MENORES do que as dos outros temas de propósito: a
  // letra deste é condensada (Arial Narrow), e uma letra condensada cabe mais
  // vezes na mesma largura. Medido em 2026-09-05 no Firefox, que a tem:
  // **6,32 px por letra**, contra ~7,5 de uma sem serifa normal — a largura
  // "média" de 680 px dava **101 caracteres por linha**, acima do teto de 90
  // (TEMAS.md §7.2 R6). ⚠️ E o Chrome desta máquina NÃO tem Arial Narrow: caía
  // na alternativa, media ~83 e passava. **O defeito só existia num motor** —
  // é a razão de a suíte correr nos dois.
  const LARGURAS = { estreita: 500, media: 580, larga: 720 };
  const SANS = '"Arial Narrow","Helvetica Neue",Helvetica,Arial,system-ui,sans-serif';

  function css(opcoes) {
    const v = resolver(opcoes);
    const p = PAPEIS[v.papel];
    const C = Temas.cor;
    const alerta = C.paraRgb(v.cor_alerta);
    return [
      '/* Nostermentor — tema Panfleto v1. A textura é um gradiente; nenhuma imagem, nenhuma letra buscada fora. */',
      ':root{--papel:' + p.papel + ';--tinta:' + p.tinta + ';--suave:' + p.suave + ';--linha:' + p.linha + ';--bloco:' + p.bloco + ';' +
        '--alerta:' + v.cor_alerta + ';--alerta-legivel:' + C.acentoLegivel(v.cor_alerta, p.papel) + ';--alerta-texto:' + C.textoSobre(alerta) + ';' +
        '--caixa-alta:' + (v.titulos === 'gritados' ? 'uppercase' : 'none') + ';' +
        '--sans:' + SANS + ';--base:' + TAMANHOS[v.tamanho_texto] + 'px;--largura:' + LARGURAS[v.largura] + 'px;--logo-altura:' + v.altura_logo + 'px}',
      '*{box-sizing:border-box}',
      'html{-webkit-text-size-adjust:100%}',
      'body{margin:0;background-color:var(--papel);background-image:' + TEXTURAS[v.textura] + ';color:var(--tinta);font-family:var(--sans);font-size:var(--base);line-height:1.58;overflow-wrap:anywhere}',
      'a{color:var(--alerta-legivel);text-underline-offset:3px}',
      'img,video{max-width:100%;height:auto}',
      'code,pre{font-family:ui-monospace,Menlo,Consolas,"Liberation Mono",monospace;font-size:.9em}',
      'pre{overflow:auto;padding:12px;background:var(--bloco);border:2px solid var(--tinta)}',
      'table{display:block;overflow-x:auto;overflow-wrap:normal;margin:0 0 1.5em;border-collapse:collapse}',
      'th,td{padding:6px 14px 6px 0;text-align:left;vertical-align:top;border-bottom:2px solid var(--tinta)}',
      'thead th{text-transform:uppercase;letter-spacing:.06em}',
      'blockquote{margin:1.4em 0;padding:.6em 0 .6em 1em;border-left:8px solid var(--tinta);font-weight:700}',
      // --- a tarja do cabeçalho --------------------------------------------
      '.cabecalho{background:var(--tinta);color:var(--papel);padding:16px 20px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px 24px}',
      '.marca{font-size:1.55em;line-height:1.1;font-weight:900;text-transform:uppercase;letter-spacing:-.01em;text-decoration:none;color:var(--papel)}',
      '.marca-logo{line-height:0}',
      '.marca-logo img{max-height:var(--logo-altura);max-width:100%;width:auto;height:auto;display:block}',
      '.menu{display:flex;flex-wrap:wrap;gap:6px 10px}',
      '.menu a{display:inline-block;padding:3px 9px;background:var(--papel);color:var(--tinta);text-decoration:none;font-size:.84em;font-weight:700;text-transform:uppercase;letter-spacing:.06em;line-height:1.6}',
      '.menu a[aria-current=page]{background:var(--alerta);color:var(--alerta-texto)}',
      '.principal{max-width:var(--largura);margin:0 auto;padding:28px 20px 44px}',
      // A barra preta: o gesto do tema. É uma borda, não um elemento — não
      // ocupa lugar na estrutura e não pode estourar a largura.
      'h1{font-size:2em;line-height:1.05;margin:0 0 .5em;font-weight:900;text-transform:var(--caixa-alta);letter-spacing:-.015em;border-bottom:10px solid var(--tinta);padding-bottom:.25em}',
      'h2{font-size:1.32em;line-height:1.15;margin:1.6em 0 .4em;font-weight:900;text-transform:var(--caixa-alta);letter-spacing:-.01em}',
      'h3{font-size:1.08em;margin:1.4em 0 .35em;font-weight:700;text-transform:uppercase;letter-spacing:.05em}',
      '.meta{margin:0 0 1em;font-size:.86em}',
      // O carimbo: inclinado, na cor de alarme. `display:inline-block` para a
      // rotação não arrastar a linha, e ângulo pequeno para não sair da caixa.
      '.carimbo{display:inline-block;border:3px solid var(--alerta-legivel);color:var(--alerta-legivel);padding:1px 10px;font-weight:900;font-size:.94em;line-height:1.5;letter-spacing:.06em;transform:rotate(-2deg);margin:0 10px 6px 0}',
      '.etiqueta{display:inline-block;padding:2px 9px;background:var(--tinta);color:var(--papel);font-size:1em;font-weight:700;text-transform:uppercase;letter-spacing:.05em;text-decoration:none;line-height:1.5}',
      'a.etiqueta:hover{background:var(--alerta);color:var(--alerta-texto)}',
      '.etiquetas{margin:1.6em 0 0;border-top:6px solid var(--tinta);padding-top:.8em}',
      '.cta{margin:1.6em 0}',
      '.botao{display:inline-block;padding:.55em 1.4em;background:var(--tinta);color:var(--papel);border:3px solid var(--alerta-legivel);text-decoration:none;font-weight:900;text-transform:uppercase;letter-spacing:.07em}',
      '.capa{margin:0 0 1.5em;border:3px solid var(--tinta)}',
      '.capa img{width:100%;height:auto;display:block}',
      '.capa figcaption{padding:6px 10px;background:var(--tinta);color:var(--papel);font-size:.84em;font-weight:700}',
      '.ampliar{display:block;line-height:0;text-decoration:none;cursor:zoom-in}',
      '.galeria{margin:2em 0}',
      '.cartoes{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:18px}',
      '.cartao{margin:0;border:3px solid var(--tinta);padding:10px}',
      '.cartao-capa{display:block;line-height:0;margin:0 0 .5em}',
      '.cartao-capa img{width:100%;height:auto;display:block}',
      '.cartao-titulo{font-size:1.02em;line-height:1.2;margin:0 0 .2em;font-weight:900;text-transform:var(--caixa-alta)}',
      '.cartao-titulo a{text-decoration:none;color:var(--tinta)}',
      '.cartao .meta{margin:0 0 .3em}',
      '.cartao .resumo{margin:0;font-size:.92em}',
      '.lista-artigos{list-style:none;margin:0;padding:0}',
      '.lista-artigos li{margin:0 0 1.6em;padding-bottom:1.6em;border-bottom:6px solid var(--tinta)}',
      '.lista-artigos li:last-child{border-bottom:0}',
      '.lista-artigos h2{margin:.2em 0 .2em;font-size:1.28em}',
      // ⚠️ Folga TAMBÉM na horizontal, e é por causa da letra condensada: um
      // título curto como "Pão" media 23 px de largura contra os 24 que a WCAG
      // 2.2 (2.5.8) pede — medido em 2026-09-05, sem logo e com a letra
      // pequena. Nos outros temas o mesmo título passa dos 24 sozinho.
      '.lista-artigos a,.ultimos p a,.blog>p a,.cartao-titulo a{display:inline-block;padding:3px 3px;margin:0 -3px}',
      // A data dentro de uma listagem não é a data de um artigo aberto: ali
      // ela abre espaço antes do texto, aqui separa duas linhas do mesmo
      // item. Sem esta regra herda a margem grande de `.meta` e a lista fica
      // com um buraco entre a data e o resumo — visto na captura, 2026-09-05.
      '.lista-artigos .meta{margin:0 0 .35em}',
      '.resumo{margin:.3em 0 0}',
      '.ultimos{margin-top:2.2em;padding-top:1em;border-top:10px solid var(--tinta)}',
      '.ultimos h2{margin-top:0}',
      '.vazio{font-weight:700}',
      '.rodape{max-width:var(--largura);margin:0 auto;padding:14px 20px 36px;border-top:3px solid var(--tinta);font-size:.84em;font-weight:700;text-transform:uppercase;letter-spacing:.05em}',
      '.apoie h2{font-size:1em;margin:0 0 .3em}',
      '.apoie code{text-transform:none;letter-spacing:normal;font-weight:400}',
      '.credito{margin:1em 0 0;color:var(--suave)}',
      ''
    ].join('\n');
  }

  return Object.freeze({ manifesto, templates, css, resolver });
})();
Temas.registar(TemaPanfleto);
