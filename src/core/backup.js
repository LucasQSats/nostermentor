/* core/backup.js — o backup exportável (13 §7; D16 de 04): a ÚNICA cópia
   durável dos rascunhos e da mídia ainda não publicada. Exportar = um JSON
   com format/version/exported_at, tudo do banco, a mídia como bytes_base64
   pela regra de 13 §7.2 (só-aqui sempre; já publicada só no "completo") e
   o TRIPWIRE de 13 §7.3: se o texto contiver uma nsec, aborta em vez de
   gravar. Importar = lista branca de campos e tipos (o arquivo é dado),
   versão maior recusada com o texto de 13 §7.4, backup de outra chave
   recusado (salvo confirmação explícita), mesclagem por id com o
   updated_at mais recente vencendo (13 §6.3 item 3; 14 T9). Sem DOM. */
const Backup = (function () {
  'use strict';

  const FORMATO = 'nostermentor-backup';
  const RE_NSEC = /nsec1[023456789acdefghjklmnpqrstuvwxyz]{58}/;
  const RE_SHA = /^[0-9a-f]{64}$/, RE_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
  const eStr = v => typeof v === 'string';
  const obj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const arr = v => (Array.isArray(v) ? v : []);
  const str = (v, max) => (eStr(v) ? v.slice(0, max) : '');
  const idValido = v => eStr(v) && v.length > 0 && v.length <= 64 && /^[A-Za-z0-9_-]+$/.test(v);
  const iso = (v, padrao) => (eStr(v) && RE_ISO.test(v) ? v : padrao);
  const statusValido = v => (Modelo.STATUS.indexOf(v) !== -1 ? v : 'draft');
  const urlsHttps = l => arr(l).filter(u => eStr(u) && Blossom.urlValida(u)).map(Modelo.normalizarUrl);

  function nomeArquivo(npub, quando) { return 'nostermentor-backup-' + Chave.npub8(npub) + '-' + Modelo.formatarData(quando || Modelo.agora()) + '.json'; }

  // --- base64 sem fetch (a CSP barra fetch a data:) ------------------------
  function blobParaBase64(blob) {
    return new Promise(function (resolve, reject) {
      const r = new FileReader();
      r.onload = function () { const s = String(r.result); resolve(s.slice(s.indexOf(',') + 1)); };
      r.onerror = function () { reject(r.error || new Error('falha ao ler o arquivo')); };
      r.readAsDataURL(blob);
    });
  }
  function base64ParaBytes(b64) {
    const s = String(b64 || '').replace(/\s+/g, '');
    const out = new Uint8Array(Math.floor(s.length * 3 / 4));
    let o = 0;
    const PASSO = 1048576;   // múltiplo de 4: cada fatia é base64 válido
    for (let i = 0; i < s.length; i += PASSO) {
      const bin = atob(s.slice(i, i + PASSO));
      for (let j = 0; j < bin.length; j++) out[o++] = bin.charCodeAt(j);
    }
    return out.subarray(0, o);
  }

  // 13 §7.2 — que mídia leva bytes
  function levaBytes(m, completo) {
    if (!m || !m.bytes) return false;
    const soAqui = !m.servers || !m.servers.length;
    return soAqui || !!completo;
  }
  function tamanhoDe(m) { return m && m.bytes && typeof m.bytes.size === 'number' ? m.bytes.size : (Number.isInteger(m && m.size) ? m.size : 0); }

  async function lerTudo(db) {
    return { site: (await db.get('site', 'site')) || null, pages: await db.getAll('pages'), posts: await db.getAll('posts'), media: await db.getAll('media'), published: (await db.get('published', 'current')) || null };
  }

  // Estimativa em bytes antes de gerar (14 T9: "~X MB; a mídia ocupa 33 % a mais")
  async function estimar(db, completo) {
    const t = await lerTudo(db);
    const semBytes = { site: t.site, pages: t.pages, posts: t.posts, media: t.media.map(m => Object.assign({}, m, { bytes: null })), published: t.published };
    let n = JSON.stringify(semBytes).length + 200;
    let midia = 0, arquivos = 0;
    for (const m of t.media) if (levaBytes(m, completo)) { midia += Math.ceil(tamanhoDe(m) * 4 / 3); arquivos++; }
    return { bytes: n + midia, midia: midia, arquivos: arquivos, soAqui: t.media.filter(m => m.bytes && (!m.servers || !m.servers.length)).length };
  }

  // → { texto, blob, bytes, nome, exported_at, contagens } ou lança (codigo 'tripwire')
  async function exportar(db, o) {
    const t = await lerTudo(db);
    const site = t.site || Modelo.sitePadrao(o.pubkey, o.npub);
    const media = [];
    for (const m of t.media) {
      const c = Object.assign({}, m); delete c.bytes;
      c.bytes_base64 = levaBytes(m, o.completo) ? await blobParaBase64(m.bytes) : null;
      media.push(c);
    }
    const exported_at = Modelo.agora();
    const dados = { format: FORMATO, version: Modelo.SCHEMA_VERSION, exported_at: exported_at, app_version: window.APP_VERSION,
      site: site, pages: t.pages, posts: t.posts, media: media, published: t.published, meta: { schema_version: Modelo.SCHEMA_VERSION } };
    const texto = JSON.stringify(dados);
    if (RE_NSEC.test(texto)) { const err = new Error(Textos.t9.exportar.tripwire); err.codigo = 'tripwire'; throw err; }
    const blob = new Blob([texto], { type: 'application/json' });
    return { texto: texto, blob: blob, bytes: blob.size, nome: nomeArquivo(o.npub, exported_at), exported_at: exported_at,
      contagens: { pages: t.pages.length, posts: t.posts.length, media: media.length, comArquivo: media.filter(m => m.bytes_base64).length } };
  }

  // --- leitura (lista branca) ----------------------------------------------
  function lerComum(p, agora) {
    if (!obj(p) || !idValido(p.id) || !eStr(p.slug) || !eStr(p.title)) return null;
    const status = statusValido(p.status);
    return { id: p.id, slug: p.slug.slice(0, 120), aliases: arr(p.aliases).filter(eStr).map(a => a.slice(0, 120)).slice(0, 50), title: p.title.slice(0, 300),
      description: str(p.description, 1000), body: str(p.body, 5000000), body_format: 'markdown', status: status,
      created_at: iso(p.created_at, agora), updated_at: iso(p.updated_at, agora),
      published_hash: eStr(p.published_hash) && RE_SHA.test(p.published_hash) ? p.published_hash : null,
      previous_status: status === 'removed' && (p.previous_status === 'published' || p.previous_status === 'modified') ? p.previous_status : null };
  }
  function lerPagina(p, agora) { const c = lerComum(p, agora); if (!c) return null; c.in_menu = p.in_menu === true; return c; }
  function lerArtigo(p, agora) {
    const c = lerComum(p, agora); if (!c) return null;
    c.date = eStr(p.date) && /^\d{4}-\d{2}-\d{2}/.test(p.date) ? p.date.slice(0, 25) : agora;
    c.excerpt = str(p.excerpt, 2000); c.tags = arr(p.tags).filter(eStr).map(t => t.toLowerCase().slice(0, 100)).slice(0, 50); c.cover_media_id = idValido(p.cover_media_id) ? p.cover_media_id : null;
    return c;
  }
  function lerMidia(m, agora) {
    if (!obj(m) || !idValido(m.id) || !eStr(m.path) || m.path.charAt(0) !== '/') return null;
    const status = statusValido(m.status);
    const rem = obj(m.removal) ? { deleted_from: urlsHttps(m.removal.deleted_from), refused_by: urlsHttps(m.removal.refused_by), unverified: urlsHttps(m.removal.unverified) } : null;
    const md = obj(m.metadata) ? m.metadata : {};
    let bytes = null;
    if (eStr(m.bytes_base64) && m.bytes_base64.length) { try { bytes = new Blob([base64ParaBytes(m.bytes_base64)], { type: eStr(m.mime) ? m.mime : '' }); } catch (e) { bytes = null; } }
    return { id: m.id, path: m.path.slice(0, 500), mime: eStr(m.mime) ? m.mime.slice(0, 100) : Modelo.mimePorCaminho(m.path),
      size: Number.isInteger(m.size) && m.size >= 0 ? m.size : (bytes ? bytes.size : null), sha256: eStr(m.sha256) && RE_SHA.test(m.sha256) ? m.sha256 : null,
      width: Number.isInteger(m.width) ? m.width : null, height: Number.isInteger(m.height) ? m.height : null, alt: str(m.alt, 500), caption: str(m.caption, 1000),
      bytes: bytes, status: status, servers: urlsHttps(m.servers), removal: rem,
      metadata: { stripped: md.stripped === true ? true : (md.stripped === false ? false : null), removed_segments: arr(md.removed_segments).filter(eStr).slice(0, 20), warning: eStr(md.warning) ? md.warning.slice(0, 200) : null },
      origin: m.origin === 'network' ? 'network' : 'upload', created_at: iso(m.created_at, agora), updated_at: iso(m.updated_at, agora),
      previous_status: status === 'removed' && (m.previous_status === 'published' || m.previous_status === 'modified') ? m.previous_status : null };
  }
  function lerPublicado(p, pubkey) {
    if (!obj(p) || !obj(p.manifest_event)) return null;
    const ev = p.manifest_event;
    if (ev.pubkey !== pubkey || ev.kind !== Rede.KIND_MANIFEST || !Chave.verificar(ev)) return null;
    const limpo = Saude.limpo(ev);
    const paths = {};
    if (obj(p.paths)) for (const k of Object.keys(p.paths)) if (k.charAt(0) === '/' && eStr(p.paths[k]) && RE_SHA.test(p.paths[k])) paths[k] = p.paths[k];
    const meta = { kind0: null, kind10002: null, kind10063: null };
    if (obj(p.metadata_events)) for (const k of Object.keys(meta)) { const e = p.metadata_events[k]; if (obj(e) && e.pubkey === pubkey && Chave.verificar(e)) meta[k] = Saude.limpo(e); }
    const listas = ['relays_with_manifest', 'relays_outdated', 'relays_newer', 'relays_missing', 'relays_unreachable'];
    const health = { checked_at: iso(obj(p.health) ? p.health.checked_at : null, Modelo.agora()) };
    for (const l of listas) health[l] = obj(p.health) ? arr(p.health[l]).filter(u => eStr(u) && Relay.urlValida(u)) : [];
    return { manifest_event: limpo, manifest_event_id: limpo.id, created_at: limpo.created_at, paths: paths,
      relays: obj(p.relays) ? p.relays : {}, servers: obj(p.servers) ? p.servers : {}, metadata_events: meta, health: health };
  }
  function semDuplicados(lista) { const ids = new Set(), s = []; for (const r of lista) { if (ids.has(r.id)) continue; ids.add(r.id); s.push(r); } return s; }

  // texto do arquivo + sessão { pubkey, npub } → análise sem tocar no banco (14 T9: resumo antes de mexer)
  function analisar(texto, sessao) {
    if (RE_NSEC.test(String(texto || ''))) return { ok: false, codigo: 'tripwire', motivo: Textos.t9.importar.tripwire };
    let j;
    try { j = JSON.parse(texto); } catch (e) { return { ok: false, codigo: 'json', motivo: Textos.t9.importar.invalido }; }
    if (!obj(j) || j.format !== FORMATO) return { ok: false, codigo: 'formato', motivo: Textos.t9.importar.invalido };
    if (!Number.isInteger(j.version) || j.version < 1) return { ok: false, codigo: 'estrutura', motivo: Textos.t9.importar.invalido };
    if (j.version > Modelo.SCHEMA_VERSION) return { ok: false, codigo: 'versao_maior', motivo: Textos.t9.importar.maisNovo, version: j.version };
    // migrações v(n) → v(n+1) entram aqui quando existirem (13 §7.4); hoje só há a 1
    const site = obj(j.site) ? j.site : {};
    const pubkey = eStr(site.pubkey) && /^[0-9a-f]{64}$/.test(site.pubkey) ? site.pubkey : null;
    const npub = eStr(site.npub) && /^npub1[023456789acdefghjklmnpqrstuvwxyz]{58}$/.test(site.npub) ? site.npub : null;
    const agora = Modelo.agora();
    const s = SiteJson.lerSite(site);
    const dados = {
      site: s, pages: semDuplicados(arr(j.pages).map(p => lerPagina(p, agora)).filter(Boolean)),
      posts: semDuplicados(arr(j.posts).map(p => lerArtigo(p, agora)).filter(Boolean)),
      media: semDuplicados(arr(j.media).map(m => lerMidia(m, agora)).filter(Boolean)),
      published: pubkey ? lerPublicado(j.published, pubkey) : null
    };
    const mesmaChave = !!(sessao && pubkey && sessao.pubkey === pubkey);
    return { ok: true, version: j.version, exported_at: iso(j.exported_at, ''), app_version: str(j.app_version, 40), pubkey: pubkey, npub: npub, mesmaChave: mesmaChave, dados: dados,
      contagens: { pages: dados.pages.length, posts: dados.posts.length, media: dados.media.length, comArquivo: dados.media.filter(m => m.bytes).length } };
  }

  // O que "Juntar" faria (14 T9): por id, updated_at mais recente vence
  async function planejar(db, dados) {
    const plano = { novos: [], atualizados: [], iguais: [], locais: [] };
    for (const [store, lista] of [['pages', dados.pages], ['posts', dados.posts], ['media', dados.media]]) {
      const locais = new Map((await db.getAll(store)).map(r => [r.id, r]));
      for (const r of lista) {
        const l = locais.get(r.id);
        const item = { store: store, id: r.id, rotulo: (l && (l.title || l.path)) || r.title || r.path || r.id, registro: r, local: l || null };   // rótulo = o que o dono vê hoje
        if (!l) plano.novos.push(item);
        else { const c = String(r.updated_at).localeCompare(String(l.updated_at)); (c > 0 ? plano.atualizados : c === 0 ? plano.iguais : plano.locais).push(item); }
      }
    }
    return plano;
  }

  function renomearSlug(slug, ocupados) { let i = 2, n = slug + '-' + i; while (ocupados.has(n)) { i++; n = slug + '-' + i; } return n; }
  function renomearPath(path, ocupados) { const m = /^(.*?)(\.[a-z0-9]+)?$/i.exec(path); let i = 2, n = m[1] + '-' + i + (m[2] || ''); while (ocupados.has(n)) { i++; n = m[1] + '-' + i + (m[2] || ''); } return n; }

  // dados (de analisar) + { modo: 'juntar' | 'substituir', pubkey, npub, mesmaChave } → resultado
  async function importar(db, analise, o) {
    const dados = analise.dados, agora = Modelo.agora();
    const site = Object.assign(Modelo.sitePadrao(o.pubkey, o.npub), dados.site, { pubkey: o.pubkey, npub: o.npub });
    site.network = { relays: dados.site.network && dados.site.network.relays.length ? dados.site.network.relays : Modelo.RELAYS_PADRAO.slice(), servers: dados.site.network && dados.site.network.servers.length ? dados.site.network.servers : Modelo.SERVIDORES_PADRAO.slice(), capabilities: {} };
    const published = analise.mesmaChave ? dados.published : null;   // um manifest assinado por OUTRA chave nunca vira "publicado" desta
    const ops = [], sobrescritos = [], renomeados = [];
    let resultado;
    if (o.modo === 'substituir') {
      await db.limparTudo();
      ops.push({ op: 'put', store: 'meta', valor: { key: 'schema_version', value: Modelo.SCHEMA_VERSION } }, { op: 'put', store: 'meta', valor: { key: 'app_version', value: window.APP_VERSION } });
      ops.push({ op: 'put', store: 'site', chave: 'site', valor: site });
      for (const p of dados.pages) ops.push({ op: 'put', store: 'pages', valor: p });
      for (const p of dados.posts) ops.push({ op: 'put', store: 'posts', valor: p });
      for (const m of dados.media) ops.push({ op: 'put', store: 'media', valor: m });
      if (published) ops.push({ op: 'put', store: 'published', chave: 'current', valor: published });
      ops.push({ op: 'put', store: 'meta', valor: { key: 'last_export_at', value: analise.exported_at || agora } }, { op: 'put', store: 'meta', valor: { key: 'alteracoes_nao_exportadas', value: 0 } });
      resultado = { modo: 'substituir', novos: dados.pages.length + dados.posts.length + dados.media.length, atualizados: 0, iguais: 0, locais: 0 };
    } else {
      const t = await lerTudo(db);
      const vazio = !t.pages.length && !t.posts.length && !t.media.length;   // sem conteúdo (o `site` existe sempre depois de T2)
      const plano = await planejar(db, dados);
      const entram = plano.novos.concat(plano.atualizados);
      // colisões de slug/path com registros locais de OUTRO id que ficam: o que entra é renomeado
      const ocupados = { pages: new Set(), posts: new Set(), media: new Set() };
      const entramIds = new Set(entram.map(i => i.id));
      for (const l of t.pages) if (!entramIds.has(l.id)) { ocupados.pages.add(l.slug); for (const a of l.aliases || []) ocupados.pages.add(a); }
      for (const l of t.posts) if (!entramIds.has(l.id)) { ocupados.posts.add(l.slug); for (const a of l.aliases || []) ocupados.posts.add(a); }
      for (const l of t.media) if (!entramIds.has(l.id)) ocupados.media.add(l.path);
      for (const it of entram) {
        let r = it.registro;
        if (it.store === 'media') { if (ocupados.media.has(r.path)) { const n = renomearPath(r.path, ocupados.media); renomeados.push(r.path + ' → ' + n); r = Object.assign({}, r, { path: n, updated_at: agora }); } ocupados.media.add(r.path); }
        else { if (ocupados[it.store].has(r.slug)) { const n = renomearSlug(r.slug, ocupados[it.store]); renomeados.push(r.slug + ' → ' + n); r = Object.assign({}, r, { slug: n, updated_at: agora }); } ocupados[it.store].add(r.slug); for (const a of r.aliases || []) ocupados[it.store].add(a); }
        if (it.local) sobrescritos.push(it.rotulo);
        ops.push({ op: 'put', store: it.store, valor: r });
      }
      if (!t.site) ops.push({ op: 'put', store: 'site', chave: 'site', valor: site });
      else { const s = Object.assign({}, t.site); s.network = Object.assign({}, t.site.network, { relays: Modelo.uniao(t.site.network.relays, site.network.relays), servers: Modelo.uniao(t.site.network.servers, site.network.servers) }); ops.push({ op: 'put', store: 'site', chave: 'site', valor: s }); }
      if (published && (!t.published || !t.published.manifest_event || Saude.comparar(published.manifest_event, t.published.manifest_event) > 0)) ops.push({ op: 'put', store: 'published', chave: 'current', valor: published });
      if (vazio) ops.push({ op: 'put', store: 'meta', valor: { key: 'last_export_at', value: analise.exported_at || agora } }, { op: 'put', store: 'meta', valor: { key: 'alteracoes_nao_exportadas', value: 0 } });
      resultado = { modo: 'juntar', novos: plano.novos.length, atualizados: plano.atualizados.length, iguais: plano.iguais.length, locais: plano.locais.length, bancoEstavaVazio: vazio };
    }
    await db.escrever(ops);
    resultado.sobrescritos = sobrescritos; resultado.renomeados = renomeados;
    resultado.site = (await db.get('site', 'site')) || site;
    return resultado;
  }

  return Object.freeze({ FORMATO, RE_NSEC, nomeArquivo, blobParaBase64, base64ParaBytes, levaBytes, estimar, exportar, analisar, planejar, importar });
})();
