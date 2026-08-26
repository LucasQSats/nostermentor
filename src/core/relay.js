/* core/relay.js — relays por WebSocket (NIP-01, consultado em 2026-08-26).
   LEITURA: ["REQ", <sub>, <filtro>] → ["EVENT", <sub>, <ev>]… → ["EOSE", <sub>];
   ["CLOSED", <sub>, <msg>] é recusa; ["NOTICE", <msg>] é só diagnóstico.
   ESCRITA (M4): ["EVENT", <ev>] → ["OK", <id>, true|false, <msg>]. O NIP-01
   diz que o 4.º campo do OK é sempre presente e, quando `false`, tem a forma
   `prefixo: explicação` — os prefixos padronizados são `duplicate`, `pow`,
   `blocked`, `rate-limited`, `invalid`, `restricted`, `mute` e `error`.
   `duplicate` é ACEITE: o relay já tem o evento (é o caso do republicar).
   Um resultado por relay, sempre (D8: sucesso parcial é o normal): nunca
   lança, nunca espera além do timeout (07 §3.2: 45 s).
   Evento recebido é DADO (02 G.0): aqui só se confere a forma; assinatura e
   autoria são conferidas por quem usa (Saude/Rede via Chave.verificar). */
const Relay = (function () {
  'use strict';

  const TIMEOUT_PADRAO_MS = 45000;
  const RE_HEX64 = /^[0-9a-f]{64}$/, RE_HEX128 = /^[0-9a-f]{128}$/;
  // 05 §2.0 (validado 2026-08-25): kind na faixa efêmera 20000–29999 — o
  // NIP-01 manda o relay NÃO reter. Sonda escrita sem deixar lixo na rede.
  const KIND_SONDA = 20169;

  function urlValida(u) {
    let p;
    try { p = new URL(String(u)); } catch (e) { return false; }
    return p.protocol === 'wss:' && !!p.hostname;      // a CSP (02 G.1.1) só deixa wss:
  }

  function eventoBemFormado(ev) {
    return !!ev && typeof ev === 'object' && !Array.isArray(ev)
      && typeof ev.id === 'string' && RE_HEX64.test(ev.id)
      && typeof ev.pubkey === 'string' && RE_HEX64.test(ev.pubkey)
      && Number.isInteger(ev.created_at) && ev.created_at >= 0
      && Number.isInteger(ev.kind) && ev.kind >= 0 && ev.kind <= 65535
      && Array.isArray(ev.tags) && ev.tags.every(t => Array.isArray(t) && t.every(x => typeof x === 'string'))
      && typeof ev.content === 'string'
      && typeof ev.sig === 'string' && RE_HEX128.test(ev.sig);
  }

  function idAssinatura() {
    const b = new Uint8Array(8); crypto.getRandomValues(b);
    return 'n' + Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  }

  // Prefixo legível-por-máquina da mensagem do OK/CLOSED (NIP-01).
  function prefixoDe(mensagem) {
    const m = /^([a-z-]+):/.exec(String(mensagem == null ? '' : mensagem).trim().toLowerCase());
    return m ? m[1] : '';
  }

  // --- leitura -------------------------------------------------------------

  // → { url, estado, eventos, ms, detalhe }
  // estado: 'ok' (EOSE) | 'timeout' | 'erro' (conexão) | 'fechou' (antes do EOSE)
  //         | 'recusou' (CLOSED) | 'invalida' (URL) | 'cancelado'
  function consultarUm(url, filtro, opts) {
    opts = opts || {};
    const timeoutMs = opts.timeoutMs || TIMEOUT_PADRAO_MS, sinal = opts.sinal || null;
    const inicio = Date.now();
    return new Promise(function (resolve) {
      const r = { url: url, estado: 'erro', eventos: [], ms: 0, detalhe: '' };
      if (!urlValida(url)) { r.estado = 'invalida'; return resolve(r); }
      if (sinal && sinal.aborted) { r.estado = 'cancelado'; return resolve(r); }
      let ws = null, terminou = false, timer = null;
      const sub = idAssinatura();
      function aoCancelar() { fim('cancelado'); }
      function fim(estado, detalhe) {
        if (terminou) return;
        terminou = true;
        r.estado = estado;
        if (detalhe) r.detalhe = String(detalhe).slice(0, 200);
        r.ms = Date.now() - inicio;
        clearTimeout(timer);
        if (sinal) sinal.removeEventListener('abort', aoCancelar);
        if (ws) {
          try { if (ws.readyState === 1) ws.send(JSON.stringify(['CLOSE', sub])); } catch (e) {}
          try { ws.close(); } catch (e) {}
        }
        resolve(r);
      }
      try { ws = new WebSocket(url); } catch (e) { return fim('erro', e && e.message); }
      timer = setTimeout(function () { fim('timeout'); }, timeoutMs);
      if (sinal) sinal.addEventListener('abort', aoCancelar);
      ws.onopen = function () {
        try { ws.send(JSON.stringify(['REQ', sub, filtro])); } catch (e) { fim('erro', e && e.message); }
      };
      ws.onerror = function () { if (!terminou) fim('erro', 'falha de conexão'); };
      ws.onclose = function (ev) { if (!terminou) fim('fechou', 'código ' + (ev && ev.code)); };
      ws.onmessage = function (m) {
        let msg;
        try { msg = JSON.parse(m.data); } catch (e) { return; }      // lixo é ignorado, não derruba
        if (!Array.isArray(msg)) return;
        const tipo = msg[0];
        if (tipo === 'EVENT' && msg[1] === sub) { if (eventoBemFormado(msg[2])) r.eventos.push(msg[2]); }
        else if (tipo === 'EOSE' && msg[1] === sub) fim('ok');
        else if (tipo === 'CLOSED' && msg[1] === sub) fim('recusou', msg[2]);
        else if (tipo === 'NOTICE') r.detalhe = String(msg[1] == null ? '' : msg[1]).slice(0, 200);
      };
    });
  }

  // Todos em paralelo (07 §3.2: o custo do Tor é latência por conexão) — um
  // resultado por URL, na ordem dada; `aoRelay(r)` avisa conforme chegam.
  function consultar(urls, filtro, opts) {
    opts = opts || {};
    const lista = Modelo.uniao(urls);
    return Promise.all(lista.map(function (u) {
      return consultarUm(u, filtro, opts).then(function (r) {
        if (typeof opts.aoRelay === 'function') { try { opts.aoRelay(r); } catch (e) {} }
        return r;
      });
    }));
  }

  // --- escrita (M4) --------------------------------------------------------

  // → { url, estado, ms, mensagem, prefixo }
  // estado: 'aceito' (OK true, ou `duplicate`) | 'recusado' (OK false)
  //         | 'timeout' (conectou e não respondeu) | 'erro' | 'fechou'
  //         | 'invalida' | 'cancelado'
  // O relay que não responde NUNCA vira sucesso (02 G.1.6: silêncio não é ok).
  function publicarEm(url, evento, opts) {
    opts = opts || {};
    const timeoutMs = opts.timeoutMs || TIMEOUT_PADRAO_MS, sinal = opts.sinal || null;
    const inicio = Date.now();
    return new Promise(function (resolve) {
      const r = { url: url, estado: 'erro', ms: 0, mensagem: '', prefixo: '' };
      if (!urlValida(url)) { r.estado = 'invalida'; return resolve(r); }
      if (!eventoBemFormado(evento)) { r.estado = 'erro'; r.mensagem = 'evento malformado'; return resolve(r); }
      if (sinal && sinal.aborted) { r.estado = 'cancelado'; return resolve(r); }
      let ws = null, terminou = false, timer = null;
      function aoCancelar() { fim('cancelado'); }
      function fim(estado, mensagem) {
        if (terminou) return;
        terminou = true;
        r.estado = estado;
        if (mensagem) { r.mensagem = String(mensagem).slice(0, 200); r.prefixo = prefixoDe(mensagem); }
        r.ms = Date.now() - inicio;
        clearTimeout(timer);
        if (sinal) sinal.removeEventListener('abort', aoCancelar);
        if (ws) { try { ws.close(); } catch (e) {} }
        resolve(r);
      }
      try { ws = new WebSocket(url); } catch (e) { return fim('erro', e && e.message); }
      timer = setTimeout(function () { fim('timeout'); }, timeoutMs);
      if (sinal) sinal.addEventListener('abort', aoCancelar);
      ws.onopen = function () {
        try { ws.send(JSON.stringify(['EVENT', evento])); } catch (e) { fim('erro', e && e.message); }
      };
      ws.onerror = function () { if (!terminou) fim('erro', 'falha de conexão'); };
      ws.onclose = function (ev) { if (!terminou) fim('fechou', 'código ' + (ev && ev.code)); };
      ws.onmessage = function (m) {
        let msg;
        try { msg = JSON.parse(m.data); } catch (e) { return; }
        if (!Array.isArray(msg)) return;
        if (msg[0] === 'NOTICE') { r.mensagem = String(msg[1] == null ? '' : msg[1]).slice(0, 200); return; }
        if (msg[0] !== 'OK' || msg[1] !== evento.id) return;          // OK de outro evento não é nosso
        const texto = msg[3] == null ? '' : String(msg[3]);
        // `duplicate` = o relay já tem este evento: para o produto é aceite
        if (msg[2] === true || prefixoDe(texto) === 'duplicate') return fim('aceito', texto);
        fim('recusado', texto || 'recusado');
      };
    });
  }

  // Todos em paralelo; um resultado por relay, na ordem dada.
  function publicar(urls, evento, opts) {
    opts = opts || {};
    const lista = Modelo.uniao(urls);
    return Promise.all(lista.map(function (u) {
      return publicarEm(u, evento, opts).then(function (r) {
        if (typeof opts.aoRelay === 'function') { try { opts.aoRelay(r); } catch (e) {} }
        return r;
      });
    }));
  }

  function placar(resultados) {
    const lista = resultados || [];
    const aceitos = lista.filter(r => r.estado === 'aceito').map(r => r.url);
    const recusados = lista.filter(r => r.estado === 'recusado').map(r => r.url);
    return { aceitos: aceitos, recusados: recusados,
      mudos: lista.filter(r => r.estado !== 'aceito' && r.estado !== 'recusado').map(r => r.url),
      com: aceitos.length, total: lista.length, ok: aceitos.length >= 1 };
  }

  // 05 §2.0 — "este relay aceita escrita?" sem sujar a rede: evento efêmero
  // assinado por uma chave gerada aqui e apagada em seguida. A chave do
  // usuário NUNCA entra nisto (02 §B).
  async function sondarEscrita(urls, opts) {
    opts = opts || {};
    const ch = Chave.gerar();
    try {
      const evento = Chave.assinar({ kind: KIND_SONDA, created_at: Math.floor(Date.now() / 1000), tags: [], content: '' }, ch.sk);
      return await publicar(urls, evento, opts);
    } finally {
      Chave.apagar(ch.sk);
    }
  }

  return Object.freeze({
    TIMEOUT_PADRAO_MS, KIND_SONDA, urlValida, eventoBemFormado, prefixoDe,
    consultarUm, consultar, publicarEm, publicar, placar, sondarEscrita
  });
})();
