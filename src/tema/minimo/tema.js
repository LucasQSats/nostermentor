/* tema/minimo/tema.js — MÍNIMO: a ausência (12; TEMAS.md). Sem cor de
   destaque, sem filetes, sem sombras, sem caixas, sem maiúsculas decorativas.
   Uma coluna estreita, o nome do site do tamanho de um parágrafo e o menu em
   texto corrido. O contrário do Manifesto.

   Não é preguiça: é a única forma que fica igual em qualquer tela e em
   qualquer motor, e é a mais leve para quem lê por trás do Tor. Tema só de
   CSS: os oito moldes base (`Temas.moldes`). Nenhum recurso externo. */
const TemaMinimo = (function () {
  'use strict';

  const options = Object.freeze({
    esquema: Object.freeze({ tipo: 'escolha', rotulo: 'Fundo', padrao: 'claro',
      opcoes: Object.freeze([['papel', 'Papel'], ['escuro', 'Escuro'], ['claro', 'Claro']]) }),
    fonte: Object.freeze({ tipo: 'escolha', rotulo: 'Letra', padrao: 'sem-serifa',
      opcoes: Object.freeze([['serifa', 'Serifa'], ['largura-fixa', 'Largura fixa'], ['sem-serifa', 'Sem serifa']]) }),
    tamanho_texto: Object.freeze({ tipo: 'escolha', rotulo: 'Tamanho do texto', padrao: 'medio',
      opcoes: Object.freeze([['pequeno', 'Pequeno'], ['medio', 'Médio'], ['grande', 'Grande']]) }),
    largura: Object.freeze({ tipo: 'escolha', rotulo: 'Largura da página', padrao: 'estreita',
      opcoes: Object.freeze([['estreita', 'Estreita'], ['media', 'Média'], ['larga', 'Larga']]) }),
    altura_logo: Object.freeze({ tipo: 'medida', rotulo: 'Altura do logo', padrao: 28, min: 20, max: 72, passo: 2, unidade: 'px' })
  });

  const manifesto = Object.freeze({ id: 'minimo', version: 1, nome: 'Mínimo', autor: 'Nostermentor', engine_min: 1, options: options });

  const templates = Temas.moldes;
  function resolver(opcoes) { return Temas.resolver(options, opcoes); }

  const ESQUEMAS = {
    claro:  { fundo: '#ffffff', tinta: '#222222', suave: '#767676', bloco: '#f4f4f4' },
    papel:  { fundo: '#f6f4ef', tinta: '#252320', suave: '#716d64', bloco: '#eceae3' },
    escuro: { fundo: '#191919', tinta: '#e4e4e4', suave: '#9a9a9a', bloco: '#242424' }
  };
  const FONTES = {
    serifa: 'Georgia,"Times New Roman",serif',
    'sem-serifa': 'system-ui,-apple-system,"Segoe UI",Roboto,Ubuntu,"Noto Sans",sans-serif',
    'largura-fixa': 'ui-monospace,Menlo,Consolas,"DejaVu Sans Mono",monospace'
  };
  const TAMANHOS = { pequeno: 16, medio: 17, grande: 19 };
  const LARGURAS = { estreita: 560, media: 660, larga: 800 };

  function css(opcoes) {
    const v = resolver(opcoes);
    const e = ESQUEMAS[v.esquema];
    return [
      '/* Nostermentor — tema Mínimo v1. Sem cor de destaque, sem imagens, sem letras vindas de fora. */',
      ':root{--fundo:' + e.fundo + ';--tinta:' + e.tinta + ';--suave:' + e.suave + ';--bloco:' + e.bloco + ';' +
        '--fonte:' + FONTES[v.fonte] + ';--base:' + TAMANHOS[v.tamanho_texto] + 'px;--largura:' + LARGURAS[v.largura] + 'px;--logo-altura:' + v.altura_logo + 'px}',
      '*{box-sizing:border-box}',
      'html{-webkit-text-size-adjust:100%}',
      'body{margin:0;background:var(--fundo);color:var(--tinta);font-family:var(--fonte);font-size:var(--base);line-height:1.7;overflow-wrap:anywhere}',
      // Sem cor de destaque: o link distingue-se pelo sublinhado, não pela cor.
      // É também o que continua a funcionar para quem não distingue cores.
      'a{color:inherit;text-underline-offset:3px}',
      'img,video{max-width:100%;height:auto}',
      'code,pre{font-family:ui-monospace,Menlo,Consolas,"Liberation Mono",monospace;font-size:.9em}',
      'pre{overflow:auto;padding:12px;background:var(--bloco)}',
      'table{display:block;overflow-x:auto;overflow-wrap:normal;margin:0 0 1.5em}',
      'th,td{padding:4px 18px 4px 0;text-align:left;vertical-align:top}',
      'blockquote{margin:1.4em 0 1.4em 1.4em;padding:0;border:0;color:var(--suave)}',
      '.cabecalho{max-width:var(--largura);margin:0 auto;padding:32px 20px 0}',
      // ⚠️ `inline-block` com folga NÃO é enfeite: o nome do site é um link,
      // e neste tema ele tem o tamanho do texto corrido. Medido em 2026-09-05,
      // sem logo e com a letra pequena: 270x19 px — abaixo dos 24 que a WCAG
      // 2.2 (2.5.8) pede a um alvo de toque. A folga resolve sem a linha crescer.
      '.marca{display:inline-block;padding:3px 0;font-size:1em;font-weight:700;text-decoration:none;color:var(--tinta)}',
      '.marca-logo{display:inline-block;line-height:0}',
      '.marca-logo img{max-height:var(--logo-altura);max-width:100%;width:auto;height:auto;display:block}',
      // O menu é texto corrido, separado por espaço — sem caixas nem barras.
      '.menu{display:flex;flex-wrap:wrap;gap:0 14px;margin-top:6px}',
      '.menu a{display:inline-block;padding:3px 0;color:var(--suave);text-decoration:none}',
      '.menu a[aria-current=page]{color:var(--tinta)}',
      '.principal{max-width:var(--largura);margin:0 auto;padding:28px 20px 40px}',
      'h1{font-size:1.35em;line-height:1.35;margin:0 0 .8em;font-weight:700}',
      'h2{font-size:1.12em;line-height:1.4;margin:2em 0 .4em;font-weight:700}',
      'h3{font-size:1em;margin:1.6em 0 .3em;font-weight:700}',
      '.meta{color:var(--suave);font-size:.92em;margin:0 0 1.6em}',
      '.etiqueta{display:inline-block;padding:2px 0;font-size:1em;color:var(--suave);text-decoration:none;line-height:1.6}',
      'a.etiqueta{text-decoration:underline}',
      '.cta{margin:1.6em 0}',
      '.botao{display:inline-block;padding:.4em 0;color:var(--tinta);text-decoration:underline;text-underline-offset:4px;font-weight:700}',
      '.capa{margin:0 0 1.6em}',
      '.capa img{width:100%;height:auto;display:block}',
      '.capa figcaption{color:var(--suave);font-size:.9em;padding-top:6px}',
      '.ampliar{display:block;line-height:0;text-decoration:none;cursor:zoom-in}',
      '.galeria{margin:1.8em 0}',
      '.cartoes{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:18px}',
      '.cartao{margin:0}',
      '.cartao-capa{display:block;line-height:0;margin:0 0 .4em}',
      '.cartao-capa img{width:100%;height:auto;display:block}',
      '.cartao-titulo{font-size:1em;line-height:1.4;margin:0;font-weight:700}',
      '.cartao .meta{margin:0;font-size:.9em}',
      '.cartao .resumo{margin:.2em 0 0;font-size:.92em;color:var(--suave)}',
      '.lista-artigos{list-style:none;margin:0;padding:0}',
      '.lista-artigos li{margin:0 0 1.1em}',
      '.lista-artigos h2{margin:0;font-size:1em;font-weight:400}',
      '.lista-artigos time{color:var(--suave);font-size:.92em}',
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
      '.resumo{margin:.1em 0 0;color:var(--suave);font-size:.94em}',
      '.ultimos{margin-top:2.4em}',
      '.ultimos h2{margin-top:0}',
      '.vazio{color:var(--suave)}',
      '.rodape{max-width:var(--largura);margin:0 auto;padding:8px 20px 40px;color:var(--suave);font-size:.9em}',
      '.apoie h2{font-size:1em;margin:0 0 .2em;color:var(--tinta)}',
      '.credito{margin:1.2em 0 0}',
      ''
    ].join('\n');
  }

  return Object.freeze({ manifesto, templates, css, resolver });
})();
Temas.registar(TemaMinimo);
