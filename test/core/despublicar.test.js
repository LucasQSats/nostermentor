// test/core/despublicar.test.js — core/despublicar.js: "tirar o site do ar"
// (14 T7 → Avançado; 03 §6). O que se prova aqui é sobretudo a ORDEM e o que
// NÃO acontece: o manifest vazio vai primeiro e, se relay nenhum o aceitar,
// nenhum blob é apagado — o site continua no ar exatamente como estava.
// Contra o servidor falso, com um servidor que recusa o DELETE (P13 de 08).
const { abrir, coletor, assert } = require('../util.js');

module.exports = async function (ctx, u) {
  const { R, it, pulado } = coletor();
  if (!u.falso) { pulado('core/despublicar (todos os casos)', 'servidor falso indisponível'); return R; }
  const p = await abrir(ctx, u.url);
  const f = u.falso;
  f.blossom('d1', {}); f.blossom('d2', {}); f.blossom('d-recusa', { remocao: 'recusa' });
  f.relay('d-ok', { escrita: 'aceita', eventos: [] });
  f.relay('d-ok2', { escrita: 'aceita', eventos: [] });
  f.relay('d-recusa', { escrita: 'recusa' });
  f.relay('d-mudo', { escrita: 'muda' });

  // Site publicado de verdade contra o servidor falso; devolve o que a
  // fotografia guardou. Depois disso, `tirar do ar` tem o que tirar.
  const SEMENTE = `
    const ch = Chave.gerar();
    const assinar = (m) => Chave.assinar(m, ch.sk);
    const site = Modelo.sitePadrao(ch.pubkey, ch.npub);
    site.title = 'Site que vai sair do ar'; site.description = 'Uma frase sobre o site';
    site.network.relays = RELAYS; site.network.servers = SERVIDORES;
    const home = Modelo.novaPagina('Início'); home.body = 'Olá.';
    site.home = { mode: 'page', page_id: home.id, latest_posts: 5 };
    const artigo = Modelo.novoArtigo('Primeiro artigo'); artigo.body = 'Corpo.'; artigo.date = '2026-08-01T00:00:00Z';
    const brutos = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]);
    const midia = { id: Modelo.novoId(), path: '/img/foto.png', mime: 'image/png', size: brutos.length,
      sha256: await Blossom.sha256Hex(brutos), width: null, height: null, alt: 'foto', caption: '',
      bytes: new Blob([brutos], { type: 'image/png' }), status: 'draft', servers: [], removal: null,
      metadata: { stripped: true, removed_segments: [], warning: null }, origin: 'upload',
      created_at: Modelo.agora(), updated_at: Modelo.agora(), previous_status: null };
    const dados = { site, pages: [home], posts: [artigo], media: [midia] };
    const gerado = await Gerador.gerarSite(dados);
    const plano = Publicar.planear({ dados, gerado, published: null });
    const res = await Publicar.executar({ plano, site, assinar, servidores: plano.servidores, relays: plano.relays });
    const published = Publicar.fotografia(res, plano, null);
    // como se aplicar() já tivesse corrido: tudo publicado
    for (const r of [home, artigo]) { r.status = 'published'; r.published_hash = gerado.porId[r.id]; }
    midia.status = 'published'; midia.servers = (res.uploads.find(x => x.path === midia.path) || { aceitos: [] }).aceitos;`;

  const naPagina = (corpo, arg) => p.pg.evaluate(new Function('arg', `return (async () => {
    const RELAYS = arg.relays, SERVIDORES = arg.servidores, RECUSA = arg.RECUSA, MUDO = arg.MUDO, SEM_DELETE = arg.SEM_DELETE;
    ${SEMENTE} ${corpo} })()`), arg);
  const infra = { relays: [f.ws('d-ok'), f.ws('d-ok2')], servidores: [f.url('d1'), f.url('d2')],
    RECUSA: f.ws('d-recusa'), MUDO: f.ws('d-mudo'), SEM_DELETE: f.url('d-recusa') };

  await it('plano: lista todo caminho publicado e todo blob (o do mapa e o da mídia), com os servidores onde cada um está', async () => {
    const r = await naPagina(`
      const pl = Despublicar.planear({ dados, published });
      return { temPublicado: pl.temPublicado, caminhos: pl.caminhos.length, blobs: pl.blobs.length,
        temMidia: pl.blobs.some(b => b.caminhos.includes('/img/foto.png')),
        servidoresDoBlob: (pl.blobs.find(b => b.caminhos.includes('/img/foto.png')) || {}).servidores,
        relays: pl.relays.length, servidores: pl.servidores.length, herdados: pl.herdados };`, infra);
    assert(r.temPublicado === true, 'devia haver o que tirar do ar');
    assert(r.caminhos === r.blobs, `um blob por caminho: ${r.caminhos} caminhos, ${r.blobs} blobs`);
    assert(r.temMidia && (r.servidoresDoBlob || []).length === 2, JSON.stringify(r.servidoresDoBlob));
    assert(r.herdados === 0, 'este site não tem herdados');
    return `${r.caminhos} caminhos, ${r.blobs} blobs, ${r.relays} relays`;
  });

  await it('o manifest vazio não tem UMA tag `path` — nem `title` nem `description` (o cartão do diretório não anuncia site fora do ar)', async () => {
    const r = await naPagina(`
      const pl = Despublicar.planear({ dados, published });
      const m = Despublicar.modeloVazio(site, pl, 1756300000);
      return { kind: m.kind, created_at: m.created_at, content: m.content, nomes: m.tags.map(t => t[0]),
        servers: m.tags.filter(t => t[0] === 'server').length, relays: m.tags.filter(t => t[0] === 'relay').length };`, infra);
    assert(r.kind === 15128 && r.content === '', JSON.stringify(r));
    assert(!r.nomes.includes('path'), 'o manifest de "tirar do ar" NÃO pode ter tag path: ' + JSON.stringify(r.nomes));
    assert(!r.nomes.includes('title') && !r.nomes.includes('description'), JSON.stringify(r.nomes));
    assert(r.nomes.includes('client') && r.servers === 2 && r.relays === 2, JSON.stringify(r));
    return r.nomes.join(', ');
  });

  await it('ORDEM: relay nenhum aceita o mapa vazio → desfecho "sem_relay" e NENHUM blob é apagado (o site continua no ar)', async () => {
    const r = await naPagina(`
      const pl = Despublicar.planear({ dados, published });
      const res2 = await Despublicar.executar({ plano: pl, site, assinar, relays: [RECUSA, MUDO], servidores: pl.servidores, timeoutMs: 3000 });
      return { desfecho: res2.desfecho, remocoes: res2.remocoes.length, shas: Object.keys(published.paths).map(k => published.paths[k]) };`, infra);
    assert(r.desfecho === 'sem_relay', r.desfecho);
    assert(r.remocoes === 0, 'não se apaga blob nenhum quando o mapa vazio não entrou');
    for (const sha of r.shas) assert(f.temBlob('d1', sha), 'o blob ' + sha.slice(0, 8) + ' devia continuar em d1');
    return `${r.shas.length} blobs intactos`;
  });

  await it('fora do ar: mapa vazio aceito, todos os blobs apagados dos dois servidores, placar por servidor e fotografia vazia com takedown_at', async () => {
    const r = await naPagina(`
      const pl = Despublicar.planear({ dados, published });
      const res2 = await Despublicar.executar({ plano: pl, site, assinar, relays: pl.relays, servidores: pl.servidores });
      const foto = Despublicar.fotografia(res2, published);
      return { desfecho: res2.desfecho, tagsPath: res2.manifest.tags.filter(t => t[0] === 'path').length,
        placar: res2.placar.com + '/' + res2.placar.total, remocoes: res2.remocoes.length,
        porServidor: res2.porServidor, shas: res2.remocoes.map(x => x.sha256),
        foto: { paths: Object.keys(foto.paths).length, takedown: !!foto.takedown_at, temEvento: !!foto.manifest_event,
                idIgual: foto.manifest_event_id === res2.manifest.id, servers: Object.keys(foto.servers).length } };`, infra);
    assert(r.desfecho === 'fora_do_ar' && r.tagsPath === 0, JSON.stringify(r));
    assert(r.placar === '2/2', r.placar);
    assert(r.foto.paths === 0 && r.foto.takedown && r.foto.temEvento && r.foto.idIgual && r.foto.servers === 0, JSON.stringify(r.foto));
    assert(r.porServidor.length === 2 && r.porServidor.every(x => x.apagados === r.remocoes && x.recusados === 0), JSON.stringify(r.porServidor));
    for (const sha of r.shas) assert(!f.temBlob('d1', sha) && !f.temBlob('d2', sha), 'o blob ' + sha.slice(0, 8) + ' devia ter saído dos dois servidores');
    return `${r.remocoes} blobs apagados em 2 servidores`;
  });

  await it('honestidade (P13): servidor que recusa o DELETE aparece no placar como recusa, e o site sai do ar mesmo assim', async () => {
    const r = await naPagina(`
      site.network.servers = SERVIDORES.concat([SEM_DELETE]);
      const pl = Despublicar.planear({ dados, published });
      const res2 = await Despublicar.executar({ plano: pl, site, assinar, relays: pl.relays, servidores: pl.servidores });
      return { desfecho: res2.desfecho, porServidor: res2.porServidor.map(x => [x.servidor, x.apagados, x.recusados]),
        remocoes: res2.remocoes.length,
        recusadoEm: res2.remocoes.every(x => x.removal.refused_by.length === 1) };`, infra);
    assert(r.desfecho === 'fora_do_ar', r.desfecho);
    assert(r.recusadoEm, 'cada remoção devia registar a recusa do servidor sem direito de apagar');
    const recusa = r.porServidor.find(x => x[0].endsWith('/d-recusa'));
    assert(recusa && recusa[1] === 0 && recusa[2] === r.remocoes, JSON.stringify(r.porServidor));
    return r.porServidor.map(x => x[0].split('/').pop() + ': ' + x[1] + ' ok / ' + x[2] + ' recusados').join(' · ');
  });

  await it('aplicar: o conteúdo local não se perde — páginas e artigos voltam a rascunho, a mídia com bytes perde os servidores, e a herdada (sem arquivo aqui) sai da biblioteca', async () => {
    const r = await naPagina(`
      const db = await Db.abrir(ch.pubkey);
      await db.limparTudo();
      const herdada = Modelo.midiaHerdada('/legado.html', published.paths['/index.html'], SERVIDORES);
      const dados2 = { site, pages: [home], posts: [artigo], media: [midia, herdada] };
      await db.escrever([{ op: 'put', store: 'site', chave: 'site', valor: site },
        { op: 'put', store: 'pages', valor: home }, { op: 'put', store: 'posts', valor: artigo },
        { op: 'put', store: 'media', valor: midia }, { op: 'put', store: 'media', valor: herdada },
        { op: 'put', store: 'published', chave: 'current', valor: published }]);
      const pl = Despublicar.planear({ dados: dados2, published });
      const res2 = await Despublicar.executar({ plano: pl, site, assinar, relays: pl.relays, servidores: pl.servidores });
      await Despublicar.aplicar(db, { resultado: res2, dados: dados2, published: Despublicar.fotografia(res2, published) });
      const depois = { pages: await db.getAll('pages'), posts: await db.getAll('posts'), media: await db.getAll('media'),
        published: await db.get('published', 'current'), meta: await db.getAll('meta') };
      db.fechar();
      return { desfecho: res2.desfecho, herdadosNoPlano: pl.herdados,
        pagina: depois.pages.map(x => [x.title, x.status, x.published_hash]),
        artigo: depois.posts.map(x => [x.status, x.published_hash]),
        media: depois.media.map(x => [x.path, x.status, (x.servers || []).length, !!x.bytes]),
        paths: Object.keys(depois.published.paths).length, takedown: !!depois.published.takedown_at,
        removalNoMeta: depois.meta.filter(x => String(x.key).indexOf('removal/') === 0).length };`, infra);
    assert(r.desfecho === 'fora_do_ar' && r.herdadosNoPlano === 1, JSON.stringify(r));
    assert(r.pagina.length === 1 && r.pagina[0][1] === 'draft' && r.pagina[0][2] === null, JSON.stringify(r.pagina));
    assert(r.artigo.length === 1 && r.artigo[0][0] === 'draft' && r.artigo[0][1] === null, JSON.stringify(r.artigo));
    assert(r.media.length === 1 && r.media[0][0] === '/img/foto.png' && r.media[0][1] === 'draft' && r.media[0][2] === 0 && r.media[0][3] === true, JSON.stringify(r.media));
    assert(r.paths === 0 && r.takedown && r.removalNoMeta >= 1, JSON.stringify(r));
    return 'conteúdo local intacto e pronto a republicar; herdado sem arquivo saiu da biblioteca';
  });

  await p.pg.close();
  return R;
};
