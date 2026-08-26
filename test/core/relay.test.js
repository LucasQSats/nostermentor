// test/core/relay.test.js — core/relay.js contra o servidor falso (personas
// ok/vazio/mudo/fecha/recusa/lixo/lento) e contra portas fechadas/URLs
// inválidas. Evidência de que um relay morto nunca segura a leitura.
const { abrir, coletor, assert } = require('../util.js');
const F = require('../fabrica.js');

module.exports = async function (ctx, u) {
  const { R, it, pulado } = coletor();
  if (!u.falso) { pulado('core/relay (todos os casos)', 'servidor falso indisponível'); return R; }
  const p = await abrir(ctx, u.url);
  const ch = F.chave();
  const m1 = F.manifest(ch, { paths: { '/index.html': 'a'.repeat(64) }, created_at: 1000 }), m2 = F.manifest(ch, { paths: { '/index.html': 'b'.repeat(64) }, created_at: 2000 });
  const k0 = F.perfil(ch);
  const f = u.falso;
  f.relay('ok', { modo: 'ok', eventos: [m1, m2, k0] });
  f.relay('vazio', { modo: 'vazio' });
  f.relay('mudo', { modo: 'mudo' });
  f.relay('fecha', { modo: 'fecha' });
  f.relay('recusa', { modo: 'recusa' });
  f.relay('lixo', { modo: 'lixo', eventos: [m1] });
  f.relay('lento', { modo: 'lento', atrasoMs: 1500, eventos: [m1] });
  f.relay('sub-errado', { modo: 'ok', subErrado: true, eventos: [m1] });
  f.relay('malformado', { modo: 'ok', eventos: [Object.assign({}, m1, { sig: 'zz' }), Object.assign({}, m1, { tags: [['a', 1]] }), m2] });
  const filtro = { kinds: [15128, 0], authors: [ch.pubkey] };
  const q = (url, opts) => p.pg.evaluate(([url, filtro, opts]) => Relay.consultarUm(url, filtro, opts), [url, filtro, opts || {}]);

  await it('ok: REQ → 3 EVENT + EOSE → estado ok, 3 eventos bem formados, CLOSE enviado', async () => {
    const r = await q(f.ws('ok'));
    assert(r.estado === 'ok' && r.eventos.length === 3 && r.eventos.every(e => typeof e.sig === 'string'), JSON.stringify([r.estado, r.eventos.length, r.detalhe]));
    const rec = f.estado.relays.get('ok').recebidas;
    assert(rec.some(m => m[0] === 'REQ' && m[2].kinds.includes(15128) && m[2].authors[0] === ch.pubkey) && rec.some(m => m[0] === 'CLOSE'), 'faltou REQ/CLOSE: ' + JSON.stringify(rec));
    return `${r.ms} ms`;
  });
  await it('filtro respeitado pelo falso: só kinds pedidos (kind 0 fora quando só 15128)', async () => {
    const r = await p.pg.evaluate(([url, pk]) => Relay.consultarUm(url, { kinds: [15128], authors: [pk] }), [f.ws('ok'), ch.pubkey]);
    assert(r.estado === 'ok' && r.eventos.length === 2 && r.eventos.every(e => e.kind === 15128), JSON.stringify([r.estado, r.eventos.map(e => e.kind)]));
  });
  await it('vazio: EOSE sem eventos → ok, 0 eventos (é "respondeu", não "não respondeu")', async () => { const r = await q(f.ws('vazio')); assert(r.estado === 'ok' && r.eventos.length === 0, JSON.stringify(r)); });
  await it('mudo: conecta e nunca responde → timeout no prazo dado (1,5 s), não antes', async () => {
    const t0 = Date.now(); const r = await q(f.ws('mudo'), { timeoutMs: 1500 }); const dt = Date.now() - t0;
    assert(r.estado === 'timeout' && dt >= 1400 && dt < 4000, JSON.stringify([r.estado, dt]));
    return `${dt} ms`;
  });
  await it('fecha: servidor fecha antes do EOSE → "fechou" (ou erro), rápido', async () => { const r = await q(f.ws('fecha'), { timeoutMs: 5000 }); assert((r.estado === 'fechou' || r.estado === 'erro') && r.ms < 4000, JSON.stringify(r)); return r.estado + ' ' + r.detalhe; });
  await it('recusa: CLOSED → "recusou" com a mensagem do relay em detalhe', async () => { const r = await q(f.ws('recusa')); assert(r.estado === 'recusou' && /auth-required/.test(r.detalhe), JSON.stringify(r)); });
  await it('lixo: JSON inválido, string solta e EVENT malformado são ignorados; o evento bom e o EOSE passam', async () => { const r = await q(f.ws('lixo')); assert(r.estado === 'ok' && r.eventos.length === 1, JSON.stringify([r.estado, r.eventos.length])); });
  await it('malformado: sig/tags fora do NIP-01 caem em eventoBemFormado; o bom fica', async () => { const r = await q(f.ws('malformado')); assert(r.estado === 'ok' && r.eventos.length === 1 && r.eventos[0].id === m2.id, JSON.stringify([r.estado, r.eventos.length])); });
  await it('sub-errado: EVENT de outra assinatura é ignorado, EOSE da nossa fecha', async () => { const r = await q(f.ws('sub-errado')); assert(r.estado === 'ok' && r.eventos.length === 0, JSON.stringify([r.estado, r.eventos.length])); });
  await it('lento: 1,5 s até o EOSE, dentro do timeout → ok', async () => { const r = await q(f.ws('lento'), { timeoutMs: 10000 }); assert(r.estado === 'ok' && r.eventos.length === 1 && r.ms >= 1400, JSON.stringify([r.estado, r.ms])); });
  await it('URL inválida (https:, ws:, lixo) → "invalida" sem abrir socket', async () => {
    const rs = await Promise.all(['https://x.y', 'ws://127.0.0.1:1/x', 'lixo', '', null].map(x => q(x)));
    assert(rs.every(r => r.estado === 'invalida'), rs.map(r => r.estado).join(','));
  });
  await it('porta fechada / host inexistente → "erro" rápido (< 10 s)', async () => {
    const rs = await Promise.all(['wss://127.0.0.1:1/x', 'wss://nao-existe.invalid/'].map(x => q(x, { timeoutMs: 15000 })));
    assert(rs.every(r => r.estado === 'erro' || r.estado === 'fechou') && rs.every(r => r.ms < 10000), JSON.stringify(rs.map(r => [r.url, r.estado, r.ms])));
    return rs.map(r => `${r.estado} ${r.ms}ms`).join(' / ');
  });
  await it('cancelar (AbortController) durante um relay mudo → "cancelado" na hora', async () => {
    const r = await p.pg.evaluate(async ([url, filtro]) => { const c = new AbortController(); setTimeout(() => c.abort(), 300); return Relay.consultarUm(url, filtro, { timeoutMs: 20000, sinal: c.signal }); }, [f.ws('mudo'), filtro]);
    assert(r.estado === 'cancelado' && r.ms < 2000, JSON.stringify(r));
  });
  await it('consultar: 5 relays em paralelo (ok, vazio, mudo 1,5 s, recusa, porta fechada) → 5 resultados na ordem, aoRelay chamado 5×, total ≈ o mais lento', async () => {
    const urls = [f.ws('ok'), f.ws('vazio'), f.ws('mudo'), f.ws('recusa'), 'wss://127.0.0.1:1/x'];
    const r = await p.pg.evaluate(async ([urls, filtro]) => { const chamadas = []; const t0 = Date.now(); const rs = await Relay.consultar(urls, filtro, { timeoutMs: 1500, aoRelay: (x) => chamadas.push(x.url) }); return { rs: rs.map(x => [x.url, x.estado, x.eventos.length]), chamadas, dt: Date.now() - t0 }; }, [urls, filtro]);
    assert(r.rs.length === 5 && r.rs[0][1] === 'ok' && r.rs[0][2] === 3 && r.rs[1][1] === 'ok' && r.rs[2][1] === 'timeout' && r.rs[3][1] === 'recusou' && (r.rs[4][1] === 'erro' || r.rs[4][1] === 'fechou'), JSON.stringify(r.rs));
    assert(r.chamadas.length === 5 && r.dt < 4000, JSON.stringify([r.chamadas.length, r.dt]));
    return `${r.dt} ms para os 5`;
  });
  await it('consultar deduplica URLs (com/sem barra final)', async () => {
    const r = await p.pg.evaluate(async ([a, filtro]) => (await Relay.consultar([a, a + '/', a], filtro)).length, [f.ws('ok'), filtro]);
    assert(r === 1, 'resultados: ' + r);
  });
  await it('eventoBemFormado: aceita evento assinado real; recusa id curto, kind string, tags não-string, sem sig, null', async () => {
    const r = await p.pg.evaluate(() => { const g = Chave.gerar(); const ev = Chave.assinar({ kind: 1, created_at: 1, tags: [['a', 'b']], content: '' }, g.sk);
      return [Relay.eventoBemFormado(ev), Relay.eventoBemFormado(Object.assign({}, ev, { id: 'ab' })), Relay.eventoBemFormado(Object.assign({}, ev, { kind: '1' })), Relay.eventoBemFormado(Object.assign({}, ev, { tags: [[1]] })), Relay.eventoBemFormado(Object.assign({}, ev, { sig: undefined })), Relay.eventoBemFormado(null), Relay.eventoBemFormado([])]; });
    assert(r[0] === true && r.slice(1).every(x => x === false), JSON.stringify(r));
  });
  await it('sem erros de página/console (falhas de rede não viram exceção)', () => assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros })));
  await p.pg.close();
  return R;
};
