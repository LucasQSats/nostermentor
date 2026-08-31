/* core/modelo.js — o contrato de dados (13) em código: defaults do site
   (13 §3), entidades (13 §4), slug e caminhos (13 §4.0, §5.1), máquina de
   estados (13 §4.4) e a infraestrutura padrão (05 §4). Sem DOM, sem rede;
   não referencia outros módulos em tempo de carga. */
const Modelo = (function () {
  'use strict';

  const SCHEMA_VERSION = 1;               // 13 §2 / §7.4: uma versão para as três cópias

  // 05 §4 (revisado 2026-08-20): os 8 relays com o manifest do Bostil;
  // `nostr.cercatrova.me` fora (P7). Oito porque via Tor sobram ~6 (P20).
  const RELAYS_PADRAO = Object.freeze([
    'wss://nos.lol', 'wss://relay.damus.io', 'wss://relay.primal.net', 'wss://relay.nsite.lol',
    'wss://relay.wellorder.net', 'wss://nostr-pub.wellorder.net', 'wss://offchain.pub', 'wss://relay.nostr.wirednet.jp'
  ]);
  // 05 §4 + 03 §6: só servidores que aceitam todos os tipos E deixam apagar.
  const SERVIDORES_PADRAO = Object.freeze(['https://cdn.hzrd149.com', 'https://blossom.primal.net']);
  // 14 T3 / T-9: nsite.lol é o gateway de "Ver o site"; nsite.cloud "pode levar dias" (P1).
  const GATEWAYS = Object.freeze([
    Object.freeze({ host: 'nsite.lol', principal: true }),
    Object.freeze({ host: 'nsite.cloud', lento: true }),
    Object.freeze({ host: 'nsite.run' })
  ]);

  const RESERVADOS = Object.freeze(['index', 'blog', 'img', 'media', 'tema', 'nostermentor', 'feed', 'sitemap', 'robots']);
  const CAMINHOS_RESERVADOS = Object.freeze(['/feed.xml', '/sitemap.xml', '/robots.txt']);   // pendência 13
  const CAMINHO_SITE_JSON = '/nostermentor/site.json';                                         // 13 §6
  const PREFIXO_BLOG = '/blog';
  const STATUS = Object.freeze(['draft', 'published', 'modified', 'removed']);

  // 13 §5.1: imagem em /img/, o resto em /media/
  const MIME = Object.freeze({
    html: 'text/html', htm: 'text/html', css: 'text/css', js: 'text/javascript', json: 'application/json',
    xml: 'application/xml', txt: 'text/plain', md: 'text/markdown', svg: 'image/svg+xml',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
    avif: 'image/avif', ico: 'image/x-icon', mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg',
    m4a: 'audio/mp4', ogg: 'audio/ogg', opus: 'audio/ogg', wav: 'audio/wav', pdf: 'application/pdf',
    ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2'
  });

  // 14 §0.9 / T-10: tudo em UTC, sem milissegundos.
  function agora() { return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'); }
  function formatarData(iso) { const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(iso || '')); return m ? m[1] : ''; }
  function formatarDataHora(iso) { const s = String(iso || ''); return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) ? s.slice(0, 10) + ' ' + s.slice(11, 16) : ''; }
  function dataDeUnix(segundos) { return new Date(segundos * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z'); }

  function novoId() { return crypto.randomUUID(); }

  // 13 §4.0: minúsculas, a-z0-9-, NFD sem diacríticos
  function slug(titulo) {
    return String(titulo == null ? '' : titulo).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  function slugValido(s) { return typeof s === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s) && s.length <= 120 && RESERVADOS.indexOf(s) === -1; }

  // 13 §5.1
  function caminhoDe(tipo, slugOuArquivo) {
    switch (tipo) {
      case 'home': return '/index.html';
      case 'blog': return PREFIXO_BLOG + '/index.html';
      case 'page': return '/' + slugOuArquivo + '.html';
      case 'post': return PREFIXO_BLOG + '/' + slugOuArquivo + '.html';
      case 'img': return '/img/' + slugOuArquivo;
      case 'media': return '/media/' + slugOuArquivo;
      case 'tema': return '/tema/' + slugOuArquivo;
      case 'site_json': return CAMINHO_SITE_JSON;
    }
    throw new Error('tipo de caminho desconhecido: ' + tipo);
  }

  function extensao(path) { const m = /\.([a-z0-9]+)$/i.exec(String(path || '')); return m ? m[1].toLowerCase() : null; }
  function mimePorCaminho(path) { const e = extensao(path); return e && MIME[e] ? MIME[e] : null; }

  function normalizarUrl(u) { return String(u == null ? '' : u).trim().replace(/\/+$/, ''); }
  function uniao() {
    const vistos = new Set(), saida = [];
    for (let i = 0; i < arguments.length; i++) {
      const lista = arguments[i];
      if (!Array.isArray(lista)) continue;
      for (const v of lista) { if (typeof v !== 'string') continue; const n = normalizarUrl(v); if (n && !vistos.has(n)) { vistos.add(n); saida.push(n); } }
    }
    return saida;
  }
  function urlDoSite(npub, host) { return 'https://' + npub + '.' + host + '/'; }

  // 13 §3
  function sitePadrao(pubkey, npub) {
    return {
      pubkey: pubkey, npub: npub, title: '', description: '', language: 'pt-BR',
      profile: { name: '', about: '', picture_media_id: null },
      home: { mode: 'blog', page_id: null, latest_posts: 5 },
      blog: { prefix: PREFIXO_BLOG, title: 'Blog' },
      menu: [{ type: 'blog' }],
      theme: { id: 'padrao', version: 1, options: {} },
      donations: { lightning_address: '', support_block: false, footer_credit: true },
      privacy: { show_publish_time: false },
      discovery: { canonical_base: null },
      network: { relays: RELAYS_PADRAO.slice(), servers: SERVIDORES_PADRAO.slice(), capabilities: {} }
    };
  }

  // 13 §4.0 — campos comuns; página (§4.1) e artigo (§4.2)
  function registroBase(titulo) {
    const t = agora();
    return { id: novoId(), slug: slug(titulo), aliases: [], title: String(titulo == null ? '' : titulo), description: '',
      body: '', body_format: 'markdown', status: 'draft', created_at: t, updated_at: t, published_hash: null, previous_status: null };
  }
  // 35 — a capa é DADO da página: o tema padrão não a desenha (decisão do
  // usuário em 2026-08-31), mas ela viaja no site.json para os temas a usarem.
  function novaPagina(titulo) { return Object.assign(registroBase(titulo), { in_menu: true, cover_media_id: null }); }
  function novoArtigo(titulo) { return Object.assign(registroBase(titulo), { date: agora(), excerpt: '', tags: [], cover_media_id: null }); }

  // 13 §4.3 — arquivo herdado: caminho do manifest que o site.json não descreve
  function midiaHerdada(path, sha256, servers) {
    const t = agora();
    return { id: novoId(), path: path, mime: mimePorCaminho(path), size: null, sha256: sha256, width: null, height: null,
      alt: '', caption: '', bytes: null, status: 'published', servers: Array.isArray(servers) ? servers.slice() : [],
      removal: null, metadata: { stripped: null, removed_segments: [], warning: null }, origin: 'network',
      created_at: t, updated_at: t, previous_status: null };
  }

  // 13 §4.4 — devolve { registro } (cópia nova), { apagar: true } ou null (transição inválida)
  function transicao(reg, acao) {
    if (!reg || typeof reg !== 'object') return null;
    const s = reg.status, t = agora();
    const com = (novo, extra) => ({ registro: Object.assign({}, reg, { status: novo, updated_at: t }, extra || {}) });
    switch (acao) {
      case 'editar':
        if (s === 'published') return com('modified');
        if (s === 'modified' || s === 'draft') return com(s);
        return null;
      case 'publicar':
        if (s === 'removed') return { apagar: true };
        if (STATUS.indexOf(s) !== -1) return com('published', { previous_status: null });
        return null;
      case 'remover':
        if (s === 'published' || s === 'modified') return com('removed', { previous_status: s });
        return null;
      case 'excluir':
        return s === 'draft' ? { apagar: true } : null;
      case 'desfazer_remocao':
        if (s !== 'removed') return null;
        return com(reg.previous_status === 'modified' ? 'modified' : 'published', { previous_status: null });
    }
    return null;
  }

  function contarPorStatus(lista) {
    const c = { draft: 0, published: 0, modified: 0, removed: 0, total: 0 };
    for (const r of lista || []) { if (r && c.hasOwnProperty(r.status)) c[r.status]++; c.total++; }
    return c;
  }
  function pendentes(c) { return (c.draft || 0) + (c.modified || 0) + (c.removed || 0); }

  return Object.freeze({
    SCHEMA_VERSION, RELAYS_PADRAO, SERVIDORES_PADRAO, GATEWAYS, RESERVADOS, CAMINHOS_RESERVADOS, CAMINHO_SITE_JSON, PREFIXO_BLOG, STATUS, MIME,
    agora, formatarData, formatarDataHora, dataDeUnix, novoId, slug, slugValido, caminhoDe, extensao, mimePorCaminho,
    normalizarUrl, uniao, urlDoSite, sitePadrao, novaPagina, novoArtigo, midiaHerdada, transicao, contarPorStatus, pendentes
  });
})();
