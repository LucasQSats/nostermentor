// test/telas/t9_backup.test.js — T9 (14 T9) pelo painel: exportar (opções,
// estimativa, Preparar → <a download>, download real com o nome de 13 §7.1,
// contador zera, T3 "Backup em dia"), tripwire na tela, importar (resumo
// antes de mexer, Juntar, Substituir em duas etapas, outra chave, versão
// maior, arquivo inválido), o banco apagado renasce do arquivo (aceite 5).
const fs = require('fs');
const { abrir, varrer, coletor, assert, entrarCom, semearSite, lerBanco } = require('../util.js');
const F = require('../fabrica.js');

module.exports = async function (ctx, u) {
  const { R, it } = coletor();
  const ch = F.chave(), outra = F.chave();
  const relaysMortos = ['wss://127.0.0.1:1/x'];
  async function sessao(chave, extra) {
    const p = await abrir(ctx, u.url);
    await semearSite(p.pg, chave, { relays: relaysMortos, servers: [], extra: extra || [] });
    await entrarCom(p.pg, chave.nsec);
    await p.pg.waitForSelector('#continuar-sem-rede', { timeout: 60000 });
    await p.pg.click('#continuar-sem-rede');
    await p.pg.waitForSelector('#t3');
    return p;
  }
  const pagina = (id, titulo, updated) => ({ id, slug: Modelo_slug(titulo), aliases: [], title: titulo, description: '', body: 'corpo de ' + titulo, body_format: 'markdown', status: 'draft', created_at: updated, updated_at: updated, published_hash: null, previous_status: null, in_menu: true });
  const artigo = (id, titulo, updated) => Object.assign(pagina(id, titulo, updated), { in_menu: undefined, date: updated, excerpt: '', tags: ['t'], cover_media_id: null });
  const midia = { id: 'm-so-aqui', path: '/img/so-aqui.png', mime: 'image/png', size: 3, sha256: 'a'.repeat(64), width: 1, height: 1, alt: '', caption: '', bytes: null, status: 'draft', servers: [], removal: null, metadata: { stripped: true, removed_segments: [], warning: null }, origin: 'upload', created_at: '2026-08-26T00:00:00Z', updated_at: '2026-08-26T00:00:00Z', previous_status: null };
  let arquivo = null, nome = null;

  await it('exportar: opções (necessário marcado), estimativa, Preparar → link "Baixar nostermentor-backup-<npub8>-<data>.json"; download real = JSON válido com a mídia só-daqui em base64; contador zera e T3 diz "Backup em dia"', async () => {
    const p = await sessao(ch, [{ op: 'put', store: 'pages', valor: pagina('p1', 'Página um', '2026-08-26T10:00:00Z') }, { op: 'put', store: 'posts', valor: artigo('a1', 'Artigo um', '2026-08-26T10:00:00Z') }, { op: 'put', store: 'media', valor: midia }, { op: 'put', store: 'meta', valor: { key: 'alteracoes_nao_exportadas', value: 3 } }]);
    await p.pg.evaluate(async (pk) => { const db = await Db.abrir(pk); const m = await db.get('media', 'm-so-aqui'); m.bytes = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }); await db.put('media', m); db.fechar(); }, ch.pubkey);
    assert((await p.pg.textContent('#btn-backup')) === 'Backup: 3 não exportadas', await p.pg.textContent('#btn-backup'));
    await p.pg.click('#btn-backup'); await p.pg.waitForSelector('#t9');
    await p.pg.waitForFunction(() => document.getElementById('exp-estimativa').textContent.length > 0, null, { timeout: 5000 });   // a estimativa é assíncrona (lê o banco)
    const est = await p.pg.evaluate(() => ({ necessario: document.getElementById('exp-necessario').checked, completo: document.getElementById('exp-completo').checked, estimativa: document.getElementById('exp-estimativa').textContent, link: document.getElementById('exp-baixar').hidden, tails: document.querySelector('#cartao-exportar').textContent }));
    assert(est.necessario && !est.completo && /^Tamanho estimado: ~\d+ [KM]?B\. A mídia ocupa 33 % a mais/.test(est.estimativa) && est.link && /Persistent Storage/.test(est.tails) && /Se o download falhou, exporte de novo\./.test(est.tails), JSON.stringify(est));
    await p.pg.click('#exp-preparar');
    await p.pg.waitForSelector('#exp-baixar:not([hidden])');
    const link = await p.pg.evaluate(() => ({ texto: document.getElementById('exp-baixar').textContent, download: document.getElementById('exp-baixar').getAttribute('download'), href: document.getElementById('exp-baixar').getAttribute('href'), pronto: document.getElementById('exp-pronto').textContent }));
    const hoje = new Date().toISOString().slice(0, 10);
    nome = 'nostermentor-backup-' + ch.npub.slice(5, 13) + '-' + hoje + '.json';
    assert(link.download === nome && link.texto === 'Baixar ' + nome && /^blob:/.test(link.href) && /^Pronto: \d+ [KM]?B\. Clique para baixar\.$/.test(link.pronto), JSON.stringify(link));
    await p.pg.screenshot({ path: u.captura('t9-exportar'), fullPage: true });
    const [download] = await Promise.all([p.pg.waitForEvent('download', { timeout: 15000 }), p.pg.click('#exp-baixar')]);
    assert(download.suggestedFilename() === nome, 'nome sugerido: ' + download.suggestedFilename());
    arquivo = fs.readFileSync(await download.path(), 'utf8');
    const j = JSON.parse(arquivo);
    assert(j.format === 'nostermentor-backup' && j.version === 1 && j.pages.length === 1 && j.posts.length === 1 && j.media.length === 1 && j.media[0].bytes_base64 === 'AQID' && j.site.npub === ch.npub && !('bytes' in j.media[0]), JSON.stringify([j.format, j.version, j.pages.length, j.media[0].bytes_base64, Object.keys(j.media[0])]));
    await p.pg.waitForSelector('#exp-baixado:not([hidden])');
    assert((await p.pg.textContent('#btn-backup')) === 'Backup em dia', await p.pg.textContent('#btn-backup'));
    const b = await lerBanco(p.pg, ch.pubkey);
    const meta = Object.fromEntries(b.meta.map(m => [m.key, m.value]));
    assert(meta.alteracoes_nao_exportadas === 0 && /^\d{4}-\d{2}-\d{2}T/.test(meta.last_export_at), JSON.stringify(meta));
    await p.pg.click('#menu .item[data-tela="t3"]'); await p.pg.waitForSelector('#cartao-backup');
    assert(new RegExp('^Backup em dia \\(último: ' + hoje + '\\)$').test(await p.pg.textContent('#backup-resumo')), await p.pg.textContent('#backup-resumo'));
    const v = await varrer(p.pg, ch.nsec);
    assert(v.achados.length === 0 && !/nsec1/.test(arquivo), 'nsec no backup ou no painel');
    assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros }));
    await p.pg.close();
    return nome + ' (' + arquivo.length + ' B)';
  });

  await it('tripwire na tela: uma nsec num campo → "Backup interrompido por segurança…", sem link de download, contador intacto', async () => {
    const p = await sessao(ch, [{ op: 'put', store: 'pages', valor: Object.assign(pagina('p-trip', 'Trip', '2026-08-26T10:00:00Z'), { body: 'x ' + outra.nsec }) }]);
    await p.pg.click('#btn-backup'); await p.pg.waitForSelector('#t9');
    await p.pg.click('#exp-preparar');
    await p.pg.waitForSelector('#exp-erro:not([hidden])');
    assert((await p.pg.textContent('#exp-erro')) === 'Backup interrompido por segurança: encontrei uma chave privada nos dados. Isto é um bug — nada foi gravado.', await p.pg.textContent('#exp-erro'));
    assert(await p.pg.evaluate(() => document.getElementById('exp-baixar').hidden), 'link apareceu');
    await p.pg.evaluate(async (pk) => { const db = await Db.abrir(pk); await db.del('pages', 'p-trip'); db.fechar(); }, ch.pubkey);
    await p.pg.close();
  });

  await it('aceite 5: apagar o IndexedDB → importar o arquivo baixado → resumo (chave a mesma ✓, contagens, plano) → "Juntar" → conteúdo idêntico por id, mídia com bytes; contador 0 e last_export_at do arquivo (banco estava vazio)', async () => {
    const p0 = await abrir(ctx, u.url);
    await p0.pg.evaluate(async (pk) => { await Db.apagar(pk); }, ch.pubkey);
    await p0.pg.close();
    const p = await sessao(ch);
    let b = await lerBanco(p.pg, ch.pubkey);
    assert(b.pages.length === 0 && b.posts.length === 0, 'banco não estava vazio');
    await p.pg.click('#btn-backup'); await p.pg.waitForSelector('#t9');
    await p.pg.setInputFiles('#imp-arquivo', { name: nome, mimeType: 'application/json', buffer: Buffer.from(arquivo) });
    await p.pg.waitForSelector('#imp-plano');
    const res = await p.pg.evaluate(() => ({ resumo: document.querySelector('#imp-resumo p').textContent, chave: document.getElementById('imp-chave').textContent, contem: document.getElementById('imp-contem').textContent, plano: document.getElementById('imp-plano').textContent, botoes: [...document.querySelectorAll('#imp-resumo .acoes button')].map(b => b.textContent) }));
    assert(/^Backup de \d{4}-\d{2}-\d{2}, versão 1, feito pelo Nostermentor \d+\.\d+\.\d+/.test(res.resumo) && res.chave === 'Chave: a mesma desta sessão ✓' && res.contem === 'Contém 1 páginas, 1 artigos, 1 mídias (1 com arquivo).' && res.plano === 'Ao juntar: 3 novos, 0 atualizados, 0 iguais (ignorados), 0 locais mais recentes que o backup (mantidos).' && res.botoes.join('|') === 'Juntar com o que está aqui|Substituir tudo', JSON.stringify(res));
    await p.pg.screenshot({ path: u.captura('t9-importar'), fullPage: true });
    await p.pg.click('#imp-juntar');
    await p.pg.waitForSelector('#imp-feito');
    assert((await p.pg.textContent('#imp-feito')) === 'Backup importado: 3 novos, 0 atualizados, 0 iguais, 0 mantidos.', await p.pg.textContent('#imp-feito'));
    b = await lerBanco(p.pg, ch.pubkey);
    const j = JSON.parse(arquivo);
    const sem = (x) => { const c = Object.assign({}, x); delete c.bytes; delete c.bytes_base64; return c; };
    assert(JSON.stringify(b.pages[0]) === JSON.stringify(j.pages[0]) && JSON.stringify(b.posts[0]) === JSON.stringify(j.posts[0]) && JSON.stringify(sem(b.media[0])) === JSON.stringify(sem(j.media[0])) && b.media[0].bytes === '<blob>', JSON.stringify([b.pages[0], j.pages[0]]));
    const tam = await p.pg.evaluate(async (pk) => { const db = await Db.abrir(pk); const m = await db.get('media', 'm-so-aqui'); db.fechar(); return m.bytes.size; }, ch.pubkey);
    assert(tam === 3, 'bytes da mídia: ' + tam);
    const meta = Object.fromEntries(b.meta.map(m => [m.key, m.value]));
    assert(meta.alteracoes_nao_exportadas === 0 && meta.last_export_at === j.exported_at && (await p.pg.textContent('#btn-backup')) === 'Backup em dia' && (await p.pg.textContent('#btn-publicar')) === 'Publicar (3)', JSON.stringify(meta));
    assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros }));
    await p.pg.close();
  });

  await it('mesclagem pela tela: local mais recente mantido, backup mais recente vence (listado), novo entra; "Substituir tudo" pede confirmação em duas etapas e apaga o resto', async () => {
    const p = await sessao(ch);
    await p.pg.evaluate(async (pk) => { const db = await Db.abrir(pk); const pg = await db.get('pages', 'p1'); pg.title = 'Local mais nova'; pg.updated_at = '2030-01-01T00:00:00Z'; await db.put('pages', pg); const a = await db.get('posts', 'a1'); a.title = 'Local velha'; a.updated_at = '2020-01-01T00:00:00Z'; await db.put('posts', a); await db.put('pages', { id: 'p-local', slug: 'so-local', aliases: [], title: 'Só local', description: '', body: '', body_format: 'markdown', status: 'draft', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', published_hash: null, previous_status: null, in_menu: true }); db.fechar(); }, ch.pubkey);
    await p.pg.click('#btn-backup'); await p.pg.waitForSelector('#t9');
    await p.pg.setInputFiles('#imp-arquivo', { name: nome, mimeType: 'application/json', buffer: Buffer.from(arquivo) });
    await p.pg.waitForSelector('#imp-plano');
    assert((await p.pg.textContent('#imp-plano')) === 'Ao juntar: 0 novos, 1 atualizados, 1 iguais (ignorados), 1 locais mais recentes que o backup (mantidos).', await p.pg.textContent('#imp-plano'));
    await p.pg.click('#imp-juntar'); await p.pg.waitForSelector('#imp-feito');
    assert(/^Backup importado: 0 novos, 1 atualizados, 1 iguais, 1 mantidos\.$/.test(await p.pg.textContent('#imp-feito')) && (await p.pg.textContent('#imp-sobrescritos')) === 'Substituídos pelo backup: Local velha', (await p.pg.textContent('#imp-resultado')));
    let b = await lerBanco(p.pg, ch.pubkey);
    assert(b.pages.find(x => x.id === 'p1').title === 'Local mais nova' && b.posts[0].title === 'Artigo um' && b.pages.length === 2, JSON.stringify(b.pages.map(x => x.title)));
    // substituir tudo
    await p.pg.setInputFiles('#imp-arquivo', { name: nome, mimeType: 'application/json', buffer: Buffer.from(arquivo) });
    await p.pg.waitForSelector('#imp-plano');
    await p.pg.click('#imp-substituir'); await p.pg.waitForSelector('#imp-confirmacao');
    assert(/apaga tudo o que está neste navegador/.test(await p.pg.textContent('#imp-confirmacao')), 'confirmação');
    await p.pg.click('#imp-substituir-nao'); await p.pg.waitForSelector('#imp-juntar');
    await p.pg.click('#imp-substituir'); await p.pg.waitForSelector('#imp-substituir-sim'); await p.pg.click('#imp-substituir-sim');
    await p.pg.waitForSelector('#imp-feito');
    assert((await p.pg.textContent('#imp-feito')) === 'Tudo substituído pelo backup: 3 registros.', await p.pg.textContent('#imp-feito'));
    b = await lerBanco(p.pg, ch.pubkey);
    assert(b.pages.length === 1 && b.pages[0].title === 'Página um' && b.posts.length === 1 && b.media.length === 1, JSON.stringify(b.pages.map(x => x.title)));
    assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros }));
    await p.pg.close();
  });

  await it('recusas: backup de OUTRA chave → recusado, com o botão explícito "Importar como conteúdo desta chave" e o aviso; versão 99 → texto de 13 §7.4 + link "Nova versão"; arquivo inválido → "não é um backup"', async () => {
    const p = await sessao(ch);
    await p.pg.click('#btn-backup'); await p.pg.waitForSelector('#t9');
    const j = JSON.parse(arquivo); j.site.pubkey = outra.pubkey; j.site.npub = outra.npub; j.pages[0].id = 'p-outra'; j.pages[0].slug = 'de-outra-chave'; j.posts = []; j.media = [];
    await p.pg.setInputFiles('#imp-arquivo', { name: 'outra.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(j)) });
    await p.pg.waitForSelector('#imp-outra-chave');
    const o = await p.pg.evaluate(() => ({ chave: document.getElementById('imp-chave').textContent, recusa: document.getElementById('imp-outra-chave').textContent, botao: document.getElementById('imp-forcar').textContent, juntar: !!document.getElementById('imp-juntar') }));
    assert(/^Chave: outra \(npub1[a-z0-9]{4}…[a-z0-9]{4}\) ⚠$/.test(o.chave) && o.recusa === 'Este backup é de outra chave. Ele foi recusado.' && o.botao === 'Importar como conteúdo desta chave' && !o.juntar, JSON.stringify(o));
    await p.pg.click('#imp-forcar'); await p.pg.waitForSelector('#imp-juntar');
    assert(/passa a pertencer à chave desta sessão/.test(await p.pg.textContent('#imp-outra-chave-aviso')), 'aviso');
    await p.pg.click('#imp-juntar'); await p.pg.waitForSelector('#imp-feito');
    const b = await lerBanco(p.pg, ch.pubkey);
    assert(b.pages.some(x => x.id === 'p-outra') && b.site.pubkey === ch.pubkey && b.site.npub === ch.npub, 'importar como desta chave');
    const j99 = JSON.parse(arquivo); j99.version = 99;
    await p.pg.setInputFiles('#imp-arquivo', { name: 'v99.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(j99)) });
    await p.pg.waitForSelector('#imp-erro:not([hidden])');
    assert(/^Este backup foi feito por um Nostermentor mais novo — atualize o app para abri-lo\. Nova versão$/.test((await p.pg.textContent('#imp-erro')).trim()) && !!(await p.pg.$('#imp-nova-versao')), await p.pg.textContent('#imp-erro'));
    await p.pg.setInputFiles('#imp-arquivo', { name: 'lixo.json', mimeType: 'application/json', buffer: Buffer.from('{"oi": 1}') });
    await p.pg.waitForFunction(() => /não é um backup/.test(document.getElementById('imp-erro').textContent));
    await p.pg.setInputFiles('#imp-arquivo', { name: 'trip.json', mimeType: 'application/json', buffer: Buffer.from(arquivo.replace('"corpo de Página um"', JSON.stringify('x ' + outra.nsec))) });
    await p.pg.waitForFunction(() => /Importação interrompida por segurança/.test(document.getElementById('imp-erro').textContent));
    const v = await varrer(p.pg, ch.nsec);
    assert(v.achados.length === 0, v.achados.join(' | '));
    await p.pg.evaluate(async (pk) => { await Db.apagar(pk); }, ch.pubkey);
    assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros }));
    await p.pg.close();
  });

  return R;
};

function Modelo_slug(t) { return String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
