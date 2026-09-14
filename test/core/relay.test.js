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
  // --- escuta (61, 2026-09-14) ---------------------------------------------
  // A assinatura que fica aberta depois do EOSE. O servidor falso empurra às
  // assinaturas abertas o que casar com o filtro — como o auth.nostr1.com e o
  // nos.lol fizeram na medição real do mesmo dia.
  const dormir = (ms) => new Promise(r => setTimeout(r, ms));
  const dono = F.chave(), ana = F.chave(), outro = F.chave();
  const env = (txt, o) => F.mensagem(ana, dono.pubkey, Object.assign({ content: txt }, o || {})).envelope;
  const filtroE = { kinds: [1059], '#p': [dono.pubkey], limit: 100 };
  const antigo = env('já estava lá');
  // `extra` é JSON: as funções de retorno nascem dentro da página.
  const iniciarEscuta = (nome, extra, filtro) => p.pg.evaluate(([url, filtro, extra]) => {
    window.__esc = window.__esc || {};
    const reg = { eventos: [], estados: [] };
    window.__esc[url] = reg;
    const o = Object.assign({ filtro: filtro, esperaMinMs: 200, pulsoMs: 0 }, extra || {});
    o.aoEvento = (e) => reg.eventos.push(e.id);
    o.aoEstado = (s) => reg.estados.push(s.estado + (s.detalhe ? ':' + s.detalhe : ''));
    if (o.comAuth) { const g = Chave.gerar(); reg.pubkey = g.pubkey; o.assinarAuth = (u, d) => Chave.assinar(Mensagens.modeloAuth(u, d), g.sk); }
    if (o.comSinal) { reg.ctrl = new AbortController(); o.sinal = reg.ctrl.signal; }
    reg.alca = Relay.escutar(url, o);
    return true;
  }, [f.ws(nome), filtro || filtroE, extra || null]);
  const lerEscuta = (nome) => p.pg.evaluate((url) => { const r = window.__esc[url]; return { eventos: r.eventos.slice(), estados: r.estados.slice(), estado: r.alca.estado(), pubkey: r.pubkey || null }; }, f.ws(nome));
  async function esperarEscuta(nome, cond, ms) {
    const t0 = Date.now(); let r = null;
    while (Date.now() - t0 < (ms || 10000)) { r = await lerEscuta(nome); if (cond(r)) return r; await dormir(100); }
    return r;
  }

  f.relay('esc-vivo', { modo: 'ok', eventos: [antigo, F.mensagem(ana, outro.pubkey, { content: 'para outra pessoa' }).envelope] });
  await it('escutar: entrega o histórico, diz "recebendo" no EOSE e FICA ABERTA — o que chega depois vem sem pedido novo, mesmo com o envelope datado de 36 h atrás', async () => {
    await iniciarEscuta('esc-vivo');
    let r = await esperarEscuta('esc-vivo', x => x.estado === 'recebendo');
    assert(r.estado === 'recebendo' && r.eventos.length === 1 && r.eventos[0] === antigo.id, 'o #p não foi respeitado ou o histórico não veio: ' + JSON.stringify(r));
    const reqsAntes = f.estado.relays.get('esc-vivo').recebidas.filter(m => m[0] === 'REQ').length;
    // a data do envelope é recuada por desenho (NIP-59): é o caso que uma escuta com `since = agora` perderia
    const novo = env('chegou agora', { envelopeEm: F.agora() - 36 * 3600 });
    const entregas = f.empurrar('esc-vivo', [novo, F.mensagem(ana, outro.pubkey, { content: 'outra, de novo' }).envelope]);
    r = await esperarEscuta('esc-vivo', x => x.eventos.length === 2);
    await dormir(300);
    r = await lerEscuta('esc-vivo');
    assert(r.eventos.length === 2 && r.eventos[1] === novo.id, 'o envelope novo não chegou pela assinatura aberta (ou chegou o de outra pessoa): ' + JSON.stringify(r));
    assert(f.estado.relays.get('esc-vivo').recebidas.filter(m => m[0] === 'REQ').length === reqsAntes, 'fez um pedido novo em vez de receber pela assinatura aberta');
    assert(f.assinaturasAbertas('esc-vivo') === 1, 'assinaturas abertas: ' + f.assinaturasAbertas('esc-vivo'));
    return entregas + ' entrega(s) do falso · estados ' + r.estados.join(' → ');
  });

  // "medir a medição": o falso tem de se comportar como os relays medidos, que
  // NÃO empurram o que o `since` exclui — senão o caso acima não provaria nada.
  f.relay('esc-since', { modo: 'ok', eventos: [] });
  await it('a armadilha, no próprio falso: com `since = agora`, o envelope recuado NÃO chega; o de data atual chega (foi o medido no auth.nostr1.com e no nos.lol)', async () => {
    await iniciarEscuta('esc-since', null, Object.assign({}, filtroE, { since: F.agora() }));
    await esperarEscuta('esc-since', x => x.estado === 'recebendo');
    const recuado = env('recuado', { envelopeEm: F.agora() - 3600 }), atual = env('atual', { envelopeEm: F.agora() + 5 });
    f.empurrar('esc-since', [recuado]);
    await dormir(500);
    const r1 = await lerEscuta('esc-since');
    f.empurrar('esc-since', [atual]);
    const r2 = await esperarEscuta('esc-since', x => x.eventos.length === 1, 5000);
    assert(r1.eventos.length === 0, 'o falso empurrou o que o since exclui — não se comporta como relay de verdade');
    assert(r2.eventos.length === 1 && r2.eventos[0] === atual.id, JSON.stringify(r2));
    await p.pg.evaluate((url) => window.__esc[url].alca.fechar(), f.ws('esc-since'));
  });

  await it('escutar: a conexão cai → religa sozinha, pede de novo, recupera o que chegou NA QUEDA e não repete o que já tinha entregado', async () => {
    const conexoesAntes = f.estado.relays.get('esc-vivo').conexoes;
    f.derrubar('esc-vivo');
    // chega enquanto não há conexão: só a reentrega ao religar (o `limit`) o traz
    const naQueda = env('chegou durante a queda');
    f.semear('esc-vivo', [naQueda]);
    let r = await esperarEscuta('esc-vivo', x => x.estados.some(e => e.indexOf('caiu') === 0) && x.estado === 'recebendo' && f.estado.relays.get('esc-vivo').conexoes > conexoesAntes, 10000);
    assert(r.estado === 'recebendo', 'não religou: ' + JSON.stringify(r.estados));
    r = await esperarEscuta('esc-vivo', x => x.eventos.length === 3, 5000);
    assert(r.eventos.length === 3 && r.eventos[2] === naQueda.id, 'repetiu o que já tinha, ou perdeu o que chegou na queda: ' + JSON.stringify(r.eventos));
    const depois = env('depois da queda');
    f.empurrar('esc-vivo', [depois]);
    r = await esperarEscuta('esc-vivo', x => x.eventos.length === 4);
    assert(r.eventos.length === 4 && r.eventos[3] === depois.id, JSON.stringify(r.eventos));
    return r.estados.join(' → ');
  });

  f.relay('esc-auth', { modo: 'ok', auth: 'ler', eventos: [antigo] });
  await it('escutar: relay que pede identificação — se identifica com ["AUTH", ev], repete o pedido e recebe ao vivo', async () => {
    await iniciarEscuta('esc-auth', { comAuth: true });
    let r = await esperarEscuta('esc-auth', x => x.estado === 'recebendo');
    assert(r.estado === 'recebendo' && r.eventos.length === 1, JSON.stringify(r));
    assert(f.identificadosEm('esc-auth').includes(r.pubkey), 'o relay não viu ninguém se identificar');
    const novo = env('só para quem se identificou');
    f.empurrar('esc-auth', [novo]);
    r = await esperarEscuta('esc-auth', x => x.eventos.length === 2);
    assert(r.eventos.length === 2 && r.eventos[1] === novo.id, JSON.stringify(r));
    return r.estados.join(' → ');
  });

  await it('escutar: "auth-required" sem desafio (o damus.io, P44) → "recusou" e NÃO fica religando', async () => {
    await iniciarEscuta('recusa', { comAuth: true });
    const r = await esperarEscuta('recusa', x => x.estado === 'recusou');
    const antes = f.estado.relays.get('recusa').conexoes;
    await dormir(1500);
    assert(r.estado === 'recusou', JSON.stringify(r));
    assert(f.estado.relays.get('recusa').conexoes === antes, 'continuou martelando o relay: ' + antes + ' → ' + f.estado.relays.get('recusa').conexoes);
  });

  f.relay('esc-fecha', { modo: 'ok', eventos: [] });
  await it('escutar: cancelar (AbortController) manda CLOSE, fecha a conexão e não religa', async () => {
    await iniciarEscuta('esc-fecha', { comSinal: true });
    await esperarEscuta('esc-fecha', x => x.estado === 'recebendo');
    assert(f.ligacoesAbertas('esc-fecha') === 1, 'conexões abertas antes: ' + f.ligacoesAbertas('esc-fecha'));
    await p.pg.evaluate((url) => window.__esc[url].ctrl.abort(), f.ws('esc-fecha'));
    const t0 = Date.now();
    while (f.ligacoesAbertas('esc-fecha') > 0 && Date.now() - t0 < 5000) await dormir(100);
    assert(f.ligacoesAbertas('esc-fecha') === 0, 'a conexão ficou aberta depois de cancelar');
    assert(f.estado.relays.get('esc-fecha').recebidas.some(m => m[0] === 'CLOSE'), 'não mandou CLOSE');
    const conexoes = f.estado.relays.get('esc-fecha').conexoes;
    await dormir(800);
    const r = await lerEscuta('esc-fecha');
    assert(f.estado.relays.get('esc-fecha').conexoes === conexoes && r.estado === 'fechado', 'religou depois de cancelado: ' + JSON.stringify(r.estados));
  });

  f.relay('esc-pulso', { modo: 'ok', eventos: [] });
  await it('escutar: o pulso — REQ por um id que não existe a cada `pulsoMs`, fechado no EOSE; a assinatura de verdade continua sendo uma só', async () => {
    await iniciarEscuta('esc-pulso', { pulsoMs: 250 });
    await esperarEscuta('esc-pulso', x => x.estado === 'recebendo');
    await dormir(1000);
    const rec = f.estado.relays.get('esc-pulso').recebidas;
    const pulsos = rec.filter(m => m[0] === 'REQ' && m[2] && Array.isArray(m[2].ids) && m[2].ids[0] === '0'.repeat(64));
    const fechados = rec.filter(m => m[0] === 'CLOSE' && pulsos.some(x => x[1] === m[1]));
    assert(pulsos.length >= 2 && fechados.length >= 2, 'pulsos ' + pulsos.length + ', fechados ' + fechados.length);
    const t0 = Date.now();
    while (f.assinaturasAbertas('esc-pulso') !== 1 && Date.now() - t0 < 2000) await dormir(20);
    assert(f.assinaturasAbertas('esc-pulso') === 1, 'sobrou assinatura de pulso aberta: ' + f.assinaturasAbertas('esc-pulso'));
    return pulsos.length + ' pulsos em ~1 s';
  });

  await it('escutar: relay que conecta e nunca manda o EOSE → cai por tempo-limite e tenta de novo, com espera', async () => {
    await iniciarEscuta('mudo', { timeoutMs: 500 });
    const r = await esperarEscuta('mudo', x => x.estados.filter(e => e === 'caiu:timeout').length >= 2, 8000);
    assert(r.estados.filter(e => e === 'caiu:timeout').length >= 2, JSON.stringify(r.estados));
    return r.estados.slice(0, 6).join(' → ');
  });

  await it('escutar: URL que não é wss: → "recusou" sem abrir socket', async () => {
    const r = await p.pg.evaluate(() => { const est = []; const a = Relay.escutar('https://x.y', { filtro: {}, aoEstado: (s) => est.push(s.estado) }); return { est, estado: a.estado() }; });
    assert(r.estado === 'recusou' && r.est.join() === 'recusou', JSON.stringify(r));
  });

  await p.pg.evaluate(() => Object.values(window.__esc || {}).forEach(r => r.alca.fechar()));

  await it('sem erros de página/console (falhas de rede não viram exceção)', () => assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros })));
  await p.pg.close();
  return R;
};
