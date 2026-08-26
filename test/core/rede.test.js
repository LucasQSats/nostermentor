// test/core/rede.test.js — Rede.reconstruir (13 §6.3) contra o servidor
// falso: carregado com site.json, reabrir sem duplicar (aceite 4), rascunho
// local preservado, publicação concorrente, herdados (T2c), sem_site,
// sem_rede, manifest forjado, hash errado, site.json de versão maior,
// kind 0 como fallback, cancelar, rede mais antiga que o local.
const { abrir, coletor, assert } = require('../util.js');
const F = require('../fabrica.js');

module.exports = async function (ctx, u) {
  const { R, it, pulado } = coletor();
  if (!u.falso) { pulado('core/rede (todos os casos)', 'servidor falso indisponível'); return R; }
  const p = await abrir(ctx, u.url);
  const f = u.falso, pg = p.pg;
  const ch = F.chave();
  const servers = [f.base];
  const relays = ['r-atual', 'r-antigo', 'r-vazio', 'r-mudo'].map(n => f.ws(n));
  const sj1 = F.siteExemplo(ch, { servers, relays: [f.ws('r-do-manifest')] });
  f.limparBlobs(); f.blob(sj1.bytes, 'application/json');
  const paths1 = F.pathsDoExemplo(sj1);
  const man1 = F.manifest(ch, { paths: paths1, servers, relays: [f.ws('r-do-manifest')], title: 'Título do manifest', description: 'desc', created_at: F.agora() - 100 });
  const man0 = F.manifest(ch, { paths: { '/index.html': F.sha256('velho') }, servers, created_at: F.agora() - 5000 });
  const k0 = F.perfil(ch, { name: 'Nome do kind 0', about: 'about do kind 0' }), k10002 = F.relayList(ch, relays), k10063 = F.serverList(ch, servers);
  f.relay('r-atual', { eventos: [man1, man0, k0, k10002, k10063] });
  f.relay('r-antigo', { eventos: [man0] });
  f.relay('r-vazio', { modo: 'vazio' });
  f.relay('r-mudo', { modo: 'mudo' });

  // seed do banco: relays/servidores apontando para o falso (como T7 §Avançado fará)
  const semear = (cfg) => pg.evaluate(async ([pk, npub, cfg]) => { await Db.apagar(pk); const db = await Db.abrir(pk); const s = Modelo.sitePadrao(pk, npub); s.network.relays = cfg.relays; s.network.servers = cfg.servers; await db.put('site', s, 'site'); db.fechar(); }, [ch.pubkey, ch.npub, cfg]);
  const reconstruir = (extra) => pg.evaluate(async ([pk, npub, extra]) => {
    const db = await Db.abrir(pk); const passos = [];
    const r = await Rede.reconstruir(Object.assign({ db, pubkey: pk, npub, timeoutRelayMs: 2000, timeoutBlobMs: 5000, progresso: (x) => passos.push(x.passo + ':' + (x.estado || x.encontrado || x.respondidos || '')) }, extra || {}));
    const banco = { site: await db.get('site', 'site'), published: await db.get('published', 'current'), pages: await db.getAll('pages'), posts: await db.getAll('posts'), media: await db.getAll('media'), meta: await db.getAll('meta') };
    db.fechar();
    return JSON.parse(JSON.stringify({ r, banco, passos }));
  }, [ch.pubkey, ch.npub, extra || null]);

  await semear({ relays, servers });
  let primeira, paths2, man2;
  await it('carregado: manifest em 2 relays (1 antigo), site.json baixado com hash conferido → 2 páginas, 3 artigos, 1 mídia publicadas; nada herdado; site do site.json; metadados guardados', async () => {
    primeira = await reconstruir();
    const { r, banco } = primeira;
    assert(r.desfecho === 'carregado', r.desfecho + ' ' + JSON.stringify(r.siteJson) + ' ' + JSON.stringify(r.placar));
    assert(r.placar.respondidos === 3 && r.placar.naoResponderam[0] === f.ws('r-mudo'), JSON.stringify(r.placar));
    assert(r.siteJson.estado === 'ok' && r.siteJson.servidor === f.base, JSON.stringify(r.siteJson));
    assert(banco.pages.length === 2 && banco.posts.length === 3 && banco.media.length === 1 && banco.media[0].origin === 'upload' && banco.media[0].sha256 === sj1.dados.media[0].sha256 && banco.media[0].servers[0] === f.base, 'registros: ' + [banco.pages.length, banco.posts.length, banco.media.length]);
    assert(banco.pages.every(x => x.status === 'published' && x.published_hash === null && x.created_at) && banco.posts.every(x => x.status === 'published'), 'status');
    assert(banco.site.title === 'Site de Teste' && banco.site.home.page_id === 'p-home' && banco.site.donations.lightning_address === 'x@y.z' && banco.site.pubkey === ch.pubkey && banco.site.npub === ch.npub, JSON.stringify(banco.site).slice(0, 300));
    assert(banco.site.network.relays.includes(f.ws('r-do-manifest')) && banco.site.network.relays.length === 5 && banco.site.network.servers.includes(f.base), JSON.stringify(banco.site.network));
    assert(banco.published.manifest_event_id === man1.id && banco.published.manifest_event.sig === man1.sig && Object.keys(banco.published.paths).length === 11 && banco.published.metadata_events.kind0.id === k0.id && banco.published.metadata_events.kind10002.id === k10002.id && banco.published.metadata_events.kind10063.id === k10063.id, 'published');
    assert(banco.published.relays[f.ws('r-atual')] === 'atual' && banco.published.relays[f.ws('r-antigo')] === 'antigo' && banco.published.relays[f.ws('r-vazio')] === 'sem' && banco.published.relays[f.ws('r-mudo')] === 'nao_respondeu', JSON.stringify(banco.published.relays));
    assert(banco.published.health.relays_with_manifest.length === 1 && banco.published.health.relays_outdated.length === 1 && banco.published.health.checked_at, JSON.stringify(banco.published.health));
    assert(r.resumo.pages === 2 && r.resumo.posts === 3 && r.resumo.media === 1 && r.resumo.herdados === 0 && /^\d{4}-\d{2}-\d{2}$/.test(r.resumo.ultimaPublicacao) && r.concorrente === false && r.tinhaConteudo === false, JSON.stringify(r.resumo));
    assert(banco.meta.some(m => m.key === 'last_network_load_at'), 'meta');
    return primeira.passos.join(' ');
  });
  await it('aceite 4: reabrir com a mesma chave → mescla por id sem duplicar (mesmos ids, mesmas contagens, created_at preservado)', async () => {
    const seg = await reconstruir();
    assert(seg.r.desfecho === 'carregado' && seg.r.tinhaConteudo === true, seg.r.desfecho);
    const ids = (b) => [...b.pages, ...b.posts, ...b.media].map(x => x.id).sort().join(',');
    assert(ids(seg.banco) === ids(primeira.banco) && seg.banco.pages.length === 2 && seg.banco.posts.length === 3 && seg.banco.media.length === 1, ids(seg.banco));
    assert(seg.banco.pages[0].created_at === primeira.banco.pages.find(x => x.id === seg.banco.pages[0].id).created_at, 'created_at mudou ao reabrir');
    assert(seg.passos.includes('juntar:') || seg.passos.some(x => x.startsWith('juntar')), seg.passos.join(' '));
  });
  await it('rascunho e alteração locais sobrevivem à recarga (13 §6.3 item 4): draft novo fica; página "modified" não é sobrescrita; slug tomado por rascunho é renomeado', async () => {
    await pg.evaluate(async ([pk]) => { const db = await Db.abrir(pk);
      const sobre = await db.get('pages', 'p-sobre'); await db.put('pages', Object.assign({}, sobre, { status: 'modified', title: 'Sobre (editado aqui)' }));
      await db.put('pages', Object.assign(Modelo.novaPagina('Rascunho local'), { id: 'local-1' }));
      await db.put('pages', Object.assign(Modelo.novaPagina('Primeiro'), { id: 'local-2', slug: 'primeiro' }));   // slug igual ao de um artigo? não: páginas e artigos têm índices separados; usa slug 'inicio' para colidir com a home
      await db.put('pages', Object.assign(Modelo.novaPagina('Colide'), { id: 'local-3', slug: 'inicio-x' }));
      db.fechar(); }, [ch.pubkey]);
    const r = await reconstruir();
    const pages = r.banco.pages;
    const sobre = pages.find(x => x.id === 'p-sobre'), local = pages.find(x => x.id === 'local-1');
    assert(sobre.status === 'modified' && sobre.title === 'Sobre (editado aqui)', JSON.stringify(sobre));
    assert(local && local.status === 'draft' && pages.length === 5, 'páginas: ' + pages.map(x => x.id + ':' + x.status).join(','));
    assert(r.r.resumo.rascunhosPreservados === 4 && r.r.resumo.sobrescritos.length === 0, JSON.stringify(r.r.resumo));
  });
  await it('publicação concorrente (13 §6.3 item 5): manifest mais novo na rede → concorrente=true, a página "modified" é sobrescrita (e listada), o rascunho local fica; slug colidente de rascunho é renomeado', async () => {
    // rascunho local que toma o slug "novo-slug" que a rede vai usar
    await pg.evaluate(async ([pk]) => { const db = await Db.abrir(pk); await db.put('pages', Object.assign(Modelo.novaPagina('Toma o slug'), { id: 'local-4', slug: 'novidade' })); db.fechar(); }, [ch.pubkey]);
    const sj2 = F.siteExemplo(ch, { servers, mutar: (d) => { d.pages[1].title = 'Sobre (versão da rede)'; d.pages.push({ id: 'p-nova', slug: 'novidade', title: 'Novidade', body: 'x', body_format: 'markdown', in_menu: false }); d.posts.pop(); } });
    f.blob(sj2.bytes, 'application/json');
    paths2 = F.pathsDoExemplo(sj2); delete paths2['/blog/terceiro.html']; paths2['/novidade.html'] = F.sha256('n');
    man2 = F.manifest(ch, { paths: paths2, servers, created_at: F.agora() });
    f.relay('r-atual', { eventos: [man2, man1, k0] });
    const r = await reconstruir();
    assert(r.r.desfecho === 'carregado' && r.r.concorrente === true, JSON.stringify([r.r.desfecho, r.r.concorrente]));
    const pages = r.banco.pages, sobre = pages.find(x => x.id === 'p-sobre');
    assert(sobre.status === 'published' && sobre.title === 'Sobre (versão da rede)', JSON.stringify(sobre));
    assert(pages.find(x => x.id === 'local-1').status === 'draft', 'rascunho sumiu');
    const tomou = pages.find(x => x.id === 'local-4'), nova = pages.find(x => x.id === 'p-nova');
    assert(nova && nova.slug === 'novidade' && tomou && tomou.slug === 'novidade-2', JSON.stringify([tomou && tomou.slug, nova && nova.slug]));
    assert(r.banco.posts.length === 2 && !r.banco.posts.some(x => x.id === 'a-3'), 'artigo removido na rede continua local: ' + r.banco.posts.map(x => x.id));
    assert(r.r.resumo.sobrescritos.some(s => /Sobre/.test(s)) && r.r.resumo.sobrescritos.some(s => /novidade-2/.test(s)), JSON.stringify(r.r.resumo.sobrescritos));
    assert(r.banco.published.manifest_event_id === man2.id && r.banco.published.relays[f.ws('r-antigo')] === 'antigo', 'published');
    return 'sobrescritos: ' + r.r.resumo.sobrescritos.join(' | ');
  });
  await it('rede mais antiga que o local: relays só com o manifest anterior → local intacto, só a saúde muda (redeAntiga)', async () => {
    f.relay('r-atual', { eventos: [man1, k0] });
    const r = await reconstruir();
    assert(r.r.redeAntiga === true && r.banco.published.manifest_event_id !== man1.id && r.banco.pages.find(x => x.id === 'p-nova'), JSON.stringify([r.r.redeAntiga, r.r.desfecho]));
    assert(r.banco.published.relays[f.ws('r-atual')] === 'antigo' && r.banco.published.relays[f.ws('r-antigo')] === 'antigo', JSON.stringify(r.banco.published.relays));
  });
  await it('18: manifest com id/created_at diferente mas o MESMO mapa de caminhos → não é concorrente de verdade; rascunho local não publicado sobrevive', async () => {
    // rascunho local (status "modified") sobre um registro já publicado, sem publicar
    await pg.evaluate(async ([pk]) => { const db = await Db.abrir(pk); const sobre = await db.get('pages', 'p-sobre'); await db.put('pages', Object.assign({}, sobre, { status: 'modified', title: 'Sobre (rascunho ainda não publicado)' })); db.fechar(); }, [ch.pubkey]);
    // mesmo site.json/paths de man2 (nenhum arquivo mudou de verdade), só um evento novo, mais recente
    const man3 = F.manifest(ch, { paths: paths2, servers, created_at: F.agora() + 20 });
    f.relay('r-atual', { eventos: [man3, man2, k0] });
    const r = await reconstruir();
    assert(r.r.desfecho === 'carregado' && r.r.concorrente === false, JSON.stringify([r.r.desfecho, r.r.concorrente]));
    assert(r.r.resumo.sobrescritos.length === 0, JSON.stringify(r.r.resumo.sobrescritos));
    const sobre = r.banco.pages.find(x => x.id === 'p-sobre');
    assert(sobre.status === 'modified' && sobre.title === 'Sobre (rascunho ainda não publicado)', 'rascunho local foi perdido: ' + JSON.stringify(sobre));
    assert(r.banco.published.manifest_event_id === man3.id, 'published não acompanhou o evento mais novo');
  });

  // --- herdado (o caso do Bostil) -------------------------------------------
  const chB = F.chave();
  const pathsB = { '/index.html': F.sha256('i'), '/1f95a.png': F.sha256('p'), '/IntankavelBostil.mp4': F.sha256('v'), '/IntankavelBst.webp': F.sha256('w') };
  const manB = F.manifest(chB, { paths: pathsB, servers: ['https://cdn.exemplo.test'], relays: ['wss://relay.exemplo.test'], title: 'Império de Teste', description: 'desc B', client: 'nsyte' });
  const k0B = F.perfil(chB, { name: 'Perfil B', about: 'about B' });
  const semearB = (cfg) => pg.evaluate(async ([pk, npub, cfg]) => { await Db.apagar(pk); const db = await Db.abrir(pk); const s = Modelo.sitePadrao(pk, npub); s.network.relays = cfg.relays; s.network.servers = cfg.servers; await db.put('site', s, 'site'); db.fechar(); }, [chB.pubkey, chB.npub, cfg]);
  const reconstruirB = (extra) => pg.evaluate(async ([pk, npub, extra]) => { const db = await Db.abrir(pk); const r = await Rede.reconstruir(Object.assign({ db, pubkey: pk, npub, timeoutRelayMs: 2000, timeoutBlobMs: 5000 }, extra || {})); const banco = { site: await db.get('site', 'site'), published: await db.get('published', 'current'), pages: await db.getAll('pages'), media: await db.getAll('media') }; db.fechar(); return JSON.parse(JSON.stringify({ r, banco })); }, [chB.pubkey, chB.npub, extra || null]);
  let herdadoIds;
  await it('herdado (T2c): manifest sem site.json → 4 media origin network com sha/mime/servers do manifest; título do manifest; relays/servidores do manifest unidos aos locais', async () => {
    f.relay('r-b', { eventos: [manB, k0B] });
    await semearB({ relays: [f.ws('r-b'), f.ws('r-vazio')], servers });
    const r = await reconstruirB();
    assert(r.r.desfecho === 'herdado' && r.r.siteJson.estado === 'ausente', JSON.stringify([r.r.desfecho, r.r.siteJson]));
    const m = r.banco.media;
    assert(m.length === 4 && m.every(x => x.origin === 'network' && x.status === 'published' && x.bytes === null && x.servers[0] === 'https://cdn.exemplo.test'), JSON.stringify(m.map(x => [x.path, x.origin, x.servers])));
    assert(m.find(x => x.path === '/IntankavelBst.webp').mime === 'image/webp' && m.find(x => x.path === '/index.html').sha256 === pathsB['/index.html'], 'mime/sha');
    assert(r.banco.site.title === 'Império de Teste' && r.banco.site.description === 'desc B' && r.banco.site.profile.name === 'Perfil B', JSON.stringify([r.banco.site.title, r.banco.site.profile]));
    assert(r.banco.site.network.relays.includes('wss://relay.exemplo.test') && r.banco.site.network.servers.includes('https://cdn.exemplo.test'), JSON.stringify(r.banco.site.network));
    assert(r.r.resumo.herdados === 4 && r.r.resumo.media === 0 && r.banco.pages.length === 0, JSON.stringify(r.r.resumo));
    herdadoIds = m.map(x => x.id).sort().join(',');
  });
  await it('herdado: reabrir → os mesmos 4 (mesmos ids, sem duplicar); arquivo que saiu do manifest some; sha mudado atualiza no mesmo id', async () => {
    const r1 = await reconstruirB();
    assert(r1.banco.media.map(x => x.id).sort().join(',') === herdadoIds && r1.banco.media.length === 4, 'duplicou/mudou ids');
    const pathsB2 = Object.assign({}, pathsB); delete pathsB2['/1f95a.png']; pathsB2['/index.html'] = F.sha256('i2');
    f.relay('r-b', { eventos: [F.manifest(chB, { paths: pathsB2, servers: ['https://cdn.exemplo.test'], created_at: F.agora() + 10 }), manB] });
    const r2 = await reconstruirB();
    const idxAntes = r1.banco.media.find(x => x.path === '/index.html'), idxDepois = r2.banco.media.find(x => x.path === '/index.html');
    assert(r2.banco.media.length === 3 && !r2.banco.media.some(x => x.path === '/1f95a.png') && idxDepois.id === idxAntes.id && idxDepois.sha256 === F.sha256('i2'), JSON.stringify(r2.banco.media.map(x => [x.path, x.sha256.slice(0, 6)])));
    f.relay('r-b', { eventos: [manB, k0B] });
  });
  await it('kind 0 como fallback: manifest sem title/description → site.title/description vêm do kind 0', async () => {
    const chC = F.chave();
    f.relay('r-c', { eventos: [F.manifest(chC, { paths: { '/index.html': F.sha256('c') } }), F.perfil(chC, { name: 'Só kind 0', about: 'about C' })] });
    const r = await pg.evaluate(async ([pk, npub, url]) => { await Db.apagar(pk); const db = await Db.abrir(pk); const s = Modelo.sitePadrao(pk, npub); s.network.relays = [url]; await db.put('site', s, 'site'); const r = await Rede.reconstruir({ db, pubkey: pk, npub, timeoutRelayMs: 2000 }); const site = await db.get('site', 'site'); db.fechar(); await Db.apagar(pk); return { desfecho: r.desfecho, title: site.title, description: site.description }; }, [chC.pubkey, chC.npub, f.ws('r-c')]);
    assert(r.desfecho === 'herdado' && r.title === 'Só kind 0' && r.description === 'about C', JSON.stringify(r));
  });
  await it('sem_site: relays respondem (vazio + recusa) e não há manifest → sem_site, nada gravado além do site semeado', async () => {
    f.relay('r-recusa', { modo: 'recusa' });
    await semearB({ relays: [f.ws('r-vazio'), f.ws('r-recusa')], servers });
    const r = await reconstruirB();
    assert(r.r.desfecho === 'sem_site' && r.r.placar.respondidos === 2 && r.banco.published === undefined && r.banco.media.length === 0, JSON.stringify([r.r.desfecho, r.r.placar]));
  });
  await it('sem_rede: só relays mudos/porta fechada/inválidos → sem_rede (nenhum respondeu)', async () => {
    await semearB({ relays: [f.ws('r-mudo'), 'wss://127.0.0.1:1/x', 'https://invalido'], servers });
    const r = await reconstruirB();
    assert(r.r.desfecho === 'sem_rede' && r.r.placar.respondidos === 0 && r.r.placar.naoResponderam.length === 3, JSON.stringify(r.r.placar));
  });
  await it('manifest forjado (assinado por outra chave com pubkey trocada) e manifest de outra chave → ignorados → sem_site', async () => {
    const outra = F.chave();
    const forjado = Object.assign({}, F.manifest(outra, { paths: pathsB, skDe: outra.sk }), { pubkey: chB.pubkey });
    f.relay('r-forjado', { eventos: [forjado, F.manifest(outra, { paths: pathsB })] });
    await semearB({ relays: [f.ws('r-forjado')], servers });
    const r = await reconstruirB();
    assert(r.r.desfecho === 'sem_site' && r.banco.media.length === 0, JSON.stringify([r.r.desfecho, r.banco.media.length]));
  });
  await it('site.json com hash errado (servidor entrega outro conteúdo) → descartado, desfecho herdado com estado hash_diferente; os caminhos viram herdados', async () => {
    const chD = F.chave();
    const sjD = F.siteExemplo(chD, { servers });
    f.blobFalso(sjD.sha256, Buffer.from('{"format":"nostermentor-site","version":1,"pages":[{"id":"x","slug":"x","title":"invasor"}]}'), 'application/json');
    const pathsD = F.pathsDoExemplo(sjD);
    f.relay('r-d', { eventos: [F.manifest(chD, { paths: pathsD, servers })] });
    const r = await pg.evaluate(async ([pk, npub, url, servers]) => { await Db.apagar(pk); const db = await Db.abrir(pk); const s = Modelo.sitePadrao(pk, npub); s.network.relays = [url]; s.network.servers = servers; await db.put('site', s, 'site'); const r = await Rede.reconstruir({ db, pubkey: pk, npub, timeoutRelayMs: 2000, timeoutBlobMs: 5000 }); const b = { pages: await db.getAll('pages'), media: await db.getAll('media') }; db.fechar(); await Db.apagar(pk); return JSON.parse(JSON.stringify({ r, b })); }, [chD.pubkey, chD.npub, f.ws('r-d'), servers]);
    assert(r.r.desfecho === 'herdado' && r.r.siteJson.estado === 'hash_diferente', JSON.stringify(r.r.siteJson));
    assert(r.b.pages.length === 0 && r.b.media.length === 11 && r.b.media.some(x => x.path === '/nostermentor/site.json'), 'pages ' + r.b.pages.length + ' media ' + r.b.media.length);
    f.blob(sjD.bytes, 'application/json');
  });
  await it('site.json de versão maior → recusado com estado mais_novo; herdados preservados (nada é perdido)', async () => {
    const chE = F.chave();
    const sjE = F.siteExemplo(chE, { version: 2, servers });
    f.blob(sjE.bytes, 'application/json');
    f.relay('r-e', { eventos: [F.manifest(chE, { paths: F.pathsDoExemplo(sjE), servers })] });
    const r = await pg.evaluate(async ([pk, npub, url, servers]) => { await Db.apagar(pk); const db = await Db.abrir(pk); const s = Modelo.sitePadrao(pk, npub); s.network.relays = [url]; s.network.servers = servers; await db.put('site', s, 'site'); const r = await Rede.reconstruir({ db, pubkey: pk, npub, timeoutRelayMs: 2000, timeoutBlobMs: 5000 }); const n = (await db.getAll('media')).length; db.fechar(); await Db.apagar(pk); return { desfecho: r.desfecho, sj: r.siteJson, n }; }, [chE.pubkey, chE.npub, f.ws('r-e'), servers]);
    assert(r.desfecho === 'herdado' && r.sj.estado === 'mais_novo' && /mais novo/.test(r.sj.motivo) && r.n === 11, JSON.stringify(r));
  });
  await it('site.json indisponível (404 em todos os servidores) → estado falhou, desfecho herdado', async () => {
    const chF = F.chave();
    const sjF = F.siteExemplo(chF, { servers });
    f.relay('r-f', { eventos: [F.manifest(chF, { paths: F.pathsDoExemplo(sjF), servers })] });
    const r = await pg.evaluate(async ([pk, npub, url, servers]) => { await Db.apagar(pk); const db = await Db.abrir(pk); const s = Modelo.sitePadrao(pk, npub); s.network.relays = [url]; s.network.servers = servers; await db.put('site', s, 'site'); const r = await Rede.reconstruir({ db, pubkey: pk, npub, timeoutRelayMs: 2000, timeoutBlobMs: 5000 }); db.fechar(); await Db.apagar(pk); return { desfecho: r.desfecho, sj: r.siteJson }; }, [chF.pubkey, chF.npub, f.ws('r-f'), servers]);
    assert(r.desfecho === 'herdado' && r.sj.estado === 'falhou' && r.sj.tentativas[0].estado === 'http' && r.sj.tentativas[0].status === 404, JSON.stringify(r));
  });
  await it('cancelar durante os relays → desfecho cancelado, nada gravado', async () => {
    await semearB({ relays: [f.ws('r-mudo')], servers });
    const r = await pg.evaluate(async ([pk, npub]) => { const db = await Db.abrir(pk); const c = new AbortController(); setTimeout(() => c.abort(), 300); const r = await Rede.reconstruir({ db, pubkey: pk, npub, sinal: c.signal, timeoutRelayMs: 10000 }); const pub = await db.get('published', 'current'); db.fechar(); return { desfecho: r.desfecho, pub }; }, [chB.pubkey, chB.npub]);
    assert(r.desfecho === 'cancelado' && r.pub === undefined, JSON.stringify(r));
  });
  await it('lerManifest: tags path/server/relay/title/description/client; path sem barra, sha inválido, server http: e relay ws: caem', async () => {
    const r = await pg.evaluate(() => Rede.lerManifest({ tags: [['path', '/a.html', 'A'.repeat(64)], ['path', 'b.html', 'b'.repeat(64)], ['path', '/c', 'curto'], ['server', 'https://s/'], ['server', 'http://x'], ['relay', 'wss://r'], ['relay', 'ws://r'], ['title', 'T'], ['description', 'D'], ['client', 'nsyte'], ['x'], 'lixo', ['path']] }));
    assert(Object.keys(r.paths).join(',') === '/a.html' && r.paths['/a.html'] === 'a'.repeat(64) && r.servers.join() === 'https://s' && r.relays.join() === 'wss://r' && r.title === 'T' && r.description === 'D' && r.client === 'nsyte', JSON.stringify(r));
  });
  await it('criarSiteNovo: site com defaults + Home rascunho no menu (T2b)', async () => {
    const r = await pg.evaluate(async ([pk, npub]) => { await Db.apagar(pk); const db = await Db.abrir(pk); const site = await Rede.criarSiteNovo(db, pk, npub); const pages = await db.getAll('pages'); const c = await Rede.contagens(db); db.fechar(); await Db.apagar(pk); return { site, pages, c }; }, [chB.pubkey, chB.npub]);
    assert(r.site.home.mode === 'page' && r.pages.length === 1 && r.pages[0].id === r.site.home.page_id && r.pages[0].status === 'draft' && r.site.menu[0].page_id === r.pages[0].id && r.c.pendentes === 1 && r.c.novos === 1, JSON.stringify([r.site.home, r.pages[0].slug, r.c]));
  });
  await it('sem erros de página/console em toda a suíte', () => assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros })));
  await pg.evaluate(async ([a, b]) => { await Db.apagar(a); await Db.apagar(b); }, [ch.pubkey, chB.pubkey]);
  await pg.close();
  return R;
};
