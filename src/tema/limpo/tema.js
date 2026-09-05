/* tema/limpo/tema.js — LIMPO: branco, ar e um título grande (12; TEMAS.md).
   Sem caixas, sem sombras, sem molduras: a única linha da página é a que
   separa o cabeçalho do texto. É o tema para quem quer que não se veja tema
   nenhum — só o que está escrito.

   Tema só de CSS: os oito moldes base (`Temas.moldes`). Nenhum recurso
   externo (02 G.2.4); letras do sistema; só aritmética inteira na cor. */
const TemaLimpo = (function () {
  'use strict';

  const options = Object.freeze({
    esquema: Object.freeze({ tipo: 'escolha', rotulo: 'Fundo', padrao: 'branco',
      opcoes: Object.freeze([['neve', 'Neve'], ['creme', 'Creme'], ['branco', 'Branco']]) }),
    cor_destaque: Object.freeze({ tipo: 'cor', rotulo: 'Cor de destaque', padrao: '#1a6b5a',
      apoio: 'Links e botões, e nada mais. Se ficar perto demais do fundo, o site escurece só o texto.' }),
    fonte_titulos: Object.freeze({ tipo: 'escolha', rotulo: 'Letra dos títulos', padrao: 'serifa',
      opcoes: Object.freeze([['sem-serifa', 'Sem serifa'], ['serifa', 'Serifa']]) }),
    fonte_texto: Object.freeze({ tipo: 'escolha', rotulo: 'Letra do texto', padrao: 'sem-serifa',
      opcoes: Object.freeze([['serifa', 'Serifa'], ['sem-serifa', 'Sem serifa']]),
      apoio: 'Só letras que já existem no computador de quem lê — buscar uma na internet entregaria o visitante ao servidor da letra.' }),
    ar: Object.freeze({ tipo: 'escolha', rotulo: 'Espaço entre as coisas', padrao: 'muito',
      opcoes: Object.freeze([['normal', 'Normal'], ['muito', 'Muito']]) }),
    tamanho_texto: Object.freeze({ tipo: 'escolha', rotulo: 'Tamanho do texto', padrao: 'medio',
      opcoes: Object.freeze([['pequeno', 'Pequeno'], ['medio', 'Médio'], ['grande', 'Grande']]) }),
    largura: Object.freeze({ tipo: 'escolha', rotulo: 'Largura da página', padrao: 'media',
      opcoes: Object.freeze([['estreita', 'Estreita'], ['media', 'Média'], ['larga', 'Larga']]) }),
    altura_logo: Object.freeze({ tipo: 'medida', rotulo: 'Altura do logo', padrao: 36, min: 24, max: 96, passo: 2, unidade: 'px' })
  });

  const manifesto = Object.freeze({ id: 'limpo', version: 1, nome: 'Limpo', autor: 'Nostermentor', engine_min: 1, options: options });

  const templates = Temas.moldes;
  function resolver(opcoes) { return Temas.resolver(options, opcoes); }

  const ESQUEMAS = {
    branco: { fundo: '#ffffff', tinta: '#1a1a1a', suave: '#6b6b6b', linha: '#e8e8e8', bloco: '#f6f6f6' },
    neve:   { fundo: '#fafafa', tinta: '#1c1c1c', suave: '#6c6c6c', linha: '#e6e6e6', bloco: '#f1f1f1' },
    creme:  { fundo: '#fdfaf4', tinta: '#22201a', suave: '#6e685c', linha: '#eae3d6', bloco: '#f5f0e6' }
  };
  const FONTES = {
    serifa: 'Georgia,"Iowan Old Style","Times New Roman",serif',
    'sem-serifa': 'system-ui,-apple-system,"Segoe UI",Roboto,Ubuntu,"Noto Sans",sans-serif'
  };
  const TAMANHOS = { pequeno: 17, medio: 18, grande: 20 };
  const LARGURAS = { estreita: 600, media: 680, larga: 820 };
  const ARES = { normal: 1, muito: 2 };

  function css(opcoes) {
    const v = resolver(opcoes);
    const e = ESQUEMAS[v.esquema];
    const C = Temas.cor;
    const ar = ARES[v.ar];
    return [
      '/* Nostermentor — tema Limpo v1. Letras do sistema, nenhuma imagem, nenhum recurso de outro servidor. */',
      ':root{--fundo:' + e.fundo + ';--tinta:' + e.tinta + ';--suave:' + e.suave + ';--linha:' + e.linha + ';--bloco:' + e.bloco + ';' +
        '--acento:' + v.cor_destaque + ';--acento-legivel:' + C.acentoLegivel(v.cor_destaque, e.fundo) + ';--acento-texto:' + C.textoSobre(C.paraRgb(v.cor_destaque)) + ';' +
        '--fonte-texto:' + FONTES[v.fonte_texto] + ';--fonte-titulos:' + FONTES[v.fonte_titulos] + ';' +
        '--ar:' + (24 * ar) + 'px;--topo:' + (28 * ar) + 'px;' +
        '--base:' + TAMANHOS[v.tamanho_texto] + 'px;--largura:' + LARGURAS[v.largura] + 'px;--logo-altura:' + v.altura_logo + 'px}',
      '*{box-sizing:border-box}',
      'html{-webkit-text-size-adjust:100%}',
      'body{margin:0;background:var(--fundo);color:var(--tinta);font-family:var(--fonte-texto);font-size:var(--base);line-height:1.75;overflow-wrap:anywhere}',
      'a{color:var(--acento-legivel);text-underline-offset:3px}',
      'img,video{max-width:100%;height:auto}',
      'code,pre{font-family:ui-monospace,Menlo,Consolas,"Liberation Mono",monospace;font-size:.9em}',
      'pre{overflow:auto;padding:16px;background:var(--bloco)}',
      'table{display:block;overflow-x:auto;overflow-wrap:normal;margin:0 0 1.6em}',
      'th,td{padding:8px 18px 8px 0;text-align:left;vertical-align:top;border-bottom:1px solid var(--linha)}',
      'blockquote{margin:1.6em 0;padding:0 0 0 1.2em;border-left:2px solid var(--linha);color:var(--suave)}',
      '.cabecalho{max-width:var(--largura);margin:0 auto;padding:var(--topo) 22px 18px;display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:8px 24px;border-bottom:1px solid var(--linha)}',
      '.marca{font-family:var(--fonte-titulos);font-size:1.28em;line-height:1.3;font-weight:600;text-decoration:none;color:var(--tinta);letter-spacing:-.01em}',
      '.marca-logo{line-height:0;align-self:center}',
      '.marca-logo img{max-height:var(--logo-altura);max-width:100%;width:auto;height:auto;display:block}',
      '.menu{display:flex;flex-wrap:wrap;gap:2px 20px}',
      '.menu a{display:inline-block;padding:3px 0;text-decoration:none;font-size:.92em;color:var(--suave)}',
      '.menu a[aria-current=page]{color:var(--tinta)}',
      '.principal{max-width:var(--largura);margin:0 auto;padding:var(--ar) 22px calc(var(--ar) * 2)}',
      'h1{font-family:var(--fonte-titulos);font-size:2.2em;line-height:1.16;margin:0 0 .4em;font-weight:600;letter-spacing:-.022em}',
      'h2{font-family:var(--fonte-titulos);font-size:1.42em;line-height:1.25;margin:2em 0 .5em;font-weight:600;letter-spacing:-.015em}',
      'h3{font-family:var(--fonte-titulos);font-size:1.14em;margin:1.7em 0 .4em;font-weight:600}',
      '.meta{color:var(--suave);font-size:.9em;margin:0 0 2em}',
      '.etiqueta{display:inline-block;padding:2px 2px;font-size:1em;text-decoration:underline;text-underline-offset:3px;color:inherit;line-height:1.6}',
      '.cta{margin:2em 0}',
      '.botao{display:inline-block;padding:.65em 1.6em;background:var(--acento);color:var(--acento-texto);text-decoration:none;font-weight:600}',
      '.capa{margin:0 0 2em}',
      '.capa img{width:100%;height:auto;display:block}',
      '.capa figcaption{color:var(--suave);font-size:.88em;padding-top:10px}',
      '.ampliar{display:block;line-height:0;text-decoration:none;cursor:zoom-in}',
      '.galeria{margin:2.4em 0}',
      '.cartoes{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:var(--ar)}',
      '.cartao{margin:0}',
      '.cartao-capa{display:block;line-height:0;margin:0 0 .7em}',
      '.cartao-capa img{width:100%;height:auto;display:block}',
      '.cartao-titulo{font-family:var(--fonte-titulos);font-size:1.05em;line-height:1.3;margin:0 0 .2em;font-weight:600}',
      '.cartao-titulo a{text-decoration:none}',
      '.cartao .meta{margin:0 0 .3em}',
      '.cartao .resumo{margin:0;font-size:.94em;color:var(--suave)}',
      '.lista-artigos{list-style:none;margin:0;padding:0}',
      '.lista-artigos li{margin:0 0 var(--ar)}',
      '.lista-artigos h2{margin:0 0 .1em;font-size:1.24em}',
      '.lista-artigos h2 a{text-decoration:none}',
      '.lista-artigos time{color:var(--suave);font-size:.9em}',
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
      '.resumo{margin:.2em 0 0;color:var(--suave)}',
      '.ultimos{margin-top:calc(var(--ar) * 2);padding-top:var(--ar);border-top:1px solid var(--linha)}',
      '.ultimos h2{margin-top:0}',
      '.vazio{color:var(--suave)}',
      '.rodape{max-width:var(--largura);margin:0 auto;padding:20px 22px 48px;border-top:1px solid var(--linha);color:var(--suave);font-size:.9em}',
      '.apoie h2{font-size:1.05em;margin:0 0 .3em;color:var(--tinta)}',
      '.credito{margin:1.2em 0 0}',
      ''
    ].join('\n');
  }

  return Object.freeze({ manifesto, templates, css, resolver });
})();
Temas.registar(TemaLimpo);
