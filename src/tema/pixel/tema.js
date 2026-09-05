/* tema/pixel/tema.js — PIXEL: o computador de 8 bits (12; TEMAS.md). Letra
   de largura fixa, contornos grossos, sombra dura deslocada (sem desfoque) e
   nada arredondado. As imagens saem com os pontos à mostra (`image-rendering:
   pixelated`), como na tela de um monitor antigo.

   Tema só de CSS: os oito moldes base (`Temas.moldes`), sem trocar nenhum.
   A sombra é `box-shadow` sem raio de desfoque — não ocupa lugar na caixa,
   logo não pode empurrar a página para o lado (TEMAS.md §7.2 R1). Nenhum
   recurso externo (02 G.2.4); letras do sistema. */
const TemaPixel = (function () {
  'use strict';

  const options = Object.freeze({
    esquema: Object.freeze({ tipo: 'escolha', rotulo: 'Cores', padrao: 'claro',
      opcoes: Object.freeze([['ceu', 'Céu'], ['escuro', 'Escuro'], ['claro', 'Claro']]) }),
    cor_destaque: Object.freeze({ tipo: 'cor', rotulo: 'Cor de destaque', padrao: '#e02f4e',
      apoio: 'Botões, links e o traço do menu.' }),
    sombra: Object.freeze({ tipo: 'escolha', rotulo: 'Sombra dura', padrao: 'media',
      opcoes: Object.freeze([['nenhuma', 'Nenhuma'], ['pequena', 'Pequena'], ['media', 'Média']]),
      apoio: 'A sombra sem desfoque das telas antigas. Não empurra nada — vive por baixo da caixa.' }),
    pontos: Object.freeze({ tipo: 'escolha', rotulo: 'Imagens com os pontos à mostra', padrao: 'nao',
      opcoes: Object.freeze([['nao', 'Não'], ['sim', 'Sim']]),
      apoio: 'Ao ampliar, a imagem fica quadriculada em vez de borrada. Bom para desenho de pixels, ruim para fotografias.' }),
    tamanho_texto: Object.freeze({ tipo: 'escolha', rotulo: 'Tamanho do texto', padrao: 'medio',
      opcoes: Object.freeze([['pequeno', 'Pequeno'], ['medio', 'Médio'], ['grande', 'Grande']]) }),
    largura: Object.freeze({ tipo: 'escolha', rotulo: 'Largura da página', padrao: 'media',
      opcoes: Object.freeze([['estreita', 'Estreita'], ['media', 'Média'], ['larga', 'Larga']]) }),
    altura_logo: Object.freeze({ tipo: 'medida', rotulo: 'Altura do logo', padrao: 40, min: 24, max: 96, passo: 2, unidade: 'px' })
  });

  const manifesto = Object.freeze({ id: 'pixel', version: 1, nome: 'Pixel', autor: 'Nostermentor', engine_min: 1, options: options });

  const templates = Temas.moldes;
  function resolver(opcoes) { return Temas.resolver(options, opcoes); }

  const ESQUEMAS = {
    claro:  { fundo: '#f4f4ef', tinta: '#141414', suave: '#5a5a52', linha: '#141414', bloco: '#e2e2d8', caixa: '#ffffff' },
    ceu:    { fundo: '#cfe8f7', tinta: '#10203a', suave: '#3f5a7a', linha: '#10203a', bloco: '#b3d9ef', caixa: '#eaf6fd' },
    escuro: { fundo: '#1b1b23', tinta: '#eceaf5', suave: '#9a97ad', linha: '#eceaf5', bloco: '#2a2a36', caixa: '#24242f' }
  };
  const SOMBRAS = { nenhuma: '0 0 0', pequena: '3px 3px 0', media: '5px 5px 0' };
  const TAMANHOS = { pequeno: 15, medio: 16, grande: 18 };
  const LARGURAS = { estreita: 620, media: 740, larga: 900 };
  const MONO = 'ui-monospace,"Courier New",Menlo,Consolas,"DejaVu Sans Mono",monospace';

  function css(opcoes) {
    const v = resolver(opcoes);
    const e = ESQUEMAS[v.esquema];
    const C = Temas.cor;
    return [
      '/* Nostermentor — tema Pixel v1. Letras do sistema, sombras de CSS, nenhuma imagem vinda de fora. */',
      ':root{--fundo:' + e.fundo + ';--tinta:' + e.tinta + ';--suave:' + e.suave + ';--linha:' + e.linha + ';--bloco:' + e.bloco + ';--caixa:' + e.caixa + ';' +
        '--acento:' + v.cor_destaque + ';--acento-legivel:' + C.acentoLegivel(v.cor_destaque, e.fundo) + ';--acento-texto:' + C.textoSobre(C.paraRgb(v.cor_destaque)) + ';' +
        '--sombra:' + SOMBRAS[v.sombra] + ' var(--linha);--pontos:' + (v.pontos === 'sim' ? 'pixelated' : 'auto') + ';' +
        '--mono:' + MONO + ';--base:' + TAMANHOS[v.tamanho_texto] + 'px;--largura:' + LARGURAS[v.largura] + 'px;--logo-altura:' + v.altura_logo + 'px}',
      '*{box-sizing:border-box}',
      'html{-webkit-text-size-adjust:100%}',
      'body{margin:0;background:var(--fundo);color:var(--tinta);font-family:var(--mono);font-size:var(--base);line-height:1.7;overflow-wrap:anywhere}',
      'a{color:var(--acento-legivel);text-underline-offset:3px}',
      'img,video{max-width:100%;height:auto;image-rendering:var(--pontos)}',
      'code{font-family:var(--mono);background:var(--bloco);padding:0 4px}',
      'pre{overflow:auto;padding:12px;background:var(--bloco);border:3px solid var(--linha);box-shadow:var(--sombra)}',
      'pre code{background:none;padding:0}',
      'table{display:block;overflow-x:auto;overflow-wrap:normal;margin:0 0 1.5em;border-collapse:collapse}',
      'th,td{padding:5px 12px;text-align:left;vertical-align:top;border:2px solid var(--linha)}',
      'thead th{background:var(--bloco)}',
      'blockquote{margin:1.4em 0;padding:.7em 1em;border:3px solid var(--linha);background:var(--caixa);box-shadow:var(--sombra)}',
      'blockquote p{margin:0}',
      // --- o cabeçalho como uma caixa de diálogo ----------------------------
      '.cabecalho{max-width:var(--largura);margin:24px auto 0;padding:14px 16px;background:var(--caixa);border:3px solid var(--linha);box-shadow:var(--sombra);display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px 18px}',
      '.marca{font-size:1.3em;line-height:1.2;font-weight:700;text-transform:uppercase;letter-spacing:.02em;text-decoration:none;color:var(--tinta)}',
      '.marca-logo{line-height:0}',
      '.marca-logo img{max-height:var(--logo-altura);max-width:100%;width:auto;height:auto;display:block}',
      '.menu{display:flex;flex-wrap:wrap;gap:8px}',
      '.menu a{display:inline-block;padding:2px 8px;border:2px solid var(--linha);background:var(--fundo);text-decoration:none;font-size:.86em;line-height:1.6;color:var(--tinta)}',
      '.menu a[aria-current=page]{background:var(--acento);color:var(--acento-texto)}',
      '.principal{max-width:var(--largura);margin:0 auto;padding:26px 20px 44px}',
      'h1{font-size:1.55em;line-height:1.25;margin:0 0 .45em;font-weight:700;text-transform:uppercase;letter-spacing:.01em;text-shadow:2px 2px 0 var(--acento-legivel)}',
      'h2{font-size:1.22em;line-height:1.3;margin:1.7em 0 .4em;font-weight:700;text-transform:uppercase}',
      'h3{font-size:1.05em;margin:1.4em 0 .35em;font-weight:700}',
      '.meta{color:var(--suave);font-size:.9em;margin:0 0 1.5em}',
      '.etiqueta{display:inline-block;padding:1px 8px;border:2px solid var(--linha);background:var(--caixa);font-size:1em;text-decoration:none;color:inherit;line-height:1.5}',
      'a.etiqueta:hover{background:var(--acento);color:var(--acento-texto)}',
      '.cta{margin:1.6em 0}',
      '.botao{display:inline-block;padding:.45em 1.2em;border:3px solid var(--linha);background:var(--acento);color:var(--acento-texto);text-decoration:none;font-weight:700;text-transform:uppercase;box-shadow:var(--sombra)}',
      '.capa{margin:0 0 1.5em;border:3px solid var(--linha);background:var(--caixa);box-shadow:var(--sombra)}',
      '.capa img{width:100%;height:auto;display:block}',
      '.capa figcaption{padding:6px 10px;color:var(--suave);font-size:.9em;border-top:3px solid var(--linha)}',
      '.ampliar{display:block;line-height:0;text-decoration:none;cursor:zoom-in}',
      '.galeria{margin:2em 0}',
      '.cartoes{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:20px}',
      '.cartao{margin:0;border:3px solid var(--linha);background:var(--caixa);padding:10px;box-shadow:var(--sombra)}',
      '.cartao-capa{display:block;line-height:0;margin:0 0 .5em;border:2px solid var(--linha)}',
      '.cartao-capa img{width:100%;height:auto;display:block}',
      '.cartao-titulo{font-size:1em;line-height:1.3;margin:0 0 .2em;font-weight:700;text-transform:uppercase}',
      '.cartao-titulo a{text-decoration:none;color:var(--tinta)}',
      '.cartao .meta{margin:0 0 .3em;font-size:.88em}',
      '.cartao .resumo{margin:0;font-size:.9em}',
      '.lista-artigos{list-style:none;margin:0;padding:0}',
      '.lista-artigos li{margin:0 0 1.2em;padding:12px;border:3px solid var(--linha);background:var(--caixa);box-shadow:var(--sombra)}',
      '.lista-artigos h2{margin:0 0 .2em;font-size:1.12em;text-shadow:none}',
      '.lista-artigos h2 a{text-decoration:none;color:var(--tinta)}',
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
      '.resumo{margin:.2em 0 0}',
      '.ultimos{margin-top:2.4em;padding-top:1.2em;border-top:3px solid var(--linha)}',
      '.ultimos h2{margin-top:0}',
      '.vazio{color:var(--suave)}',
      '.rodape{max-width:var(--largura);margin:0 auto;padding:14px 20px 36px;border-top:3px solid var(--linha);color:var(--suave);font-size:.88em}',
      '.apoie h2{font-size:1em;margin:0 0 .3em;color:var(--tinta);text-shadow:none}',
      '.credito{margin:1em 0 0}',
      ''
    ].join('\n');
  }

  return Object.freeze({ manifesto, templates, css, resolver });
})();
Temas.registar(TemaPixel);
