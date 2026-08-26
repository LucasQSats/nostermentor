/* core/blossom.js — leitura de blob (BUD-01, consultado em 2026-08-26):
   GET https://<servidor>/<sha256>, CORS `*` obrigatório no servidor, 3xx
   permitido desde que aponte para o mesmo hash (por isso `redirect:
   'follow'` — P15). O endereço É o hash: o que chega é conferido com
   crypto.subtle e descartado se não bater (05 §2.3). Timeout 120 s por
   operação (07 §3.2). Só GET neste marco (M2); HEAD/PUT/DELETE no M4. */
const Blossom = (function () {
  'use strict';

  const TIMEOUT_PADRAO_MS = 120000;
  const RE_SHA = /^[0-9a-f]{64}$/;

  function urlValida(u) {
    let p;
    try { p = new URL(String(u)); } catch (e) { return false; }
    return p.protocol === 'https:' && !!p.hostname;     // a CSP só deixa https:
  }
  function base(servidor) { return String(servidor).trim().replace(/\/+$/, ''); }

  async function sha256Hex(bytes) {
    const d = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(d), b => b.toString(16).padStart(2, '0')).join('');
  }

  // → { servidor, estado, status, ms, detalhe, bytes?, mime? }
  // estado: 'ok' | 'http' (status ≥ 400) | 'hash_diferente' | 'timeout' | 'erro' | 'cancelado' | 'invalido' | 'hash_invalido'
  async function baixarDe(servidor, sha, opts) {
    opts = opts || {};
    const r = { servidor: servidor, estado: 'erro', status: 0, ms: 0, detalhe: '' };
    const inicio = Date.now();
    if (!urlValida(servidor)) { r.estado = 'invalido'; return r; }
    if (typeof sha !== 'string' || !RE_SHA.test(sha)) { r.estado = 'hash_invalido'; return r; }
    if (opts.sinal && opts.sinal.aborted) { r.estado = 'cancelado'; return r; }
    const ctrl = new AbortController();
    let motivoAborto = null;
    const timer = setTimeout(function () { motivoAborto = 'timeout'; ctrl.abort(); }, opts.timeoutMs || TIMEOUT_PADRAO_MS);
    const aoCancelar = function () { motivoAborto = 'cancelado'; ctrl.abort(); };
    if (opts.sinal) opts.sinal.addEventListener('abort', aoCancelar);
    try {
      const res = await fetch(base(servidor) + '/' + sha, { method: 'GET', signal: ctrl.signal, redirect: 'follow', cache: 'no-store', credentials: 'omit' });
      r.status = res.status;
      if (!res.ok) {
        r.estado = 'http';
        let motivo = null;
        try { motivo = res.headers.get('x-reason'); } catch (e) {}   // opcional; só se exibe (05 §2.1)
        r.detalhe = motivo ? String(motivo).slice(0, 200) : '';
        return r;
      }
      const bytes = new Uint8Array(await res.arrayBuffer());
      const h = await sha256Hex(bytes);
      if (h !== sha) { r.estado = 'hash_diferente'; r.detalhe = h; return r; }   // sem os bytes: integridade falhou
      r.estado = 'ok'; r.bytes = bytes;
      try { r.mime = res.headers.get('content-type') || null; } catch (e) { r.mime = null; }
      return r;
    } catch (e) {
      r.estado = motivoAborto || 'erro';
      r.detalhe = e && e.message ? String(e.message).slice(0, 200) : '';
      return r;
    } finally {
      clearTimeout(timer);
      if (opts.sinal) opts.sinal.removeEventListener('abort', aoCancelar);
      r.ms = Date.now() - inicio;
    }
  }

  // Tenta os servidores na ordem (ordem = confiança, 13 §3) até um entregar
  // bytes com o hash certo. → { ok, bytes?, mime?, servidor?, tentativas }
  async function baixar(servidores, sha, opts) {
    opts = opts || {};
    const tentativas = [];
    for (const s of Modelo.uniao(servidores)) {
      if (opts.sinal && opts.sinal.aborted) break;
      const r = await baixarDe(s, sha, opts);
      tentativas.push({ servidor: r.servidor, estado: r.estado, status: r.status, ms: r.ms, detalhe: r.detalhe });
      if (r.estado === 'ok') return { ok: true, bytes: r.bytes, mime: r.mime, servidor: s, tentativas: tentativas };
      if (r.estado === 'cancelado') break;
    }
    return { ok: false, tentativas: tentativas };
  }

  return Object.freeze({ TIMEOUT_PADRAO_MS, urlValida, sha256Hex, baixarDe, baixar });
})();
