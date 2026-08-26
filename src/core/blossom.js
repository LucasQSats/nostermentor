/* core/blossom.js — cliente Blossom. Specs consultadas em 2026-08-26
   (repositório hzrd149/blossom, texto cru):
     BUD-01  GET /<sha256> — CORS `*`, 3xx permitido (P15); o endereço É o
             hash, e o que chega é conferido com crypto.subtle (05 §2.3).
     BUD-02  PUT /upload — corpo binário, headers Content-Type e X-SHA-256;
             resposta 201 (criado) ou 200 (já existia) com Blob Descriptor
             { url, sha256, size, type, uploaded }; 409 = X-SHA-256 não bate.
     BUD-04  PUT /mirror — corpo {"url": "<origem>/<hash>"}, mesma auth de
             upload; 201 criado, 200 já existia, 502 não conseguiu buscar.
     BUD-06  HEAD /upload — X-SHA-256 / X-Content-Length / X-Content-Type;
             veredicto só pelo status + X-Reason (sem corpo). É otimização:
             não é garantia, e servidor pode não implementar.
     BUD-11  auth = evento kind 24242 assinado: `content` legível,
             `expiration` (NIP-40) no futuro, tag `t` com o verbo, tag `x`
             com o hash (OBRIGATÓRIA em upload/mirror/delete/head-upload) e
             tag `server` OPCIONAL com o domínio em minúsculas — a spec
             recomenda-a porque um token de delete sem escopo, se
             interceptado, apaga o mesmo blob em qualquer servidor.
     BUD-12  DELETE /<sha256> — auth com t=delete; 200/204 apagado, 404 não
             existe, 401/403 recusado. (Mudou de lugar: até 2026-08 o DELETE
             era descrito no BUD-02.)

   ⚠️ Codificação do header (medida ao vivo em 2026-08-26, sonda com chave
   efêmera): o BUD-11 manda Base64url SEM padding, mas o
   `blossom.primal.net` só aceita quando o comprimento calha de ser múltiplo
   de 4 — 12 tentativas, 12 acertos da hipótese: o decodificador dele é de
   base64 PADRÃO, estrito. Por isso o app envia base64 padrão (aceito nos
   dois servidores) e só retenta em base64url se vier 400/401. P33 de 08.

   A nsec nunca chega aqui (02 §B): quem publica passa `assinar(modelo)`,
   que é `Shell.assinar`. Um resultado por servidor, sempre — nunca lança
   (D8: sucesso parcial é o normal). Timeout 120 s (07 §3.2). */
const Blossom = (function () {
  'use strict';

  const TIMEOUT_PADRAO_MS = 120000;
  const RE_SHA = /^[0-9a-f]{64}$/;
  const KIND_AUTH = 24242;
  const VALIDADE_AUTH_S = 300;                 // token novo a cada requisição: 5 min sobram
  const VERBOS = Object.freeze(['get', 'upload', 'list', 'delete', 'media']);
  const CONTEUDO_AUTH = Object.freeze({ upload: 'Upload Blob', delete: 'Delete Blob', get: 'Get Blob', list: 'List Blobs', media: 'Upload Media' });

  function urlValida(u) {
    let p;
    try { p = new URL(String(u)); } catch (e) { return false; }
    return p.protocol === 'https:' && !!p.hostname;     // a CSP só deixa https:
  }
  function base(servidor) { return String(servidor).trim().replace(/\/+$/, ''); }
  function dominioDe(servidor) {
    try { return new URL(base(servidor)).hostname.toLowerCase(); } catch (e) { return null; }
  }

  async function sha256Hex(bytes) {
    const d = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(d), b => b.toString(16).padStart(2, '0')).join('');
  }

  // --- autorização (BUD-11) ------------------------------------------------

  // bytes → base64 padrão (com padding) ou base64url sem padding
  function base64De(bytes, comoUrl) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    const b = btoa(s);
    return comoUrl ? b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : b;
  }

  // O modelo do evento; `agoraS` só para o teste fixar o relógio.
  function modeloAuth(verbo, sha, servidor, agoraS) {
    if (VERBOS.indexOf(verbo) === -1) throw new Error('verbo de auth desconhecido: ' + verbo);
    const t = Number.isInteger(agoraS) ? agoraS : Math.floor(Date.now() / 1000);
    const tags = [['t', verbo], ['expiration', String(t + VALIDADE_AUTH_S)]];
    if (typeof sha === 'string' && RE_SHA.test(sha)) tags.push(['x', sha]);
    const d = dominioDe(servidor);
    if (d) tags.push(['server', d]);
    return { kind: KIND_AUTH, created_at: t, tags: tags, content: CONTEUDO_AUTH[verbo] || 'Blossom' };
  }
  function cabecalhoDe(evento, comoUrl) {
    return 'Nostr ' + base64De(new TextEncoder().encode(JSON.stringify(evento)), !!comoUrl);
  }
  // assinar: modelo → evento assinado (Shell.assinar). Devolve os dois formatos.
  function autorizacao(verbo, sha, servidor, assinar, agoraS) {
    const ev = assinar(modeloAuth(verbo, sha, servidor, agoraS));
    return { evento: ev, padrao: cabecalhoDe(ev, false), url: cabecalhoDe(ev, true) };
  }

  // --- classificação de respostas -----------------------------------------

  // Motivo curto, para a tela traduzir (14 T8). X-Reason é só diagnóstico
  // humano: exibe-se quando vier, e é proibido usá-lo para decidir (BUD-06).
  const MOTIVOS = Object.freeze({
    400: 'malformado', 401: 'sem_permissao', 402: 'pagamento', 403: 'politica',
    409: 'hash_diferente', 411: 'malformado', 413: 'grande_demais', 415: 'tipo_nao_aceito',
    429: 'limite', 502: 'origem_inacessivel', 503: 'indisponivel'
  });
  function motivoDe(status) { return MOTIVOS[status] || (status >= 500 ? 'indisponivel' : 'recusado'); }
  function cabecalhoReason(res) {
    try { const v = res.headers.get('x-reason'); return v ? String(v).slice(0, 200) : ''; } catch (e) { return ''; }
  }

  // --- requisição com timeout, cancelamento e retentativa de codificação ---

  // monta(cabecalho) → { url, init }. Se a primeira tentativa (base64 padrão)
  // devolver 400/401, refaz-se uma única vez em base64url (⚠ acima).
  async function requisitar(servidor, verbo, sha, o, monta) {
    const r = { servidor: base(servidor), estado: 'erro', status: 0, ms: 0, codigo: '', detalhe: '', codificacao: 'base64', corpo: null };
    const inicio = Date.now();
    if (!urlValida(servidor)) { r.estado = 'invalido'; r.codigo = 'servidor_invalido'; return r; }
    if (typeof o.assinar !== 'function') { r.estado = 'erro'; r.codigo = 'sem_assinatura'; return r; }
    if (o.sinal && o.sinal.aborted) { r.estado = 'cancelado'; return r; }

    let auth;
    try { auth = autorizacao(verbo, sha, servidor, o.assinar); }
    catch (e) { r.estado = 'erro'; r.codigo = 'sem_assinatura'; r.detalhe = e && e.message ? String(e.message).slice(0, 200) : ''; return r; }

    for (const forma of ['padrao', 'url']) {
      const ctrl = new AbortController();
      let motivoAborto = null;
      const timer = setTimeout(function () { motivoAborto = 'timeout'; ctrl.abort(); }, o.timeoutMs || TIMEOUT_PADRAO_MS);
      const aoCancelar = function () { motivoAborto = 'cancelado'; ctrl.abort(); };
      if (o.sinal) o.sinal.addEventListener('abort', aoCancelar);
      try {
        const pedido = monta(auth[forma]);
        const res = await fetch(pedido.url, Object.assign({ signal: ctrl.signal, cache: 'no-store', credentials: 'omit', redirect: 'follow' }, pedido.init));
        r.status = res.status;
        r.codificacao = forma === 'padrao' ? 'base64' : 'base64url';
        r.detalhe = cabecalhoReason(res);
        if (pedido.lerCorpo && res.status >= 200 && res.status < 300) {
          try { r.corpo = await res.json(); } catch (e) { r.corpo = null; }   // descritor é MUST, mas nem todo servidor cumpre
        }
        // retentativa única: só quando a recusa pode ser da codificação
        if ((res.status === 400 || res.status === 401) && forma === 'padrao') continue;   // o `finally` já limpa timer e ouvinte
        r.estado = 'resposta';
        return r;
      } catch (e) {
        r.estado = motivoAborto || 'erro';
        r.codigo = motivoAborto === 'timeout' ? 'timeout' : (motivoAborto === 'cancelado' ? 'cancelado' : 'rede');
        // P26: o primal manda erro sem CORS → TypeError indistinguível de queda de rede
        r.detalhe = e && e.message ? String(e.message).slice(0, 200) : '';
        return r;
      } finally {
        clearTimeout(timer);
        if (o.sinal) o.sinal.removeEventListener('abort', aoCancelar);
        r.ms = Date.now() - inicio;
      }
    }
    return r;
  }

  // --- leitura (BUD-01) — desde o M2 --------------------------------------

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
        r.detalhe = cabecalhoReason(res);        // opcional; só se exibe (05 §2.1)
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

  // --- pré-flight (BUD-06) -------------------------------------------------

  // Três estados, e só três (P26 de 08, decisão de 06 §4):
  //   'aceita'        — 200: pode subir
  //   'recusa'        — o servidor disse não, com motivo
  //   'indeterminado' — não deu para saber (não implementa, caiu, TypeError,
  //                     limite temporário). NUNCA conta como recusa: o
  //                     arquivo sobe e, se recusarem, T8 relata como falha.
  // o: { sha, tamanho, mime, assinar, timeoutMs, sinal }
  async function preflight(servidor, o) {
    o = o || {};
    const r = await requisitar(servidor, 'upload', o.sha, o, function (cab) {
      return {
        url: base(servidor) + '/upload',
        init: { method: 'HEAD', headers: { 'X-SHA-256': String(o.sha), 'X-Content-Length': String(o.tamanho), 'X-Content-Type': String(o.mime || 'application/octet-stream'), 'Authorization': cab } }
      };
    });
    const saida = { servidor: r.servidor, estado: 'indeterminado', status: r.status, ms: r.ms, codigo: r.codigo, detalhe: r.detalhe, codificacao: r.codificacao, checked_at: Modelo.agora() };
    if (r.estado !== 'resposta') return saida;                                   // rede/timeout/cancelado → indeterminado
    if (r.status === 200) { saida.estado = 'aceita'; saida.codigo = ''; return saida; }
    if (r.status === 400 || r.status === 401 || r.status === 402 || r.status === 403 ||
        r.status === 411 || r.status === 413 || r.status === 415) { saida.estado = 'recusa'; saida.codigo = motivoDe(r.status); return saida; }
    saida.codigo = r.status === 404 || r.status === 405 || r.status === 501 ? 'nao_implementa' : motivoDe(r.status);
    return saida;                                                                 // 429/503/5xx/não implementado
  }

  // Pré-flight em vários servidores, em paralelo (07 §3.2).
  function preflightEmTodos(servidores, o) {
    o = o || {};
    return Promise.all(Modelo.uniao(servidores).map(function (s) {
      return preflight(s, o).then(function (r) {
        if (typeof o.aoServidor === 'function') { try { o.aoServidor(r); } catch (e) {} }
        return r;
      });
    }));
  }

  // --- envio (BUD-02) e espelho (BUD-04) -----------------------------------

  // estado: 'ok' | 'recusado' | 'erro' | 'timeout' | 'cancelado' | 'invalido'
  // 'recusado' é definitivo (não adianta repetir); 'erro' pode ser temporário.
  function classificarEscrita(r) {
    const saida = { servidor: r.servidor, estado: 'erro', status: r.status, ms: r.ms, codigo: r.codigo, detalhe: r.detalhe, codificacao: r.codificacao, descritor: null };
    if (r.estado === 'invalido' || r.estado === 'cancelado' || r.estado === 'timeout') { saida.estado = r.estado; return saida; }
    if (r.estado !== 'resposta') return saida;
    if (r.status === 200 || r.status === 201) { saida.estado = 'ok'; saida.codigo = ''; saida.descritor = r.corpo; return saida; }
    if (r.status === 429 || r.status >= 500) { saida.codigo = motivoDe(r.status); return saida; }   // temporário
    saida.estado = 'recusado'; saida.codigo = motivoDe(r.status);
    return saida;
  }

  // o: { sha, bytes, mime, assinar, timeoutMs, sinal }
  async function enviar(servidor, o) {
    o = o || {};
    if (typeof o.sha !== 'string' || !RE_SHA.test(o.sha)) return { servidor: base(servidor), estado: 'invalido', status: 0, ms: 0, codigo: 'hash_invalido', detalhe: '', descritor: null };
    const r = await requisitar(servidor, 'upload', o.sha, o, function (cab) {
      return {
        url: base(servidor) + '/upload', lerCorpo: true,
        init: { method: 'PUT', body: o.bytes, headers: { 'Content-Type': String(o.mime || 'application/octet-stream'), 'X-SHA-256': String(o.sha), 'Authorization': cab } }
      };
    });
    const saida = classificarEscrita(r);
    // O descritor é conferido quando vem: servidor que devolve outro hash não guardou o nosso blob.
    if (saida.estado === 'ok' && saida.descritor && typeof saida.descritor.sha256 === 'string' && saida.descritor.sha256.toLowerCase() !== o.sha) {
      saida.estado = 'recusado'; saida.codigo = 'hash_diferente'; saida.detalhe = String(saida.descritor.sha256).slice(0, 64);
    }
    return saida;
  }

  // BUD-04: o destino busca o blob na origem. Mesma auth de upload (t=upload).
  // o: { sha, origem (URL completa do blob), assinar, timeoutMs, sinal }
  async function espelhar(servidor, o) {
    o = o || {};
    if (typeof o.sha !== 'string' || !RE_SHA.test(o.sha)) return { servidor: base(servidor), estado: 'invalido', status: 0, ms: 0, codigo: 'hash_invalido', detalhe: '', descritor: null };
    const r = await requisitar(servidor, 'upload', o.sha, o, function (cab) {
      return {
        url: base(servidor) + '/mirror', lerCorpo: true,
        init: { method: 'PUT', body: JSON.stringify({ url: String(o.origem) }), headers: { 'Content-Type': 'application/json', 'Authorization': cab } }
      };
    });
    return classificarEscrita(r);
  }

  // Sobe em todos os servidores em paralelo. `minimo` = quantos precisam
  // aceitar (D8: 1). → { ok, aceitos: [...], porServidor: [...] }
  async function enviarEmTodos(servidores, o) {
    o = o || {};
    const lista = Modelo.uniao(servidores);
    const resultados = await Promise.all(lista.map(function (s) {
      return enviar(s, o).then(function (r) {
        if (typeof o.aoServidor === 'function') { try { o.aoServidor(r); } catch (e) {} }
        return r;
      });
    }));
    const aceitos = resultados.filter(r => r.estado === 'ok').map(r => r.servidor);
    return { ok: aceitos.length >= (o.minimo || 1), aceitos: aceitos, porServidor: resultados };
  }

  // --- remoção (BUD-12) ----------------------------------------------------

  // estado: 'apagado' | 'ausente' (404: já não está lá) | 'recusado' (401/403)
  //         | 'indeterminado' — 13 §4.3 `removal`: o que não se sabe fica por conferir.
  async function apagar(servidor, o) {
    o = o || {};
    if (typeof o.sha !== 'string' || !RE_SHA.test(o.sha)) return { servidor: base(servidor), estado: 'indeterminado', status: 0, ms: 0, codigo: 'hash_invalido', detalhe: '' };
    const r = await requisitar(servidor, 'delete', o.sha, o, function (cab) {
      return { url: base(servidor) + '/' + o.sha, init: { method: 'DELETE', headers: { 'Authorization': cab } } };
    });
    const saida = { servidor: r.servidor, estado: 'indeterminado', status: r.status, ms: r.ms, codigo: r.codigo, detalhe: r.detalhe, codificacao: r.codificacao };
    if (r.estado !== 'resposta') return saida;
    if (r.status === 200 || r.status === 204) { saida.estado = 'apagado'; saida.codigo = ''; return saida; }
    if (r.status === 404) { saida.estado = 'ausente'; saida.codigo = ''; return saida; }
    if (r.status === 401 || r.status === 403 || r.status === 405) { saida.estado = 'recusado'; saida.codigo = motivoDe(r.status); return saida; }
    saida.codigo = motivoDe(r.status);
    return saida;                                                                 // 402/429/5xx: por conferir
  }

  // → 13 §4.3 `removal`: { checked_at, deleted_from, refused_by, unverified }
  async function apagarEmTodos(servidores, o) {
    o = o || {};
    const resultados = await Promise.all(Modelo.uniao(servidores).map(function (s) {
      return apagar(s, o).then(function (r) {
        if (typeof o.aoServidor === 'function') { try { o.aoServidor(r); } catch (e) {} }
        return r;
      });
    }));
    return {
      checked_at: Modelo.agora(),
      deleted_from: resultados.filter(r => r.estado === 'apagado' || r.estado === 'ausente').map(r => r.servidor),
      refused_by: resultados.filter(r => r.estado === 'recusado').map(r => r.servidor),
      unverified: resultados.filter(r => r.estado === 'indeterminado').map(r => r.servidor),
      porServidor: resultados
    };
  }

  // URL pública de um blob num servidor (o que o BUD-04 pede no corpo).
  function urlDoBlob(servidor, sha) { return base(servidor) + '/' + sha; }

  return Object.freeze({
    TIMEOUT_PADRAO_MS, KIND_AUTH, VALIDADE_AUTH_S, VERBOS, MOTIVOS,
    urlValida, dominioDe, sha256Hex, base64De, modeloAuth, cabecalhoDe, autorizacao, motivoDe, urlDoBlob,
    baixarDe, baixar, preflight, preflightEmTodos, enviar, espelhar, enviarEmTodos, apagar, apagarEmTodos
  });
})();
