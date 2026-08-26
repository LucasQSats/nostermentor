// test/rede/consulta_independente.js — juiz INDEPENDENTE do app (02 §F):
// consulta os relays pelo WebSocket do Node (sem nostr-tools, sem o código
// do produto) e imprime UMA linha JSON com o manifest 15128 mais recente
// por relay e o mais recente de todos (NIP-01: created_at maior; empate →
// menor id). É o papel que caca_34128.mjs fazia em 2026-08-18.
//   node --experimental-websocket consulta_independente.js <pubkey-hex> <relay>…
const [, , pubkey, ...relays] = process.argv;
if (!pubkey || !relays.length) { console.error('uso: consulta_independente.js <pubkey> <relay>…'); process.exit(2); }

function consultar(url) {
  return new Promise((resolve) => {
    const r = { url, estado: 'erro', eventos: [] };
    let ws; try { ws = new WebSocket(url); } catch (e) { return resolve(r); }
    const timer = setTimeout(() => { r.estado = 'timeout'; try { ws.close(); } catch (e) {} resolve(r); }, 20000);
    const fim = (estado) => { clearTimeout(timer); r.estado = estado; try { ws.close(); } catch (e) {} resolve(r); };
    ws.onopen = () => ws.send(JSON.stringify(['REQ', 'j', { kinds: [15128], authors: [pubkey] }]));
    ws.onmessage = (m) => { let msg; try { msg = JSON.parse(m.data); } catch (e) { return; }
      if (msg[0] === 'EVENT' && msg[2] && msg[2].kind === 15128 && msg[2].pubkey === pubkey) r.eventos.push({ id: msg[2].id, created_at: msg[2].created_at, paths: msg[2].tags.filter(t => t[0] === 'path').length, cru: msg[2] });
      if (msg[0] === 'EOSE') fim('ok'); if (msg[0] === 'CLOSED') fim('recusou'); };
    ws.onerror = () => fim('erro');
    ws.onclose = () => { if (r.estado === 'erro') fim('fechou'); };
  });
}
(async () => {
  const rs = await Promise.all(relays.map(consultar));
  const mais = (l) => l.reduce((m, e) => (!m || e.created_at > m.created_at || (e.created_at === m.created_at && e.id < m.id)) ? e : m, null);
  const por_relay = {};
  for (const r of rs) por_relay[r.url] = { estado: r.estado, mais_recente: mais(r.eventos) };
  const topo = mais(rs.flatMap(r => r.eventos));
  const semCru = (e) => (e ? { id: e.id, created_at: e.created_at, paths: e.paths } : null);
  for (const k of Object.keys(por_relay)) por_relay[k].mais_recente = semCru(por_relay[k].mais_recente);
  console.log(JSON.stringify({ pubkey, por_relay, mais_recente: semCru(topo), evento: topo ? topo.cru : null, respondidos: rs.filter(r => r.estado === 'ok').length, total: rs.length }));
  process.exit(0);
})();
