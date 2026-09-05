/* tema/vintage/tema.js — VINTAGE: a página de rosto de um livro de 1900
   (12; TEMAS.md). Simetria central, tinta sépia sobre papel de marfim,
   filete duplo a fechar o cabeçalho e o rodapé, títulos em versalete muito
   espaçado e um florão tipográfico a abrir cada página. É o oposto do
   Jornal, que é assimétrico e em colunas: aqui tudo se organiza à volta de
   um eixo, como numa folha de rosto.

   Pacote de DADOS (TEMAS.md §1): manifesto, os oito moldes base do app
   (`Temas.moldes`) e `css(opcoes)`, função pura das opções. O ornamento é um
   CARACTERE, não uma imagem — nenhum `url()`, nenhum recurso de outro
   servidor (02 G.2.4), e as letras são famílias do sistema. Só aritmética
   inteira na cor (TEMAS.md §9). Sem uma única `@media`. */
const TemaVintage = (function () {
  'use strict';

  const options = Object.freeze({
    papel: Object.freeze({ tipo: 'escolha', rotulo: 'Papel', padrao: 'marfim',
      opcoes: Object.freeze([['marfim', 'Marfim'], ['pergaminho', 'Pergaminho'], ['linho', 'Linho']]),
      apoio: 'O tom do fundo e das linhas, que mudam juntos para o texto nunca ficar apagado.' }),
    cor_tinta: Object.freeze({ tipo: 'cor', rotulo: 'Cor da tinta', padrao: '#5a3e2b',
      apoio: 'Títulos, links e o ornamento. Se a cor ficar perto demais do papel, o site escurece só o texto — a cor cheia continua nos botões.' }),
    ornamento: Object.freeze({ tipo: 'escolha', rotulo: 'Ornamento', padrao: 'florao',
      opcoes: Object.freeze([['nenhum', 'Nenhum'], ['losango', 'Losango'], ['asteriscos', 'Asteriscos'], ['florao', 'Florão']]),
      apoio: 'O sinal impresso acima de cada título. É uma letra, como as outras — não uma imagem.' }),
    versaletes: Object.freeze({ tipo: 'escolha', rotulo: 'Títulos em versalete', padrao: 'sim',
      opcoes: Object.freeze([['nao', 'Não'], ['sim', 'Sim']]),
      apoio: 'Versalete é a maiúscula pequena das folhas de rosto antigas.' }),
    tamanho_texto: Object.freeze({ tipo: 'escolha', rotulo: 'Tamanho do texto', padrao: 'medio',
      opcoes: Object.freeze([['pequeno', 'Pequeno'], ['medio', 'Médio'], ['grande', 'Grande']]) }),
    largura: Object.freeze({ tipo: 'escolha', rotulo: 'Largura da página', padrao: 'media',
      opcoes: Object.freeze([['estreita', 'Estreita'], ['media', 'Média'], ['larga', 'Larga']]) }),
    altura_logo: Object.freeze({ tipo: 'medida', rotulo: 'Altura do logo', padrao: 48,
      min: 28, max: 96, passo: 2, unidade: 'px',
      apoio: 'A largura acompanha sozinha, sem distorcer.' })
  });

  const manifesto = Object.freeze({ id: 'vintage', version: 1, nome: 'Vintage', autor: 'Nostermentor', engine_min: 1, options: options });

  const templates = Temas.moldes;
  function resolver(opcoes) { return Temas.resolver(options, opcoes); }

  const PAPEIS = {
    marfim:      { papel: '#faf6ee', tinta: '#2c2418', suave: '#6f6353', linha: '#d9cdb8', bloco: '#f1e9da' },
    pergaminho:  { papel: '#f3e8d2', tinta: '#33291a', suave: '#736548', linha: '#d3c1a0', bloco: '#eaddc2' },
    linho:       { papel: '#efeade', tinta: '#2a2a22', suave: '#6b6858', linha: '#cfc8b5', bloco: '#e5dfd0' }
  };
  const ORNAMENTOS = { nenhum: '""', losango: '"\\25C6"', asteriscos: '"\\2042"', florao: '"\\2766"' };
  const TAMANHOS = { pequeno: 16, medio: 17, grande: 19 };
  const LARGURAS = { estreita: 600, media: 680, larga: 860 };

  function css(opcoes) {
    const v = resolver(opcoes);
    const p = PAPEIS[v.papel];
    const C = Temas.cor;
    const tinta = C.paraRgb(v.cor_tinta);
    return [
      '/* Nostermentor — tema Vintage v1. Sem fontes remotas, sem imagens: o ornamento é um caractere. */',
      ':root{--papel:' + p.papel + ';--tinta:' + p.tinta + ';--suave:' + p.suave + ';--linha:' + p.linha + ';--bloco:' + p.bloco + ';' +
        '--acento:' + v.cor_tinta + ';--acento-legivel:' + C.acentoLegivel(v.cor_tinta, p.papel) + ';--acento-texto:' + C.textoSobre(tinta) + ';' +
        '--orn:' + ORNAMENTOS[v.ornamento] + ';--versalete:' + (v.versaletes === 'sim' ? 'small-caps' : 'normal') + ';' +
        '--base:' + TAMANHOS[v.tamanho_texto] + 'px;--largura:' + LARGURAS[v.largura] + 'px;--logo-altura:' + v.altura_logo + 'px}',
      '*{box-sizing:border-box}',
      'html{-webkit-text-size-adjust:100%}',
      'body{margin:0;background:var(--papel);color:var(--tinta);font-family:Georgia,"Iowan Old Style","Times New Roman",serif;font-size:var(--base);line-height:1.65;overflow-wrap:anywhere}',
      'a{color:var(--acento-legivel)}',
      'img,video{max-width:100%;height:auto}',
      'code,pre{font-family:ui-monospace,Menlo,Consolas,"Liberation Mono",monospace;font-size:.92em}',
      'pre{overflow:auto;padding:12px;background:var(--bloco);border:1px solid var(--linha)}',
      'table{display:block;overflow-x:auto;overflow-wrap:normal;margin:0 0 1.5em}',
      'th,td{padding:5px 14px 5px 0;text-align:left;vertical-align:top;border-bottom:1px solid var(--linha)}',
      'blockquote{margin:1.6em 1.4em;padding:0;border:0;font-style:italic;text-align:center;color:var(--suave)}',
      // --- a folha de rosto: tudo centrado, fechada por filete duplo --------
      '.cabecalho{max-width:var(--largura);margin:0 auto;padding:38px 20px 16px;text-align:center;border-bottom:3px double var(--linha)}',
      '.marca{display:inline-block;font-size:1.9em;line-height:1.2;font-variant:var(--versalete);letter-spacing:.12em;text-decoration:none;color:var(--tinta)}',
      '.marca-logo{line-height:0;letter-spacing:normal}',
      '.marca-logo img{max-height:var(--logo-altura);max-width:100%;width:auto;height:auto;display:block;margin:0 auto}',
      '.menu{display:flex;flex-wrap:wrap;justify-content:center;gap:2px 22px;margin-top:14px}',
      '.menu a{display:inline-block;padding:3px 0;text-decoration:none;font-variant:small-caps;letter-spacing:.09em;font-size:1.02em}',
      '.menu a[aria-current=page]{color:var(--tinta);text-decoration:underline;text-underline-offset:4px}',
      '.principal{max-width:var(--largura);margin:0 auto;padding:34px 20px 48px}',
      // O florão abre cada página. `content:var(--orn)` — com "Nenhum" a
      // variável é a cadeia vazia e o bloco desaparece sem regra a mais.
      'h1{font-size:1.8em;line-height:1.28;margin:0 0 .35em;text-align:center;font-variant:var(--versalete);letter-spacing:.05em;font-weight:400}',
      'h1::before{content:var(--orn);display:block;font-size:.62em;line-height:1.6;color:var(--acento-legivel);letter-spacing:normal;font-variant:normal}',
      'h2{font-size:1.32em;line-height:1.3;margin:1.6em 0 .4em;font-variant:var(--versalete);letter-spacing:.04em;font-weight:400}',
      'h3{font-size:1.12em;margin:1.4em 0 .4em;font-style:italic;font-weight:400}',
      '.meta{text-align:center;font-style:italic;color:var(--suave);font-size:.92em;margin:0 0 1.8em}',
      '.etiqueta{display:inline-block;padding:2px 10px;border:1px solid var(--linha);font-size:1em;font-style:normal;font-variant:small-caps;letter-spacing:.06em;text-decoration:none;color:inherit;line-height:1.5}',
      'a.etiqueta:hover{border-color:var(--acento-legivel);color:var(--acento-legivel)}',
      '.cta{margin:1.8em 0;text-align:center}',
      '.botao{display:inline-block;padding:.5em 1.5em;border:2px solid var(--acento);background:var(--acento);color:var(--acento-texto);text-decoration:none;font-variant:small-caps;letter-spacing:.09em}',
      '.capa{margin:0 0 1.6em;text-align:center}',
      // ⚠️ A moldura NUNCA pode ser borda nem padding da imagem. Com `box-sizing:border-box`
      // e `max-width:100%`, uma borda e um `padding` no `<img>` saem de dentro
      // da largura disponível e a ALTURA continua a vir da proporção do
      // conteúdo: a caixa desenhada ficava 1,71:1 onde a imagem é 1,78:1 —
      // reprovado pela R4 em 2026-09-05, em todas as telas até 412 px.
      // O `outline` desenha-se FORA da caixa e não entra na sua medida — é o
      // que dá a moldura sem tocar na proporção; a margem abre-lhe espaço.
      '.capa img{display:inline-block;outline:1px solid var(--linha);outline-offset:6px;margin:7px}',
      '.capa figcaption{color:var(--suave);font-size:.88em;font-style:italic;padding-top:8px}',
      '.ampliar{display:inline-block;line-height:0;text-decoration:none;cursor:zoom-in}',
      '.galeria{margin:2em 0}',
      '.cartoes{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:24px}',
      '.cartao{margin:0;text-align:center;border-top:1px solid var(--linha);padding-top:12px}',
      '.cartao-capa{display:block;line-height:0;margin:0 0 .6em}',
      '.cartao-capa img{width:100%;height:auto;display:block}',
      '.cartao-titulo{font-size:1.05em;line-height:1.3;margin:0 0 .2em;font-weight:400;font-variant:var(--versalete);letter-spacing:.03em}',
      '.cartao .meta{margin:0 0 .4em}',
      '.cartao .resumo{margin:0;font-size:.94em}',
      // listagens: cada entrada separada por um filete simples
      '.lista-artigos{list-style:none;margin:0;padding:0}',
      '.lista-artigos li{margin:0 0 1.4em;text-align:center}',
      '.lista-artigos li+li{border-top:1px solid var(--linha);padding-top:1.4em}',
      '.lista-artigos h2{margin:0 0 .2em;font-size:1.22em}',
      '.lista-artigos h2::before{content:none}',
      '.lista-artigos time{color:var(--suave);font-size:.9em;font-style:italic}',
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
      '.resumo{margin:.4em 0 0}',
      '.ultimos{margin-top:2.6em;padding-top:1.6em;border-top:3px double var(--linha)}',
      '.ultimos h2{text-align:center;margin-top:0}',
      '.blog>p{text-align:center}',
      '.vazio{color:var(--suave);text-align:center;font-style:italic}',
      '.rodape{max-width:var(--largura);margin:0 auto;padding:18px 20px 40px;border-top:3px double var(--linha);color:var(--suave);font-size:.88em;text-align:center}',
      '.apoie h2{font-size:1.1em;margin:0 0 .3em;font-variant:small-caps;letter-spacing:.06em}',
      '.apoie h2::before{content:none}',
      '.credito{margin:1em 0 0;font-style:italic}',
      ''
    ].join('\n');
  }

  return Object.freeze({ manifesto, templates, css, resolver });
})();
Temas.registar(TemaVintage);
