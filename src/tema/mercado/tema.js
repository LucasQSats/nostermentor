/* tema/mercado/tema.js — MERCADO: o jornal económico (12; TEMAS.md). Papel
   salmão, tinta azul-marinho, rótulos em versalete espaçado e — o que
   nenhum outro tema faz — TABELAS tratadas a sério: cabeçalho destacado,
   linhas alternadas e algarismos de largura fixa, para as colunas de números
   alinharem uma debaixo da outra.

   Troca dois moldes base (`blog` e `etiqueta`): a data passa para a frente do
   título, como numa folha de cotações, em vez de vir depois. O resto é o jogo
   base (`Temas.moldes`). Nenhum recurso externo (02 G.2.4), letras do
   sistema, só aritmética inteira na cor (TEMAS.md §9). */
const TemaMercado = (function () {
  'use strict';

  const options = Object.freeze({
    papel: Object.freeze({ tipo: 'escolha', rotulo: 'Papel', padrao: 'salmao',
      opcoes: Object.freeze([['branco', 'Branco'], ['creme', 'Creme'], ['salmao', 'Salmão']]),
      apoio: 'O salmão é o papel dos jornais de economia — vinca o assunto antes de se ler uma linha.' }),
    cor_tinta: Object.freeze({ tipo: 'cor', rotulo: 'Cor da tinta', padrao: '#123a5e',
      apoio: 'Títulos, links e o filete do cabeçalho.' }),
    numeros: Object.freeze({ tipo: 'escolha', rotulo: 'Algarismos', padrao: 'tabulares',
      opcoes: Object.freeze([['normais', 'Normais'], ['tabulares', 'De largura fixa']]),
      apoio: 'De largura fixa, as colunas de números de uma tabela ficam alinhadas.' }),
    zebra: Object.freeze({ tipo: 'escolha', rotulo: 'Linhas alternadas nas tabelas', padrao: 'sim',
      opcoes: Object.freeze([['nao', 'Não'], ['sim', 'Sim']]) }),
    tamanho_texto: Object.freeze({ tipo: 'escolha', rotulo: 'Tamanho do texto', padrao: 'medio',
      opcoes: Object.freeze([['pequeno', 'Pequeno'], ['medio', 'Médio'], ['grande', 'Grande']]) }),
    largura: Object.freeze({ tipo: 'escolha', rotulo: 'Largura da página', padrao: 'media',
      opcoes: Object.freeze([['estreita', 'Estreita'], ['media', 'Média'], ['larga', 'Larga']]) }),
    altura_logo: Object.freeze({ tipo: 'medida', rotulo: 'Altura do logo', padrao: 40, min: 24, max: 96, passo: 2, unidade: 'px' })
  });

  const manifesto = Object.freeze({ id: 'mercado', version: 1, nome: 'Mercado', autor: 'Nostermentor', engine_min: 1, options: options });

  const lista = '<ul class="lista-artigos">{{#artigos}}<li><p class="meta"><time datetime="{{data_iso}}">{{data}}</time></p><h2><a href="{{href}}">{{titulo}}</a></h2>{{#resumo}}<p class="resumo">{{resumo}}</p>{{/resumo}}</li>\n{{/artigos}}</ul>';

  const blog = [
    '<section class="blog">',
    '<h1>{{blog_titulo}}</h1>',
    '{{^tem_artigos}}<p class="vazio">Nenhuma publicação ainda.</p>',
    '{{/tem_artigos}}' + lista,
    '</section>',
    ''
  ].join('\n');

  const etiqueta = [
    '<section class="blog etiqueta-pagina">',
    '<h1>Etiqueta: {{etiqueta}}</h1>',
    '{{^tem_artigos}}<p class="vazio">Nenhuma publicação com esta etiqueta.</p>',
    '{{/tem_artigos}}' + lista,
    '<p><a href="{{blog_href}}">{{blog_titulo}}</a></p>',
    '</section>',
    ''
  ].join('\n');

  const templates = Object.freeze(Object.assign({}, Temas.moldes, { blog, etiqueta }));
  function resolver(opcoes) { return Temas.resolver(options, opcoes); }

  const PAPEIS = {
    branco: { papel: '#ffffff', tinta: '#1b232b', suave: '#5d6873', linha: '#d3d9df', bloco: '#f2f4f6', zebra: '#f6f8fa' },
    creme:  { papel: '#faf6ee', tinta: '#26241d', suave: '#6a6558', linha: '#ddd5c4', bloco: '#f0ebdf', zebra: '#f4efe4' },
    salmao: { papel: '#fbe9dd', tinta: '#33261f', suave: '#7a6558', linha: '#e2c8b6', bloco: '#f5ddcd', zebra: '#f7e2d3' }
  };
  const TAMANHOS = { pequeno: 16, medio: 17, grande: 19 };
  const LARGURAS = { estreita: 620, media: 700, larga: 900 };
  const SANS = 'system-ui,-apple-system,"Segoe UI",Roboto,Ubuntu,"Noto Sans",sans-serif';

  function css(opcoes) {
    const v = resolver(opcoes);
    const p = PAPEIS[v.papel];
    const C = Temas.cor;
    return [
      '/* Nostermentor — tema Mercado v1. Letras do sistema, nenhum recurso de outro servidor. */',
      ':root{--papel:' + p.papel + ';--tinta:' + p.tinta + ';--suave:' + p.suave + ';--linha:' + p.linha + ';--bloco:' + p.bloco + ';--zebra:' + (v.zebra === 'sim' ? p.zebra : 'transparent') + ';' +
        '--acento:' + v.cor_tinta + ';--acento-legivel:' + C.acentoLegivel(v.cor_tinta, p.papel) + ';--acento-texto:' + C.textoSobre(C.paraRgb(v.cor_tinta)) + ';' +
        '--num:' + (v.numeros === 'tabulares' ? 'tabular-nums' : 'normal') + ';' +
        '--sans:' + SANS + ';--base:' + TAMANHOS[v.tamanho_texto] + 'px;--largura:' + LARGURAS[v.largura] + 'px;--logo-altura:' + v.altura_logo + 'px}',
      '*{box-sizing:border-box}',
      'html{-webkit-text-size-adjust:100%}',
      'body{margin:0;background:var(--papel);color:var(--tinta);font-family:Georgia,"Times New Roman",serif;font-size:var(--base);line-height:1.6;overflow-wrap:anywhere;font-variant-numeric:var(--num)}',
      'a{color:var(--acento-legivel)}',
      'img,video{max-width:100%;height:auto}',
      'code,pre{font-family:ui-monospace,Menlo,Consolas,"Liberation Mono",monospace;font-size:.9em}',
      'pre{overflow:auto;padding:12px;background:var(--bloco);border-left:3px solid var(--acento-legivel)}',
      // A tabela é o que este tema faz melhor: rola dentro de si em telas
      // estreitas (o Markdown não deixa embrulhá-la), com `overflow-wrap:normal`
      // para o motor rolar em vez de esmagar as células (TEMAS.md §7.4).
      'table{display:block;overflow-x:auto;overflow-wrap:normal;margin:0 0 1.6em;border-collapse:collapse;font-variant-numeric:var(--num)}',
      'thead th{border-bottom:2px solid var(--tinta);font-family:var(--sans);font-size:.86em;text-transform:uppercase;letter-spacing:.06em;font-weight:700}',
      'th,td{padding:6px 16px 6px 0;text-align:left;vertical-align:top;border-bottom:1px solid var(--linha)}',
      'tbody tr:nth-child(even){background:var(--zebra)}',
      'blockquote{margin:1.4em 0;padding:0 0 0 1em;border-left:3px solid var(--acento-legivel);color:var(--suave);font-style:italic}',
      // --- a "chapa" do cabeçalho: nome entre filetes -----------------------
      '.cabecalho{max-width:var(--largura);margin:0 auto;padding:24px 20px 10px;display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:8px 24px;border-bottom:3px solid var(--tinta)}',
      '.marca{font-size:1.6em;line-height:1.15;font-weight:700;letter-spacing:-.01em;text-decoration:none;color:var(--tinta)}',
      '.marca-logo{line-height:0;align-self:center}',
      '.marca-logo img{max-height:var(--logo-altura);max-width:100%;width:auto;height:auto;display:block}',
      '.menu{display:flex;flex-wrap:wrap;gap:2px 18px;font-family:var(--sans)}',
      '.menu a{display:inline-block;padding:3px 0;text-decoration:none;font-size:.84em;text-transform:uppercase;letter-spacing:.09em;font-weight:600}',
      '.menu a[aria-current=page]{color:var(--tinta);border-bottom:2px solid var(--acento-legivel)}',
      '.principal{max-width:var(--largura);margin:0 auto;padding:28px 20px 44px}',
      'h1{font-size:1.85em;line-height:1.18;margin:0 0 .35em;font-weight:700;letter-spacing:-.01em}',
      'h2{font-size:1.3em;line-height:1.25;margin:1.6em 0 .4em;font-weight:700}',
      'h3{font-size:.98em;margin:1.4em 0 .35em;font-family:var(--sans);text-transform:uppercase;letter-spacing:.06em;font-weight:700}',
      '.meta{color:var(--suave);font-family:var(--sans);font-size:.82em;text-transform:uppercase;letter-spacing:.1em;margin:0 0 1.4em}',
      '.etiqueta{display:inline-block;padding:2px 8px;background:var(--bloco);border:1px solid var(--linha);font-size:1em;letter-spacing:.06em;text-decoration:none;color:inherit;line-height:1.6;text-transform:none}',
      'a.etiqueta:hover{border-color:var(--acento-legivel);color:var(--acento-legivel)}',
      '.cta{margin:1.6em 0}',
      '.botao{display:inline-block;padding:.55em 1.3em;background:var(--acento);color:var(--acento-texto);text-decoration:none;font-family:var(--sans);font-weight:700;font-size:.92em;text-transform:uppercase;letter-spacing:.08em}',
      '.capa{margin:0 0 1.5em}',
      '.capa img{width:100%;height:auto;display:block}',
      '.capa figcaption{color:var(--suave);font-family:var(--sans);font-size:.82em;padding-top:6px;border-bottom:1px solid var(--linha);padding-bottom:8px}',
      '.ampliar{display:inline-block;line-height:0;text-decoration:none;cursor:zoom-in}',
      '.galeria{margin:2em 0}',
      '.cartoes{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:22px}',
      '.cartao{margin:0;border-top:2px solid var(--tinta);padding-top:10px}',
      '.cartao-capa{display:block;line-height:0;margin:0 0 .5em}',
      '.cartao-capa img{width:100%;height:auto;display:block}',
      // O título do cartão é um `h3`, e o `h3` deste tema é o rótulo de secção
      // (sem serifa, maiúsculas, espaçado). Num cartão isso dá um título
      // comprido todo em caixa alta, pesado de ler — visto na captura de
      // 2026-09-05. Aqui volta a ser texto de leitura.
      '.cartao-titulo{font-size:1.08em;line-height:1.3;margin:0 0 .2em;font-family:inherit;text-transform:none;letter-spacing:normal}',
      '.cartao-titulo a{text-decoration:none}',
      '.cartao .meta{margin:0 0 .3em}',
      '.cartao .resumo{margin:0;font-size:.92em}',
      // a listagem: data primeiro, como numa folha de cotações
      '.lista-artigos{list-style:none;margin:0;padding:0}',
      '.lista-artigos li{margin:0 0 1.3em;padding-bottom:1.3em;border-bottom:1px solid var(--linha)}',
      '.lista-artigos li:last-child{border-bottom:0}',
      '.lista-artigos .meta{margin:0 0 .15em}',
      '.lista-artigos h2{margin:0 0 .2em;font-size:1.2em}',
      '.lista-artigos a,.ultimos p a,.blog>p a,.cartao-titulo a{display:inline-block;padding:3px 0}',
      '.resumo{margin:.2em 0 0;color:var(--suave)}',
      '.ultimos{margin-top:2.4em;padding-top:1.2em;border-top:3px solid var(--tinta)}',
      '.ultimos h2{margin-top:0;font-family:var(--sans);font-size:.9em;text-transform:uppercase;letter-spacing:.12em}',
      '.vazio{color:var(--suave);font-style:italic}',
      '.rodape{max-width:var(--largura);margin:0 auto;padding:16px 20px 36px;border-top:1px solid var(--linha);color:var(--suave);font-family:var(--sans);font-size:.82em}',
      '.apoie h2{font-size:1.05em;margin:0 0 .3em;text-transform:uppercase;letter-spacing:.09em}',
      '.credito{margin:1em 0 0}',
      ''
    ].join('\n');
  }

  return Object.freeze({ manifesto, templates, css, resolver });
})();
Temas.registar(TemaMercado);
