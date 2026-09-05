/* tema/noturno/tema.js — NOTURNO: o escuro para LER, não para impressionar
   (12; TEMAS.md). Existem outros três temas escuros no app — Terminal, Neon e
   DeFi — e os três são escuros com um efeito por cima. Este não tem efeito
   nenhum: fundo de ardósia, texto quente em vez de branco puro (o branco
   sobre preto "sangra" e cansa), entrelinha larga e uma cor de destaque
   discreta. É o tema de quem lê um texto longo às duas da manhã.

   Tema só de CSS: os oito moldes base (`Temas.moldes`). Nenhum recurso
   externo (02 G.2.4); letras do sistema; só aritmética inteira na cor. */
const TemaNoturno = (function () {
  'use strict';

  const options = Object.freeze({
    esquema: Object.freeze({ tipo: 'escolha', rotulo: 'Fundo', padrao: 'ardosia',
      opcoes: Object.freeze([['carvao', 'Carvão'], ['tinta', 'Azul-tinta'], ['ardosia', 'Ardósia']]) }),
    cor_destaque: Object.freeze({ tipo: 'cor', rotulo: 'Cor de destaque', padrao: '#e0a458',
      apoio: 'Links e botões. Se ficar perto demais do fundo, o site clareia só o texto.' }),
    fonte_texto: Object.freeze({ tipo: 'escolha', rotulo: 'Letra do texto', padrao: 'serifa',
      opcoes: Object.freeze([['sem-serifa', 'Sem serifa'], ['serifa', 'Serifa']]) }),
    entrelinha: Object.freeze({ tipo: 'escolha', rotulo: 'Entrelinha', padrao: 'larga',
      opcoes: Object.freeze([['normal', 'Normal'], ['larga', 'Larga']]),
      apoio: 'O espaço entre as linhas. Larga cansa menos em texto comprido.' }),
    tamanho_texto: Object.freeze({ tipo: 'escolha', rotulo: 'Tamanho do texto', padrao: 'medio',
      opcoes: Object.freeze([['pequeno', 'Pequeno'], ['medio', 'Médio'], ['grande', 'Grande']]) }),
    largura: Object.freeze({ tipo: 'escolha', rotulo: 'Largura da página', padrao: 'media',
      opcoes: Object.freeze([['estreita', 'Estreita'], ['media', 'Média'], ['larga', 'Larga']]) }),
    altura_logo: Object.freeze({ tipo: 'medida', rotulo: 'Altura do logo', padrao: 36, min: 24, max: 96, passo: 2, unidade: 'px' })
  });

  const manifesto = Object.freeze({ id: 'noturno', version: 1, nome: 'Noturno', autor: 'Nostermentor', engine_min: 1, options: options });

  const templates = Temas.moldes;
  function resolver(opcoes) { return Temas.resolver(options, opcoes); }

  // Nenhum destes usa #ffffff no texto de propósito: o branco puro sobre fundo
  // escuro alarga as letras (halação) e torna a leitura longa cansativa.
  const ESQUEMAS = {
    ardosia: { fundo: '#1b1f24', tinta: '#dcd7cc', suave: '#98938a', linha: '#2f353d', bloco: '#232830' },
    carvao:  { fundo: '#1a1a1a', tinta: '#ddd8d0', suave: '#96918a', linha: '#2e2e2e', bloco: '#222222' },
    tinta:   { fundo: '#151c28', tinta: '#d9d9cf', suave: '#8f95a0', linha: '#26303f', bloco: '#1c2432' }
  };
  const FONTES = {
    serifa: 'Georgia,"Iowan Old Style","Times New Roman",serif',
    'sem-serifa': 'system-ui,-apple-system,"Segoe UI",Roboto,Ubuntu,"Noto Sans",sans-serif'
  };
  const TAMANHOS = { pequeno: 17, medio: 18, grande: 20 };
  const LARGURAS = { estreita: 600, media: 680, larga: 820 };
  const ENTRELINHAS = { normal: '1.6', larga: '1.85' };

  function css(opcoes) {
    const v = resolver(opcoes);
    const e = ESQUEMAS[v.esquema];
    const C = Temas.cor;
    return [
      '/* Nostermentor — tema Noturno v1. Letras do sistema, nenhuma imagem, nenhum recurso de outro servidor. */',
      ':root{--fundo:' + e.fundo + ';--tinta:' + e.tinta + ';--suave:' + e.suave + ';--linha:' + e.linha + ';--bloco:' + e.bloco + ';' +
        '--acento:' + v.cor_destaque + ';--acento-legivel:' + C.acentoLegivel(v.cor_destaque, e.fundo) + ';--acento-texto:' + C.textoSobre(C.paraRgb(v.cor_destaque)) + ';' +
        '--fonte:' + FONTES[v.fonte_texto] + ';--entrelinha:' + ENTRELINHAS[v.entrelinha] + ';' +
        '--base:' + TAMANHOS[v.tamanho_texto] + 'px;--largura:' + LARGURAS[v.largura] + 'px;--logo-altura:' + v.altura_logo + 'px}',
      '*{box-sizing:border-box}',
      'html{-webkit-text-size-adjust:100%}',
      'body{margin:0;background:var(--fundo);color:var(--tinta);font-family:var(--fonte);font-size:var(--base);line-height:var(--entrelinha);overflow-wrap:anywhere}',
      'a{color:var(--acento-legivel);text-underline-offset:3px}',
      'img,video{max-width:100%;height:auto}',
      'code,pre{font-family:ui-monospace,Menlo,Consolas,"Liberation Mono",monospace;font-size:.9em}',
      'code{background:var(--bloco);padding:1px 5px}',
      'pre{overflow:auto;padding:16px;background:var(--bloco);border-radius:4px}',
      'pre code{background:none;padding:0}',
      'table{display:block;overflow-x:auto;overflow-wrap:normal;margin:0 0 1.6em}',
      'th,td{padding:8px 18px 8px 0;text-align:left;vertical-align:top;border-bottom:1px solid var(--linha)}',
      'blockquote{margin:1.6em 0;padding:0 0 0 1.2em;border-left:3px solid var(--linha);color:var(--suave);font-style:italic}',
      '.cabecalho{max-width:var(--largura);margin:0 auto;padding:30px 22px 16px;display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:8px 24px;border-bottom:1px solid var(--linha)}',
      '.marca{font-size:1.3em;line-height:1.3;font-weight:700;text-decoration:none;color:var(--tinta);letter-spacing:-.01em}',
      '.marca-logo{line-height:0;align-self:center}',
      '.marca-logo img{max-height:var(--logo-altura);max-width:100%;width:auto;height:auto;display:block}',
      '.menu{display:flex;flex-wrap:wrap;gap:2px 20px}',
      '.menu a{display:inline-block;padding:3px 0;text-decoration:none;font-size:.92em;color:var(--suave)}',
      '.menu a[aria-current=page]{color:var(--tinta)}',
      '.principal{max-width:var(--largura);margin:0 auto;padding:32px 22px 52px}',
      'h1{font-size:1.95em;line-height:1.2;margin:0 0 .4em;font-weight:700;letter-spacing:-.02em}',
      'h2{font-size:1.35em;line-height:1.3;margin:1.9em 0 .45em;font-weight:700}',
      'h3{font-size:1.12em;margin:1.6em 0 .35em;font-weight:700}',
      '.meta{color:var(--suave);font-size:.9em;margin:0 0 1.8em}',
      '.etiqueta{display:inline-block;padding:2px 10px;border:1px solid var(--linha);border-radius:4px;font-size:1em;text-decoration:none;color:inherit;line-height:1.5}',
      'a.etiqueta:hover{border-color:var(--acento-legivel);color:var(--acento-legivel)}',
      '.cta{margin:1.8em 0}',
      '.botao{display:inline-block;padding:.6em 1.5em;border-radius:4px;background:var(--acento);color:var(--acento-texto);text-decoration:none;font-weight:700}',
      '.capa{margin:0 0 1.8em}',
      '.capa img{width:100%;height:auto;display:block;border-radius:4px}',
      '.capa figcaption{color:var(--suave);font-size:.88em;padding-top:8px}',
      '.ampliar{display:block;line-height:0;text-decoration:none;cursor:zoom-in}',
      '.galeria{margin:2.2em 0}',
      '.cartoes{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:22px}',
      '.cartao{margin:0}',
      '.cartao-capa{display:block;line-height:0;margin:0 0 .6em;border-radius:4px;overflow:hidden}',
      '.cartao-capa img{width:100%;height:auto;display:block}',
      '.cartao-titulo{font-size:1.05em;line-height:1.35;margin:0 0 .2em;font-weight:700}',
      '.cartao-titulo a{text-decoration:none;color:var(--tinta)}',
      '.cartao .meta{margin:0 0 .3em}',
      '.cartao .resumo{margin:0;font-size:.93em;color:var(--suave)}',
      '.lista-artigos{list-style:none;margin:0;padding:0}',
      '.lista-artigos li{margin:0 0 1.8em}',
      '.lista-artigos h2{margin:0 0 .1em;font-size:1.24em}',
      '.lista-artigos h2 a{text-decoration:none}',
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
      '.resumo{margin:.2em 0 0;color:var(--suave)}',
      '.ultimos{margin-top:2.8em;padding-top:1.4em;border-top:1px solid var(--linha)}',
      '.ultimos h2{margin-top:0}',
      '.vazio{color:var(--suave)}',
      '.rodape{max-width:var(--largura);margin:0 auto;padding:18px 22px 48px;border-top:1px solid var(--linha);color:var(--suave);font-size:.9em}',
      '.apoie h2{font-size:1.05em;margin:0 0 .3em;color:var(--tinta)}',
      '.credito{margin:1.2em 0 0}',
      ''
    ].join('\n');
  }

  return Object.freeze({ manifesto, templates, css, resolver });
})();
Temas.registar(TemaNoturno);
