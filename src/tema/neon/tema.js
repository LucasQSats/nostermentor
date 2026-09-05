/* tema/neon/tema.js — NEON: o painel de instrumentos (12; TEMAS.md). Fundo
   escuro, uma cor que brilha, filetes finos, rótulos de largura fixa em
   maiúsculas e — a assinatura do tema — os CANTOS CORTADOS na diagonal, como
   numa chapa de metal, feitos com `clip-path` e não com imagem.

   Tema só de CSS: os oito moldes base (`Temas.moldes`). O brilho é
   `text-shadow`, que não ocupa lugar na caixa e por isso não pode empurrar a
   página para o lado (TEMAS.md §7.2 R1). Nenhum recurso externo (02 G.2.4);
   letras do sistema; só aritmética inteira na cor (TEMAS.md §9). */
const TemaNeon = (function () {
  'use strict';

  const options = Object.freeze({
    esquema: Object.freeze({ tipo: 'escolha', rotulo: 'Fundo', padrao: 'carbono',
      opcoes: Object.freeze([['violeta', 'Violeta'], ['abissal', 'Azul abissal'], ['carbono', 'Carbono']]) }),
    cor_destaque: Object.freeze({ tipo: 'cor', rotulo: 'Cor que brilha', padrao: '#22d3ee',
      apoio: 'Títulos, links, filetes e botões. Se ficar perto demais do fundo, o site clareia só o texto.' }),
    brilho: Object.freeze({ tipo: 'escolha', rotulo: 'Brilho', padrao: 'suave',
      opcoes: Object.freeze([['nenhum', 'Nenhum'], ['forte', 'Forte'], ['suave', 'Suave']]),
      apoio: 'O halo ao redor das letras. Forte é bonito e cansa a leitura longa.' }),
    corte: Object.freeze({ tipo: 'medida', rotulo: 'Canto cortado', padrao: 12, min: 0, max: 28, passo: 2, unidade: 'px',
      apoio: 'O tamanho da diagonal que corta o canto das caixas. Com zero, ficam retas.' }),
    grelha: Object.freeze({ tipo: 'escolha', rotulo: 'Grade de fundo', padrao: 'sim',
      opcoes: Object.freeze([['nao', 'Não'], ['sim', 'Sim']]),
      apoio: 'As linhas tênues por trás da página. São desenhadas pelo site, sem imagem.' }),
    tamanho_texto: Object.freeze({ tipo: 'escolha', rotulo: 'Tamanho do texto', padrao: 'medio',
      opcoes: Object.freeze([['pequeno', 'Pequeno'], ['medio', 'Médio'], ['grande', 'Grande']]) }),
    largura: Object.freeze({ tipo: 'escolha', rotulo: 'Largura da página', padrao: 'media',
      opcoes: Object.freeze([['estreita', 'Estreita'], ['media', 'Média'], ['larga', 'Larga']]) }),
    altura_logo: Object.freeze({ tipo: 'medida', rotulo: 'Altura do logo', padrao: 40, min: 24, max: 96, passo: 2, unidade: 'px' })
  });

  const manifesto = Object.freeze({ id: 'neon', version: 1, nome: 'Neon', autor: 'Nostermentor', engine_min: 1, options: options });

  const templates = Temas.moldes;
  function resolver(opcoes) { return Temas.resolver(options, opcoes); }

  const ESQUEMAS = {
    carbono: { fundo: '#0a0c10', tinta: '#d7dee8', suave: '#7b8797', linha: '#1e252f', bloco: '#11151c', grade: 'rgba(120,160,200,.055)' },
    abissal: { fundo: '#050f1d', tinta: '#cfe0f2', suave: '#6e88a6', linha: '#12263c', bloco: '#0a1728', grade: 'rgba(90,160,230,.06)' },
    violeta: { fundo: '#0f0819', tinta: '#e0d5f2', suave: '#8a7aa8', linha: '#241639', bloco: '#160d24', grade: 'rgba(160,110,230,.06)' }
  };
  const BRILHOS = { nenhum: 'none', suave: '0 0 10px', forte: '0 0 20px' };
  const TAMANHOS = { pequeno: 16, medio: 17, grande: 19 };
  const LARGURAS = { estreita: 640, media: 720, larga: 900 };
  const SANS = 'system-ui,-apple-system,"Segoe UI",Roboto,Ubuntu,"Noto Sans",sans-serif';
  const MONO = 'ui-monospace,"SF Mono",Menlo,Consolas,"DejaVu Sans Mono",monospace';
  // O canto cortado, em cima à esquerda e em baixo à direita.
  const CHANFRO = 'polygon(var(--corte) 0,100% 0,100% calc(100% - var(--corte)),calc(100% - var(--corte)) 100%,0 100%,0 var(--corte))';

  function css(opcoes) {
    const v = resolver(opcoes);
    const e = ESQUEMAS[v.esquema];
    const C = Temas.cor;
    const legivel = C.acentoLegivel(v.cor_destaque, e.fundo);
    const grade = v.grelha === 'sim'
      ? 'repeating-linear-gradient(to right,' + e.grade + ' 0 1px,transparent 1px 48px),repeating-linear-gradient(to bottom,' + e.grade + ' 0 1px,transparent 1px 48px)'
      : 'none';
    return [
      '/* Nostermentor — tema Neon v1. Brilho e grade são CSS; nenhuma imagem, nenhuma letra vinda de fora. */',
      ':root{--fundo:' + e.fundo + ';--tinta:' + e.tinta + ';--suave:' + e.suave + ';--linha:' + e.linha + ';--bloco:' + e.bloco + ';' +
        '--acento:' + v.cor_destaque + ';--acento-legivel:' + legivel + ';--acento-texto:' + C.textoSobre(C.paraRgb(v.cor_destaque)) + ';' +
        '--brilho:' + (BRILHOS[v.brilho] === 'none' ? 'none' : BRILHOS[v.brilho] + ' ' + legivel) + ';' +
        '--corte:' + v.corte + 'px;--sans:' + SANS + ';--mono:' + MONO + ';' +
        '--base:' + TAMANHOS[v.tamanho_texto] + 'px;--largura:' + LARGURAS[v.largura] + 'px;--logo-altura:' + v.altura_logo + 'px}',
      '*{box-sizing:border-box}',
      'html{-webkit-text-size-adjust:100%}',
      'body{margin:0;background-color:var(--fundo);background-image:' + grade + ';color:var(--tinta);font-family:var(--sans);font-size:var(--base);line-height:1.68;overflow-wrap:anywhere}',
      'a{color:var(--acento-legivel);text-underline-offset:3px}',
      'img,video{max-width:100%;height:auto}',
      'code,pre{font-family:var(--mono);font-size:.9em}',
      'code{background:var(--bloco);padding:0 4px}',
      'pre{overflow:auto;padding:14px;background:var(--bloco);border:1px solid var(--linha);border-left:3px solid var(--acento-legivel);clip-path:' + CHANFRO + '}',
      'pre code{background:none;padding:0}',
      'table{display:block;overflow-x:auto;overflow-wrap:normal;margin:0 0 1.5em;border-collapse:collapse}',
      'th,td{padding:7px 16px 7px 0;text-align:left;vertical-align:top;border-bottom:1px solid var(--linha)}',
      'thead th{color:var(--acento-legivel);font-family:var(--mono);font-size:.86em;text-transform:uppercase;letter-spacing:.08em}',
      'blockquote{margin:1.5em 0;padding:.2em 0 .2em 1.1em;border-left:2px solid var(--acento-legivel);color:var(--suave)}',
      // --- a barra de instrumentos -----------------------------------------
      '.cabecalho{max-width:var(--largura);margin:0 auto;padding:22px 20px 14px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px 22px;border-bottom:1px solid var(--linha)}',
      '.marca{font-size:1.35em;line-height:1.2;font-weight:700;letter-spacing:.06em;text-transform:uppercase;text-decoration:none;color:var(--acento-legivel);text-shadow:var(--brilho)}',
      '.marca-logo{line-height:0;text-shadow:none}',
      '.marca-logo img{max-height:var(--logo-altura);max-width:100%;width:auto;height:auto;display:block}',
      '.menu{display:flex;flex-wrap:wrap;gap:6px 8px;font-family:var(--mono)}',
      '.menu a{display:inline-block;padding:3px 10px;border:1px solid var(--linha);text-decoration:none;font-size:.82em;text-transform:uppercase;letter-spacing:.09em;line-height:1.7;color:var(--suave);clip-path:' + CHANFRO + '}',
      '.menu a[aria-current=page]{border-color:var(--acento-legivel);color:var(--acento-legivel);text-shadow:var(--brilho)}',
      '.principal{max-width:var(--largura);margin:0 auto;padding:30px 20px 48px}',
      'h1{font-size:1.85em;line-height:1.18;margin:0 0 .4em;font-weight:700;letter-spacing:-.01em;color:var(--acento-legivel);text-shadow:var(--brilho)}',
      'h2{font-size:1.3em;line-height:1.25;margin:1.7em 0 .4em;font-weight:700;color:var(--tinta)}',
      'h3{font-size:1.08em;margin:1.4em 0 .35em;font-weight:700;font-family:var(--mono);text-transform:uppercase;letter-spacing:.06em}',
      '.meta{color:var(--suave);font-family:var(--mono);font-size:.84em;text-transform:uppercase;letter-spacing:.1em;margin:0 0 1.6em}',
      '.etiqueta{display:inline-block;padding:2px 9px;border:1px solid var(--linha);font-size:1em;letter-spacing:.06em;text-decoration:none;color:inherit;line-height:1.6;clip-path:' + CHANFRO + '}',
      'a.etiqueta:hover{border-color:var(--acento-legivel);color:var(--acento-legivel)}',
      '.cta{margin:1.8em 0}',
      '.botao{display:inline-block;padding:.55em 1.5em;background:var(--acento);color:var(--acento-texto);text-decoration:none;font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-size:.94em;clip-path:' + CHANFRO + '}',
      '.capa{margin:0 0 1.6em;clip-path:' + CHANFRO + '}',
      '.capa img{width:100%;height:auto;display:block}',
      '.capa figcaption{padding:8px 12px;background:var(--bloco);color:var(--suave);font-family:var(--mono);font-size:.84em}',
      '.ampliar{display:block;line-height:0;text-decoration:none;cursor:zoom-in}',
      '.galeria{margin:2.2em 0}',
      '.cartoes{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:20px}',
      '.cartao{margin:0;background:var(--bloco);border:1px solid var(--linha);padding:12px;clip-path:' + CHANFRO + '}',
      '.cartao-capa{display:block;line-height:0;margin:0 0 .6em}',
      '.cartao-capa img{width:100%;height:auto;display:block}',
      '.cartao-titulo{font-size:1.05em;line-height:1.3;margin:0 0 .2em;font-weight:700}',
      '.cartao-titulo a{text-decoration:none;color:var(--tinta)}',
      '.cartao .meta{margin:0 0 .3em}',
      '.cartao .resumo{margin:0;font-size:.92em;color:var(--suave)}',
      '.lista-artigos{list-style:none;margin:0;padding:0}',
      '.lista-artigos li{margin:0 0 1.2em;padding:14px;background:var(--bloco);border:1px solid var(--linha);border-left:3px solid var(--acento-legivel);clip-path:' + CHANFRO + '}',
      '.lista-artigos h2{margin:0 0 .2em;font-size:1.16em}',
      '.lista-artigos h2 a{text-decoration:none}',
      '.lista-artigos time{color:var(--suave);font-family:var(--mono);font-size:.84em;letter-spacing:.08em}',
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
      '.resumo{margin:.3em 0 0;color:var(--suave)}',
      '.ultimos{margin-top:2.6em;padding-top:1.2em;border-top:1px solid var(--acento-legivel)}',
      '.ultimos h2{margin-top:0;color:var(--acento-legivel);text-shadow:var(--brilho)}',
      '.vazio{color:var(--suave)}',
      '.rodape{max-width:var(--largura);margin:0 auto;padding:16px 20px 40px;border-top:1px solid var(--linha);color:var(--suave);font-family:var(--mono);font-size:.84em;letter-spacing:.06em}',
      '.apoie h2{font-size:1em;margin:0 0 .3em;color:var(--acento-legivel);text-transform:uppercase;letter-spacing:.1em}',
      '.credito{margin:1em 0 0}',
      ''
    ].join('\n');
  }

  return Object.freeze({ manifesto, templates, css, resolver });
})();
Temas.registar(TemaNeon);
