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

  // Markdown → HTML sanitizado (string). Determinístico.
  function renderizarCorpo(markdown) {
    preparar();
    const html = marked.parse(String(markdown == null ? '' : markdown));
    return imagensClicaveis(DOMPurify.sanitize(html, PURIFY));
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
    const resumoDe = (post) => (post.excerpt && String(post.excerpt).trim()) ? String(post.excerpt).trim() : primeiroParagrafo(renderizarCorpo(post.body));
    const itemLista = (post) => Object.assign({ href: hrefPost(post), titulo: post.title, resumo: resumoDe(post) }, datas(post.date, mostrarHora));
    return { site, pages, posts, media, porIdMedia, homePage, hrefPagina, hrefPost, hrefBlog, menu, mostrarHora, resumoDe, itemLista, lang: site.language || 'pt-BR' };
  }

  function layout(ctx, o) {
    preparar();
    const site = ctx.site;
    const doacoes = (site.donations && site.donations.support_block && site.donations.lightning_address) ? { lightning_address: site.donations.lightning_address } : null;
    return Mustache.render(TemaPadrao.templates.layout, {
      lang: ctx.lang, titulo_pagina: o.tituloPagina, descricao: o.descricao || '', site_titulo: site.title || '',
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
    const corpo = renderizarCorpo(page.body);
    const ehHome = ctx.homePage && page.id === ctx.homePage.id;
    const n = ehHome ? (Number.isInteger(ctx.site.home.latest_posts) ? ctx.site.home.latest_posts : 0) : 0;
    const ultimos = n > 0 ? { blog_titulo: (ctx.site.blog && ctx.site.blog.title) || 'Blog', blog_href: ctx.hrefBlog, artigos: ctx.posts.slice(0, n).map(ctx.itemLista) } : null;
    const conteudo = Mustache.render(TemaPadrao.templates.pagina, { titulo: page.title, corpo: corpo, ultimos: ultimos, capa: capaDe(ctx, page) });
    return layout(ctx, { tituloPagina: ehHome ? (ctx.site.title || page.title) : tituloPagina(ctx, page.title), descricao: page.description || (ehHome ? ctx.site.description : '') || primeiroParagrafo(corpo), conteudo: conteudo, atualId: page.id });
  }
  function htmlArtigo(ctx, post) {
    const corpo = renderizarCorpo(post.body);
    const capa = capaDe(ctx, post);
    const tags = Array.isArray(post.tags) ? post.tags.filter(t => typeof t === 'string' && t).map(t => ({ nome: t })) : [];
    const conteudo = Mustache.render(TemaPadrao.templates.artigo, Object.assign({ titulo: post.title, corpo: corpo, tem_tags: tags.length > 0, tags: tags, capa: capa }, datas(post.date, ctx.mostrarHora)));
    return layout(ctx, { tituloPagina: tituloPagina(ctx, post.title), descricao: post.description || ctx.resumoDe(post), conteudo: conteudo, atualId: 'blog' });
  }
  function htmlBlog(ctx, ehHome) {
    const titulo = (ctx.site.blog && ctx.site.blog.title) || 'Blog';
    const conteudo = Mustache.render(TemaPadrao.templates.blog, { blog_titulo: titulo, tem_artigos: ctx.posts.length > 0, artigos: ctx.posts.map(ctx.itemLista) });
    return layout(ctx, { tituloPagina: ehHome ? (ctx.site.title || titulo) : tituloPagina(ctx, titulo), descricao: ctx.site.description || '', conteudo: conteudo, atualId: 'blog' });
  }
  function htmlAlias(ctx, titulo, destino) { preparar(); return Mustache.render(TemaPadrao.templates.alias, { lang: ctx.lang, titulo: titulo, destino: destino }); }

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
    const add = (path, texto, mime, tipo, id) => arquivos.push({ path: path, texto: texto, bytes: enc.encode(texto), mime: mime, tipo: tipo, id: id || null });
    if (ctx.homePage) add(Modelo.caminhoDe('home'), htmlPagina(ctx, ctx.homePage), 'text/html', 'page', ctx.homePage.id);
    else add(Modelo.caminhoDe('home'), htmlBlog(ctx, true), 'text/html', 'blog', null);
    for (const p of ctx.pages) {
      if (ctx.homePage && p.id === ctx.homePage.id) { for (const a of (p.aliases || [])) if (Modelo.slugValido(a)) add(Modelo.caminhoDe('page', a), htmlAlias(ctx, p.title, ctx.hrefPagina(p)), 'text/html', 'alias', p.id); continue; }
      add(Modelo.caminhoDe('page', p.slug), htmlPagina(ctx, p), 'text/html', 'page', p.id);
      for (const a of (p.aliases || [])) if (Modelo.slugValido(a) && a !== p.slug) add(Modelo.caminhoDe('page', a), htmlAlias(ctx, p.title, ctx.hrefPagina(p)), 'text/html', 'alias', p.id);
    }
    add(ctx.hrefBlog, htmlBlog(ctx, false), 'text/html', 'blog', null);
    for (const p of ctx.posts) {
      add(ctx.hrefPost(p), htmlArtigo(ctx, p), 'text/html', 'post', p.id);
      for (const a of (p.aliases || [])) if (Modelo.slugValido(a) && a !== p.slug) add(Modelo.caminhoDe('post', a), htmlAlias(ctx, p.title, ctx.hrefPost(p)), 'text/html', 'alias', p.id);
    }
    add(caminhoCss(), TemaPadrao.css, 'text/css', 'tema', null);
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
  function previa(html, dataUris) {
    let s = html.replace(linkCss(), '<style>\n' + TemaPadrao.css + '</style>');
    s = s.replace(/(<img\b[^>]*\bsrc=")([^"]*)(")/g, function (tudo, a, src, z) {
      if (dataUris && dataUris[src]) return a + dataUris[src] + z;
      if (/^data:/i.test(src)) return tudo;
      return a + marcador(src) + z;
    });
    return s;
  }
  // Só o corpo (o editor, enquanto se digita): artigo/página mínimos com o CSS do tema
  function previaCorpo(titulo, markdown, dataUris) {
    const corpo = renderizarCorpo(markdown);
    const html = '<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n<title>' + escapar(titulo) + '</title>\n' + linkCss() + '\n</head>\n<body>\n<main class="principal">\n<article class="pagina">\n<h1>' + escapar(titulo) + '</h1>\n' + corpo + '\n</article>\n</main>\n</body>\n</html>\n';
    return previa(html, dataUris);
  }

  return Object.freeze({ caminhoCss, PURIFY, escapar, imagensClicaveis, renderizarCorpo, primeiroParagrafo, sha256Hex, contexto, htmlDe, gerarSite, previa, previaCorpo });
})();
