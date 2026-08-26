/* core/saude.js — "verificar" da saúde da publicação (13 §5.5, 03 §3.4.1):
   em que relays o manifest 15128 está, e em que versão. Quatro estados por
   relay (14 T-8): 'atual' | 'antigo' | 'sem' | 'nao_respondeu' — e um
   quinto, 'mais_novo', que é o aviso de publicação concorrente (13 §6.3
   item 5). Silêncio nunca vira "ok" (02 G.1.6). "Republicar" chega no M4.
   NIP-01 (consultado 2026-08-26): evento substituível — vale o created_at
   maior; empate → o de MENOR id (ordem lexical). */
const Saude = (function () {
  'use strict';

  const KIND_MANIFEST = 15128;
  const ESTADOS = Object.freeze(['atual', 'antigo', 'mais_novo', 'sem', 'nao_respondeu']);

  // Evento da rede é dado (02 G.0; P29): só os 7 campos do NIP-01.
  function limpo(ev) {
    return { id: ev.id, pubkey: ev.pubkey, created_at: ev.created_at, kind: ev.kind, tags: ev.tags, content: ev.content, sig: ev.sig };
  }
  function manifestsValidos(eventos, pubkey) {
    const saida = [];
    for (const e of eventos || []) {
      if (!e || e.kind !== KIND_MANIFEST || e.pubkey !== pubkey) continue;
      if (!Chave.verificar(e)) continue;
      saida.push(limpo(e));
    }
    return saida;
  }
  // > 0 se `a` é mais novo que `b`; 0 se é o mesmo evento
  function comparar(a, b) {
    if (a.id === b.id) return 0;
    if (a.created_at !== b.created_at) return a.created_at - b.created_at;
    return a.id < b.id ? 1 : -1;
  }
  function maisRecente(eventos) {
    let m = null;
    for (const e of eventos || []) if (!m || comparar(e, m) > 0) m = e;
    return m;
  }

  // resultados: os de Relay.consultar; referencia: o manifest que o app
  // considera atual (null quando ainda não há — todo relay com manifest é 'atual').
  function classificar(resultados, pubkey, referencia) {
    const por_relay = {}, listas = { atual: [], antigo: [], mais_novo: [], sem: [], nao_respondeu: [] };
    for (const r of resultados || []) {
      const melhor = maisRecente(manifestsValidos(r.eventos, pubkey));
      let estado;
      if (melhor) {
        if (!referencia) estado = 'atual';
        else { const c = comparar(melhor, referencia); estado = c === 0 ? 'atual' : (c < 0 ? 'antigo' : 'mais_novo'); }
      } else estado = r.estado === 'ok' ? 'sem' : 'nao_respondeu';
      por_relay[r.url] = estado;
      listas[estado].push(r.url);
    }
    return {
      por_relay: por_relay, listas: listas, com: listas.atual.length, total: (resultados || []).length,
      precisa_republicar: listas.antigo.length + listas.sem.length, concorrente: listas.mais_novo.length > 0
    };
  }

  // 13 §5.4 `published.health`
  function saudeDe(c, quando) {
    return { checked_at: quando || Modelo.agora(), relays_with_manifest: c.listas.atual.slice(), relays_outdated: c.listas.antigo.slice(),
      relays_newer: c.listas.mais_novo.slice(), relays_missing: c.listas.sem.slice(), relays_unreachable: c.listas.nao_respondeu.slice() };
  }
  function contagemDe(health) {
    const h = health || {};
    const n = k => (Array.isArray(h[k]) ? h[k].length : 0);
    return { atual: n('relays_with_manifest'), antigo: n('relays_outdated'), mais_novo: n('relays_newer'), sem: n('relays_missing'), nao_respondeu: n('relays_unreachable'),
      total: n('relays_with_manifest') + n('relays_outdated') + n('relays_newer') + n('relays_missing') + n('relays_unreachable') };
  }

  // { relays, pubkey, referencia, timeoutMs, sinal, aoRelay } → { resultados, classificacao, health }
  async function verificar(o) {
    const resultados = await Relay.consultar(o.relays, { kinds: [KIND_MANIFEST], authors: [o.pubkey] }, { timeoutMs: o.timeoutMs, sinal: o.sinal, aoRelay: o.aoRelay });
    const c = classificar(resultados, o.pubkey, o.referencia || null);
    return { resultados: resultados, classificacao: c, health: saudeDe(c) };
  }

  return Object.freeze({ KIND_MANIFEST, ESTADOS, limpo, manifestsValidos, comparar, maisRecente, classificar, saudeDe, contagemDe, verificar });
})();
