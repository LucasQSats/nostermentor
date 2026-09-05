/* tema/manifesto/tema.js — MANIFESTO: o cartaz de uma causa (12; TEMAS.md).
   Cabeçalho em faixa de cor a toda a largura, título de display enorme,
   citações do tamanho de um slogan e muito ar em volta. É o tema para uma
   ideia que se quer espalhar — o oposto do Mínimo, que quer desaparecer.

   Nenhum recurso externo (02 G.2.4): a faixa é um gradiente, as letras são do
   sistema. `css(opcoes)` é função pura das opções e só usa aritmética
   inteira na cor (TEMAS.md §9). Sem uma única `@media` — a faixa alinha-se à
   coluna com `max()`, que é conta, não ponto de quebra. */
const TemaManifesto = (function () {
  'use strict';

  const options = Object.freeze({
    hora: Object.freeze({ tipo: 'escolha', rotulo: 'A faixa do cabeçalho', padrao: 'amanhecer',
      opcoes: Object.freeze([['tinta', 'Tinta (sólida)'], ['entardecer', 'Entardecer'], ['aurora', 'Aurora'], ['amanhecer', 'Amanhecer']]),
      apoio: 'A cor que abre a página. Os três degradês são desenhados pelo site, sem imagem nenhuma.' }),
    cor_destaque: Object.freeze({ tipo: 'cor', rotulo: 'Cor de destaque', padrao: '#b4531a',
      apoio: 'Links, botões e as citações. Se ficar perto demais do fundo, o site escurece só o texto.' }),
    citacoes: Object.freeze({ tipo: 'escolha', rotulo: 'Citações', padrao: 'gigantes',
      opcoes: Object.freeze([['normais', 'Normais'], ['gigantes', 'Gigantes']]),
      apoio: 'Gigantes, uma citação do Markdown vira o slogan da página.' }),
    tamanho_texto: Object.freeze({ tipo: 'escolha', rotulo: 'Tamanho do texto', padrao: 'medio',
      opcoes: Object.freeze([['pequeno', 'Pequeno'], ['medio', 'Médio'], ['grande', 'Grande']]) }),
    largura: Object.freeze({ tipo: 'escolha', rotulo: 'Largura da página', padrao: 'media',
      opcoes: Object.freeze([['estreita', 'Estreita'], ['media', 'Média'], ['larga', 'Larga']]) }),
    altura_logo: Object.freeze({ tipo: 'medida', rotulo: 'Altura do logo', padrao: 52, min: 28, max: 96, passo: 2, unidade: 'px' })
  });

  const manifesto = Object.freeze({ id: 'manifesto', version: 1, nome: 'Manifesto', autor: 'Nostermentor', engine_min: 1, options: options });

  const templates = Temas.moldes;
  function resolver(opcoes) { return Temas.resolver(options, opcoes); }

  // Cada faixa é um par de cores; a segunda é também a do texto do rodapé.
  const FAIXAS = {
    tinta:      { a: '#1f2933', b: '#1f2933', texto: '#ffffff' },
    entardecer: { a: '#7b2d5e', b: '#c04a2f', texto: '#ffffff' },
    aurora:     { a: '#16405c', b: '#2f8f83', texto: '#ffffff' },
    amanhecer:  { a: '#c2410c', b: '#e8a33d', texto: '#22160c' }
  };
  const TAMANHOS = { pequeno: 17, medio: 18, grande: 20 };
  const LARGURAS = { estreita: 620, media: 700, larga: 860 };
  const SANS = 'system-ui,-apple-system,"Segoe UI",Roboto,Ubuntu,"Noto Sans",sans-serif';

  function css(opcoes) {
    const v = resolver(opcoes);
    const f = FAIXAS[v.hora];
    const C = Temas.cor;
    const FUNDO = '#fdfbf7';
    return [
      '/* Nostermentor — tema Manifesto v1. A faixa é um gradiente; letras do sistema, nada vindo de fora. */',
      ':root{--fundo:' + FUNDO + ';--tinta:#1c1b18;--suave:#6b675e;--linha:#e3ded2;--bloco:#f3efe5;' +
        '--faixa-a:' + f.a + ';--faixa-b:' + f.b + ';--faixa-texto:' + f.texto + ';' +
        '--acento:' + v.cor_destaque + ';--acento-legivel:' + C.acentoLegivel(v.cor_destaque, FUNDO) + ';--acento-texto:' + C.textoSobre(C.paraRgb(v.cor_destaque)) + ';' +
        '--citacao:' + (v.citacoes === 'gigantes' ? '1.55em' : '1em') + ';' +
        '--sans:' + SANS + ';--base:' + TAMANHOS[v.tamanho_texto] + 'px;--largura:' + LARGURAS[v.largura] + 'px;--logo-altura:' + v.altura_logo + 'px}',
      '*{box-sizing:border-box}',
      'html{-webkit-text-size-adjust:100%}',
      'body{margin:0;background:var(--fundo);color:var(--tinta);font-family:var(--sans);font-size:var(--base);line-height:1.72;overflow-wrap:anywhere}',
      'a{color:var(--acento-legivel);text-underline-offset:3px}',
      'img,video{max-width:100%;height:auto}',
      'code,pre{font-family:ui-monospace,Menlo,Consolas,"Liberation Mono",monospace;font-size:.9em}',
      'pre{overflow:auto;padding:16px;background:var(--bloco);border-radius:10px}',
      'table{display:block;overflow-x:auto;overflow-wrap:normal;margin:0 0 1.6em}',
      'th,td{padding:8px 16px 8px 0;text-align:left;vertical-align:top;border-bottom:1px solid var(--linha)}',
      // A CITAÇÃO GIGANTE: sem filete à esquerda, sem itálico — é uma frase
      // posta no meio da página, como numa parede.
      'blockquote{margin:1.8em 0;padding:0;border:0;font-size:var(--citacao);line-height:1.28;font-weight:600;color:var(--acento-legivel);letter-spacing:-.01em}',
      'blockquote p{margin:0 0 .4em}',
      // --- a faixa: cor a toda a largura, conteúdo alinhado pela coluna -----
      // `max()` põe o miolo da faixa em cima da coluna de texto sem `@media`:
      // quando a janela é menor que a coluna, ganha o padding mínimo de 20px.
      '.cabecalho{background:linear-gradient(150deg,var(--faixa-a),var(--faixa-b));color:var(--faixa-texto);' +
        'padding:44px max(20px,calc((100% - var(--largura))/2 + 20px)) 34px;display:flex;flex-wrap:wrap;align-items:center;gap:14px 28px}',
      '.marca{font-size:2.2em;line-height:1.08;font-weight:800;letter-spacing:-.02em;text-decoration:none;color:var(--faixa-texto)}',
      '.marca-logo{line-height:0}',
      '.marca-logo img{max-height:var(--logo-altura);max-width:100%;width:auto;height:auto;display:block}',
      '.menu{display:flex;flex-wrap:wrap;gap:4px 20px;margin-left:auto}',
      '.menu a{display:inline-block;padding:3px 0;color:var(--faixa-texto);text-decoration:none;font-weight:600;font-size:.92em;opacity:.88}',
      '.menu a[aria-current=page]{opacity:1;border-bottom:3px solid var(--faixa-texto)}',
      '.principal{max-width:var(--largura);margin:0 auto;padding:44px 20px 60px}',
      'h1{font-size:2.5em;line-height:1.06;margin:0 0 .35em;font-weight:800;letter-spacing:-.028em}',
      'h2{font-size:1.5em;line-height:1.18;margin:1.8em 0 .4em;font-weight:800;letter-spacing:-.018em}',
      'h3{font-size:1.16em;margin:1.5em 0 .35em;font-weight:700}',
      '.meta{color:var(--suave);font-size:.88em;margin:0 0 1.8em;font-weight:600;letter-spacing:.03em}',
      '.etiqueta{display:inline-block;padding:2px 12px;border-radius:999px;background:var(--bloco);font-size:1em;text-decoration:none;color:inherit;line-height:1.6}',
      'a.etiqueta:hover{background:var(--acento);color:var(--acento-texto)}',
      '.cta{margin:2em 0}',
      '.botao{display:inline-block;padding:.7em 1.8em;border-radius:999px;background:var(--acento);color:var(--acento-texto);text-decoration:none;font-weight:700;font-size:1.05em}',
      '.capa{margin:0 0 2em}',
      '.capa img{width:100%;height:auto;display:block;border-radius:12px}',
      '.capa figcaption{color:var(--suave);font-size:.86em;padding-top:8px}',
      '.ampliar{display:block;line-height:0;text-decoration:none;cursor:zoom-in}',
      '.galeria{margin:2.4em 0}',
      '.cartoes{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:26px}',
      '.cartao{margin:0}',
      '.cartao-capa{display:block;line-height:0;margin:0 0 .7em;border-radius:12px;overflow:hidden}',
      '.cartao-capa img{width:100%;height:auto;display:block}',
      '.cartao-titulo{font-size:1.14em;line-height:1.2;margin:0 0 .2em;font-weight:800;letter-spacing:-.015em}',
      '.cartao-titulo a{text-decoration:none}',
      '.cartao .meta{margin:0 0 .3em}',
      '.cartao .resumo{margin:0;font-size:.94em}',
      '.lista-artigos{list-style:none;margin:0;padding:0}',
      '.lista-artigos li{margin:0 0 2em}',
      '.lista-artigos h2{margin:0 0 .15em;font-size:1.35em}',
      '.lista-artigos h2 a{text-decoration:none}',
      '.lista-artigos a,.ultimos p a,.blog>p a,.cartao-titulo a{display:inline-block;padding:3px 0}',
      '.lista-artigos time{color:var(--suave);font-size:.88em;font-weight:600}',
      // ⚠️ `em` COMPÕE: na listagem o `<time>` vive dentro do `<p class="meta">`,
      // que já reduziu o tamanho — reduzir outra vez dava 11,8 px no tema
      // Galeria e 12,0 no Neon, abaixo do piso de 12 (TEMAS.md §7.2 R5),
      // medido em 2026-09-05. Na seção "últimos artigos" o `<time>` é filho
      // direto do `<li>` e a redução acima é a que se quer; daí o escopo.
      '.lista-artigos .meta time{font-size:1em}',
      // A data dentro de uma listagem não é a data de um artigo aberto: ali
      // ela abre espaço antes do texto, aqui separa duas linhas do mesmo
      // item. Sem esta regra herda a margem grande de `.meta` e a lista fica
      // com um buraco entre a data e o resumo — visto na captura, 2026-09-05.
      '.lista-artigos .meta{margin:0 0 .35em}',
      '.resumo{margin:.3em 0 0}',
      '.ultimos{margin-top:3em;padding-top:1.6em;border-top:4px solid var(--acento-legivel)}',
      '.ultimos h2{margin-top:0}',
      '.vazio{color:var(--suave)}',
      '.rodape{max-width:var(--largura);margin:0 auto;padding:22px 20px 48px;border-top:1px solid var(--linha);color:var(--suave);font-size:.88em}',
      '.apoie h2{font-size:1.1em;margin:0 0 .3em;color:var(--tinta)}',
      '.credito{margin:1.2em 0 0}',
      ''
    ].join('\n');
  }

  return Object.freeze({ manifesto, templates, css, resolver });
})();
Temas.registar(TemaManifesto);
