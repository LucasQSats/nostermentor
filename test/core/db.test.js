// test/core/db.test.js — IndexedDB nostermentor/<hex> (13 §2): aceite 3 de
// 15 M2 (nome, schema_version, dois sites → dois bancos), atomicidade,
// anti-downgrade (13 §7.4).
const { abrir, coletor, assert } = require('../util.js');

module.exports = async function (ctx, u) {
  const { R, it } = coletor();
  const p = await abrir(ctx, u.url);
  const r = await p.pg.evaluate(async () => {
    const out = {};
    const hexA = 'a'.repeat(64), hexB = 'b'.repeat(64);
    await Db.apagar(hexA); await Db.apagar(hexB);
    const a = await Db.abrir(hexA);
    out.nome = a.nome; out.criado = a.criado;
    out.meta = { schema: await a.getMeta('schema_version'), app: await a.getMeta('app_version'), nada: await a.getMeta('inexistente') };
    const site = Modelo.sitePadrao(hexA, 'npub1a'); site.title = 'A';
    await a.put('site', site, 'site');
    await a.escrever([{ op: 'put', store: 'pages', valor: { id: 'p1', slug: 'um', title: '1', status: 'draft' } }, { op: 'put', store: 'pages', valor: { id: 'p2', slug: 'dois', title: '2', status: 'published' } }, { op: 'put', store: 'media', valor: { id: 'm1', path: '/a.png', sha256: 'x'.repeat(64), status: 'published' } }]);
    out.leituras = { site: (await a.get('site', 'site')).title, pages: (await a.getAll('pages')).length, count: await a.count('pages'), porSlug: (await a.porIndice('pages', 'slug', 'dois'))[0].id, porPath: (await a.porIndice('media', 'path', '/a.png'))[0].id, semChave: await a.get('published', 'current') };
    // atomicidade: a 2ª put viola o índice único de slug → nada da transação entra
    let erroAtomico = null;
    try { await a.escrever([{ op: 'put', store: 'pages', valor: { id: 'p3', slug: 'tres', title: '3', status: 'draft' } }, { op: 'put', store: 'pages', valor: { id: 'p4', slug: 'um', title: 'dup', status: 'draft' } }]); } catch (e) { erroAtomico = e && (e.name || e.message); }
    out.atomico = { erro: erroAtomico, pages: (await a.getAll('pages')).map(x => x.id).sort() };
    await a.del('pages', 'p1');
    out.del = (await a.getAll('pages')).map(x => x.id);
    // put substitui (mesma chave)
    await a.put('pages', { id: 'p2', slug: 'dois', title: '2b', status: 'modified' });
    out.subst = (await a.get('pages', 'p2')).title;
    // dois sites → dois bancos, sem cruzamento
    const b = await Db.abrir(hexB);
    out.b = { nome: b.nome, criado: b.criado, site: await b.get('site', 'site'), pages: (await b.getAll('pages')).length };
    const nomes = (await indexedDB.databases()).map(d => d.name).filter(n => n && n.startsWith('nostermentor/')).sort();
    out.bancos = nomes;
    // reabrir: não é "criado"
    a.fechar(); out.fechado = !a.estaAberto();
    const a2 = await Db.abrir(hexA); out.reaberto = { criado: a2.criado, pages: (await a2.getAll('pages')).length }; a2.fechar();
    // anti-downgrade: um banco de versão maior (feito por um app futuro) não pode ser aberto por este
    b.fechar();
    await new Promise((res, rej) => { const q = indexedDB.open(b.nome, Modelo.SCHEMA_VERSION + 1); q.onupgradeneeded = () => {}; q.onsuccess = () => { q.result.close(); res(); }; q.onerror = () => rej(q.error); });
    try { const x = await Db.abrir(hexB); x.fechar(); out.downgrade = 'abriu (ERRADO)'; } catch (e) { out.downgrade = { codigo: e.codigo, msg: e.message }; }
    await Db.apagar(hexB);
    try { await Db.abrir('zz'); out.pubkeyRuim = 'abriu'; } catch (e) { out.pubkeyRuim = 'rejeitou'; }
    // limparTudo
    const a3 = await Db.abrir(hexA); await a3.limparTudo(); out.limpo = { pages: await a3.count('pages'), site: await a3.get('site', 'site'), meta: await a3.count('meta') }; a3.fechar();
    await Db.apagar(hexA);
    out.apagado = !(await indexedDB.databases()).some(d => d.name === Db.nome(hexA));
    out.stores = Db.STORES;
    return out;
  });
  await it('abrir: nome nostermentor/<hex>, criado na 1ª vez, meta.schema_version = 1 e app_version', () => assert(r.nome === 'nostermentor/' + 'a'.repeat(64) && r.criado === true && r.meta.schema === 1 && /^\d+\.\d+\.\d+/.test(r.meta.app) && r.meta.nada === undefined, JSON.stringify([r.nome, r.criado, r.meta])));
  await it('put/get/getAll/count/porIndice (slug, path) e chave singleton fora do registro', () => assert(r.leituras.site === 'A' && r.leituras.pages === 2 && r.leituras.count === 2 && r.leituras.porSlug === 'p2' && r.leituras.porPath === 'm1' && r.leituras.semChave === undefined, JSON.stringify(r.leituras)));
  await it('escrever é atômico: slug duplicado (índice único) rejeita e NADA da transação entra', () => assert(r.atomico.erro && JSON.stringify(r.atomico.pages) === '["p1","p2"]', JSON.stringify(r.atomico)));
  await it('del e put-substitui', () => assert(JSON.stringify(r.del) === '["p2"]' && r.subst === '2b', JSON.stringify([r.del, r.subst])));
  await it('aceite 3: dois sites (duas chaves) → dois bancos, sem cruzamento', () => assert(r.b.nome === 'nostermentor/' + 'b'.repeat(64) && r.b.criado && r.b.site === undefined && r.b.pages === 0 && r.bancos.length === 2, JSON.stringify([r.b, r.bancos])));
  await it('fechar/reabrir: o conteúdo persiste e `criado` é false', () => assert(r.fechado && r.reaberto.criado === false && r.reaberto.pages === 1, JSON.stringify(r.reaberto)));
  await it('anti-downgrade (13 §7.4): banco de versão maior → recusa com codigo mais_novo e a mensagem de Textos.db', () => assert(r.downgrade && r.downgrade.codigo === 'mais_novo' && /Nostermentor mais novo/.test(r.downgrade.msg), JSON.stringify(r.downgrade)));
  await it('pubkey inválida rejeita; limparTudo esvazia; apagar remove o banco', () => assert(r.pubkeyRuim === 'rejeitou' && r.limpo.pages === 0 && r.limpo.site === undefined && r.limpo.meta === 0 && r.apagado, JSON.stringify([r.pubkeyRuim, r.limpo, r.apagado])));
  await it('stores: site, pages, posts, media, published, meta (13 §2)', () => assert(r.stores.join(',') === 'site,pages,posts,media,published,meta', r.stores.join(',')));
  await it('sem erros de página/console', () => assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros })));
  await p.pg.close();
  return R;
};
