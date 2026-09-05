/* core/gerador.js — Markdown → HTML sanitizado → tema Mustache → bytes
   DETERMINÍSTICOS (13 §5.2, D14 de 04): mesmo conteúdo + mesmo tema = mesmos
   bytes, sempre — sem data de geração, chaves de JSON em ordem fixa, `\n`
   como fim de linha, UTF-8 sem BOM. É o que torna o diff prévio verdadeiro
   (só sobe o que mudou) e o que permite conferir os hashes do manifest.
   Caminhos de 13 §5.1; o que muda quando algo muda (13 §5.3) é consequência
   natural: cada caminho só depende do que aparece nele.
   Todo HTML inline do Markdown passa pelo DOMPurify (13 §4.0): sem
   scripts, sem on*=, sem javascript:, sem iframe/object. Fontes
   consultadas em 2026-08-26: marked 18 (`marked.parse` síncrono, `marked.use`)
   e DOMPurify 3.4.14 (`sanitize`, USE_PROFILES/FORBID_TAGS/FORBID_ATTR;
   `javascript:` e `data:` fora de <img> já barrados pelo ALLOWED_URI_REGEXP
   padrão). Usa o DOM do navegador (DOMPurify/DOMParser) mas não toca no
   painel. Sem rede. */
const Gerador = (function () {
  'use strict';

  const enc = new TextEncoder();
  const RESUMO_MAX = 200;
  // sem referência cruzada em tempo de carga (a ordem dos scripts de core/ é alfabética)
  function caminhoCss() { return Modelo.caminhoDe('tema', 'estilo.css'); }
  function linkCss() { return '<link rel="stylesheet" href="' + caminhoCss() + '">'; }

  // 13 §4.0 — conteúdo é dado, nunca programa (02 G.2.3). <style>/<link>/
  // <meta>/<base> ficam fora porque poderiam puxar recurso remoto (G.2.4:
  // privacidade do leitor). Atributo style inline é permitido (não carrega nada).
  const PURIFY = Object.freeze({
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['iframe', 'object', 'embed', 'style', 'link', 'meta', 'base', 'script'],
    FORBID_ATTR: ['srcdoc']
  });
  let pronto = false;
  const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function escapar(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ESCAPES[c]); }
  function preparar() {
    if (pronto) return;
    marked.use({ gfm: true, breaks: false, async: false });
    // Mustache 4 escapa também `/`, `=` e a crase (`&#x2F;` em todo href) —
    // o HTML padrão só precisa de & < > " ' (medido 2026-08-26)
    Mustache.escape = escapar;
    pronto = true;
  }

  // 06 §4 / 00 §6.2 item 21 (decidido pelo usuário em 2026-08-27): clicar na
  // imagem abre o arquivo em tamanho real, em nova aba. É a resposta ao pedido
  // "imagem em tela cheia" SEM abrir a única exceção que a casa não abre — o
  // site publicado continua sem uma única tag de script (02 G.0; o Tor Browser
  // Safest desliga JS, P22 de 08). Regras:
  //  - a imagem que o dono já linkou à mão ("Inserir com link…",
  //    `[![alt](img)](url)`) fica como está: o link dele ganha. Daí o contador
  //    de profundidade de <a> — <a> dentro de <a> é HTML inválido;
  //  - só vira link o que tem um arquivo a abrir: caminho do próprio site
  //    (/img/…, /media/…) ou http(s). `data:` e qualquer outro esquema passam
  //    intactos;
  //  - string → string, sem DOM: o determinismo entre motores (13 §5.2) vem de
  //    não passar por serializador de navegador nenhum.
  const TAGS_LINK_IMG = /<a\b[^>]*>|<\/a\s*>|<img\b[^>]*>/gi;
  function imagensClicaveis(html) {
    let profundidade = 0;
    return String(html).replace(TAGS_LINK_IMG, function (tag) {
      if (/^<a/i.test(tag)) { profundidade++; return tag; }
      if (/^<\//.test(tag)) { if (profundidade > 0) profundidade--; return tag; }
      if (profundidade > 0) return tag;
      const m = /\bsrc="([^"]*)"/i.exec(tag);
      const src = m ? m[1] : '';
      if (!/^\/[^\/]/.test(src) && !/^https?:\/\//i.test(src)) return tag;
      return '<a class="ampliar" href="' + src + '" target="_blank" rel="noopener">' + tag + '</a>';
    });
  }

  // 30 — MARCADOR DE BLOCOS. Uma linha que seja só `[[nome: argumentos]]` sai
  // do Markdown antes de o `marked` a ver, e o HTML de um molde do tema entra
  // no lugar depois de o DOMPurify passar. A ordem é deliberada:
  //  - ANTES do marked, para o marcador não ser mastigado pela sintaxe (`->`
  //    viraria `-&gt;` e os colchetes podiam ser lidos como link);
  //  - DEPOIS do sanitize, porque o molde é dado do TEMA (02 G.0), como o
  //    layout e a listagem — passá-lo pelo sanitizador seria pedir a ele que
  //    julgasse o próprio app. O preço disto é que NADA vindo do dono pode
  //    chegar cru ao molde: o texto vai por Mustache (que escapa) e o href
  //    passa por `hrefSeguro`, que é a única barreira contra `javascript:`
  //    naquele `<a>` — o DOMPurify não o vai ver.
  // String → string, sem DOM: o determinismo entre motores (13 §5.2) vem de
  // não passar por serializador de navegador nenhum.
  // Marcador em linha não-isolada, ou de nome desconhecido, fica texto: é o
  // que já acontecia e é o que o dono vê na prévia se escrever torto.
  const RE_MARCADOR = /^\[\[\s*([a-z]+)\s*:\s*([\s\S]*?)\s*\]\]$/;
  const BLOCOS = Object.freeze(['botao', 'artigos']);
  function extrairBlocos(md) {
    if (md.indexOf('[[') === -1) return { texto: md, blocos: [], token: '' };
    // O token tem de ser texto que nem o marked nem o DOMPurify tocam (só
    // letras e dígitos) e que não exista já no corpo — daí o alongamento.
    let token = 'nmbloco';
    while (md.indexOf(token) !== -1) token += 'z';
    const linhas = md.split('\n'), blocos = [];
    // ⚠️ Bloco de CÓDIGO fica de fora, e não é detalhe: sem isto, mostrar
    // `[[botao: …]]` como exemplo dentro de ``` era impossível — o marcador
    // seria expandido e um <section> inteiro entraria dentro do <pre>. A
    // própria Ajuda deste app documenta a sintaxe; um dono a explicá-la no seu
    // site tropeçaria nisto no primeiro parágrafo.
    let cerca = null;                      // { char, n } da cerca aberta
    for (let i = 0; i < linhas.length; i++) {
      const linha = linhas[i], t = linha.trim();
      const mc = /^(`{3,}|~{3,})/.exec(t);
      if (mc) {
        const ch = mc[1].charAt(0), n = mc[1].length;
        if (!cerca) cerca = { char: ch, n: n };
        else if (ch === cerca.char && n >= cerca.n) cerca = null;
        continue;
      }
      if (cerca) continue;
      if (/^ {4,}/.test(linha)) continue;  // bloco de código indentado
      const m = RE_MARCADOR.exec(t);
      if (!m || BLOCOS.indexOf(m[1]) === -1) continue;
      blocos.push({ nome: m[1], args: m[2], bruto: t });
      linhas[i] = token + (blocos.length - 1) + 'x';
    }
    if (!blocos.length) return { texto: md, blocos: [], token: '' };
    return { texto: linhas.join('\n'), blocos: blocos, token: token };
  }
  // Só caminho do próprio site (`/algo`) ou http(s). Tudo o resto — incluindo
  // `javascript:`, `data:` e `//outro-host` — é recusado, e o marcador fica
  // texto para o dono ver que está errado.
  function hrefSeguro(u) {
    const s = String(u == null ? '' : u).trim();
    if (/^\/[^\/]/.test(s) || s === '/') return { href: s, externo: false };
    if (/^https?:\/\//i.test(s)) return { href: s, externo: true };
    return null;
  }
  // 37 — `[[botao: Texto -> /destino]]`. A seta considerada é a ÚLTIMA: é mais
  // provável um rótulo com "->" do que um endereço com "->".
  function blocoBotao(ctx, args) {
    const i = String(args).lastIndexOf('->');
    if (i === -1) return null;
    const rotulo = String(args).slice(0, i).trim();
    const destino = hrefSeguro(String(args).slice(i + 2));
    if (!rotulo || !destino) return null;
    return Mustache.render(temaDe(ctx).templates.botao, { texto: rotulo, href: destino.href, externo: destino.externo });
  }
  // 30 — `[[artigos: 6, com-capa, com-resumo, etiqueta=receitas]]`. Cada pedaço
  // é opcional e o que não se reconhece é ignorado (o marcador continua a
  // valer): um erro de escrita não pode fazer sumir a galeria inteira.
  function opcoesArtigos(args) {
    const o = { n: 6, capa: true, resumo: false, etiqueta: null };
    for (const parte of String(args).split(',')) {
      const t = parte.trim();
      if (!t) continue;
      if (/^\d+$/.test(t)) { const n = parseInt(t, 10); if (n >= 1 && n <= 50) o.n = n; continue; }
      if (t === 'com-capa') { o.capa = true; continue; }
      if (t === 'sem-capa') { o.capa = false; continue; }
      if (t === 'com-resumo') { o.resumo = true; continue; }
      if (t === 'sem-resumo') { o.resumo = false; continue; }
      const m = /^etiqueta\s*=\s*([\s\S]+)$/.exec(t);
      if (m) { const sl = Modelo.slug(m[1]); if (sl) o.etiqueta = sl; }
    }
    return o;
  }
  // 32(c) — a galeria serve a MINIATURA guardada, não a foto: uma capa de 7 MB
  // por cartão seria a página inteira do leitor de Tor gasta em imagens. Sem
  // miniatura guardada (mídia antiga), cai na original — é o que existe.
  // `thumb_media_id` chega do site.json, que é DADO da rede (02 G.0): apontar
  // para nada, ou para um vídeo, não pode virar `<img src>` de um vídeo. Sem
  // miniatura utilizável, a original — que é o que existe.
  function fonteDaCapa(ctx, m) {
    const t = m.thumb_media_id ? ctx.porIdMedia.get(m.thumb_media_id) : null;
    return (t && /^image\//.test(String(t.mime || '')) && t.path) ? t : m;
  }
  function capaDaGaleria(ctx, post) {
    const m = post.cover_media_id ? ctx.porIdMedia.get(post.cover_media_id) : null;
    if (!m) return null;
    const f = fonteDaCapa(ctx, m);
    const tem = Number.isInteger(f.width) && Number.isInteger(f.height) && f.width > 0 && f.height > 0;
    return { src: f.path, alt: m.alt || post.title || '', largura: tem ? f.width : null, altura: tem ? f.height : null, href: ctx.hrefPost(post) };
  }
  function blocoArtigos(ctx, args) {
    const o = opcoesArtigos(args);
    let lista = ctx.posts;
    if (o.etiqueta) lista = lista.filter(p => (Array.isArray(p.tags) ? p.tags : []).some(t => Modelo.slug(t) === o.etiqueta));
    const artigos = lista.slice(0, o.n).map(function (post) {
      const item = ctx.itemLista(post);
      return { href: item.href, titulo: item.titulo, data: item.data, data_iso: item.data_iso,
        resumo: o.resumo ? item.resumo : '', capa: o.capa ? capaDaGaleria(ctx, post) : null };
    });
    return Mustache.render(temaDe(ctx).templates.galeria, { tem_artigos: artigos.length > 0, artigos: artigos });
  }
  function blocoHtml(ctx, b) {
    let html = null;
    if (b.nome === 'botao') html = blocoBotao(ctx, b.args);
    else if (b.nome === 'artigos' && ctx) html = blocoArtigos(ctx, b.args);
    // Argumentos que não dão bloco nenhum: devolver o que ele escreveu, para o
    // erro aparecer na prévia em vez de a linha desaparecer em silêncio.
    return html == null ? '<p>' + escapar(b.bruto) + '</p>\n' : html;
  }
  function aplicarBlocos(html, ex, ctx) {
    let s = html;
    for (let i = 0; i < ex.blocos.length; i++) {
      const marca = ex.token + i + 'x';
      // Sem ctx (o resumo de um artigo, que é texto e não pode conter uma
      // galeria — seria recursão) a galeria some; o botão continua a valer.
      const bloco = (!ctx && ex.blocos[i].nome === 'artigos') ? '' : blocoHtml(ctx, ex.blocos[i]);
      s = s.split('<p>' + marca + '</p>').join(bloco);
      s = s.split(marca).join(bloco);
    }
    return s;
  }
  function temGaleria(markdown) {
    return extrairBlocos(String(markdown == null ? '' : markdown)).blocos.some(b => b.nome === 'artigos');
  }

  // Markdown → HTML sanitizado (string). Determinístico.
  function renderizarCorpo(markdown, ctx) {
    preparar();
    const ex = extrairBlocos(String(markdown == null ? '' : markdown));
    const html = marked.parse(ex.texto);
    const limpo = imagensClicaveis(DOMPurify.sanitize(html, PURIFY));
    return ex.blocos.length ? aplicarBlocos(limpo, ex, ctx || null) : limpo;
  }

  // 51 — HTML COLADO PELO DONO (botão "HTML" da barra do editor). Não abre
  // exceção nenhuma na segurança: é o MESMO `PURIFY` de `renderizarCorpo`, e
  // é de propósito — um segundo juiz de HTML divergiria do primeiro com o
  // tempo, que é a lição de `hrefSeguro` (00 §6.2 item 50). O que esta função
  // acrescenta são as duas coisas que faltavam, ambas MEDIDAS em 2026-09-04
  // contra o dist de 648 994 B:
  //
  //  1. O FORMATO. HTML dentro de Markdown já funcionava, mas partia-se de
  //     três maneiras que o dono não tinha como adivinhar: primeira linha com
  //     4+ espaços vira BLOCO DE CÓDIGO (o leitor lê a tag em vez de a ver);
  //     uma linha em branco no meio TERMINA o bloco HTML (regra do CommonMark
  //     para `<div>` e companhia) e o resto sai remendado — medido, um `<pre>`
  //     dentro de um `<div>` saía `<pre>um<p>dois</p></pre><p></p>`; e sem
  //     linha em branco à volta os parágrafos vizinhos saem irregulares (esse
  //     último é do `inserirBloco`, na tela). Daí tirar as linhas em branco e
  //     a indentação comum ANTES de tudo.
  //  2. O QUE O FILTRO TIROU. Hoje um `script` some em silêncio e o dono só
  //     descobre no site publicado. Isto devolve a lista.
  //
  // ⚠️ Por que NÃO usar `DOMPurify.removed`, que existe para isto: medido na
  // 3.4.14, ele **não reporta a tag `script`** quando o HTML começa por ela nem
  // quando há vários — o aviso mentiria por omissão, que é pior do que não
  // haver aviso. O inventário antes/depois pega os dois casos, pega ainda
  // o `href="javascript:"` que o sanitizador esvazia calado, e não acusa o
  // `<tbody>` que ele ACRESCENTA a uma `<table>` (comparar só o que sumiu).
  //
  // Devolve o HTML já limpo, porque é ele que entra no texto: o que se vê no
  // editor tem de ser o que o leitor vê (decisão do usuário, 2026-09-04).
  // Idempotente — medido: `sanitize(sanitize(x)) === sanitize(x)` e o corpo
  // gravado atravessa `renderizarCorpo` sem mudar mais nada, logo o
  // determinismo de 13 §5.2 fica intacto.
  const RE_PRE = /<(\/?)(?:pre|textarea)\b/gi;
  const ATTR_ENDERECO = Object.freeze(['href', 'src', 'action', 'formaction', 'xlink:href', 'data', 'poster']);
  // `DOMParser` cria documento INERTE (sem browsing context): nada carrega,
  // nada executa — é o mesmo que o DOMPurify faz por dentro, e o mesmo padrão
  // que `primeiroParagrafo` já usa aqui. O documento nunca entra na página.
  function inventario(html) {
    const tags = new Set(), attrs = new Set();
    let doc;
    try { doc = new DOMParser().parseFromString('<body>' + String(html == null ? '' : html), 'text/html'); } catch (e) { return { tags, attrs }; }
    for (const el of (doc.body ? doc.body.querySelectorAll('*') : [])) {
      const nome = el.nodeName.toLowerCase();
      tags.add(nome);
      for (const a of el.attributes) attrs.add(nome + '/' + a.name.toLowerCase());
    }
    return { tags, attrs };
  }
  function limparHtmlColado(bruto) {
    const cru = String(bruto == null ? '' : bruto).replace(/\r\n?/g, '\n');
    // Uma linha em branco dentro de `<pre>` é CONTEÚDO, não formatação: sai
    // com as outras e o dono tem de saber. Contagem de tags abertas, que
    // chega para o aviso (não é um parser, e não precisa de ser).
    let abertos = 0, perdeuEmPre = false;
    const linhas = [];
    for (const linha of cru.split('\n')) {
      if (linha.trim() === '') { if (abertos > 0) perdeuEmPre = true; }
      else linhas.push(linha);
      RE_PRE.lastIndex = 0;
      let m;
      while ((m = RE_PRE.exec(linha)) !== null) abertos = Math.max(0, abertos + (m[1] ? -1 : 1));
    }
    // Dedent pela indentação comum; e a primeira linha sem espaço nenhum,
    // que é a única que o CommonMark olha para decidir se aquilo é código.
    let min = Infinity;
    for (const l of linhas) { const n = /^[ \t]*/.exec(l)[0].length; if (n < min) min = n; }
    const preparado = (min > 0 && min !== Infinity ? linhas.map(l => l.slice(min)) : linhas)
      .join('\n').replace(/^[ \t]+/, '');
    if (!preparado) return { html: '', removidos: [], perdeuEmPre, vazio: true };

    const html = DOMPurify.sanitize(preparado, PURIFY);
    const antes = inventario(preparado), depois = inventario(html);
    const removidos = [];
    for (const t of antes.tags) if (!depois.tags.has(t)) removidos.push({ tipo: 'tag', nome: t });
    for (const par of antes.attrs) {
      const i = par.indexOf('/'), tag = par.slice(0, i), nome = par.slice(i + 1);
      // Atributo de tag que também sumiu não é achado próprio: seria dizer
      // "tirei o href" a quem colou um <link> inteiro.
      if (!depois.tags.has(tag) || depois.attrs.has(par)) continue;
      removidos.push({ tipo: 'atributo', nome, em: tag });
    }
    return { html, removidos, perdeuEmPre, vazio: html.trim() === '' };
  }
  // Em que grupo de explicação cai o que foi removido (a tela tem um texto por
  // grupo, e não um por tag — "svg, circle" em duas linhas seria ruído).
  function grupoRemovido(r) {
    if (r.tipo === 'atributo') {
      if (/^on/.test(r.nome) || r.nome === 'srcdoc') return 'programa';
      return ATTR_ENDERECO.indexOf(r.nome) === -1 ? 'outro' : 'endereco';
    }
    if (r.nome === 'script') return 'programa';
    if (['iframe', 'object', 'embed', 'link', 'style', 'meta', 'base'].indexOf(r.nome) !== -1) return 'defora';
    return 'outro';
  }

  // Primeiro parágrafo em texto simples (para excerpt/description derivados)
  function primeiroParagrafo(html) {
    let doc;
    try { doc = new DOMParser().parseFromString('<body>' + html, 'text/html'); } catch (e) { return ''; }
    const p = doc.querySelector('p');
    const t = (p ? p.textContent : (doc.body ? doc.body.textContent : '')).replace(/\s+/g, ' ').trim();
    return t.length > RESUMO_MAX ? t.slice(0, RESUMO_MAX - 1).replace(/\s+\S*$/, '') + '…' : t;
  }

  async function sha256Hex(bytes) {
    const d = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(d)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // 14 T-10 / 13 §4.2: com show_publish_time = false o tema só vê o dia —
  // inclusive no atributo datetime (senão a hora vazaria pelo HTML).
  function datas(iso, mostrarHora) {
    const s = String(iso || '');
    if (mostrarHora && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return { data: Modelo.formatarDataHora(s) + ' UTC', data_iso: s.slice(0, 19) + 'Z' };
    const d = Modelo.formatarData(s);
    return { data: d, data_iso: d };
  }

  function publicaveis(lista) { return (lista || []).filter(r => r && r.status !== 'removed'); }
  function ordenarPosts(posts) { return posts.slice().sort((a, b) => (String(b.date || '').localeCompare(String(a.date || ''))) || String(a.slug).localeCompare(String(b.slug))); }
  function ordenarPorSlug(l) { return l.slice().sort((a, b) => String(a.slug).localeCompare(String(b.slug))); }

  // O contexto comum a todas as páginas: o que cada uma precisa saber do resto.
  function contexto(dados) {
    const site = dados.site;
    const pages = ordenarPorSlug(publicaveis(dados.pages));
    const posts = ordenarPosts(publicaveis(dados.posts));
    const media = (dados.media || []).filter(m => m && m.status !== 'removed');
    const porIdPagina = new Map(pages.map(p => [p.id, p]));
    const porIdMedia = new Map(media.map(m => [m.id, m]));
    const home = site.home || {};
    const homePage = home.mode === 'page' && home.page_id && porIdPagina.has(home.page_id) ? porIdPagina.get(home.page_id) : null;
    const hrefPagina = (p) => (homePage && p.id === homePage.id) ? Modelo.caminhoDe('home') : Modelo.caminhoDe('page', p.slug);
    const hrefPost = (p) => Modelo.caminhoDe('post', p.slug);
    const hrefBlog = Modelo.caminhoDe('blog');
    // menu (13 §3): a ordem do site.menu; páginas fora dele com in_menu entram no fim
    const menu = [], vistos = new Set();
    for (const item of (site.menu || [])) {
      if (!item) continue;
      if (item.type === 'page') { const p = porIdPagina.get(item.page_id); if (!p || !p.in_menu || vistos.has(p.id)) continue; vistos.add(p.id); menu.push({ href: hrefPagina(p), rotulo: p.title, externo: false, id: p.id }); }
      else if (item.type === 'blog') { if (vistos.has('blog')) continue; vistos.add('blog'); menu.push({ href: hrefBlog, rotulo: (site.blog && site.blog.title) || 'Blog', externo: false, id: 'blog' }); }
      else if (item.type === 'link' && typeof item.href === 'string' && typeof item.label === 'string') menu.push({ href: item.href, rotulo: item.label, externo: true, id: null });
    }
    for (const p of pages) if (p.in_menu && !vistos.has(p.id)) { vistos.add(p.id); menu.push({ href: hrefPagina(p), rotulo: p.title, externo: false, id: p.id }); }
    const mostrarHora = !!(site.privacy && site.privacy.show_publish_time);
    // O resumo é TEXTO: renderiza-se sem contexto de blocos de propósito. Um
    // artigo com galeria no corpo, cujo resumo entrasse na galeria, chamaria
    // o gerador a si próprio sem fim.
    const resumoDe = (post) => (post.excerpt && String(post.excerpt).trim()) ? String(post.excerpt).trim() : primeiroParagrafo(renderizarCorpo(post.body, null));
    const itemLista = (post) => Object.assign({ href: hrefPost(post), titulo: post.title, resumo: resumoDe(post) }, datas(post.date, mostrarHora));
    // 40 — as etiquetas que vão ter página. `Modelo.etiquetasDe` agrupa por
    // slug (é ele que garante um só arquivo por caminho); aqui só se guarda
    // quais existem, para a etiqueta do artigo saber se pode virar link.
    const etiquetas = Modelo.etiquetasDe(posts);
    const slugsEtiqueta = new Set(etiquetas.map(e => e.slug));
    const hrefEtiqueta = function (nome) { const sl = Modelo.slug(nome); return sl && slugsEtiqueta.has(sl) ? Modelo.caminhoDe('etiqueta', sl) : null; };
    return { site, pages, posts, media, porIdMedia, homePage, hrefPagina, hrefPost, hrefBlog, menu, mostrarHora, resumoDe, itemLista,
      etiquetas, hrefEtiqueta, logo: logoDe(site, porIdMedia), favicon: faviconDe(site, porIdMedia),
      opcoes: opcoesDe(site), lang: site.language || 'pt-BR',
      tema: Temas.de(site) };
  }

  // 38 — o logo do cabeçalho. Campo do SITE, não do tema (13 §3): trocar de
  // tema não pode fazer a marca desaparecer. O que é opção do tema é a altura.
  // Não confundir com `profile.picture_media_id`, que é o avatar do kind 0 —
  // são dois campos porque são duas imagens (avatar quadrado no Nostr, logo
  // horizontal no site). O título do site vai para o `alt`: quem lê por leitor
  // de tela, e quem indexa, continua a ver o nome (03 §1.1).
  function logoDe(site, porIdMedia) {
    const m = site.logo_media_id ? porIdMedia.get(site.logo_media_id) : null;
    if (!m) return null;
    const tem = Number.isInteger(m.width) && Number.isInteger(m.height) && m.width > 0 && m.height > 0;
    return { src: m.path, alt: site.title || '', largura: tem ? m.width : null, altura: tem ? m.height : null };
  }
  // O ícone da aba do navegador. Campo do SITE como o logo, e uma TERCEIRA
  // imagem: o avatar do Nostr é quadrado mas grande, o logo é horizontal, e
  // este tem de continuar legível com 16 px de lado.
  // ⚠️ O `type` sai do próprio caminho publicado, nunca de um palpite: o
  // navegador que recebe `image/png` num WebP simplesmente não desenha.
  // Sem ícone escolhido devolve `null`, e o molde não emite `<link>` nenhum
  // — melhor não ter ícone do que ter um `<link>` apontando para o vazio,
  // que faz o leitor do site pagar um pedido a mais por nada.
  function faviconDe(site, porIdMedia) {
    const m = site.favicon_media_id ? porIdMedia.get(site.favicon_media_id) : null;
    if (!m || !m.path) return null;
    return { src: m.path, tipo: Modelo.mimePorCaminho(m.path) || m.mime || '' };
  }
  // 24 — as opções que o tema vai resolver. O core não conhece nome nenhum
  // (06 §5.3): passa o objeto inteiro e é o tema que valida e descarta o que
  // não bate com o manifesto dele.
  function opcoesDe(site) { const t = site && site.theme; return (t && t.options && typeof t.options === 'object') ? t.options : {}; }
  // 12 — o tema que vai desenhar: pelo `site.theme.id`, via registro
  // (core/temas.js); desconhecido cai no Padrão. Os blocos recebem `ctx`
  // nulo quando se renderiza um RESUMO (texto), e aí qualquer tema serve.
  function temaDe(ctx) { return (ctx && ctx.tema) || Temas.padrao(); }

  function layout(ctx, o) {
    preparar();
    const site = ctx.site;
    const doacoes = (site.donations && site.donations.support_block && site.donations.lightning_address) ? { lightning_address: site.donations.lightning_address } : null;
    return Mustache.render(ctx.tema.templates.layout, {
      lang: ctx.lang, titulo_pagina: o.tituloPagina, descricao: o.descricao || '', site_titulo: site.title || '', logo: ctx.logo, favicon: ctx.favicon,
      menu: ctx.menu.map(m => ({ href: m.href, rotulo: m.rotulo, externo: m.externo, atual: !!o.atualId && m.id === o.atualId })),
      conteudo: o.conteudo, doacoes: doacoes, credito: !(site.donations && site.donations.footer_credit === false)
    });
  }
  function tituloPagina(ctx, titulo) { return ctx.site.title ? titulo + ' – ' + ctx.site.title : titulo; }

  // 35 — a capa chega ao molde de página TAMBÉM. O tema padrão não tem
  // `{{#capa}}` na página (é o que o dono decidiu), mas um tema que queira
  // usá-la não precisa de tocar no gerador — `06` §5.3.1: o layout vive no tema.
  function capaDe(ctx, reg) {
    const m = reg.cover_media_id ? ctx.porIdMedia.get(reg.cover_media_id) : null;
    return m ? { src: m.path, alt: m.alt || '', largura: m.width || null, altura: m.height || null, legenda: m.caption || '' } : null;
  }
  function htmlPagina(ctx, page) {
    const corpo = renderizarCorpo(page.body, ctx);
    const ehHome = ctx.homePage && page.id === ctx.homePage.id;
    const n = ehHome ? (Number.isInteger(ctx.site.home.latest_posts) ? ctx.site.home.latest_posts : 0) : 0;
    const ultimos = n > 0 ? { blog_titulo: (ctx.site.blog && ctx.site.blog.title) || 'Blog', blog_href: ctx.hrefBlog, artigos: ctx.posts.slice(0, n).map(ctx.itemLista) } : null;
    const conteudo = Mustache.render(ctx.tema.templates.pagina, { titulo: page.title, corpo: corpo, ultimos: ultimos, capa: capaDe(ctx, page) });
    return layout(ctx, { tituloPagina: ehHome ? (ctx.site.title || page.title) : tituloPagina(ctx, page.title), descricao: page.description || (ehHome ? ctx.site.description : '') || primeiroParagrafo(corpo), conteudo: conteudo, atualId: page.id });
  }
  function htmlArtigo(ctx, post) {
    const corpo = renderizarCorpo(post.body, ctx);
    const capa = capaDe(ctx, post);
    // 40 — a etiqueta vira link quando existe página para ela. Quando o nome
    // não produz slug ("!!!"), continua `<span>`: um href vazio seria pior que
    // não haver link.
    const tags = Array.isArray(post.tags) ? post.tags.filter(t => typeof t === 'string' && t).map(t => ({ nome: t, href: ctx.hrefEtiqueta(t) })) : [];
    const conteudo = Mustache.render(ctx.tema.templates.artigo, Object.assign({ titulo: post.title, corpo: corpo, tem_tags: tags.length > 0, tags: tags, capa: capa }, datas(post.date, ctx.mostrarHora)));
    return layout(ctx, { tituloPagina: tituloPagina(ctx, post.title), descricao: post.description || ctx.resumoDe(post), conteudo: conteudo, atualId: 'blog' });
  }
  function htmlBlog(ctx, ehHome) {
    const titulo = (ctx.site.blog && ctx.site.blog.title) || 'Blog';
    const conteudo = Mustache.render(ctx.tema.templates.blog, { blog_titulo: titulo, tem_artigos: ctx.posts.length > 0, artigos: ctx.posts.map(ctx.itemLista) });
    return layout(ctx, { tituloPagina: ehHome ? (ctx.site.title || titulo) : tituloPagina(ctx, titulo), descricao: ctx.site.description || '', conteudo: conteudo, atualId: 'blog' });
  }
  // 40 — a página de uma etiqueta. Os artigos vêm da ordem de `ctx.posts`
  // (data decrescente, empate por slug), filtrados pelos ids que
  // `Modelo.etiquetasDe` já apurou — nada é recalculado aqui.
  function htmlEtiqueta(ctx, et) {
    const ids = new Set(et.ids);
    const artigos = ctx.posts.filter(p => ids.has(p.id)).map(ctx.itemLista);
    const conteudo = Mustache.render(ctx.tema.templates.etiqueta, {
      etiqueta: et.nome, blog_titulo: (ctx.site.blog && ctx.site.blog.title) || 'Blog', blog_href: ctx.hrefBlog,
      tem_artigos: artigos.length > 0, artigos: artigos
    });
    return layout(ctx, { tituloPagina: tituloPagina(ctx, 'Etiqueta: ' + et.nome), descricao: '', conteudo: conteudo, atualId: 'blog' });
  }
  function htmlAlias(ctx, titulo, destino) { preparar(); return Mustache.render(ctx.tema.templates.alias, { lang: ctx.lang, titulo: titulo, destino: destino }); }

  // HTML de um registro (para "Ver como ficará" e para o published_hash)
  function htmlDe(dados, registro, tipo) {
    const ctx = contexto(dados);
    if (tipo === 'page') return htmlPagina(ctx, registro);
    if (tipo === 'post') return htmlArtigo(ctx, registro);
    throw new Error('tipo desconhecido: ' + tipo);
  }

  // O site inteiro como seria publicado agora (tudo com status ≠ removed).
  // → { arquivos: [{ path, bytes, mime, texto, tipo, id }], hashes: { path: sha256 }, porId: { id: sha256 } }
  async function gerarSite(dados) {
    const ctx = contexto(dados);
    const arquivos = [];
    // `dinamico`: este caminho muda sozinho quando um artigo é publicado, sem
    // o dono lhe ter tocado (30 — a galeria; e `/index.html` com recentes, e
    // `/blog/`, que já eram assim). T8 usa-o para dizer o porquê (13 §5.3).
    const add = (path, texto, mime, tipo, id, dinamico) => arquivos.push({ path: path, texto: texto, bytes: enc.encode(texto), mime: mime, tipo: tipo, id: id || null, dinamico: dinamico === true });
    if (ctx.homePage) add(Modelo.caminhoDe('home'), htmlPagina(ctx, ctx.homePage), 'text/html', 'page', ctx.homePage.id, temGaleria(ctx.homePage.body));
    else add(Modelo.caminhoDe('home'), htmlBlog(ctx, true), 'text/html', 'blog', null);
    for (const p of ctx.pages) {
      if (ctx.homePage && p.id === ctx.homePage.id) { for (const a of (p.aliases || [])) if (Modelo.slugValido(a)) add(Modelo.caminhoDe('page', a), htmlAlias(ctx, p.title, ctx.hrefPagina(p)), 'text/html', 'alias', p.id); continue; }
      add(Modelo.caminhoDe('page', p.slug), htmlPagina(ctx, p), 'text/html', 'page', p.id, temGaleria(p.body));
      for (const a of (p.aliases || [])) if (Modelo.slugValido(a) && a !== p.slug) add(Modelo.caminhoDe('page', a), htmlAlias(ctx, p.title, ctx.hrefPagina(p)), 'text/html', 'alias', p.id);
    }
    add(ctx.hrefBlog, htmlBlog(ctx, false), 'text/html', 'blog', null);
    for (const p of ctx.posts) {
      add(ctx.hrefPost(p), htmlArtigo(ctx, p), 'text/html', 'post', p.id, temGaleria(p.body));
      for (const a of (p.aliases || [])) if (Modelo.slugValido(a) && a !== p.slug) add(Modelo.caminhoDe('post', a), htmlAlias(ctx, p.title, ctx.hrefPost(p)), 'text/html', 'alias', p.id);
    }
    // 40 — depois dos artigos e dos seus aliases de propósito: o dedup mais
    // abaixo faz o PRIMEIRO caminho ganhar, e um artigo nunca pode perder o
    // seu endereço para uma etiqueta.
    for (const et of ctx.etiquetas) add(Modelo.caminhoDe('etiqueta', et.slug), htmlEtiqueta(ctx, et), 'text/html', 'etiqueta', null, true);
    add(caminhoCss(), ctx.tema.css(ctx.opcoes), 'text/css', 'tema', null);
    add(Modelo.caminhoDe('site_json'), SiteJson.escrever({ site: ctx.site, pages: ctx.pages, posts: ctx.posts, media: ctx.media.filter(m => m.origin !== 'network') }), 'application/json', 'site_json', null);
    // caminhos únicos: um alias nunca pode sobrepor um caminho real (o primeiro vence — páginas e artigos entram antes dos seus aliases)
    const vistos = new Set(), unicos = [];
    for (const a of arquivos) { if (vistos.has(a.path)) continue; vistos.add(a.path); unicos.push(a); }
    const hashes = {}, porId = {};
    for (const a of unicos) { const h = await sha256Hex(a.bytes); a.sha256 = h; hashes[a.path] = h; if (a.id && (a.tipo === 'page' || a.tipo === 'post')) porId[a.id] = h; }
    return { arquivos: unicos, hashes: hashes, porId: porId };
  }

  // Pré-visualização isolada (14 §0.8; E4): o HTML gerado, com o CSS do tema
  // embutido (o iframe de origem opaca não resolve /tema/estilo.css) e as
  // imagens locais trocadas por data: URI (dataUris: { "/img/x.webp": "data:…" }).
  // Toda outra imagem vira um marcador com o caminho: dentro do iframe um
  // src relativo resolveria para file:// (bloqueado, com erro de console) e
  // um https: é barrado pela CSP — nada sai da máquina ao pré-visualizar.
  function marcador(src) {
    const rot = String(src).slice(0, 60).replace(/[<>&"']/g, '');
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="120"><rect width="100%" height="100%" fill="#dcdcde"/><text x="50%" y="50%" font-family="sans-serif" font-size="13" fill="#50575e" text-anchor="middle" dominant-baseline="middle">' + rot + '</text></svg>');
  }
  function previa(html, dataUris, opcoes, tema) {
    let s = html.replace(linkCss(), '<style>\n' + (tema || Temas.padrao()).css(opcoes) + '</style>');
    // O ícone da aba sai da prévia: dentro do iframe o caminho `/img/…` não
    // existe, e o navegador ia buscá-lo à raiz do disco — um pedido que
    // falha, um erro no console e nada mostrado (a prévia não tem aba).
    s = s.replace(/<link rel="icon"[^>]*>\n?/g, '');
    s = s.replace(/(<img\b[^>]*\bsrc=")([^"]*)(")/g, function (tudo, a, src, z) {
      if (dataUris && dataUris[src]) return a + dataUris[src] + z;
      if (/^data:/i.test(src)) return tudo;
      return a + marcador(src) + z;
    });
    return s;
  }
  // Só o corpo (o editor, enquanto se digita): artigo/página mínimos com o CSS
  // do tema. `ctx` (opcional) é o que faz a galeria aparecer na prévia lateral
  // com os artigos reais — sem ele o marcador desenha vazio.
  function previaCorpo(titulo, markdown, dataUris, opcoes, ctx, tema) {
    const corpo = renderizarCorpo(markdown, ctx || null);
    const html = '<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n<title>' + escapar(titulo) + '</title>\n' + linkCss() + '\n</head>\n<body>\n<main class="principal">\n<article class="pagina">\n<h1>' + escapar(titulo) + '</h1>\n' + corpo + '\n</article>\n</main>\n</body>\n</html>\n';
    return previa(html, dataUris, opcoes, tema || (ctx && ctx.tema) || null);
  }

  return Object.freeze({ caminhoCss, PURIFY, escapar, imagensClicaveis, renderizarCorpo, primeiroParagrafo, sha256Hex, contexto, opcoesDe, temaDe, htmlDe, gerarSite, previa, previaCorpo,
    extrairBlocos, hrefSeguro, opcoesArtigos, temGaleria, BLOCOS, limparHtmlColado, grupoRemovido });
})();
