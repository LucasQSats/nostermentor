/* tema/terminal/tema.js — TERMINAL: o site como um console (12; TEMAS.md).
   Tudo em letra de largura fixa, fundo quase preto, um sinal de comando antes
   de cada título, o menu entre parênteses retos e um cursor a piscar… que não
   pisca: o site publicado não tem uma linha de script (02 G.0), e uma
   animação CSS que pisca sem parar é ruído para quem lê. O cursor é um bloco
   parado, e é o suficiente para o gesto se ler.

   Tema só de CSS: usa os oito moldes base (`Temas.moldes`) sem trocar
   nenhum. Os sinais (`$`, `#`, `[`, `]`) são `content` do CSS, não HTML —
   o texto que o leitor de tela lê continua a ser o do dono. Nenhum recurso
   externo (02 G.2.4); letras do sistema. */
const TemaTerminal = (function () {
  'use strict';

  const options = Object.freeze({
    esquema: Object.freeze({ tipo: 'escolha', rotulo: 'Cores do console', padrao: 'noite',
      opcoes: Object.freeze([['ambar', 'Âmbar'], ['fosforo', 'Verde fósforo'], ['noite', 'Noite']]),
      apoio: 'Fundo, texto e comentários mudam juntos. Todas escuras — é um console.' }),
    cor_destaque: Object.freeze({ tipo: 'cor', rotulo: 'Cor de destaque', padrao: '#7ee787',
      apoio: 'O sinal de comando, os links e a barra do bloco de código.' }),
    prompt: Object.freeze({ tipo: 'escolha', rotulo: 'Sinal antes dos títulos', padrao: 'cifrao',
      opcoes: Object.freeze([['nenhum', 'Nenhum'], ['seta', 'Uma seta'], ['cifrao', 'Um cifrão']]) }),
    cursor: Object.freeze({ tipo: 'escolha', rotulo: 'Cursor depois do título', padrao: 'sim',
      opcoes: Object.freeze([['nao', 'Não'], ['sim', 'Sim']]),
      apoio: 'Um bloco parado. Não pisca de propósito: piscar sem parar cansa quem lê e o site não tem script para controlá-lo.' }),
    tamanho_texto: Object.freeze({ tipo: 'escolha', rotulo: 'Tamanho do texto', padrao: 'medio',
      opcoes: Object.freeze([['pequeno', 'Pequeno'], ['medio', 'Médio'], ['grande', 'Grande']]) }),
    largura: Object.freeze({ tipo: 'escolha', rotulo: 'Largura da página', padrao: 'media',
      opcoes: Object.freeze([['estreita', 'Estreita'], ['media', 'Média'], ['larga', 'Larga']]) }),
    altura_logo: Object.freeze({ tipo: 'medida', rotulo: 'Altura do logo', padrao: 36, min: 24, max: 96, passo: 2, unidade: 'px' })
  });

  const manifesto = Object.freeze({ id: 'terminal', version: 1, nome: 'Terminal', autor: 'Nostermentor', engine_min: 1, options: options });

  const templates = Temas.moldes;
  function resolver(opcoes) { return Temas.resolver(options, opcoes); }

  const ESQUEMAS = {
    ambar:   { fundo: '#181410', tinta: '#e8c88a', suave: '#9a7f52', linha: '#3a2f22', bloco: '#211b14' },
    fosforo: { fundo: '#0b1410', tinta: '#b8e6c4', suave: '#5f8f70', linha: '#1e3a2a', bloco: '#111f18' },
    noite:   { fundo: '#0d1117', tinta: '#c9d1d9', suave: '#7d8590', linha: '#26303b', bloco: '#161b22' }
  };
  const PROMPTS = { nenhum: '""', seta: '"\\203A\\A0"', cifrao: '"$\\A0"' };
  const TAMANHOS = { pequeno: 15, medio: 16, grande: 18 };
  const LARGURAS = { estreita: 620, media: 740, larga: 900 };
  const MONO = 'ui-monospace,"SF Mono",Menlo,Consolas,"DejaVu Sans Mono","Liberation Mono",monospace';

  function css(opcoes) {
    const v = resolver(opcoes);
    const e = ESQUEMAS[v.esquema];
    const C = Temas.cor;
    return [
      '/* Nostermentor — tema Terminal v1. Letras do sistema, nenhum recurso de outro servidor, nenhuma animação. */',
      ':root{--fundo:' + e.fundo + ';--tinta:' + e.tinta + ';--suave:' + e.suave + ';--linha:' + e.linha + ';--bloco:' + e.bloco + ';' +
        '--acento:' + v.cor_destaque + ';--acento-legivel:' + C.acentoLegivel(v.cor_destaque, e.fundo) + ';--acento-texto:' + C.textoSobre(C.paraRgb(v.cor_destaque)) + ';' +
        '--prompt:' + PROMPTS[v.prompt] + ';--cursor:' + (v.cursor === 'sim' ? '"\\A0\\2588"' : '""') + ';' +
        '--mono:' + MONO + ';--base:' + TAMANHOS[v.tamanho_texto] + 'px;--largura:' + LARGURAS[v.largura] + 'px;--logo-altura:' + v.altura_logo + 'px}',
      '*{box-sizing:border-box}',
      'html{-webkit-text-size-adjust:100%}',
      // line-height 1.7: em letra de 15 px dá 25,5 px, e é isso que garante os
      // 24 px de alvo de toque a um link dentro de um parágrafo (TEMAS.md §7.2 R3).
      'body{margin:0;background:var(--fundo);color:var(--tinta);font-family:var(--mono);font-size:var(--base);line-height:1.7;overflow-wrap:anywhere}',
      'a{color:var(--acento-legivel);text-underline-offset:3px}',
      'img,video{max-width:100%;height:auto}',
      'code{font-family:var(--mono);background:var(--bloco);padding:0 4px}',
      'pre{overflow:auto;padding:12px 14px;background:var(--bloco);border-left:3px solid var(--acento-legivel)}',
      'pre code{background:none;padding:0}',
      'table{display:block;overflow-x:auto;overflow-wrap:normal;margin:0 0 1.5em;border-collapse:collapse}',
      'th,td{padding:4px 16px 4px 0;text-align:left;vertical-align:top;border-bottom:1px solid var(--linha)}',
      'thead th{color:var(--acento-legivel)}',
      'blockquote{margin:1.4em 0;padding:0 0 0 1em;border-left:3px solid var(--linha);color:var(--suave)}',
      'blockquote p::before{content:"> ";color:var(--suave)}',
      // --- a linha de comando do cabeçalho ---------------------------------
      '.cabecalho{max-width:var(--largura);margin:0 auto;padding:22px 20px 14px;display:flex;flex-wrap:wrap;align-items:baseline;gap:8px 22px;border-bottom:1px solid var(--linha)}',
      '.marca{font-size:1.25em;line-height:1.3;font-weight:700;text-decoration:none;color:var(--tinta)}',
      '.marca::before{content:"~/";color:var(--suave)}',
      '.marca-logo{line-height:0;align-self:center}',
      '.marca-logo::before{content:none}',
      '.marca-logo img{max-height:var(--logo-altura);max-width:100%;width:auto;height:auto;display:block}',
      '.menu{display:flex;flex-wrap:wrap;gap:2px 14px}',
      '.menu a{display:inline-block;padding:3px 0;text-decoration:none;font-size:.94em}',
      '.menu a::before{content:"[";color:var(--suave)}',
      '.menu a::after{content:"]";color:var(--suave)}',
      '.menu a[aria-current=page]{color:var(--tinta);font-weight:700}',
      '.principal{max-width:var(--largura);margin:0 auto;padding:26px 20px 44px}',
      // O sinal de comando e o cursor. `\A0` é o espaço que não quebra: mantém
      // o "$" colado ao título quando ele passa para a linha seguinte.
      'h1{font-size:1.6em;line-height:1.28;margin:0 0 .4em;font-weight:700;letter-spacing:-.01em}',
      'h1::before{content:var(--prompt);color:var(--acento-legivel)}',
      'h1::after{content:var(--cursor);color:var(--acento-legivel)}',
      'h2{font-size:1.24em;line-height:1.3;margin:1.7em 0 .4em;font-weight:700}',
      'h2::before{content:"## ";color:var(--suave)}',
      'h3{font-size:1.06em;margin:1.4em 0 .35em;font-weight:700}',
      'h3::before{content:"### ";color:var(--suave)}',
      '.meta{color:var(--suave);font-size:.92em;margin:0 0 1.5em}',
      '.meta::before{content:"# "}',
      '.etiqueta{display:inline-block;padding:1px 8px;border:1px solid var(--linha);font-size:1em;text-decoration:none;color:var(--suave);line-height:1.6}',
      'a.etiqueta:hover{border-color:var(--acento-legivel);color:var(--acento-legivel)}',
      '.cta{margin:1.6em 0}',
      '.botao{display:inline-block;padding:.45em 1.1em;border:2px solid var(--acento-legivel);color:var(--acento-legivel);text-decoration:none;font-weight:700}',
      '.botao::before{content:"[ "}',
      '.botao::after{content:" ]"}',
      '.capa{margin:0 0 1.5em;border:1px solid var(--linha)}',
      '.capa img{width:100%;height:auto;display:block}',
      '.capa figcaption{padding:6px 10px;color:var(--suave);font-size:.9em;border-top:1px solid var(--linha)}',
      '.ampliar{display:block;line-height:0;text-decoration:none;cursor:zoom-in}',
      '.galeria{margin:2em 0}',
      '.cartoes{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:18px}',
      '.cartao{margin:0;border:1px solid var(--linha);padding:10px}',
      '.cartao-capa{display:block;line-height:0;margin:0 0 .5em}',
      '.cartao-capa img{width:100%;height:auto;display:block}',
      '.cartao-titulo{font-size:1em;line-height:1.35;margin:0 0 .2em;font-weight:700}',
      '.cartao-titulo::before{content:none}',
      '.cartao-titulo a{text-decoration:none}',
      '.cartao .meta{margin:0 0 .3em;font-size:.9em}',
      '.cartao .resumo{margin:0;font-size:.92em;color:var(--suave)}',
      '.lista-artigos{list-style:none;margin:0;padding:0}',
      '.lista-artigos li{margin:0 0 1.3em}',
      '.lista-artigos li::before{content:"- ";color:var(--suave)}',
      '.lista-artigos h2{display:inline;margin:0;font-size:1.06em}',
      '.lista-artigos h2::before{content:none}',
      '.lista-artigos time{color:var(--suave);font-size:.92em}',
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
      '.resumo{margin:.15em 0 0;color:var(--suave)}',
      '.ultimos{margin-top:2.4em;padding-top:1.2em;border-top:1px solid var(--linha)}',
      '.ultimos h2{margin-top:0}',
      '.vazio{color:var(--suave)}',
      '.rodape{max-width:var(--largura);margin:0 auto;padding:14px 20px 36px;border-top:1px solid var(--linha);color:var(--suave);font-size:.9em}',
      '.apoie h2{font-size:1em;margin:0 0 .3em;color:var(--tinta)}',
      '.credito{margin:1em 0 0}',
      '.credito::before{content:"# "}',
      ''
    ].join('\n');
  }

  return Object.freeze({ manifesto, templates, css, resolver });
})();
Temas.registar(TemaTerminal);
