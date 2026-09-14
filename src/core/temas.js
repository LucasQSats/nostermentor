/* core/temas.js — o REGISTRO de temas (12; TEMAS.md §3 e §11). É a única
   porta entre o core e os temas: cada arquivo `src/tema/<id>/tema.js`
   regista-se ao carregar (o core carrega antes dos temas — 15 §2), e o
   gerador escolhe pelo `site.theme.id` (13 §3). Id desconhecido cai no
   Padrão — um site cujo tema não vem com esta versão do app continua a
   publicar, com o tema que existe, e a aba Aparência diz isso de frente.
   `resolver` é o validador genérico de opções que os temas usam (TEMAS.md §6):
   compara cada valor com o manifesto e descarta o que não bate. Continua a
   ser o TEMA que o chama e que o exporta — o core não conhece nome nenhum. */
const Temas = (function () {
  'use strict';
  const lista = [];
  const RE_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  const RE_COR = /^#[0-9a-fA-F]{6}$/;

  // --- os MOLDES BASE (TEMAS.md §2 e §4) -----------------------------------
  // 2026-09-05 — os oito moldes viviam copiados dentro de cada tema. Com
  // quatro temas era repetição tolerável; com vinte e um, são vinte e uma
  // cópias das mesmas noventa linhas de HTML, e a promessa da TEMAS.md §2 ("o tema mais
  // simples é um tema só de CSS") obrigava na prática a copiar tudo à mão.
  // Passam a viver aqui, num lugar só, e um tema escreve:
  //
  //     const templates = Object.freeze(Object.assign({}, Temas.moldes,
  //       { pagina: oMeuMoldeDePagina }));   // troca só o que quiser
  //
  // ⚠️ Isto NÃO torna o molde propriedade do core: o tema continua a exportar
  // os seus `templates`, e quem os escolhe é ele. O que o core oferece é um
  // ponto de partida — o mesmo HTML que o tema Padrão sempre produziu, byte
  // a byte, para que o `padrao` continue a gerar exatamente os mesmos
  // arquivos (13 §5.2: mudar um byte aqui muda o sha256 de toda página
  // publicada por todos os sites que usem estes moldes).
  // ⚠️ E é por isso que mexer num molde daqui é mexer em MUITOS temas de uma
  // vez (os que não trocam aquele molde): qualquer alteração obriga a subir a
  // `version` de cada tema que o use. ⚠️ Acrescentar um molde NOVO é outra
  // coisa e é seguro desde 2026-09-12 — `Temas.molde` dá reserva a ele, e um
  // tema que não o conheça passa a receber este.
  // ⚠️ Quantos temas herdam cada molde NÃO se deduz da leitura: é medido. Em
  // 2026-09-12, 18 dos 22 partem do jogo do core (alguns trocando um molde ou
  // outro) e quatro enumeram os oito moldes próprios.


  // Layout de toda página HTML. Contexto (todo pré-calculado pelo gerador —
  // logic-less): lang, titulo_pagina, descricao, site_titulo, logo {src, alt,
  // largura, altura} | null, menu[] {href, rotulo, externo, atual}, conteudo
  // (HTML já sanitizado), doacoes {lightning_address} | null, credito (bool).
  // 38 — o logo SUBSTITUI o título no cabeçalho e o título vai para o `alt`:
  // o leitor vê a marca, o buscador e o leitor de tela continuam a ler o nome
  // do site (03 §1.1). Sem logo, o cabeçalho é o texto de sempre.
  const layout = [
    '<!doctype html>',
    '<html lang="{{lang}}">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>{{titulo_pagina}}</title>',
    '{{#descricao}}<meta name="description" content="{{descricao}}">',
    // O ícone da aba do navegador de quem lê o site. Vive no molde
    // COMPARTILHADO, e uma linha aqui vale para todo tema que herde este
    // `layout`. ⚠️⚠️ QUE NÃO SÃO TODOS, e a linha que aqui esteve até
    // 2026-09-12 ("nenhum dos 21 temas substitui `layout`") era FALSA: quatro
    // temas têm layout próprio — `diario`, `jornal`, `moderno` e
    // `nostermentor` —, e foi exatamente assim que o ícone da aba serviu 18 de
    // 21 sem erro nenhum. A RESERVA de `Temas.molde`
    // resolve o caso de um molde que FALTA por inteiro, mas não este: quem
    // substitui o `layout` o substitui com o conteúdo que copiou no dia, e uma
    // linha nova aqui não chega lá. Tema de terceiro que substitua o `layout`
    // tem de repetir esta linha, ou o site sai sem ícone (TEMAS.md §2).
    // Sem ícone escolhido, `favicon` é nulo e não sai `<link>` nenhum: um
    // `<link>` para o vazio custaria um pedido a cada leitor.
    '{{/descricao}}{{#favicon}}<link rel="icon" href="{{src}}"{{#tipo}} type="{{tipo}}"{{/tipo}}>',
    '{{/favicon}}<link rel="stylesheet" href="/tema/estilo.css">',
    '</head>',
    '<body>',
    '<header class="cabecalho">',
    '{{#logo}}<a class="marca marca-logo" href="/index.html"><img src="{{src}}" alt="{{alt}}"{{#largura}} width="{{largura}}" height="{{altura}}"{{/largura}}></a>',
    '{{/logo}}{{^logo}}<a class="marca" href="/index.html">{{site_titulo}}</a>',
    '{{/logo}}<nav class="menu" aria-label="Menu">{{#menu}}<a href="{{href}}"{{#externo}} rel="external noopener noreferrer"{{/externo}}{{#atual}} aria-current="page"{{/atual}}>{{rotulo}}</a>{{/menu}}</nav>',
    '</header>',
    '<main class="principal">',
    '{{{conteudo}}}',
    '</main>',
    '<footer class="rodape">',
    '{{#doacoes}}<section class="apoie"><h2>Apoie este site</h2><p>Endereço Lightning: <code>{{lightning_address}}</code></p></section>',
    '{{/doacoes}}{{#credito}}<p class="credito">Publicado com Nostermentor</p>',
    '{{/credito}}</footer>',
    '</body>',
    '</html>',
    ''
  ].join('\n');

  // Página fixa. Contexto: titulo, corpo (HTML sanitizado), ultimos
  // {blog_titulo, blog_href, artigos[] {href, titulo, data, data_iso}} | null,
  // capa {src, alt, largura, altura, legenda} | null.
  // 35 — a capa CHEGA aqui e este tema não a desenha, de propósito: a decisão
  // do dono (2026-08-31) é que ela seja dado para os temas que virão. Um tema
  // que a queira só precisa de acrescentar o bloco `{{#capa}}`.
  const pagina = [
    '<article class="pagina">',
    '<h1>{{titulo}}</h1>',
    '{{{corpo}}}',
    '</article>',
    '{{#ultimos}}<section class="ultimos">',
    '<h2>{{blog_titulo}}</h2>',
    '<ul class="lista-artigos">{{#artigos}}<li><a href="{{href}}">{{titulo}}</a> <time datetime="{{data_iso}}">{{data}}</time></li>',
    '{{/artigos}}</ul>',
    '<p><a href="{{blog_href}}">Todos os artigos</a></p>',
    '</section>',
    '{{/ultimos}}',
    ''
  ].join('\n');

  // Artigo. Contexto: titulo, data, data_iso, tem_tags, tags[] {nome},
  // capa {src, alt, largura, altura, legenda} | null, corpo.
  const artigo = [
    '<article class="artigo">',
    '<h1>{{titulo}}</h1>',
    '<p class="meta"><time datetime="{{data_iso}}">{{data}}</time>{{#tem_tags}} · {{#tags}}{{#href}}<a class="etiqueta" href="{{href}}">{{nome}}</a>{{/href}}{{^href}}<span class="etiqueta">{{nome}}</span>{{/href}} {{/tags}}{{/tem_tags}}</p>',
    '{{#capa}}<figure class="capa"><a class="ampliar" href="{{src}}" target="_blank" rel="noopener"><img src="{{src}}" alt="{{alt}}"{{#largura}} width="{{largura}}" height="{{altura}}"{{/largura}}></a>{{#legenda}}<figcaption>{{legenda}}</figcaption>{{/legenda}}</figure>',
    '{{/capa}}{{{corpo}}}',
    '</article>',
    ''
  ].join('\n');

  // Listagem do blog. Contexto: blog_titulo, tem_artigos, artigos[]
  // {href, titulo, data, data_iso, resumo}.
  const blog = [
    '<section class="blog">',
    '<h1>{{blog_titulo}}</h1>',
    '{{^tem_artigos}}<p class="vazio">Nenhum artigo ainda.</p>',
    '{{/tem_artigos}}<ul class="lista-artigos">{{#artigos}}<li><h2><a href="{{href}}">{{titulo}}</a></h2><p class="meta"><time datetime="{{data_iso}}">{{data}}</time></p>{{#resumo}}<p class="resumo">{{resumo}}</p>{{/resumo}}</li>',
    '{{/artigos}}</ul>',
    '</section>',
    ''
  ].join('\n');

  // 40 — a página de uma etiqueta: `/blog/etiqueta/<slug>.html`. Contexto:
  // etiqueta (o nome a mostrar), blog_titulo, blog_href, tem_artigos,
  // artigos[] {href, titulo, data, data_iso, resumo}. É a listagem do blog
  // filtrada — de propósito com a mesma classe `.blog`, para um tema que
  // desenhe a listagem receber esta de graça.
  const etiqueta = [
    '<section class="blog etiqueta-pagina">',
    '<h1>Etiqueta: {{etiqueta}}</h1>',
    '{{^tem_artigos}}<p class="vazio">Nenhum artigo com esta etiqueta.</p>',
    '{{/tem_artigos}}<ul class="lista-artigos">{{#artigos}}<li><h2><a href="{{href}}">{{titulo}}</a></h2><p class="meta"><time datetime="{{data_iso}}">{{data}}</time></p>{{#resumo}}<p class="resumo">{{resumo}}</p>{{/resumo}}</li>',
    '{{/artigos}}</ul>',
    '<p><a href="{{blog_href}}">{{blog_titulo}}</a></p>',
    '</section>',
    ''
  ].join('\n');

  // 37 — o CTA. Contexto: texto, href, externo. É LINK com aparência de botão:
  // o gerador já validou que o href é do próprio site ou http(s) (nada aqui
  // passa pelo DOMPurify, porque molde de tema é dado do app, não do dono).
  const botao = [
    '<p class="cta"><a class="botao" href="{{href}}"{{#externo}} rel="external noopener noreferrer"{{/externo}}>{{texto}}</a></p>',
    ''
  ].join('\n');

  // 30 — a galeria de artigos, o bloco que o marcador `[[artigos: …]]` produz.
  // Contexto: tem_artigos, artigos[] {href, titulo, data, data_iso, resumo,
  // capa {src, alt, largura, altura, href} | null}. Sem JS: é grade CSS e
  // links (clicável sim, carrossel não — 06 §5.3.2 (c)).
  const galeria = [
    '<section class="galeria">',
    '{{^tem_artigos}}<p class="vazio">Nenhum artigo ainda.</p>',
    '{{/tem_artigos}}<ul class="cartoes">{{#artigos}}<li class="cartao">{{#capa}}<a class="cartao-capa" href="{{href}}"><img src="{{src}}" alt="{{alt}}"{{#largura}} width="{{largura}}" height="{{altura}}"{{/largura}} loading="lazy"></a>',
    '{{/capa}}<h3 class="cartao-titulo"><a href="{{href}}">{{titulo}}</a></h3><p class="meta"><time datetime="{{data_iso}}">{{data}}</time></p>{{#resumo}}<p class="resumo">{{resumo}}</p>{{/resumo}}</li>',
    '{{/artigos}}</ul>',
    '</section>',
    ''
  ].join('\n');

  // Stub de redirecionamento para caminhos antigos (13 §4.0 aliases; L1 de 08).
  // Contexto: lang, titulo, destino.
  const alias = [
    '<!doctype html>',
    '<html lang="{{lang}}">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta http-equiv="refresh" content="0; url={{destino}}">',
    '<title>{{titulo}}</title>',
    '</head>',
    '<body>',
    '<p>Esta página mudou de endereço: <a href="{{destino}}">{{destino}}</a></p>',
    '</body>',
    '</html>',
    ''
  ].join('\n');

  // 61 — o bloco de CONTATOS, o que o marcador `[[contatos]]` produz. Contexto:
  // titulo (string ou '' — sem ele não sai cabeçalho nenhum), itens[] {tipo,
  // rotulo, texto, href | '', externo, codigo | ''}. O gerador já montou cada
  // link e já o passou por `Gerador.hrefSeguro`: aqui não se decide nada.
  // ⚠️ SEM ÍCONE, de propósito e com razão medida (plano §3.4): no Tor Browser
  // "Muito seguro" todo SVG é desligado (P41 do 08), logo um ícone SVG
  // desapareceria justamente para o leitor mais cauteloso — e ícones em PNG
  // seriam oito arquivos publicados a mais.
  // ⚠️ E sem CSS novo em tema nenhum: são `<ul>`, `<li>`, `<a>` e `<code>`, que
  // os 22 temas já desenham. A alternativa — uma classe nova no CSS de cada
  // tema — mudaria os bytes de `/tema/estilo.css` de TODO site publicado e
  // obrigaria a subir a `version` dos 22 (é a conta da Etapa 3). As classes
  // ficam escritas no HTML para o tema que quiser pegá-las (TEMAS.md §5).
  // O Nostr sai em DOBRO — link e texto — porque é o único canal cujo link
  // pode não fazer nada no computador de quem lê (NIP-21 não tem reserva).
  // ⚠️ O `<br>` antes do `<code>` não é estética: num tema com
  // `text-align: justify` (o Jornal), sem ele a linha do link deixa de ser a
  // última do bloco e é ESTICADA — "Meu     endereço     Nostr" com buracos
  // entre as palavras. Visto na captura da página publicada, não num teste.
  const contatos = [
    '<section class="contatos">',
    '{{#titulo}}<h2>{{titulo}}</h2>',
    '{{/titulo}}<ul class="lista-contatos">{{#itens}}<li class="contato contato-{{tipo}}"><span class="contato-canal">{{rotulo}}</span> {{#href}}<a href="{{href}}"{{#externo}} rel="external noopener noreferrer"{{/externo}}>{{texto}}</a>{{/href}}{{^href}}<span class="contato-valor">{{texto}}</span>{{/href}}{{#codigo}}<br><code class="contato-codigo">{{codigo}}</code>{{/codigo}}{{#nota}}<br><small class="contato-nota">{{nota}}</small>{{/nota}}</li>',
    '{{/itens}}</ul>',
    '</section>',
    ''
  ].join('\n');

  // O jogo completo, para `Object.assign({}, Temas.moldes, {…})`.
  const moldes = Object.freeze({ layout, pagina, artigo, blog, etiqueta, alias, botao, galeria, contatos });

  // 56 + 61 — O MOLDE QUE UM TEMA USA, com RESERVA no jogo do core. É uma
  // função e não um acesso direto por uma razão medida em 2026-09-12: quatro
  // dos 22 temas (`diario`, `jornal`, `moderno` e `nostermentor`) não fazem
  // `Object.assign({}, Temas.moldes, {…})` — enumeram os oito moldes um a um,
  // porque foram escritos antes de `Temas.moldes` existir. Um molde NOVO no
  // core simplesmente não existia neles: o `Mustache.render` recebia
  // `undefined` e o bloco saía vazio, sem erro nenhum, justamente nos temas
  // mais trabalhados. É a mesma família do defeito do ícone da aba, que serviu
  // 18 de 21 temas em silêncio.
  // ⚠️ Isto NÃO muda um byte publicado: para os 18 temas que já herdavam o
  // jogo, `tema.templates[nome]` continua sendo o mesmo molde; para os quatro,
  // só passa a existir o que antes faltava. Provado pelo site de exemplo nos
  // 22 temas, nos dois motores.
  function molde(tema, nome) {
    const t = tema && tema.templates;
    const m = t && t[nome];
    return typeof m === 'string' ? m : moldes[nome];
  }

  // o bech32 do NIP-19: "npub1" e mais 58 caracteres do alfabeto do bech32
  const RE_NPUB = /^npub1[023456789acdefghjklmnpqrstuvwxyz]{58}$/;
  function registar(tema) {
    const m = tema && tema.manifesto;
    if (!m || typeof m.id !== 'string' || !RE_ID.test(m.id)) throw new Error('tema sem id válido');
    if (!tema.templates || typeof tema.css !== 'function' || typeof tema.resolver !== 'function') throw new Error('tema incompleto: ' + m.id);
    if (m.exclusivo !== undefined && !(typeof m.exclusivo === 'string' && RE_NPUB.test(m.exclusivo))) throw new Error('tema com "exclusivo" que não é uma npub: ' + m.id);
    if (porId(m.id)) return;
    lista.push(tema);
  }
  function porId(id) { for (const t of lista) if (t.manifesto.id === id) return t; return null; }
  function padrao() { return porId('padrao') || lista[0] || null; }
  // Padrão primeiro; os outros por id (ordem estável, sem locale).
  function todos() { return lista.slice().sort((a, b) => (a.manifesto.id === 'padrao' ? -1 : b.manifesto.id === 'padrao' ? 1 : a.manifesto.id < b.manifesto.id ? -1 : a.manifesto.id > b.manifesto.id ? 1 : 0)); }
  // Os temas que a GALERIA (T12) oferece a quem entrou com esta npub. Um tema
  // com `exclusivo` no manifesto só aparece para a npub escrita nele — é
  // assim que o site oficial do projeto tem um tema que ninguém mais escolhe
  // (decisão do dono, 2026-09-11: "exclusivo e não aparece em mais nenhum
  // lugar"). ⚠️ É a GALERIA que filtra, não o gerador: o tema continua
  // registrado e desenha qualquer site cujo `site.theme.id` o nomeie. Esconder
  // da escolha não é proibir o uso — nem precisa ser, porque o estilo de
  // qualquer site publicado já está à vista de quem o abrir. Os testes que
  // medem os temas (gerador, responsividade) usam `todos()`, e é de
  // propósito: o tema exclusivo passa pelas MESMAS provas que os outros.
  function visiveisPara(npub) { return todos().filter(t => !t.manifesto.exclusivo || t.manifesto.exclusivo === npub); }
  function idDe(site) { const t = site && site.theme; return t && typeof t.id === 'string' ? t.id : 'padrao'; }
  function de(site) { return porId(idDe(site)) || padrao(); }
  function conhecido(site) { return !!porId(idDe(site)); }

  // valor seguro de UMA opção, pelo manifesto (TEMAS.md §6)
  function valor(o, bruto) {
    if (!o) return null;
    if (o.tipo === 'escolha') return o.opcoes.some(x => x[0] === bruto) ? bruto : o.padrao;
    if (o.tipo === 'cor') return (typeof bruto === 'string' && RE_COR.test(bruto)) ? bruto.toLowerCase() : o.padrao;
    if (o.tipo === 'medida') {
      const n = typeof bruto === 'number' ? bruto : parseInt(bruto, 10);
      return (Number.isInteger(n) && n >= o.min && n <= o.max) ? n : o.padrao;
    }
    return o.padrao;
  }
  // → { nome: valor } com TODAS as opções do manifesto resolvidas
  function resolver(options, opcoes) {
    const o = opcoes && typeof opcoes === 'object' ? opcoes : {};
    const saida = {};
    for (const nome of Object.keys(options || {})) saida[nome] = valor(options[nome], o[nome]);
    return saida;
  }

  // --- cor: só aritmética inteira (TEMAS.md §9) ----------------------------
  // Estava copiado dentro de cada tema; com vinte e um temas, passa a viver
  // aqui. NÃO é uma escolha de estilo — é uma regra de correção:
  //  · o dono escolhe uma cor livre e o tema tem de a afastar do fundo até
  //    dar para ler, ou uma cor mal escolhida deixa o site ilegível;
  //  · 125 é o limiar de "brightness difference" da técnica AERT do W3C.
  //    Escolhido por ser calculável só com INTEIROS: o critério da WCAG 2
  //    (contraste 4,5:1) precisa de `Math.pow(x, 2.4)`, cuja precisão a spec
  //    do JS não fixa — e isto entra em arquivo publicado, onde os bytes têm
  //    de bater entre motores (13 §5.2).
  const CLARO = 128;                 // meio da escala: acima disto pede texto preto
  const DISTANCIA_MIN = 125;
  function paraRgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function paraHex(c) { return '#' + c.map(n => n.toString(16).padStart(2, '0')).join(''); }
  function brilho(c) { return Math.round((299 * c[0] + 587 * c[1] + 114 * c[2]) / 1000); }
  function misturar(a, b, p) { return [0, 1, 2].map(i => Math.round((a[i] * (100 - p) + b[i] * p) / 100)); }
  // Afasta o acento do fundo em passos de 5% até dar para ler. Determinístico
  // e limitado: no pior caso devolve o extremo (preto ou branco).
  function legivelSobre(acento, fundo) {
    const alvo = brilho(fundo) >= CLARO ? [0, 0, 0] : [255, 255, 255], bf = brilho(fundo);
    for (let p = 0; p <= 100; p += 5) { const c = misturar(acento, alvo, p); if (Math.abs(brilho(c) - bf) >= DISTANCIA_MIN) return c; }
    return alvo;
  }
  // Texto preto ou branco POR CIMA de uma cor cheia (botões, etiquetas).
  function textoSobre(c) { return brilho(c) >= CLARO ? '#111111' : '#ffffff'; }
  // #rrggbb já legível sobre um fundo #rrggbb — o atalho que os temas usam.
  function acentoLegivel(hexAcento, hexFundo) { return paraHex(legivelSobre(paraRgb(hexAcento), paraRgb(hexFundo))); }
  const cor = Object.freeze({ paraRgb, paraHex, brilho, misturar, legivelSobre, textoSobre, acentoLegivel, CLARO, DISTANCIA_MIN });

  // --- a memória de opções por tema (decisão dele, 2026-09-05) --------------
  // Trocar de tema zera `site.theme.options` — as opções são do tema, não do
  // site (TEMAS.md §3). Isso fazia perder os ajustes só por espiar outro tema.
  // Passa a haver uma GAVETA: ao sair de um tema guarda-se o que ele tinha; ao
  // voltar, devolve-se.
  //
  // ⚠️ Onde vive, e porquê: em `site.theme_memory`, que é campo LOCAL do
  // registro `site` — **nunca sai no `site.json` publicado** (13 §5.2 lista o
  // que a rede recebe, e isto não está lá). Guardar na rede os ajustes de
  // temas que o dono NÃO usa seria publicar dado inútil e alargar a superfície
  // à toa. Vai no BACKUP (decisão dele: "no backup, junto com o site"), que é
  // o que faz a memória sobreviver ao Tails desligar e viajar para outra
  // máquina.
  // ⚠️ Tem de ser MAIOR que o número de temas que o app traz, ou a gaveta
  // enche e passa a descartar ajustes em silêncio, por ordem alfabética de id
  // (o `.sort().slice()` abaixo). Com 21 temas em 2026-09-05, o antigo valor
  // de 20 já era alcançável só por o dono espiar todos os temas uma vez.
  const MAX_TEMAS_LEMBRADOS = 60;

  // → { <id do tema>: { <opção>: valor } }, já pela lista branca
  function memoriaDe(site) {
    const m = site && site.theme_memory;
    if (!m || typeof m !== 'object') return {};
    const saida = {};
    for (const id of Object.keys(m).sort().slice(0, MAX_TEMAS_LEMBRADOS)) {
      if (!RE_ID.test(id)) continue;
      const o = SiteJson.lerOpcoesTema(m[id]);
      if (Object.keys(o).length) saida[id] = o;
    }
    return saida;
  }

  // A troca de tema, num lugar só: guarda o que o tema que sai tinha, devolve
  // o que o tema que entra tinha da última vez. Devolve o `theme` novo e a
  // gaveta nova — quem grava é a tela.
  // ⚠️ Guarda-se pelo id do tema que ESTÁ no `site`, mesmo que este app não o
  // conheça: um dia o tema volta a existir e os ajustes ainda lá estão.
  function trocar(site, tema) {
    const antigo = idDe(site);
    const novo = tema.manifesto.id;
    const memoria = memoriaDe(site);
    if (antigo !== novo) {
      const opcoes = SiteJson.lerOpcoesTema(site && site.theme && site.theme.options);
      if (Object.keys(opcoes).length) memoria[antigo] = opcoes;
      else delete memoria[antigo];
    }
    // Ficar no mesmo tema não mexe em nada — nem na versão gravada, que é a do
    // tema com que o site foi publicado.
    if (antigo === novo) return { theme: site.theme, theme_memory: memoria, lembrou: false };
    const guardadas = memoria[novo] || {};
    delete memoria[novo];              // saiu da gaveta: está em uso outra vez
    return { theme: { id: novo, version: tema.manifesto.version, options: guardadas },
      theme_memory: memoria, lembrou: Object.keys(guardadas).length > 0 };
  }

  return Object.freeze({ registar, porId, padrao, todos, visiveisPara, idDe, de, conhecido, resolver, moldes, molde, cor, memoriaDe, trocar, MAX_TEMAS_LEMBRADOS });
})();
