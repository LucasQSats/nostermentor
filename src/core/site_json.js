/* core/site_json.js — leitura do espelho estruturado /nostermentor/site.json
   (13 §6). É DADO vindo da rede (02 G.0): tudo passa por lista branca de
   campos e tipos; o que não bate é descartado, nunca "lido o que der".
   Versão maior que a do app é recusada com mensagem (13 §7.4). Desde M3,
   `escrever` produz o texto DETERMINÍSTICO (13 §5.2): chaves na ordem de
   13 §6.1, arrays ordenados, JSON compacto, sem data de geração. */
const SiteJson = (function () {
  'use strict';

  const CAMINHO = '/nostermentor/site.json', FORMATO = 'nostermentor-site';
  const RE_SHA = /^[0-9a-f]{64}$/;

  function decodificar(bytes) { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }

  const eStr = v => typeof v === 'string';
  const obj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const str = (v, max) => (eStr(v) ? v.slice(0, max) : '');
  const arr = v => (Array.isArray(v) ? v : []);
  function inteiro(v, padrao, min, max) { if (!Number.isInteger(v)) return padrao; if (min != null && v < min) return padrao; if (max != null && v > max) return padrao; return v; }
  function idValido(v) { return eStr(v) && v.length > 0 && v.length <= 64 && /^[A-Za-z0-9_-]+$/.test(v); }
  function idOuNulo(v) { return idValido(v) ? v : null; }
  function urls(lista, protocolo) {
    const saida = [];
    for (const u of arr(lista)) { if (!eStr(u)) continue; let p; try { p = new URL(u); } catch (e) { continue; } if (p.protocol === protocolo && p.hostname) saida.push(Modelo.normalizarUrl(u)); }
    return saida;
  }
  function strings(lista, max) { return arr(lista).filter(eStr).map(s => s.slice(0, 100)).slice(0, max); }

  function lerItemMenu(m) {
    if (!obj(m)) return null;
    if (m.type === 'blog') return { type: 'blog' };
    if (m.type === 'page' && idValido(m.page_id)) return { type: 'page', page_id: m.page_id };
    if (m.type === 'link' && eStr(m.label) && eStr(m.href)) { let p; try { p = new URL(m.href); } catch (e) { return null; } if (p.protocol !== 'https:' && p.protocol !== 'http:') return null; return { type: 'link', label: m.label.slice(0, 100), href: m.href.slice(0, 500) }; }
    return null;
  }

  function lerSite(s) {
    if (!obj(s)) return {};
    const o = {};
    if (eStr(s.title)) o.title = s.title.slice(0, 200);
    if (eStr(s.description)) o.description = s.description.slice(0, 1000);
    if (eStr(s.language)) o.language = s.language.slice(0, 20);
    if (obj(s.profile)) o.profile = { name: str(s.profile.name, 200), about: str(s.profile.about, 2000), picture_media_id: idOuNulo(s.profile.picture_media_id) };
    if (obj(s.home)) o.home = { mode: s.home.mode === 'page' ? 'page' : 'blog', page_id: idOuNulo(s.home.page_id), latest_posts: inteiro(s.home.latest_posts, 5, 0, 100) };
    if (obj(s.blog)) o.blog = { prefix: Modelo.PREFIXO_BLOG, title: str(s.blog.title, 100) || 'Blog' };
    if (Array.isArray(s.menu)) o.menu = s.menu.map(lerItemMenu).filter(Boolean).slice(0, 50);
    if (obj(s.theme)) o.theme = { id: str(s.theme.id, 50) || 'padrao', version: inteiro(s.theme.version, 1, 1), options: obj(s.theme.options) ? s.theme.options : {} };
    if (obj(s.donations)) o.donations = { lightning_address: str(s.donations.lightning_address, 200), support_block: s.donations.support_block === true, footer_credit: s.donations.footer_credit !== false };
    if (obj(s.privacy)) o.privacy = { show_publish_time: s.privacy.show_publish_time === true };
    if (obj(s.discovery)) o.discovery = { canonical_base: eStr(s.discovery.canonical_base) ? s.discovery.canonical_base.slice(0, 300) : null };
    if (obj(s.network)) o.network = { relays: urls(s.network.relays, 'wss:'), servers: urls(s.network.servers, 'https:') };
    return o;
  }

  function lerComum(p) {
    if (!obj(p) || !idValido(p.id) || !eStr(p.slug) || !eStr(p.title)) return null;
    return { id: p.id, slug: p.slug.slice(0, 120), aliases: strings(p.aliases, 50), title: p.title.slice(0, 300),
      description: str(p.description, 1000), body: str(p.body, 5000000), body_format: 'markdown' };
  }
  function lerPagina(p) { const c = lerComum(p); if (!c) return null; c.in_menu = p.in_menu === true; return c; }
  function lerArtigo(p) {
    const c = lerComum(p); if (!c) return null;
    c.date = eStr(p.date) && /^\d{4}-\d{2}-\d{2}/.test(p.date) ? p.date.slice(0, 25) : '';
    c.excerpt = str(p.excerpt, 2000); c.tags = strings(p.tags, 50).map(t => t.toLowerCase()); c.cover_media_id = idOuNulo(p.cover_media_id);
    return c;
  }
  function lerMidia(m) {
    if (!obj(m) || !idValido(m.id) || !eStr(m.path) || m.path.charAt(0) !== '/' || !eStr(m.sha256) || !RE_SHA.test(m.sha256)) return null;
    return { id: m.id, path: m.path.slice(0, 500), mime: eStr(m.mime) ? m.mime.slice(0, 100) : Modelo.mimePorCaminho(m.path), size: inteiro(m.size, null, 0),
      sha256: m.sha256, width: inteiro(m.width, null, 0), height: inteiro(m.height, null, 0), alt: str(m.alt, 500), caption: str(m.caption, 1000) };
  }
  function semDuplicados(lista) {
    const ids = new Set(), saida = [];
    for (const r of lista) { if (ids.has(r.id)) continue; ids.add(r.id); saida.push(r); }
    return saida;
  }

  // → { ok: true, version, dados: { site, pages, posts, media, theme }, ignorados }
  //   | { ok: false, codigo: 'json'|'formato'|'versao_maior'|'estrutura', motivo }
  function ler(texto) {
    let j;
    try { j = JSON.parse(texto); } catch (e) { return { ok: false, codigo: 'json', motivo: Textos.siteJson.invalido }; }
    if (!obj(j) || j.format !== FORMATO) return { ok: false, codigo: 'formato', motivo: Textos.siteJson.invalido };
    if (!Number.isInteger(j.version) || j.version < 1) return { ok: false, codigo: 'estrutura', motivo: Textos.siteJson.invalido };
    if (j.version > Modelo.SCHEMA_VERSION) return { ok: false, codigo: 'versao_maior', motivo: Textos.siteJson.maisNovo };
    const brutos = { pages: arr(j.pages), posts: arr(j.posts), media: arr(j.media) };
    const pages = semDuplicados(brutos.pages.map(lerPagina).filter(Boolean));
    const posts = semDuplicados(brutos.posts.map(lerArtigo).filter(Boolean));
    const media = semDuplicados(brutos.media.map(lerMidia).filter(Boolean));
    const ignorados = (brutos.pages.length - pages.length) + (brutos.posts.length - posts.length) + (brutos.media.length - media.length);
    const site = lerSite(j.site);
    const theme = obj(j.theme) ? { id: str(j.theme.id, 50) || 'padrao', version: inteiro(j.theme.version, 1, 1), options: obj(j.theme.options) ? j.theme.options : {} } : (site.theme || null);
    return { ok: true, version: j.version, dados: { site: site, pages: pages, posts: posts, media: media, theme: theme }, ignorados: ignorados };
  }

  // --- escrita (13 §6.1) --------------------------------------------------
  function ordenarChaves(v) {
    if (Array.isArray(v)) return v.map(ordenarChaves);
    if (!obj(v)) return v;
    const o = {};
    for (const k of Object.keys(v).sort()) o[k] = ordenarChaves(v[k]);
    return o;
  }
  const s200 = v => str(v, 200), s1000 = v => str(v, 1000);
  function escreverSite(s) {
    const o = {
      pubkey: s.pubkey, npub: s.npub, title: s200(s.title), description: s1000(s.description), language: str(s.language, 20) || 'pt-BR',
      profile: { name: s200(s.profile && s.profile.name), about: str(s.profile && s.profile.about, 2000), picture_media_id: idOuNulo(s.profile && s.profile.picture_media_id) },
      home: { mode: s.home && s.home.mode === 'page' ? 'page' : 'blog', page_id: idOuNulo(s.home && s.home.page_id), latest_posts: inteiro(s.home && s.home.latest_posts, 5, 0, 100) },
      blog: { prefix: Modelo.PREFIXO_BLOG, title: str(s.blog && s.blog.title, 100) || 'Blog' },
      menu: arr(s.menu).map(lerItemMenu).filter(Boolean),
      theme: { id: str(s.theme && s.theme.id, 50) || 'padrao', version: inteiro(s.theme && s.theme.version, 1, 1), options: ordenarChaves(obj(s.theme && s.theme.options) ? s.theme.options : {}) },
      donations: { lightning_address: s200(s.donations && s.donations.lightning_address), support_block: !!(s.donations && s.donations.support_block === true), footer_credit: !(s.donations && s.donations.footer_credit === false) },
      privacy: { show_publish_time: !!(s.privacy && s.privacy.show_publish_time === true) }
    };
    if (s.discovery && eStr(s.discovery.canonical_base)) o.discovery = { canonical_base: s.discovery.canonical_base.slice(0, 300) };
    o.network = { relays: urls(s.network && s.network.relays, 'wss:'), servers: urls(s.network && s.network.servers, 'https:') };
    return o;
  }
  const comum = p => ({ id: p.id, slug: p.slug, aliases: arr(p.aliases).filter(eStr).slice().sort(), title: str(p.title, 300), description: s1000(p.description), body: String(p.body == null ? '' : p.body), body_format: 'markdown' });
  function escreverPagina(p) { const c = comum(p); c.in_menu = p.in_menu === true; return c; }
  function escreverArtigo(p) { const c = comum(p); c.date = str(p.date, 25); c.excerpt = str(p.excerpt, 2000); c.tags = arr(p.tags).filter(eStr).map(t => t.toLowerCase()).slice(0, 50); c.cover_media_id = idOuNulo(p.cover_media_id); return c; }
  function escreverMidia(m) { return { id: m.id, path: m.path, mime: eStr(m.mime) ? m.mime : Modelo.mimePorCaminho(m.path), size: Number.isInteger(m.size) ? m.size : null, sha256: m.sha256, width: Number.isInteger(m.width) ? m.width : null, height: Number.isInteger(m.height) ? m.height : null, alt: str(m.alt, 500), caption: s1000(m.caption) }; }
  const porSlug = (a, b) => String(a.slug).localeCompare(String(b.slug));

  // dados: { site, pages, posts, media } — só o que se publica (o chamador filtra). → texto
  function escrever(dados) {
    const site = escreverSite(dados.site || {});
    const pages = arr(dados.pages).map(escreverPagina).sort(porSlug);
    const posts = arr(dados.posts).map(escreverArtigo).sort((a, b) => (String(b.date).localeCompare(String(a.date))) || porSlug(a, b));
    const media = arr(dados.media).filter(m => m && eStr(m.sha256) && RE_SHA.test(m.sha256)).map(escreverMidia).sort((a, b) => String(a.path).localeCompare(String(b.path)));
    const saida = { format: FORMATO, version: Modelo.SCHEMA_VERSION, site: site, pages: pages, posts: posts, media: media, theme: site.theme };
    return JSON.stringify(saida);
  }

  return Object.freeze({ CAMINHO, FORMATO, decodificar, ler, lerSite, escrever });
})();
