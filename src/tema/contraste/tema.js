/* tema/contraste/tema.js — ALTO CONTRASTE: legibilidade acima de tudo
   (12; TEMAS.md). Letra grande, preto puro sobre branco puro (ou o
   contrário), todos os links sublinhados e a negrito, alvos de toque
   folgados e contorno grosso ao navegar pelo teclado. Decoração nenhuma —
   aqui ela é ruído.

   Não é um tema "para deficientes visuais": é o tema para ler ao sol num
   telemóvel, num monitor velho, ou com a vista cansada. Tema só de CSS: os
   oito moldes base (`Temas.moldes`). Nenhum recurso externo (02 G.2.4). */
const TemaContraste = (function () {
  'use strict';

  const options = Object.freeze({
    esquema: Object.freeze({ tipo: 'escolha', rotulo: 'Cores', padrao: 'claro',
      opcoes: Object.freeze([['escuro', 'Branco sobre preto'], ['amarelo', 'Amarelo sobre preto'], ['claro', 'Preto sobre branco']]),
      apoio: 'Amarelo sobre preto é a combinação que muita gente com baixa visão prefere.' }),
    tamanho_texto: Object.freeze({ tipo: 'escolha', rotulo: 'Tamanho do texto', padrao: 'grande',
      opcoes: Object.freeze([['grande', 'Grande'], ['maior', 'Maior'], ['enorme', 'Enorme']]),
      apoio: 'Todos os tamanhos deste tema são maiores do que o normal — é a razão de ele existir.' }),
    sublinhado: Object.freeze({ tipo: 'escolha', rotulo: 'Links sublinhados', padrao: 'sempre',
      opcoes: Object.freeze([['ao-passar', 'Só ao passar por cima'], ['sempre', 'Sempre']]),
      apoio: 'Sublinhar sempre é o que permite reconhecer um link a quem não distingue cores.' }),
    largura: Object.freeze({ tipo: 'escolha', rotulo: 'Largura da página', padrao: 'media',
      opcoes: Object.freeze([['estreita', 'Estreita'], ['media', 'Média'], ['larga', 'Larga']]) }),
    altura_logo: Object.freeze({ tipo: 'medida', rotulo: 'Altura do logo', padrao: 48, min: 28, max: 96, passo: 2, unidade: 'px' })
  });

  const manifesto = Object.freeze({ id: 'contraste', version: 1, nome: 'Alto contraste', autor: 'Nostermentor', engine_min: 1, options: options });

  const templates = Temas.moldes;
  function resolver(opcoes) { return Temas.resolver(options, opcoes); }

  const ESQUEMAS = {
    claro:   { fundo: '#ffffff', tinta: '#000000', suave: '#3a3a3a', acento: '#0033cc', sobre: '#ffffff' },
    escuro:  { fundo: '#000000', tinta: '#ffffff', suave: '#d0d0d0', acento: '#66ccff', sobre: '#000000' },
    amarelo: { fundo: '#000000', tinta: '#ffe600', suave: '#d8c400', acento: '#ffe600', sobre: '#000000' }
  };
  const TAMANHOS = { grande: 20, maior: 23, enorme: 26 };
  const LARGURAS = { estreita: 620, media: 720, larga: 880 };
  const SANS = 'system-ui,-apple-system,"Segoe UI",Roboto,Ubuntu,"Noto Sans",Arial,sans-serif';

  function css(opcoes) {
    const v = resolver(opcoes);
    const e = ESQUEMAS[v.esquema];
    return [
      '/* Nostermentor — tema Alto contraste v1. Letras do sistema, nenhuma imagem, nenhum recurso de outro servidor. */',
      ':root{--fundo:' + e.fundo + ';--tinta:' + e.tinta + ';--suave:' + e.suave + ';--acento:' + e.acento + ';--sobre-acento:' + e.sobre + ';' +
        '--sublinha:' + (v.sublinhado === 'sempre' ? 'underline' : 'none') + ';' +
        '--sans:' + SANS + ';--base:' + TAMANHOS[v.tamanho_texto] + 'px;--largura:' + LARGURAS[v.largura] + 'px;--logo-altura:' + v.altura_logo + 'px}',
      '*{box-sizing:border-box}',
      'html{-webkit-text-size-adjust:100%}',
      'body{margin:0;background:var(--fundo);color:var(--tinta);font-family:var(--sans);font-size:var(--base);line-height:1.8;overflow-wrap:anywhere}',
      'a{color:var(--acento);font-weight:700;text-decoration:var(--sublinha);text-underline-offset:4px;text-decoration-thickness:2px}',
      'a:hover{text-decoration:underline}',
      // O contorno de foco é a única "decoração" deste tema, e é a que serve
      // quem navega pelo teclado. 3 px, e afastado, para se ver em ambos os
      // esquemas.
      'a:focus-visible,button:focus-visible{outline:3px solid var(--acento);outline-offset:3px}',
      'img,video{max-width:100%;height:auto}',
      'code,pre{font-family:ui-monospace,Menlo,Consolas,"Liberation Mono",monospace;font-size:.95em}',
      'pre{overflow:auto;padding:16px;border:3px solid var(--tinta)}',
      'table{display:block;overflow-x:auto;overflow-wrap:normal;margin:0 0 1.4em;border-collapse:collapse}',
      'th,td{padding:10px 16px;text-align:left;vertical-align:top;border:2px solid var(--tinta)}',
      'thead th{font-weight:800}',
      'blockquote{margin:1.4em 0;padding:.6em 0 .6em 1em;border-left:8px solid var(--tinta)}',
      '.cabecalho{max-width:var(--largura);margin:0 auto;padding:24px 20px 16px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px 20px;border-bottom:4px solid var(--tinta)}',
      '.marca{font-size:1.5em;line-height:1.2;font-weight:800;text-decoration:none;color:var(--tinta)}',
      '.marca-logo{line-height:0}',
      '.marca-logo img{max-height:var(--logo-altura);max-width:100%;width:auto;height:auto;display:block}',
      '.menu{display:flex;flex-wrap:wrap;gap:8px 10px}',
      '.menu a{display:inline-block;padding:6px 12px;border:2px solid var(--tinta);color:var(--tinta);text-decoration:none;font-size:.9em;line-height:1.5}',
      '.menu a[aria-current=page]{background:var(--tinta);color:var(--fundo)}',
      '.principal{max-width:var(--largura);margin:0 auto;padding:28px 20px 48px}',
      'h1{font-size:1.9em;line-height:1.2;margin:0 0 .5em;font-weight:800}',
      'h2{font-size:1.4em;line-height:1.3;margin:1.6em 0 .4em;font-weight:800}',
      'h3{font-size:1.15em;margin:1.4em 0 .35em;font-weight:800}',
      '.meta{color:var(--suave);font-size:.9em;margin:0 0 1.4em;font-weight:700}',
      '.etiqueta{display:inline-block;padding:4px 12px;border:2px solid var(--tinta);font-size:1em;text-decoration:none;color:var(--tinta);line-height:1.5;font-weight:700}',
      'a.etiqueta:hover{background:var(--tinta);color:var(--fundo);text-decoration:none}',
      '.cta{margin:1.6em 0}',
      '.botao{display:inline-block;padding:.7em 1.6em;background:var(--acento);color:var(--sobre-acento);border:3px solid var(--tinta);text-decoration:none;font-weight:800}',
      '.capa{margin:0 0 1.6em;border:3px solid var(--tinta)}',
      '.capa img{width:100%;height:auto;display:block}',
      '.capa figcaption{padding:8px 12px;font-size:.9em;border-top:3px solid var(--tinta)}',
      '.ampliar{display:block;line-height:0;text-decoration:none;cursor:zoom-in}',
      '.galeria{margin:2em 0}',
      '.cartoes{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:20px}',
      '.cartao{margin:0;border:3px solid var(--tinta);padding:14px}',
      '.cartao-capa{display:block;line-height:0;margin:0 0 .6em}',
      '.cartao-capa img{width:100%;height:auto;display:block}',
      '.cartao-titulo{font-size:1.05em;line-height:1.3;margin:0 0 .2em;font-weight:800}',
      '.cartao .meta{margin:0 0 .3em}',
      '.cartao .resumo{margin:0;font-size:.95em}',
      '.lista-artigos{list-style:none;margin:0;padding:0}',
      '.lista-artigos li{margin:0 0 1.4em;padding-bottom:1.4em;border-bottom:2px solid var(--tinta)}',
      '.lista-artigos li:last-child{border-bottom:0}',
      '.lista-artigos h2{margin:0 0 .1em;font-size:1.25em}',
      '.lista-artigos time{color:var(--suave);font-size:.9em;font-weight:700}',
      // ⚠️ `em` COMPÕE: na listagem o `<time>` vive dentro do `<p class="meta">`,
      // que já reduziu o tamanho — reduzir outra vez dava 11,8 px no tema
      // Galeria e 12,0 no Neon, abaixo do piso de 12 (TEMAS.md §7.2 R5),
      // medido em 2026-09-05. Na secção "últimos artigos" o `<time>` é filho
      // direto do `<li>` e a redução acima é a que se quer; daí o escopo.
      '.lista-artigos .meta time{font-size:1em}',
      '.lista-artigos a,.ultimos p a,.blog>p a,.cartao-titulo a{display:inline-block;padding:4px 0}',
      // A data dentro de uma listagem não é a data de um artigo aberto: ali
      // ela abre espaço antes do texto, aqui separa duas linhas do mesmo
      // item. Sem esta regra herda a margem grande de `.meta` e a lista fica
      // com um buraco entre a data e o resumo — visto na captura, 2026-09-05.
      '.lista-artigos .meta{margin:0 0 .35em}',
      '.resumo{margin:.2em 0 0}',
      '.ultimos{margin-top:2.4em;padding-top:1.2em;border-top:4px solid var(--tinta)}',
      '.ultimos h2{margin-top:0}',
      '.vazio{font-weight:700}',
      '.rodape{max-width:var(--largura);margin:0 auto;padding:18px 20px 44px;border-top:4px solid var(--tinta);font-size:.9em}',
      '.apoie h2{font-size:1.1em;margin:0 0 .3em}',
      '.credito{margin:1.2em 0 0}',
      ''
    ].join('\n');
  }

  return Object.freeze({ manifesto, templates, css, resolver });
})();
Temas.registar(TemaContraste);
