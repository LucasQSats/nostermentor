/* tema/satoshi/tema.js — SATOSHI: laranja e preto, e a lista de publicações
   desenhada como uma CORRENTE DE BLOCOS (12; TEMAS.md) — cada entrada é uma
   caixa ligada à anterior por um elo vertical. O elo é um pseudo-elemento
   posicionado, não uma imagem, e desaparece quando o dono desliga a opção.

   Tema só de CSS: os oito moldes base (`Temas.moldes`). A data e as etiquetas
   saem em letra de largura fixa, como um identificador. Nenhum recurso
   externo (02 G.2.4); letras do sistema; só aritmética inteira na cor. */
const TemaSatoshi = (function () {
  'use strict';

  const options = Object.freeze({
    esquema: Object.freeze({ tipo: 'escolha', rotulo: 'Cores', padrao: 'claro',
      opcoes: Object.freeze([['grafite', 'Grafite'], ['noite', 'Noite'], ['claro', 'Claro']]) }),
    cor_destaque: Object.freeze({ tipo: 'cor', rotulo: 'Cor de destaque', padrao: '#f7931a',
      apoio: 'Links, botões, o elo da corrente e o contorno dos blocos.' }),
    corrente: Object.freeze({ tipo: 'escolha', rotulo: 'Ligar as publicações em corrente', padrao: 'sim',
      opcoes: Object.freeze([['nao', 'Não'], ['sim', 'Sim']]),
      apoio: 'Um traço vertical a unir cada bloco ao seguinte, na página do blog.' }),
    simbolo: Object.freeze({ tipo: 'escolha', rotulo: 'Símbolo antes do nome do site', padrao: 'nenhum',
      opcoes: Object.freeze([['nenhum', 'Nenhum'], ['raio', 'Um raio'], ['bitcoin', 'O B cortado']]),
      apoio: 'É um caractere, como os outros — quem usa leitor de ecrã continua a ouvir só o nome do site.' }),
    tamanho_texto: Object.freeze({ tipo: 'escolha', rotulo: 'Tamanho do texto', padrao: 'medio',
      opcoes: Object.freeze([['pequeno', 'Pequeno'], ['medio', 'Médio'], ['grande', 'Grande']]) }),
    largura: Object.freeze({ tipo: 'escolha', rotulo: 'Largura da página', padrao: 'media',
      opcoes: Object.freeze([['estreita', 'Estreita'], ['media', 'Média'], ['larga', 'Larga']]) }),
    altura_logo: Object.freeze({ tipo: 'medida', rotulo: 'Altura do logo', padrao: 40, min: 24, max: 96, passo: 2, unidade: 'px' })
  });

  const manifesto = Object.freeze({ id: 'satoshi', version: 1, nome: 'Satoshi', autor: 'Nostermentor', engine_min: 1, options: options });

  const templates = Temas.moldes;
  function resolver(opcoes) { return Temas.resolver(options, opcoes); }

  const ESQUEMAS = {
    claro:   { fundo: '#faf8f5', tinta: '#16130f', suave: '#605a51', linha: '#ded7cd', bloco: '#efeae3', caixa: '#ffffff' },
    grafite: { fundo: '#1c1c1c', tinta: '#ece9e4', suave: '#9c968d', linha: '#333130', bloco: '#252424', caixa: '#232221' },
    noite:   { fundo: '#0c0c0d', tinta: '#e8e4de', suave: '#8d8880', linha: '#262524', bloco: '#161615', caixa: '#141413' }
  };
  const SIMBOLOS = { nenhum: '""', raio: '"\\26A1\\A0"', bitcoin: '"\\20BF\\A0"' };
  const TAMANHOS = { pequeno: 16, medio: 17, grande: 19 };
  const LARGURAS = { estreita: 620, media: 700, larga: 880 };
  const SANS = 'system-ui,-apple-system,"Segoe UI",Roboto,Ubuntu,"Noto Sans",sans-serif';
  const MONO = 'ui-monospace,"SF Mono",Menlo,Consolas,"DejaVu Sans Mono",monospace';
  const ELO = 22;   // px entre blocos = comprimento do elo

  function css(opcoes) {
    const v = resolver(opcoes);
    const e = ESQUEMAS[v.esquema];
    const C = Temas.cor;
    return [
      '/* Nostermentor — tema Satoshi v1. A corrente é CSS; nenhuma imagem, nenhuma letra vinda de fora. */',
      ':root{--fundo:' + e.fundo + ';--tinta:' + e.tinta + ';--suave:' + e.suave + ';--linha:' + e.linha + ';--bloco:' + e.bloco + ';--caixa:' + e.caixa + ';' +
        '--acento:' + v.cor_destaque + ';--acento-legivel:' + C.acentoLegivel(v.cor_destaque, e.fundo) + ';--acento-texto:' + C.textoSobre(C.paraRgb(v.cor_destaque)) + ';' +
        '--simbolo:' + SIMBOLOS[v.simbolo] + ';--elo:' + (v.corrente === 'sim' ? 'block' : 'none') + ';--elo-h:' + ELO + 'px;' +
        '--sans:' + SANS + ';--mono:' + MONO + ';--base:' + TAMANHOS[v.tamanho_texto] + 'px;--largura:' + LARGURAS[v.largura] + 'px;--logo-altura:' + v.altura_logo + 'px}',
      '*{box-sizing:border-box}',
      'html{-webkit-text-size-adjust:100%}',
      'body{margin:0;background:var(--fundo);color:var(--tinta);font-family:var(--sans);font-size:var(--base);line-height:1.66;overflow-wrap:anywhere}',
      'a{color:var(--acento-legivel);text-underline-offset:3px}',
      'img,video{max-width:100%;height:auto}',
      'code,pre{font-family:var(--mono);font-size:.9em}',
      'code{background:var(--bloco);padding:1px 5px}',
      'pre{overflow:auto;padding:14px;background:var(--bloco);border:2px solid var(--linha)}',
      'pre code{background:none;padding:0}',
      'table{display:block;overflow-x:auto;overflow-wrap:normal;margin:0 0 1.5em;border-collapse:collapse;font-variant-numeric:tabular-nums}',
      'th,td{padding:7px 16px 7px 0;text-align:left;vertical-align:top;border-bottom:1px solid var(--linha)}',
      'thead th{font-family:var(--mono);font-size:.86em;text-transform:uppercase;letter-spacing:.07em;color:var(--acento-legivel)}',
      'blockquote{margin:1.5em 0;padding:.4em 0 .4em 1.1em;border-left:4px solid var(--acento);color:var(--suave)}',
      '.cabecalho{max-width:var(--largura);margin:0 auto;padding:22px 20px 14px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px 22px;border-bottom:2px solid var(--linha)}',
      '.marca{font-size:1.4em;line-height:1.2;font-weight:800;letter-spacing:-.02em;text-decoration:none;color:var(--tinta)}',
      '.marca::before{content:var(--simbolo);color:var(--acento-legivel)}',
      '.marca-logo{line-height:0}',
      '.marca-logo::before{content:none}',
      '.marca-logo img{max-height:var(--logo-altura);max-width:100%;width:auto;height:auto;display:block}',
      '.menu{display:flex;flex-wrap:wrap;gap:4px 16px}',
      '.menu a{display:inline-block;padding:3px 0;text-decoration:none;font-size:.92em;font-weight:600;color:var(--suave)}',
      '.menu a[aria-current=page]{color:var(--tinta);border-bottom:3px solid var(--acento)}',
      '.principal{max-width:var(--largura);margin:0 auto;padding:30px 20px 48px}',
      'h1{font-size:1.9em;line-height:1.16;margin:0 0 .4em;font-weight:800;letter-spacing:-.025em}',
      'h2{font-size:1.32em;line-height:1.24;margin:1.7em 0 .4em;font-weight:700;letter-spacing:-.012em}',
      'h3{font-size:1.08em;margin:1.4em 0 .35em;font-weight:700}',
      '.meta{color:var(--suave);font-family:var(--mono);font-size:.85em;letter-spacing:.04em;margin:0 0 1.6em}',
      '.etiqueta{display:inline-block;padding:2px 9px;border:1px solid var(--linha);background:var(--bloco);font-size:1em;text-decoration:none;color:inherit;line-height:1.6}',
      'a.etiqueta:hover{border-color:var(--acento);color:var(--acento-legivel)}',
      '.cta{margin:1.8em 0}',
      '.botao{display:inline-block;padding:.6em 1.5em;background:var(--acento);color:var(--acento-texto);text-decoration:none;font-weight:700}',
      '.capa{margin:0 0 1.6em;border:2px solid var(--linha)}',
      '.capa img{width:100%;height:auto;display:block}',
      '.capa figcaption{padding:8px 12px;background:var(--bloco);color:var(--suave);font-size:.86em}',
      '.ampliar{display:block;line-height:0;text-decoration:none;cursor:zoom-in}',
      '.galeria{margin:2.2em 0}',
      '.cartoes{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:20px}',
      '.cartao{margin:0;background:var(--caixa);border:2px solid var(--linha);padding:12px}',
      '.cartao-capa{display:block;line-height:0;margin:0 0 .6em}',
      '.cartao-capa img{width:100%;height:auto;display:block}',
      '.cartao-titulo{font-size:1.05em;line-height:1.3;margin:0 0 .2em;font-weight:700}',
      '.cartao-titulo a{text-decoration:none;color:var(--tinta)}',
      '.cartao .meta{margin:0 0 .3em}',
      '.cartao .resumo{margin:0;font-size:.92em;color:var(--suave)}',
      // --- A CORRENTE: cada bloco ligado ao anterior por um elo -------------
      // O elo é `::before` do bloco de baixo, posicionado no espaço que a
      // margem abre. `position:relative` no `li` é o que o prende; sem ele o
      // elo iria parar ao canto da página.
      '.lista-artigos{list-style:none;margin:0;padding:0}',
      '.lista-artigos li{position:relative;margin:0 0 var(--elo-h);padding:16px 18px;background:var(--caixa);border:2px solid var(--linha);border-left:5px solid var(--acento)}',
      '.lista-artigos li+li::before{content:"";display:var(--elo);position:absolute;left:24px;top:calc(-1 * var(--elo-h));width:3px;height:var(--elo-h);background:var(--acento)}',
      '.lista-artigos h2{margin:0 0 .2em;font-size:1.2em}',
      '.lista-artigos h2 a{text-decoration:none;color:var(--tinta)}',
      '.lista-artigos time{color:var(--suave);font-family:var(--mono);font-size:.85em}',
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
      '.ultimos{margin-top:2.6em;padding-top:1.2em;border-top:2px solid var(--linha)}',
      '.ultimos h2{margin-top:0}',
      '.vazio{color:var(--suave)}',
      '.rodape{max-width:var(--largura);margin:0 auto;padding:16px 20px 40px;border-top:2px solid var(--linha);color:var(--suave);font-size:.86em}',
      '.apoie h2{font-size:1.05em;margin:0 0 .3em;color:var(--tinta)}',
      '.apoie code{font-size:.95em}',
      '.credito{margin:1em 0 0}',
      ''
    ].join('\n');
  }

  return Object.freeze({ manifesto, templates, css, resolver });
})();
Temas.registar(TemaSatoshi);
