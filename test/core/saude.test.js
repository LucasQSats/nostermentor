// test/core/saude.test.js — classificação da saúde (13 §5.5, 14 T-8) com
// eventos assinados na própria página; sem rede.
const { abrir, coletor, assert } = require('../util.js');

module.exports = async function (ctx, u) {
  const { R, it } = coletor();
  const p = await abrir(ctx, u.url);
  const r = await p.pg.evaluate(() => {
    const out = {};
    const g = Chave.gerar(), outra = Chave.gerar();
    const mk = (created_at, sk, tags) => Chave.assinar({ kind: 15128, created_at, tags: tags || [['path', '/index.html', 'a'.repeat(64)]], content: '' }, sk || g.sk);
    const novo = mk(2000), velho = mk(1000), maisNovo = mk(3000);
    const forjado = Object.assign({}, mk(5000, outra.sk), { pubkey: g.pubkey });      // assinatura de outra chave, pubkey trocada
    const res = (url, estado, eventos) => ({ url, estado, eventos: eventos || [], ms: 1, detalhe: '' });
    const resultados = [res('wss://atual', 'ok', [novo]), res('wss://antigo', 'ok', [velho]), res('wss://mais-novo', 'ok', [maisNovo]), res('wss://sem', 'ok', []), res('wss://mudo', 'timeout', []),
      res('wss://forjado', 'ok', [forjado]), res('wss://dois', 'ok', [velho, novo]), res('wss://kind-errado', 'ok', [Chave.assinar({ kind: 1, created_at: 9000, tags: [], content: '' }, g.sk)]), res('wss://parcial', 'timeout', [novo])];
    const c = Saude.classificar(resultados, g.pubkey, novo);
    out.com = c.por_relay; out.contagem = { com: c.com, total: c.total, republicar: c.precisa_republicar, concorrente: c.concorrente };
    out.semRef = Saude.classificar(resultados, g.pubkey, null).por_relay;
    // empate de created_at: NIP-01 → o de MENOR id é o retido (= "atual")
    let e1 = mk(4000, g.sk, [['x', '1']]), e2 = mk(4000, g.sk, [['x', '2']]);
    if (e1.id > e2.id) { const t = e1; e1 = e2; e2 = t; }         // e1 = menor id
    out.empate = { cmp: Saude.comparar(e1, e2), mais: Saude.maisRecente([e2, e1]).id === e1.id, igual: Saude.comparar(e1, e1) };
    out.maisRecente = Saude.maisRecente([velho, maisNovo, novo]).id === maisNovo.id && Saude.maisRecente([]) === null;
    const h = Saude.saudeDe(c, '2026-08-26T10:00:00Z');
    out.health = h; out.contagemDe = Saude.contagemDe(h);
    out.limpo = Object.keys(Saude.limpo(Object.assign({ extra: 1 }, novo))).sort().join(',');
    out.validos = Saude.manifestsValidos([novo, forjado, { id: 'x' }, null], g.pubkey).length;
    return out;
  });
  await it('classificar: atual / antigo / mais_novo / sem / nao_respondeu; forjado (pubkey trocada) e kind errado contam como "sem"; evento chegou mas sem EOSE → ainda classifica', () => {
    const e = { 'wss://atual': 'atual', 'wss://antigo': 'antigo', 'wss://mais-novo': 'mais_novo', 'wss://sem': 'sem', 'wss://mudo': 'nao_respondeu', 'wss://forjado': 'sem', 'wss://dois': 'atual', 'wss://kind-errado': 'sem', 'wss://parcial': 'atual' };
    const dif = Object.keys(e).filter(k => r.com[k] !== e[k]).map(k => k + '=' + r.com[k]);
    assert(dif.length === 0, dif.join(', '));
    assert(r.contagem.com === 3 && r.contagem.total === 9 && r.contagem.republicar === 4 && r.contagem.concorrente === true, JSON.stringify(r.contagem));
  });
  await it('sem referência (primeira carga): todo relay com manifest válido é "atual"', () => assert(r.semRef['wss://antigo'] === 'atual' && r.semRef['wss://mais-novo'] === 'atual' && r.semRef['wss://forjado'] === 'sem', JSON.stringify(r.semRef)));
  await it('NIP-01: mesmo created_at → o de menor id é o mais recente; comparar(a,a) = 0; maisRecente de [] = null', () => assert(r.empate.cmp > 0 && r.empate.mais && r.empate.igual === 0 && r.maisRecente, JSON.stringify(r.empate)));
  await it('saudeDe → published.health (13 §5.4) com as cinco listas; contagemDe soma', () => assert(r.health.checked_at === '2026-08-26T10:00:00Z' && r.health.relays_with_manifest.length === 3 && r.health.relays_outdated.length === 1 && r.health.relays_newer.length === 1 && r.health.relays_missing.length === 3 && r.health.relays_unreachable.length === 1 && r.contagemDe.total === 9 && r.contagemDe.atual === 3, JSON.stringify(r.contagemDe)));
  await it('limpo: só os 7 campos do NIP-01 (P29); manifestsValidos descarta forjado e lixo', () => assert(r.limpo === 'content,created_at,id,kind,pubkey,sig,tags' && r.validos === 1, r.limpo + ' / ' + r.validos));
  await it('sem erros de página/console', () => assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros })));
  await p.pg.close();
  return R;
};
