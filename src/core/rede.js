/* core/rede.js — reconstruir o estado do site a partir da npub (13 §6.3;
   06 §3 "abrir com site existente"): manifest 15128 nos relays → é a
   verdade do publicado → site.json (hash conferido) → banco local, com
   mesclagem por id; caminhos que o site.json não descreve viram arquivos
   herdados (13 §4.3, 14 T2c); guarda de publicação concorrente (13 §6.3
   item 5). Só leitura (M2). Nunca lança por falha de rede — devolve um
   desfecho: 'carregado' | 'herdado' | 'sem_site' | 'sem_rede' | 'cancelado'. */
const Rede = (function () {
  'use strict';

  const KIND_MANIFEST = 15128;
  const KINDS = Object.freeze([0, 10002, 10063, KIND_MANIFEST]);   // 05 §1 e §3
  const RE_SHA = /^[0-9a-f]{64}$/;

  // 05 §1 (empírico, 2026-08-18/25): tags path/server/relay/client/title/description
  function lerManifest(ev) {
    const m = { paths: {}, servers: [], relays: [], title: '', description: '', client: '' };
    for (const t of ev.tags || []) {
      if (!Array.isArray(t) || typeof t[0] !== 'string') continue;
      const k = t[0], v = t[1];
      if (k === 'path') {
        if (typeof v === 'string' && v.charAt(0) === '/' && v.length <= 500 && typeof t[2] === 'string' && RE_SHA.test(t[2].toLowerCase())) m.paths[v] = t[2].toLowerCase();
      } else if (k === 'server') { if (Blossom.urlValida(v)) m.servers = Modelo.uniao(m.servers, [v]); }
      else if (k === 'relay') { if (Relay.urlValida(v)) m.relays = Modelo.uniao(m.relays, [v]); }
      else if (k === 'title') { if (typeof v === 'string') m.title = v.slice(0, 200); }
      else if (k === 'description') { if (typeof v === 'string') m.description = v.slice(0, 1000); }
      else if (k === 'client') { if (typeof v === 'string') m.client = v.slice(0, 100); }
    }
    return m;
  }

  // Evento da rede é dado (02 G.0): autoria + assinatura conferidas, cópia limpa (P29).
  function eventosValidos(resultados, pubkey) {
    const vistos = new Set(), saida = [];
    for (const r of resultados) for (const e of r.eventos || []) {
      if (!e || vistos.has(e.id) || e.pubkey !== pubkey || KINDS.indexOf(e.kind) === -1) continue;
      if (!Chave.verificar(e)) continue;
      vistos.add(e.id); saida.push(Saude.limpo(e));
    }
    return saida;
  }
  function maisRecentePorKind(eventos) {
    const por = {};
    for (const e of eventos) if (!por[e.kind] || Saude.comparar(e, por[e.kind]) > 0) por[e.kind] = e;
    return por;
  }
  // kind 0 (05 §3): só strings, só o que o site usa
  function perfilDe(ev) {
    if (!ev) return null;
    let j; try { j = JSON.parse(ev.content); } catch (e) { return null; }
    if (!j || typeof j !== 'object') return null;
    const s = v => (typeof v === 'string' ? v.slice(0, 2000) : '');
    return { name: s(j.name || j.display_name), about: s(j.about), picture: s(j.picture) };
  }

  function respondeu(r) { return r.estado === 'ok' || r.estado === 'recusou' || (r.eventos && r.eventos.length > 0); }
  function contarRascunhos(l) {
    let n = 0;
    for (const lista of [l.pages, l.posts, l.media]) for (const r of lista) if (r.status === 'draft' || r.status === 'modified' || r.status === 'removed') n++;
    return n;
  }

  // Um nível de profundidade basta para o `site` (13 §3)
  function mesclarSite(base, extra) {
    const s = Object.assign({}, base);
    for (const k of Object.keys(extra || {})) {
      const v = extra[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && s[k] && typeof s[k] === 'object' && !Array.isArray(s[k])) s[k] = Object.assign({}, s[k], v);
      else s[k] = v;
    }
    return s;
  }
  // Quando o site.json manda: na PRIMEIRA carga deste banco (ainda sem
  // `published`) e na publicação concorrente — nos demais casos o local
  // fica (pode ter edições ainda não publicadas). As listas de rede nunca
  // são substituídas: local ∪ site.json ∪ manifest, e nunca se perde um
  // relay/servidor que acabou de funcionar (decisão M2-2).
  function montarSite(siteLocal, dadosSite, mapa, kind0, pubkey, npub, o) {
    const aplicarRede = !!dadosSite && (o.primeiraCarga || o.concorrente);
    const semRede = Object.assign({}, dadosSite || {}); delete semRede.network;
    const site = mesclarSite(siteLocal || Modelo.sitePadrao(pubkey, npub), aplicarRede ? semRede : {});
    site.pubkey = pubkey; site.npub = npub;
    const dr = (dadosSite && dadosSite.network) ? dadosSite.network : { relays: [], servers: [] };
    const lr = (siteLocal && siteLocal.network && Array.isArray(siteLocal.network.relays)) ? siteLocal.network.relays : [];
    const ls = (siteLocal && siteLocal.network && Array.isArray(siteLocal.network.servers)) ? siteLocal.network.servers : [];
    site.network = {
      relays: aplicarRede ? Modelo.uniao(lr, dr.relays.length ? dr.relays : o.relaysUsados, mapa.relays) : Modelo.uniao(lr.length ? lr : o.relaysUsados, mapa.relays),
      servers: aplicarRede ? Modelo.uniao(ls, dr.servers.length ? dr.servers : o.servidoresUsados, mapa.servers) : Modelo.uniao(ls.length ? ls : o.servidoresUsados, mapa.servers),
      capabilities: (siteLocal && siteLocal.network && siteLocal.network.capabilities) || {}
    };
    const perfil = perfilDe(kind0);
    if (!site.title) site.title = mapa.title || (perfil ? perfil.name : '') || '';
    if (!site.description) site.description = mapa.description || (perfil ? perfil.about : '') || '';
    site.profile = Object.assign({ name: '', about: '', picture_media_id: null }, site.profile || {});
    if (perfil) { if (!site.profile.name) site.profile.name = perfil.name; if (!site.profile.about) site.profile.about = perfil.about; }
    return site;
  }

  function publicado(r, agora) {
    return Object.assign({}, r, { status: 'published', created_at: agora, updated_at: agora, published_hash: null, previous_status: null });
  }
  function midiaPublicada(m, mapa, agora) {
    const sha = mapa.paths[m.path] || m.sha256;
    return Object.assign({}, m, { sha256: sha, bytes: null, status: 'published', servers: mapa.servers.slice(), removal: null,
      metadata: { stripped: null, removed_segments: [], warning: null }, origin: 'upload', created_at: agora, updated_at: agora, previous_status: null });
  }
  // 13 §5.1: o que o gerador produz (não é herdado)
  function caminhosGerados(pages, posts) {
    const s = new Set(['/index.html', Modelo.PREFIXO_BLOG + '/index.html', Modelo.CAMINHO_SITE_JSON].concat(Modelo.CAMINHOS_RESERVADOS));
    for (const p of pages) { s.add(Modelo.caminhoDe('page', p.slug)); for (const a of p.aliases || []) s.add(Modelo.caminhoDe('page', a)); }
    for (const p of posts) { s.add(Modelo.caminhoDe('post', p.slug)); for (const a of p.aliases || []) s.add(Modelo.caminhoDe('post', a)); }
    return s;
  }
  function ehGerado(path, gerados) { return gerados.has(path) || path.indexOf('/tema/') === 0; }
  // O que importa para o dono é o conteúdo publicado (path → sha256), não o
  // id/created_at do evento — dois manifests com o mesmo mapa não são uma
  // divergência real, ainda que relays inconsistentes na regra de empate de
  // evento substituível (NIP-01) tenham feito o id "vencedor" mudar.
  function chaveMapaDePaths(paths) { return Object.keys(paths).sort().map(p => p + '=' + paths[p]).join('\n'); }
  function mesmoConteudo(a, b) { return chaveMapaDePaths(lerManifest(a).paths) === chaveMapaDePaths(lerManifest(b).paths); }
  function serversPorHash(mapa) {
    const s = {};
    for (const p of Object.keys(mapa.paths)) s[mapa.paths[p]] = mapa.servers.slice();
    return s;
  }

  // 13 §6.3 itens 2 e 4 — por `id`; o publicado local é substituído pela
  // rede, o rascunho/alteração local fica (salvo publicação concorrente).
  function mesclarPorId(store, locais, daRede, concorrente, ops, sobrescritos) {
    const locaisPorId = new Map(locais.map(r => [r.id, r]));
    const idsRede = new Set(daRede.map(r => r.id));
    const apagar = [], gravar = [];
    for (const l of locais) if (!idsRede.has(l.id) && l.status === 'published') apagar.push(l);   // saiu do ar por outra máquina
    const slugsOcupados = new Map();
    for (const l of locais) if (!apagar.includes(l)) slugsOcupados.set(l.slug, l);
    for (const n of daRede) {
      const l = locaisPorId.get(n.id);
      if (l && l.status !== 'published' && !concorrente) continue;                     // local vence
      const v = l ? Object.assign({}, n, { created_at: l.created_at || n.created_at }) : n;
      if (l && l.status !== 'published') sobrescritos.push(store + ':' + (l.title || l.id));
      const dono = slugsOcupados.get(n.slug);
      if (dono && dono.id !== n.id && !apagar.includes(dono)) {                        // slug tomado por um rascunho local: o rascunho muda de slug
        let i = 2, novo = dono.slug + '-' + i;
        while (slugsOcupados.has(novo) || daRede.some(x => x.slug === novo)) { i++; novo = dono.slug + '-' + i; }
        const renomeado = Object.assign({}, dono, { slug: novo, updated_at: Modelo.agora() });
        slugsOcupados.delete(dono.slug); slugsOcupados.set(novo, renomeado);
        gravar.push(renomeado); sobrescritos.push(store + ':' + (dono.title || dono.id) + ' → slug ' + novo);
      }
      slugsOcupados.set(n.slug, v);
      gravar.push(v);
    }
    for (const a of apagar) ops.push({ op: 'del', store: store, chave: a.id });
    for (const g of gravar) ops.push({ op: 'put', store: store, valor: g });
  }

  // Mídia: a do site.json por `id`; os herdados por `path` (13 §4.3).
  function mesclarMidia(locais, daRede, herdados, mapa, concorrente, ops, sobrescritos) {
    const locaisPorId = new Map(locais.map(r => [r.id, r]));
    const idsRede = new Set(daRede.map(r => r.id));
    const pathsManifest = new Set(Object.keys(mapa.paths));
    const apagar = new Set(), gravar = [];
    for (const l of locais) {
      if (l.origin === 'network' && !pathsManifest.has(l.path)) apagar.add(l.id);                      // herdado que saiu do ar
      else if (l.origin !== 'network' && l.status === 'published' && !idsRede.has(l.id) && !pathsManifest.has(l.path)) apagar.add(l.id);
    }
    const porPath = new Map();
    for (const l of locais) if (!apagar.has(l.id)) porPath.set(l.path, l);
    for (const n of daRede) {
      const l = locaisPorId.get(n.id);
      if (l && l.status !== 'published' && !concorrente) continue;
      const v = l ? Object.assign({}, n, { created_at: l.created_at || n.created_at }) : n;
      if (l && l.status !== 'published') sobrescritos.push('media:' + (l.path || l.id));
      const dono = porPath.get(n.path);
      if (dono && dono.id !== n.id) {
        if (dono.origin === 'network' || dono.status === 'published') apagar.add(dono.id);            // o site.json agora descreve este caminho
        else { const novo = renomearPath(dono.path, porPath); const r = Object.assign({}, dono, { path: novo, updated_at: Modelo.agora() }); porPath.delete(dono.path); porPath.set(novo, r); gravar.push(r); sobrescritos.push('media:' + dono.path + ' → ' + novo); }
        porPath.delete(n.path);
      }
      porPath.set(n.path, v);
      gravar.push(v);
    }
    for (const hd of herdados) {
      const l = porPath.get(hd.path);
      if (!l) { porPath.set(hd.path, hd); gravar.push(hd); continue; }
      if (l.origin === 'network' || l.status === 'published') {
        if (l.sha256 !== hd.sha256 || (l.servers || []).join() !== hd.servers.join()) gravar.push(Object.assign({}, l, { sha256: hd.sha256, servers: hd.servers.slice(), status: 'published', updated_at: Modelo.agora() }));
      }
      // rascunho local com o mesmo caminho: fica (a rede não o conhece ainda)
    }
    for (const id of apagar) ops.push({ op: 'del', store: 'media', chave: id });
    for (const g of gravar) if (!apagar.has(g.id)) ops.push({ op: 'put', store: 'media', valor: g });
  }
  function renomearPath(path, ocupados) {
    const m = /^(.*?)(\.[a-z0-9]+)?$/i.exec(path);
    let i = 2, novo = m[1] + '-' + i + (m[2] || '');
    while (ocupados.has(novo)) { i++; novo = m[1] + '-' + i + (m[2] || ''); }
    return novo;
  }

  // Contagens para a moldura e T3 (14 §2, T3 cartões 2 e 3)
  async function contagens(db) {
    const pages = await db.getAll('pages'), posts = await db.getAll('posts'), media = await db.getAll('media');
    const c = { pages: Modelo.contarPorStatus(pages), posts: Modelo.contarPorStatus(posts), media: Modelo.contarPorStatus(media.filter(m => m.origin !== 'network')) };
    c.herdados = media.filter(m => m.origin === 'network').length;
    c.midiaSoLocal = media.filter(m => m.bytes && (!m.servers || !m.servers.length)).length;
    c.pendentes = Modelo.pendentes(c.pages) + Modelo.pendentes(c.posts) + Modelo.pendentes(c.media);
    c.novos = c.pages.draft + c.posts.draft + c.media.draft;
    c.alterados = c.pages.modified + c.posts.modified + c.media.modified;
    c.aRemover = c.pages.removed + c.posts.removed + c.media.removed;
    return c;
  }

  // { db, pubkey, npub, sinal?, progresso?, timeoutRelayMs?, timeoutBlobMs? }
  async function reconstruir(o) {
    const db = o.db, pubkey = o.pubkey, npub = o.npub, sinal = o.sinal || null;
    const prog = typeof o.progresso === 'function' ? function (p) { try { o.progresso(p); } catch (e) {} } : function () {};
    const tRelay = o.timeoutRelayMs || Relay.TIMEOUT_PADRAO_MS, tBlob = o.timeoutBlobMs || Blossom.TIMEOUT_PADRAO_MS;
    const cancelado = () => !!(sinal && sinal.aborted);

    // 0. o que já está neste navegador
    const siteLocal = (await db.get('site', 'site')) || null;
    const publicadoLocal = (await db.get('published', 'current')) || null;
    const locais = { pages: await db.getAll('pages'), posts: await db.getAll('posts'), media: await db.getAll('media') };
    const tinhaConteudo = locais.pages.length + locais.posts.length + locais.media.length > 0;
    const rascunhosAntes = contarRascunhos(locais);
    const relays = (siteLocal && siteLocal.network && Array.isArray(siteLocal.network.relays) && siteLocal.network.relays.length) ? Modelo.uniao(siteLocal.network.relays) : Modelo.RELAYS_PADRAO.slice();

    // 1. relays
    let respondidos = 0;
    prog({ passo: 'relays', total: relays.length, respondidos: 0 });
    const resultados = await Relay.consultar(relays, { kinds: KINDS.slice(), authors: [pubkey] }, {
      timeoutMs: tRelay, sinal: sinal,
      aoRelay: function (r) { if (respondeu(r)) respondidos++; prog({ passo: 'relays', total: relays.length, respondidos: respondidos, relay: r.url, estado: r.estado }); }
    });
    if (cancelado()) return { desfecho: 'cancelado' };
    const naoResponderam = resultados.filter(r => !respondeu(r)).map(r => r.url);
    const placar = { total: relays.length, respondidos: relays.length - naoResponderam.length, naoResponderam: naoResponderam,
      resultados: resultados.map(r => ({ url: r.url, estado: r.estado, eventos: r.eventos.length, ms: r.ms, detalhe: r.detalhe })) };
    prog({ passo: 'relays_fim', total: placar.total, respondidos: placar.respondidos, naoResponderam: naoResponderam });
    if (placar.respondidos === 0) return { desfecho: 'sem_rede', placar: placar, tinhaConteudo: tinhaConteudo, siteLocal: siteLocal };

    // 2. o manifest
    const porKind = maisRecentePorKind(eventosValidos(resultados, pubkey));
    let manifest = porKind[KIND_MANIFEST] || null;
    if (!manifest) {
      prog({ passo: 'site', encontrado: false });
      return { desfecho: 'sem_site', placar: placar, tinhaConteudo: tinhaConteudo, siteLocal: siteLocal, metadata: porKind };
    }
    let concorrente = false, redeAntiga = false;
    if (publicadoLocal && publicadoLocal.manifest_event && publicadoLocal.manifest_event_id !== manifest.id
        && !mesmoConteudo(manifest, publicadoLocal.manifest_event)) {
      if (Saude.comparar(manifest, publicadoLocal.manifest_event) < 0) redeAntiga = true;   // o local publicou algo que hoje nenhum relay que respondeu tem
      else concorrente = true;                                                              // 13 §6.3 item 5
    }
    const referencia = redeAntiga ? Saude.limpo(publicadoLocal.manifest_event) : manifest;
    const classificacao = Saude.classificar(resultados, pubkey, referencia);
    const agora = Modelo.agora();
    prog({ passo: 'site', encontrado: true, relays: classificacao.listas.atual.length + classificacao.listas.antigo.length + classificacao.listas.mais_novo.length });

    if (redeAntiga) {
      // Não sobrescrever o local com uma versão mais velha: só a saúde muda.
      const health = Saude.saudeDe(classificacao, agora);
      await db.escrever([{ op: 'put', store: 'published', chave: 'current', valor: Object.assign({}, publicadoLocal, { health: health, relays: classificacao.por_relay }) }]);
      prog({ passo: 'saude', classificacao: classificacao });
      const c = await contagens(db);
      return { desfecho: siteLocal && Object.keys(publicadoLocal.paths || {}).indexOf(Modelo.CAMINHO_SITE_JSON) !== -1 ? 'carregado' : 'herdado', redeAntiga: true, placar: placar, manifest: referencia,
        mapa: lerManifest(referencia), siteJson: { estado: 'local' }, site: siteLocal, classificacao: classificacao, concorrente: false, tinhaConteudo: tinhaConteudo,
        resumo: { pages: c.pages.total, posts: c.posts.total, media: c.media.total, herdados: c.herdados, rascunhosPreservados: rascunhosAntes, sobrescritos: [], ultimaPublicacao: Modelo.formatarData(Modelo.dataDeUnix(referencia.created_at)) } };
    }

    // 3. site.json (13 §6)
    const mapa = lerManifest(manifest);
    const shaSiteJson = mapa.paths[Modelo.CAMINHO_SITE_JSON] || null;
    const servidores = Modelo.uniao(mapa.servers, siteLocal && siteLocal.network ? siteLocal.network.servers : [], Modelo.SERVIDORES_PADRAO);
    let siteJson = { estado: 'ausente' }, dados = null;
    if (shaSiteJson) {
      prog({ passo: 'site_json', estado: 'baixando' });
      const b = await Blossom.baixar(servidores, shaSiteJson, { timeoutMs: tBlob, sinal: sinal });
      if (cancelado()) return { desfecho: 'cancelado' };
      if (!b.ok) siteJson = { estado: b.tentativas.some(t => t.estado === 'hash_diferente') ? 'hash_diferente' : 'falhou', tentativas: b.tentativas };
      else {
        let texto = null;
        try { texto = SiteJson.decodificar(b.bytes); } catch (e) { texto = null; }
        const lido = texto == null ? { ok: false, codigo: 'json', motivo: Textos.siteJson.invalido } : SiteJson.ler(texto);
        if (lido.ok) { siteJson = { estado: 'ok', servidor: b.servidor, ignorados: lido.ignorados, version: lido.version }; dados = lido.dados; }
        else siteJson = { estado: lido.codigo === 'versao_maior' ? 'mais_novo' : 'invalido', motivo: lido.motivo };
      }
    }
    prog({ passo: 'site_json', estado: siteJson.estado });

    // 4. registros que a rede descreve
    const site = montarSite(siteLocal, dados ? dados.site : null, mapa, porKind[0] || null, pubkey, npub,
      { primeiraCarga: !publicadoLocal, concorrente: concorrente, relaysUsados: relays, servidoresUsados: (siteLocal && siteLocal.network && siteLocal.network.servers && siteLocal.network.servers.length) ? siteLocal.network.servers : Modelo.SERVIDORES_PADRAO.slice() });
    if (dados && dados.theme) site.theme = Object.assign({}, site.theme, dados.theme);
    const rede = { pages: [], posts: [], media: [], herdados: [] };
    if (dados) {
      rede.pages = dados.pages.map(p => publicado(p, agora));
      rede.posts = dados.posts.map(p => publicado(p, agora));
      rede.media = dados.media.map(m => midiaPublicada(m, mapa, agora));
    }
    const gerados = caminhosGerados(rede.pages, rede.posts), descritos = new Set(rede.media.map(m => m.path));
    for (const path of Object.keys(mapa.paths)) {
      if (descritos.has(path)) continue;
      if (dados && ehGerado(path, gerados)) continue;
      rede.herdados.push(Modelo.midiaHerdada(path, mapa.paths[path], mapa.servers));
    }

    // 5. mesclar com o local (13 §6.3) e gravar numa transação só
    const ops = [], sobrescritos = [];
    ops.push({ op: 'put', store: 'site', chave: 'site', valor: site });
    mesclarPorId('pages', locais.pages, rede.pages, concorrente, ops, sobrescritos);
    mesclarPorId('posts', locais.posts, rede.posts, concorrente, ops, sobrescritos);
    mesclarMidia(locais.media, rede.media, rede.herdados, mapa, concorrente, ops, sobrescritos);
    const published = {
      manifest_event: manifest, manifest_event_id: manifest.id, created_at: manifest.created_at,
      paths: mapa.paths, relays: classificacao.por_relay, servers: serversPorHash(mapa),
      metadata_events: { kind0: porKind[0] || null, kind10002: porKind[10002] || null, kind10063: porKind[10063] || null },
      health: Saude.saudeDe(classificacao, agora)
    };
    ops.push({ op: 'put', store: 'published', chave: 'current', valor: published });
    ops.push({ op: 'put', store: 'meta', valor: { key: 'last_network_load_at', value: agora } });
    if (tinhaConteudo) prog({ passo: 'juntar', rascunhos: rascunhosAntes });
    await db.escrever(ops);
    prog({ passo: 'saude', classificacao: classificacao });

    // 6. resumo (14 T2 "Site carregado: …")
    const c = await contagens(db);
    const resumo = { pages: c.pages.total, posts: c.posts.total, media: c.media.total, herdados: c.herdados,
      rascunhosPreservados: tinhaConteudo ? rascunhosAntes : 0, sobrescritos: sobrescritos, ignoradosNoSiteJson: siteJson.ignorados || 0,
      ultimaPublicacao: Modelo.formatarData(Modelo.dataDeUnix(manifest.created_at)) };
    return { desfecho: dados ? 'carregado' : 'herdado', placar: placar, manifest: manifest, mapa: mapa, siteJson: siteJson, site: site,
      published: published, classificacao: classificacao, resumo: resumo, concorrente: concorrente, tinhaConteudo: tinhaConteudo };
  }

  // T2b "Começar um site novo" / "Continuar sem rede": site com defaults e uma Home rascunho (14 T2)
  async function criarSiteNovo(db, pubkey, npub) {
    const site = Modelo.sitePadrao(pubkey, npub);
    const home = Modelo.novaPagina(Textos.t2.tituloHome);
    site.home = { mode: 'page', page_id: home.id, latest_posts: 5 };
    site.menu = [{ type: 'page', page_id: home.id }, { type: 'blog' }];
    await db.escrever([{ op: 'put', store: 'site', chave: 'site', valor: site }, { op: 'put', store: 'pages', valor: home }]);
    return site;
  }

  return Object.freeze({ KIND_MANIFEST, KINDS, lerManifest, eventosValidos, maisRecentePorKind, perfilDe, contagens, reconstruir, criarSiteNovo });
})();
