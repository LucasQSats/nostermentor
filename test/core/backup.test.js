// test/core/backup.test.js — core/backup.js (13 §7) dentro da página:
// aceite 5 de 15 M3 — exportar (forma, regra da mídia de 13 §7.2),
// tripwire, apagar o banco → importar → idêntico por id, outra npub
// recusada, version 99 recusada com o texto de 13 §7.4, mesclagem com
// updated_at mais recente vencendo, substituir tudo, colisão de slug.
const { abrir, coletor, assert } = require('../util.js');
const F = require('../fabrica.js');

module.exports = async function (ctx, u) {
  const { R, it } = coletor();
  const p = await abrir(ctx, u.url);
  const ch = F.chave(), outra = F.chave();
  const man = F.manifest(ch, { paths: { '/index.html': F.sha256('i') }, servers: ['https://s.test'], title: 'T' });
  const r = await p.pg.evaluate(async ([ch, outra, man]) => {
    const out = {};
    await Db.apagar(ch.pubkey);
    const db = await Db.abrir(ch.pubkey);
    const site = Modelo.sitePadrao(ch.pubkey, ch.npub); site.title = 'Site A'; site.network.relays = ['wss://r1.test']; site.network.servers = ['https://s.test'];
    const pg1 = Modelo.novaPagina('Página um'); pg1.body = 'um';
    const pg2 = Modelo.novaPagina('Página dois'); pg2.status = 'published'; pg2.published_hash = 'd'.repeat(64);
    const a1 = Modelo.novoArtigo('Artigo'); a1.tags = ['x']; a1.status = 'modified';
    const bytesA = new Uint8Array([1, 2, 3, 4, 5]), bytesB = new Uint8Array([9, 8, 7]);
    const mA = { id: 'm-a', path: '/img/a.png', mime: 'image/png', size: 5, sha256: await Gerador.sha256Hex(bytesA), width: 1, height: 1, alt: 'a', caption: '', bytes: new Blob([bytesA], { type: 'image/png' }), status: 'draft', servers: [], removal: null, metadata: { stripped: true, removed_segments: ['exif'], warning: null }, origin: 'upload', created_at: Modelo.agora(), updated_at: Modelo.agora(), previous_status: null };
    const mB = Object.assign({}, mA, { id: 'm-b', path: '/img/b.png', bytes: new Blob([bytesB], { type: 'image/png' }), sha256: await Gerador.sha256Hex(bytesB), size: 3, status: 'published', servers: ['https://s.test'] });
    const mC = Object.assign({}, mA, { id: 'm-c', path: '/img/c.png', bytes: null, status: 'published', servers: ['https://s.test'] });
    const published = { manifest_event: man, manifest_event_id: man.id, created_at: man.created_at, paths: { '/index.html': 'a'.repeat(64) }, relays: {}, servers: {}, metadata_events: { kind0: null, kind10002: null, kind10063: null }, health: { checked_at: Modelo.agora(), relays_with_manifest: ['wss://r1.test'], relays_outdated: [], relays_newer: [], relays_missing: [], relays_unreachable: [] } };
    await db.escrever([{ op: 'put', store: 'site', chave: 'site', valor: site }, { op: 'put', store: 'pages', valor: pg1 }, { op: 'put', store: 'pages', valor: pg2 }, { op: 'put', store: 'posts', valor: a1 },
      { op: 'put', store: 'media', valor: mA }, { op: 'put', store: 'media', valor: mB }, { op: 'put', store: 'media', valor: mC }, { op: 'put', store: 'published', chave: 'current', valor: published }]);
    // exportar "o necessário"
    const est = await Backup.estimar(db, false);
    const ex = await Backup.exportar(db, { completo: false, pubkey: ch.pubkey, npub: ch.npub });
    const j = JSON.parse(ex.texto);
    out.estimativa = est; out.exportado = { nome: ex.nome, bytes: ex.bytes, contagens: ex.contagens, chaves: Object.keys(j), format: j.format, version: j.version, exported_at: j.exported_at, app: j.app_version, meta: j.meta,
      media: j.media.map(m => ({ id: m.id, b64: m.bytes_base64, temBytes: 'bytes' in m })), pages: j.pages.length, posts: j.posts.length, publishedId: j.published && j.published.manifest_event_id, tags: j.posts[0].tags };
    const exC = await Backup.exportar(db, { completo: true, pubkey: ch.pubkey, npub: ch.npub });
    out.completo = JSON.parse(exC.texto).media.map(m => ({ id: m.id, b64: m.bytes_base64 }));
    // tripwire: uma nsec num campo de texto aborta a exportação
    const pgT = Modelo.novaPagina('Tripwire'); pgT.body = 'segredo: ' + outra.nsec;
    await db.put('pages', pgT);
    try { await Backup.exportar(db, { completo: false, pubkey: ch.pubkey, npub: ch.npub }); out.tripwire = 'exportou (ERRADO)'; } catch (e) { out.tripwire = { codigo: e.codigo, msg: e.message }; }
    await db.del('pages', pgT.id);
    // apagar o banco → importar (substituir) → idêntico por id
    await db.limparTudo();
    const an = Backup.analisar(ex.texto, { pubkey: ch.pubkey, npub: ch.npub });
    out.analise = { ok: an.ok, mesmaChave: an.mesmaChave, version: an.version, contagens: an.contagens, published: !!an.dados.published, npub: an.npub === ch.npub };
    const plano = await Backup.planejar(db, an.dados);
    out.planoVazio = { novos: plano.novos.length, atualizados: plano.atualizados.length };
    const imp = await Backup.importar(db, an, { modo: 'substituir', pubkey: ch.pubkey, npub: ch.npub });
    const lerTudo = async () => ({ site: await db.get('site', 'site'), pages: (await db.getAll('pages')).sort((a, b) => a.id.localeCompare(b.id)), posts: await db.getAll('posts'), media: (await db.getAll('media')).sort((a, b) => a.id.localeCompare(b.id)), published: await db.get('published', 'current'), meta: await db.getAll('meta') });
    const dep = await lerTudo();
    const sha = async (b) => (b ? await Gerador.sha256Hex(new Uint8Array(await b.arrayBuffer())) : null);
    out.depois = { imp: { modo: imp.modo, novos: imp.novos }, siteTitulo: dep.site.title, relays: dep.site.network.relays, pubkey: dep.site.pubkey === ch.pubkey,
      pages: dep.pages.map(x => [x.id, x.status, x.published_hash, x.updated_at]), posts: dep.posts.map(x => [x.id, x.status, x.tags.join()]),
      media: await Promise.all(dep.media.map(async m => [m.id, m.status, m.bytes ? m.bytes.size : null, await sha(m.bytes), m.sha256, m.metadata.removed_segments.join()])),
      publishedId: dep.published && dep.published.manifest_event_id, verifica: dep.published && Chave.verificar(dep.published.manifest_event),
      meta: Object.fromEntries(dep.meta.map(m => [m.key, m.value])) };
    out.original = { pages: [pg1, pg2].sort((a, b) => a.id.localeCompare(b.id)).map(x => [x.id, x.status, x.published_hash, x.updated_at]), posts: [[a1.id, a1.status, 'x']], shaA: mA.sha256, shaB: mB.sha256 };
    // versão maior → recusa com o texto de 13 §7.4
    const j99 = Object.assign({}, j, { version: 99 });
    out.v99 = Backup.analisar(JSON.stringify(j99), { pubkey: ch.pubkey, npub: ch.npub });
    // outra npub → mesmaChave false; importar como conteúdo desta chave não traz o published
    const exO = JSON.parse(ex.texto); exO.site.pubkey = outra.pubkey; exO.site.npub = outra.npub;
    const anO = Backup.analisar(JSON.stringify(exO), { pubkey: ch.pubkey, npub: ch.npub });
    out.outra = { ok: anO.ok, mesmaChave: anO.mesmaChave, npub: anO.npub === outra.npub, published: anO.dados.published };
    // lixo
    // 32(c) — a miniatura guardada tem de sobreviver ao backup, e a chave NÃO
    // pode nascer onde não existia: `thumb_media_id` ausente e `null` são a
    // mesma coisa em todo o app, e inventar a chave faz a importação devolver
    // um registro diferente do exportado (foi o aceite 5 de telas/t9_backup a
    // apanhá-lo). Os dois sentidos, no mesmo caso.
    const jm = JSON.parse(ex.texto);
    jm.media = [
      { id: 'm-orig', path: '/img/a.jpg', mime: 'image/jpeg', size: 10, sha256: 'a'.repeat(64), width: 100, height: 80, alt: '', caption: '', status: 'draft', servers: [], thumb_media_id: 'm-mini', bytes_base64: null },
      { id: 'm-mini', path: '/img/a-mini.webp', mime: 'image/webp', size: 3, sha256: 'b'.repeat(64), width: 480, height: 384, alt: '', caption: '', status: 'draft', servers: [], bytes_base64: null },
      { id: 'm-sem', path: '/img/c.jpg', mime: 'image/jpeg', size: 10, sha256: 'c'.repeat(64), width: 100, height: 80, alt: '', caption: '', status: 'draft', servers: [], thumb_media_id: 'nao-e-id-valido!!', bytes_base64: null }
    ];
    const anM = Backup.analisar(JSON.stringify(jm), { pubkey: ch.pubkey, npub: ch.npub });
    const porId = new Map((anM.dados.media || []).map(m => [m.id, m]));
    out.miniBackup = {
      liga: (porId.get('m-orig') || {}).thumb_media_id,
      semChaveNaMini: porId.has('m-mini') && !('thumb_media_id' in porId.get('m-mini')),
      semChaveQuandoInvalido: porId.has('m-sem') && !('thumb_media_id' in porId.get('m-sem'))
    };

    out.lixo = [Backup.analisar('{"a":1}', {}).codigo, Backup.analisar('nada', {}).codigo, Backup.analisar('{"format":"nostermentor-backup"}', {}).codigo, Backup.analisar('{"format":"nostermentor-backup","version":1,"pages":[{"id":"x"}]}', {}).ok];
    // mesclagem: local mais recente fica; backup mais recente vence; novo entra; igual ignorado
    const local1 = Object.assign({}, dep.pages[0], { title: 'Local mais recente', updated_at: '2030-01-01T00:00:00Z' });
    await db.put('pages', local1);
    const j2 = JSON.parse(ex.texto);
    const alvo = j2.pages.find(x => x.id === dep.pages[1].id); alvo.title = 'Do backup, mais novo'; alvo.updated_at = '2031-01-01T00:00:00Z';
    const novoDoBackup = Modelo.novaPagina('Só no backup'); j2.pages.push(novoDoBackup);
    const colide = Modelo.novaPagina('Colide'); colide.slug = local1.slug; j2.pages.push(colide);   // mesmo slug de um local que fica
    const an2 = Backup.analisar(JSON.stringify(j2), { pubkey: ch.pubkey, npub: ch.npub });
    const plano2 = await Backup.planejar(db, an2.dados);
    out.plano2 = { novos: plano2.novos.map(x => x.rotulo).sort(), atualizados: plano2.atualizados.map(x => x.rotulo), iguais: plano2.iguais.length, locais: plano2.locais.map(x => x.rotulo) };
    const imp2 = await Backup.importar(db, an2, { modo: 'juntar', pubkey: ch.pubkey, npub: ch.npub });
    const dep2 = await lerTudo();
    out.juntar = { imp: { novos: imp2.novos, atualizados: imp2.atualizados, iguais: imp2.iguais, locais: imp2.locais, sobrescritos: imp2.sobrescritos, renomeados: imp2.renomeados, vazio: imp2.bancoEstavaVazio }, titulos: dep2.pages.map(x => x.title).sort(), slugs: dep2.pages.map(x => x.slug).sort(), meta: Object.fromEntries(dep2.meta.map(m => [m.key, m.value])) };
    // 2026-09-05 — a gaveta de ajustes por tema sobrevive ao backup (decisão
    // dele: "no backup, junto com o site"), passa por lista branca na volta, e
    // em "Juntar" a desta máquina ganha.
    {
      const s2 = await db.get('site', 'site');
      s2.theme = { id: 'jornal', version: 1, options: { colunas: 'uma' } };
      s2.theme_memory = { padrao: { esquema: 'escuro' }, 'ID MAU!': { x: 1 }, moderno: { mau: { fundo: 1 }, cantos: 'suaves' } };
      await db.put('site', s2, 'site');
      const exG = await Backup.exportar(db, { completo: false, pubkey: ch.pubkey, npub: ch.npub });
      const jG = JSON.parse(exG.texto);
      out.gaveta = { noArquivo: jG.theme_options, dentroDoSite: 'theme_memory' in jG.site,
        noSiteJson: SiteJson.escrever({ site: s2, pages: [], posts: [], media: [] }).indexOf('theme_memory') !== -1 };
      // substituir: a gaveta do arquivo entra tal e qual (já filtrada)
      const anG = Backup.analisar(exG.texto, { pubkey: ch.pubkey });
      await Backup.importar(db, anG, { modo: 'substituir', pubkey: ch.pubkey, npub: ch.npub });
      out.gaveta.aposSubstituir = (await db.get('site', 'site')).theme_memory;
      // juntar: local ganha, e o que só existe no arquivo entra
      const s3 = await db.get('site', 'site');
      s3.theme_memory = { padrao: { esquema: 'claro' }, diario: { paginado: 'nao' } };
      await db.put('site', s3, 'site');
      await Backup.importar(db, Backup.analisar(exG.texto, { pubkey: ch.pubkey }), { modo: 'juntar', pubkey: ch.pubkey, npub: ch.npub });
      out.gaveta.aposJuntar = (await db.get('site', 'site')).theme_memory;
    }
    // base64 ida e volta com bytes "difíceis"
    const dif = new Uint8Array(70000); for (let i = 0; i < dif.length; i++) dif[i] = (i * 31) & 255;
    const b64 = await Backup.blobParaBase64(new Blob([dif]));
    const volta = Backup.base64ParaBytes(b64);
    out.b64 = volta.length === dif.length && volta.every((v, i) => v === dif[i]);
    db.fechar(); await Db.apagar(ch.pubkey);
    return JSON.parse(JSON.stringify(out));
  }, [ch, outra, man]);
  // ⚠️ `version` (o FORMATO do arquivo) e `meta.schema_version` (o BANCO de onde
  // ele saiu) deixaram de ser o mesmo número em 2026-09-12: a migração v2
  // acrescentou armazéns locais (as mensagens) e não mudou nada do formato.
  // Carimbar 2 no formato faria um app anterior recusar um arquivo que sabe ler.
  await it('exportar: nome nostermentor-backup-<npub8>-<data>.json, chaves de 13 §7.1 na ordem, format/version=1 (formato) e meta.schema_version=2 (banco)', () => {
    const e = r.exportado;
    assert(e.nome === 'nostermentor-backup-' + ch.npub.slice(5, 13) + '-' + e.exported_at.slice(0, 10) + '.json', e.nome);
    assert(e.chaves.join(',') === 'format,version,exported_at,app_version,site,pages,posts,media,published,theme_options,meta' && e.format === 'nostermentor-backup' && e.version === 1 && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(e.exported_at) && /^\d+\.\d+\.\d+/.test(e.app) && e.meta.schema_version === 2, JSON.stringify(e));
    assert(e.pages === 2 && e.posts === 1 && e.publishedId === man.id && e.tags.join() === 'x' && e.contagens.comArquivo === 1, JSON.stringify(e.contagens));
  });
  await it('13 §7.2: "necessário" leva bytes_base64 só da mídia que só existe aqui (m-a); "completo" também da publicada com bytes (m-b); sem bytes → null; o campo `bytes` nunca vai', () => {
    const n = Object.fromEntries(r.exportado.media.map(m => [m.id, m.b64])), c = Object.fromEntries(r.completo.map(m => [m.id, m.b64]));
    assert(n['m-a'] === 'AQIDBAU=' && n['m-b'] === null && n['m-c'] === null, JSON.stringify(n));
    assert(c['m-a'] === 'AQIDBAU=' && c['m-b'] === 'CQgH' && c['m-c'] === null, JSON.stringify(c));
    assert(r.exportado.media.every(m => !m.temBytes), 'campo bytes no JSON');
    assert(r.estimativa.arquivos === 1 && r.estimativa.soAqui === 1 && r.estimativa.bytes > 1000, JSON.stringify(r.estimativa));
  });
  await it('tripwire (13 §7.3): nsec num campo → exportar aborta com codigo tripwire e o texto de 14 T9', () => assert(r.tripwire && r.tripwire.codigo === 'tripwire' && /Backup interrompido por segurança/.test(r.tripwire.msg), JSON.stringify(r.tripwire)));
  await it('analisar: ok, mesma chave, versão 1, contagens, published verificado; banco vazio → tudo "novo"', () => assert(r.analise.ok && r.analise.mesmaChave && r.analise.version === 1 && r.analise.contagens.pages === 2 && r.analise.contagens.comArquivo === 1 && r.analise.published && r.analise.npub && r.planoVazio.novos === 6 && r.planoVazio.atualizados === 0, JSON.stringify([r.analise, r.planoVazio])));
  await it('aceite 5: apagar o banco → importar → conteúdo idêntico por id (status, published_hash, updated_at, tags, bytes da mídia com sha conferido, published assinado); last_export_at = exported_at e contador 0', () => {
    const d = r.depois;
    assert(JSON.stringify(d.pages) === JSON.stringify(r.original.pages) && JSON.stringify(d.posts) === JSON.stringify(r.original.posts), JSON.stringify([d.pages, r.original.pages]));
    const m = Object.fromEntries(d.media.map(x => [x[0], x]));
    assert(m['m-a'][2] === 5 && m['m-a'][3] === r.original.shaA && m['m-a'][4] === r.original.shaA && m['m-a'][5] === 'exif' && m['m-b'][2] === null && m['m-c'][2] === null, JSON.stringify(d.media));
    assert(d.siteTitulo === 'Site A' && JSON.stringify(d.relays) === '["wss://r1.test"]' && d.pubkey && d.publishedId === man.id && d.verifica === true, JSON.stringify([d.siteTitulo, d.relays, d.publishedId, d.verifica]));
    assert(d.meta.schema_version === 2 && d.meta.alteracoes_nao_exportadas === 0 && d.meta.last_export_at === r.exportado.exported_at, JSON.stringify(d.meta));
  });
  await it('version 99 → recusado com o texto de 13 §7.4', () => assert(!r.v99.ok && r.v99.codigo === 'versao_maior' && r.v99.motivo === 'Este backup foi feito por um Nostermentor mais novo — atualize o app para abri-lo.', JSON.stringify(r.v99)));
  await it('backup de outra npub → mesmaChave=false (a tela recusa); o published assinado pela outra chave não entra', () => assert(r.outra.ok && !r.outra.mesmaChave && r.outra.npub && r.outra.published === null, JSON.stringify(r.outra)));
  await it('lixo: JSON sem format, texto solto, sem version, registros malformados → recusa/ignora sem lançar', () => assert(JSON.stringify(r.lixo) === '["formato","json","estrutura",true]', JSON.stringify(r.lixo)));
  await it('mesclagem (13 §6.3 item 3 / 14 T9): local mais recente mantido, backup mais recente vence e é listado, novo entra, igual ignorado, colisão de slug renomeada; contador intacto (banco não estava vazio)', () => {
    const j = r.juntar;
    // rótulos = o título LOCAL (o que o dono vê hoje) quando o registro já existe
    assert(JSON.stringify(r.plano2.novos) === JSON.stringify(['Colide', 'Só no backup']) && r.plano2.atualizados.length === 1 && /^Página (um|dois)$/.test(r.plano2.atualizados[0]) && r.plano2.iguais === 4 && r.plano2.locais.length === 1 && r.plano2.locais[0] === 'Local mais recente', JSON.stringify(r.plano2));
    assert(j.imp.novos === 2 && j.imp.atualizados === 1 && j.imp.iguais === 4 && j.imp.locais === 1 && /^Página (um|dois)$/.test(j.imp.sobrescritos.join()) && j.imp.renomeados.length === 1 && /-2$/.test(j.imp.renomeados[0]) && j.imp.vazio === false, JSON.stringify(j.imp));
    assert(j.titulos.includes('Local mais recente') && j.titulos.includes('Do backup, mais novo') && j.titulos.includes('Só no backup') && j.titulos.includes('Colide') && new Set(j.slugs).size === j.slugs.length, JSON.stringify(j.titulos));
    assert(j.meta.alteracoes_nao_exportadas === 0, JSON.stringify(j.meta));
  });
  await it('32(c): a miniatura guardada sobrevive ao backup — e a chave NÃO nasce onde não existia (ausente == null em todo o app)', () => {
    assert(r.miniBackup.liga === 'm-mini', 'a ligação original→miniatura perdeu-se: ' + r.miniBackup.liga);
    assert(r.miniBackup.semChaveNaMini, 'a miniatura ganhou uma chave `thumb_media_id` que não tinha');
    assert(r.miniBackup.semChaveQuandoInvalido, 'id inválido tinha de ser descartado sem deixar a chave para trás');
  });
  await it('a gaveta de ajustes por tema entra no backup, volta pela lista branca e NUNCA sai no site.json; em "Juntar" a desta máquina ganha', () => {
    const g = r.gaveta;
    // no arquivo: campo de topo, filtrado, e nunca dentro do `site`
    assert(JSON.stringify(g.noArquivo) === '{"moderno":{"cantos":"suaves"},"padrao":{"esquema":"escuro"}}', 'gaveta exportada: ' + JSON.stringify(g.noArquivo));
    assert(g.dentroDoSite === false, 'a gaveta é campo de topo, não vai dentro do `site` (que é lido pela lista branca da REDE)');
    assert(g.noSiteJson === false, 'a gaveta NUNCA pode sair no site.json publicado');
    // substituir devolve o que estava no arquivo
    assert(JSON.stringify(g.aposSubstituir) === '{"moderno":{"cantos":"suaves"},"padrao":{"esquema":"escuro"}}', 'após substituir: ' + JSON.stringify(g.aposSubstituir));
    // juntar: `padrao` local (claro) ganha do arquivo (escuro); `diario` local fica; `moderno` do arquivo entra
    assert(g.aposJuntar.padrao.esquema === 'claro', 'em "Juntar" a gaveta desta máquina ganha: ' + JSON.stringify(g.aposJuntar));
    assert(g.aposJuntar.diario && g.aposJuntar.diario.paginado === 'nao', 'o que só existe aqui fica');
    assert(g.aposJuntar.moderno && g.aposJuntar.moderno.cantos === 'suaves', 'o que só existe no arquivo entra');
    return 'exportada filtrada, fora do site.json, substituir devolve, juntar funde com a local a ganhar';
  });

  // 61 — as mensagens são dados de TERCEIROS. O backup do site é o arquivo que
  // o dono compartilha (foi assim que o site oficial veio parar na KB): conversa
  // de outra pessoa não viaja nele. E não há arquivo de backup próprio — ele
  // recusou o arquivo à parte em 2026-09-12 ("sem arquivo extra").
  await it('⚠️ o backup do site NÃO leva mensagem nenhuma: nem `messages`, nem `peers`, nem sequer as chaves vazias', async () => {
    const g = await p.pg.evaluate(async () => {
      const ch = Chave.gerar();
      await Db.apagar(ch.pubkey);
      const db = await Db.abrir(ch.pubkey);
      await db.put('site', Object.assign(Modelo.sitePadrao(ch.pubkey, ch.npub), { title: 'Com mensagens' }), 'site');
      await db.escrever([
        { op: 'put', store: 'messages', valor: { id: '1'.repeat(64), peer: '2'.repeat(64), created_at: 10, kind: 14, content: 'um segredo de outra pessoa' } },
        { op: 'put', store: 'peers', valor: { pubkey: '2'.repeat(64), apelido: 'apelido privado', arquivado: false, bloqueado: false } }
      ]);
      const exp = await Backup.exportar(db, { npub: ch.npub, pubkey: ch.pubkey, completo: false });
      db.fechar();
      const texto = exp.texto;
      const obj = JSON.parse(texto);
      await Db.apagar(ch.pubkey);
      return {
        chaves: Object.keys(obj),
        temTexto: texto.includes('um segredo de outra pessoa') || texto.includes('apelido privado') || texto.includes('2'.repeat(64)),
        temExportarMensagens: typeof Backup.exportarMensagens,
        version: obj.version, schema: obj.meta && obj.meta.schema_version
      };
    });
    assert(g.chaves.indexOf('messages') === -1 && g.chaves.indexOf('peers') === -1, 'o backup ganhou armazém de mensagens: ' + JSON.stringify(g.chaves));
    assert(g.temTexto === false, '⚠️ conteúdo de mensagem vazou para o backup do site');
    assert(g.temExportarMensagens === 'undefined', 'existe um exportador de mensagens — ele recusou esse arquivo');
    // A versão do FORMATO continua 1 (nada do que se publica mudou); a do
    // BANCO é 2. Confundi-las mandaria republicar todo site já publicado.
    assert(g.version === 1 && g.schema === 2, 'version/schema: ' + JSON.stringify([g.version, g.schema]));
    return 'formato v' + g.version + ', banco v' + g.schema + ', sem mensagens';
  });

  // ⚠️ Este caso nasceu de um defeito que NENHUM dos outros pegava: a caixa de
  // entrada saía no `site` do backup e voltava por `SiteJson.lerSite`, que é a
  // lista branca do que vem da REDE e não a conhece — desaparecia em silêncio.
  // **No Tails isso é o caminho normal**: cada sessão começa por importar o
  // backup, e o dono veria as mensagens desligadas sem nada lhe dizer por quê.
  await it('⚠️ a caixa de entrada SOBREVIVE ao backup (é o caminho do Tails), e importar "substituir" NÃO apaga as conversas', async () => {
    const g = await p.pg.evaluate(async () => {
      const ch = Chave.gerar();
      await Db.apagar(ch.pubkey);
      const db = await Db.abrir(ch.pubkey);
      const site = Modelo.sitePadrao(ch.pubkey, ch.npub);
      site.title = 'Com caixa ligada';
      site.messages = { enabled: true, relays: ['wss://auth.nostr1.com', 'wss://nos.lol'] };
      await db.put('site', site, 'site');
      await db.escrever([
        { op: 'put', store: 'messages', valor: { id: '3'.repeat(64), peer: '4'.repeat(64), created_at: 10, kind: 14, content: 'conversa de terceiro' } },
        { op: 'put', store: 'peers', valor: { pubkey: '4'.repeat(64), apelido: 'Alguém', arquivado: false, bloqueado: false } }
      ]);
      const exp = await Backup.exportar(db, { npub: ch.npub, pubkey: ch.pubkey, completo: false });
      const noArquivo = JSON.parse(exp.texto);
      // agora desliga a caixa e importa por cima, em "substituir"
      site.messages = { enabled: false, relays: [] };
      await db.put('site', site, 'site');
      const analise = await Backup.analisar(exp.texto, { pubkey: ch.pubkey, npub: ch.npub });
      await Backup.importar(db, analise, { modo: 'substituir', pubkey: ch.pubkey, npub: ch.npub, mesmaChave: true });
      const depois = await db.get('site', 'site');
      const saida = {
        noSite: noArquivo.site.messages,           // não pode estar aqui
        noTopo: noArquivo.messages,                // tem de estar aqui
        depoisLigada: depois.messages,
        mensagens: await db.count('messages'),
        pessoas: await db.count('peers'),
        titulo: depois.title
      };
      db.fechar();
      await Db.apagar(ch.pubkey);
      return saida;
    });
    assert(g.noSite === undefined, 'a caixa saiu dentro do `site`, onde a lista branca a come: ' + JSON.stringify(g.noSite));
    assert(g.noTopo && g.noTopo.enabled === true && g.noTopo.relays.length === 2, 'campo de topo: ' + JSON.stringify(g.noTopo));
    assert(g.depoisLigada && g.depoisLigada.enabled === true && g.depoisLigada.relays.length === 2,
      '⚠️ a caixa não sobreviveu à importação — no Tails o recurso morreria a cada sessão: ' + JSON.stringify(g.depoisLigada));
    assert(g.titulo === 'Com caixa ligada', 'o resto do site não voltou: ' + g.titulo);
    assert(g.mensagens === 1 && g.pessoas === 1,
      '⚠️ "substituir" apagou conversas que o backup nem sequer traz: ' + JSON.stringify([g.mensagens, g.pessoas]));
    return 'caixa com ' + g.depoisLigada.relays.length + ' relays de volta, ' + g.mensagens + ' conversa intacta';
  });

  await it('backup de quem NÃO ligou as mensagens não ganha campo nenhum (o arquivo de ontem continua igual)', async () => {
    const g = await p.pg.evaluate(async () => {
      const ch = Chave.gerar();
      await Db.apagar(ch.pubkey);
      const db = await Db.abrir(ch.pubkey);
      await db.put('site', Modelo.sitePadrao(ch.pubkey, ch.npub), 'site');
      const exp = await Backup.exportar(db, { npub: ch.npub, pubkey: ch.pubkey, completo: false });
      db.fechar();
      await Db.apagar(ch.pubkey);
      const o = JSON.parse(exp.texto);
      return { chaves: Object.keys(o), temMessages: 'messages' in o, noSite: 'messages' in o.site };
    });
    assert(g.temMessages === false && g.noSite === false, 'campo a mais no backup de quem não usa: ' + JSON.stringify(g.chaves));
  });

  await it('61 Etapa 2: as formas de contato vão e voltam no backup pela lista branca; e quem não tem nenhuma não ganha a chave', async () => {
    const g = await p.pg.evaluate(async () => {
      const ch = Chave.gerar();
      await Db.apagar(ch.pubkey);
      let db = await Db.abrir(ch.pubkey);
      const site = Modelo.sitePadrao(ch.pubkey, ch.npub);
      site.contacts = [
        { kind: 'email', value: 'contato@exemplo.org', label: '' },
        { kind: 'link', value: 'https://exemplo.org/loja', label: 'Minha loja' }
      ];
      await db.put('site', site, 'site');
      const exp = await Backup.exportar(db, { npub: ch.npub, pubkey: ch.pubkey, completo: false });
      db.fechar();
      // o arquivo as leva, e um item inventado dentro do arquivo não entra
      const bruto = JSON.parse(exp.texto);
      const noArquivo = (bruto.site.contacts || []).length;
      bruto.site.contacts.push({ kind: 'inventado', value: 'x' });
      bruto.site.contacts.push({ kind: 'email', value: 'javascript:alert(1)' });

      await Db.apagar(ch.pubkey);
      db = await Db.abrir(ch.pubkey);
      const analise = Backup.analisar(JSON.stringify(bruto), { pubkey: ch.pubkey, npub: ch.npub });
      await Backup.importar(db, analise, { modo: 'substituir', pubkey: ch.pubkey, npub: ch.npub });
      const voltou = (await db.get('site', 'site')).contacts;
      db.fechar();
      await Db.apagar(ch.pubkey);

      // e o de quem não tem nenhuma
      const ch2 = Chave.gerar();
      await Db.apagar(ch2.pubkey);
      const db2 = await Db.abrir(ch2.pubkey);
      await db2.put('site', Modelo.sitePadrao(ch2.pubkey, ch2.npub), 'site');
      const exp2 = await Backup.exportar(db2, { npub: ch2.npub, pubkey: ch2.pubkey, completo: false });
      db2.fechar();
      await Db.apagar(ch2.pubkey);
      return { noArquivo: noArquivo, voltou: voltou, semNenhum: 'contacts' in JSON.parse(exp2.texto).site };
    });
    assert(g.noArquivo === 2, 'o backup tem de levar as duas: ' + g.noArquivo);
    assert(g.voltou.length === 2 && g.voltou[0].kind === 'email' && g.voltou[1].label === 'Minha loja', JSON.stringify(g.voltou));
    assert(g.semNenhum === false, 'quem não tem contato nenhum não pode ganhar a chave no backup');
  });

  await it('base64 ida e volta (70.000 bytes) sem fetch', () => assert(r.b64 === true));
  await it('sem erros de página/console', () => assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros })));
  await p.pg.close();
  return R;
};
