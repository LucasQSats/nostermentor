// test/servidor_falso.js — relay Nostr + servidores Blossom FALSOS num só
// HTTPS local (certificado autoassinado gerado por roda.sh; os contextos de
// teste abrem com ignoreHTTPSErrors). Só para testes (P-13): prova T2/T3/T8 e
// os módulos de rede sem internet e com comportamentos que a rede real não dá
// sob encomenda — relay mudo, que fecha, que recusa, que manda lixo, blob com
// hash errado, servidor que recusa o tipo, que não deixa apagar, que responde
// sem CORS.
//   wss://127.0.0.1:<porta>/<nome>            → relay com a persona de `relay(nome, cfg)`
//   https://127.0.0.1:<porta>/<sha256>        → blob do servidor Blossom PADRÃO
//   https://127.0.0.1:<porta>/<nome>/<sha256> → blob do servidor de `blossom(nome, cfg)`
// Persona de relay:   { modo: 'ok'|'vazio'|'mudo'|'fecha'|'recusa'|'lixo'|'lento',
//                       eventos: [], atrasoMs, subErrado, escrita: 'aceita'|'recusa'|'duplicada'|'muda' }
// Persona de Blossom: { exigeAuth, tiposRecusados: [], maxBytes, preflight: 'normal'|'sempre200'|'nao_implementa',
//                       remocao: 'ok'|'recusa'|'ausente', semXReason, semCorsNoErro, atrasoMs, descritorErrado }
// WebSocket mínimo (RFC 6455): quadros de texto mascarados do cliente, close, ping.
const https = require('https'), crypto = require('crypto'), fs = require('fs');
let verifyEvent = null;
try { verifyEvent = require('nostr-tools').verifyEvent; } catch (e) { verifyEvent = null; }

function casa(f, e) {
  if (!f || typeof f !== 'object') return false;
  if (f.kinds && !f.kinds.includes(e.kind)) return false;
  if (f.authors && !f.authors.includes(e.pubkey)) return false;
  if (f.ids && !f.ids.includes(e.id)) return false;
  if (Number.isInteger(f.since) && e.created_at < f.since) return false;
  if (Number.isInteger(f.until) && e.created_at > f.until) return false;
  return true;
}

function quadro(texto) {
  const p = Buffer.from(texto, 'utf8');
  let cab;
  if (p.length < 126) cab = Buffer.from([0x81, p.length]);
  else if (p.length < 65536) { cab = Buffer.alloc(4); cab[0] = 0x81; cab[1] = 126; cab.writeUInt16BE(p.length, 2); }
  else { cab = Buffer.alloc(10); cab[0] = 0x81; cab[1] = 127; cab.writeBigUInt64BE(BigInt(p.length), 2); }
  return Buffer.concat([cab, p]);
}
function lerQuadro(buf) {
  if (buf.length < 2) return null;
  const b0 = buf[0], b1 = buf[1], opcode = b0 & 0x0f, mascarado = (b1 & 0x80) !== 0;
  let len = b1 & 0x7f, off = 2;
  if (len === 126) { if (buf.length < 4) return null; len = buf.readUInt16BE(2); off = 4; }
  else if (len === 127) { if (buf.length < 10) return null; len = Number(buf.readBigUInt64BE(2)); off = 10; }
  let mask = null;
  if (mascarado) { if (buf.length < off + 4) return null; mask = buf.slice(off, off + 4); off += 4; }
  if (buf.length < off + len) return null;
  const payload = Buffer.from(buf.slice(off, off + len));
  if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
  return { opcode, payload, tamanho: off + len };
}

// --- autorização BUD-11 (o servidor falso valida como a spec manda) --------
// → { ok: true, evento } | { ok: false, motivo }
function conferirAuth(cabecalho, verbo, sha, dominio) {
  if (typeof cabecalho !== 'string' || !/^Nostr /.test(cabecalho)) return { ok: false, motivo: 'sem cabeçalho Nostr' };
  const bruto = cabecalho.slice(6).trim();
  let texto = null;
  // base64 padrão; base64url sem padding também decodifica aqui (o servidor
  // falso é tolerante de propósito: quem é estrito é o primal, P33 de 08)
  try { texto = Buffer.from(bruto, 'base64').toString('utf8'); } catch (e) { return { ok: false, motivo: 'base64 inválido' }; }
  let ev = null;
  try { ev = JSON.parse(texto); } catch (e) { return { ok: false, motivo: 'json inválido' }; }
  if (!ev || ev.kind !== 24242) return { ok: false, motivo: 'kind != 24242' };
  if (verifyEvent && !verifyEvent(ev)) return { ok: false, motivo: 'assinatura inválida' };
  const agora = Math.floor(Date.now() / 1000);
  if (!Number.isInteger(ev.created_at) || ev.created_at > agora + 60) return { ok: false, motivo: 'created_at no futuro' };
  const tags = Array.isArray(ev.tags) ? ev.tags : [];
  const val = (n) => tags.filter(t => Array.isArray(t) && t[0] === n).map(t => String(t[1]));
  const exp = val('expiration')[0];
  if (!exp || !/^\d+$/.test(exp) || Number(exp) <= agora) return { ok: false, motivo: 'expiration ausente ou vencida' };
  if (val('t')[0] !== verbo) return { ok: false, motivo: 't != ' + verbo };
  if (typeof ev.content !== 'string' || !ev.content) return { ok: false, motivo: 'content vazio' };
  const servers = val('server');
  if (servers.length > 0 && dominio && !servers.includes(dominio)) return { ok: false, motivo: 'server tag não bate' };
  if (sha) { const xs = val('x'); if (!xs.includes(sha)) return { ok: false, motivo: 'x tag não bate' }; }
  return { ok: true, evento: ev };
}

function iniciar(certDir) {
  return new Promise((resolve, reject) => {
    const opts = { key: fs.readFileSync(certDir + '/key.pem'), cert: fs.readFileSync(certDir + '/cert.pem') };
    const estado = { blobs: new Map(), relays: new Map(), servidores: new Map(), log: [], sockets: new Set() };
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, *', 'Access-Control-Allow-Methods': 'GET, HEAD, PUT, DELETE', 'Access-Control-Expose-Headers': 'X-Reason' };
    const PADRAO = { exigeAuth: true, tiposRecusados: [], maxBytes: null, preflight: 'normal', remocao: 'ok', semXReason: false, semCorsNoErro: false, atrasoMs: 0, descritorErrado: false };

    function servidorDe(nome) {
      if (!nome) return { cfg: Object.assign({}, PADRAO), blobs: estado.blobs, nome: null };
      const s = estado.servidores.get(nome);
      return s || null;
    }
    function responder(res, status, cabecalhos, corpo, cfg) {
      const semCors = cfg && cfg.semCorsNoErro && status >= 400;
      const h = Object.assign({}, semCors ? {} : cors, cabecalhos || {});
      if (cfg && cfg.semXReason) delete h['X-Reason'];
      res.writeHead(status, h);
      res.end(corpo);
    }
    // veredicto de política, comum ao HEAD /upload e ao PUT /upload
    function politica(cfg, mime, tamanho) {
      if (cfg.tiposRecusados.includes(String(mime || '').split(';')[0])) return { status: 415, motivo: 'Filetype not allowed' };
      if (cfg.maxBytes != null && Number(tamanho) > cfg.maxBytes) return { status: 413, motivo: 'File too large. Maximum allowed size is ' + cfg.maxBytes + ' bytes' };
      return null;
    }
    function descritor(sha, tamanho, mime, base, cfg) {
      return JSON.stringify({ url: base + '/' + sha, sha256: cfg && cfg.descritorErrado ? 'f'.repeat(64) : sha, size: tamanho, type: mime || 'application/octet-stream', uploaded: Math.floor(Date.now() / 1000) });
    }
    function lerCorpo(req) {
      return new Promise((resolve) => {
        const partes = [];
        req.on('data', d => partes.push(d));
        req.on('end', () => resolve(Buffer.concat(partes)));
        req.on('error', () => resolve(Buffer.alloc(0)));
      });
    }

    const srv = https.createServer(opts, async (req, res) => {
      estado.log.push(req.method + ' ' + req.url);
      if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
      const dominio = '127.0.0.1';
      const url = req.url.split('?')[0];

      // endpoints de escrita: /upload, /mirror (com prefixo opcional de servidor)
      const ep = /^\/(?:([a-z0-9-]+)\/)?(upload|mirror)$/.exec(url);
      if (ep) {
        const alvo = servidorDe(ep[1] || null);
        if (!alvo) return responder(res, 404, { 'Content-Type': 'text/plain' }, 'servidor desconhecido');
        const cfg = alvo.cfg, base = 'https://127.0.0.1:' + srv.address().port + (alvo.nome ? '/' + alvo.nome : '');
        if (cfg.atrasoMs) await new Promise(r => setTimeout(r, cfg.atrasoMs));

        if (ep[2] === 'upload' && req.method === 'HEAD') {
          if (cfg.preflight === 'nao_implementa') return responder(res, 404, {}, undefined, cfg);
          const sha = String(req.headers['x-sha-256'] || '');
          if (cfg.exigeAuth) {
            const a = conferirAuth(req.headers.authorization, 'upload', sha, dominio);
            if (!a.ok) return responder(res, 401, { 'X-Reason': 'Authorization required: ' + a.motivo }, undefined, cfg);
          }
          if (cfg.preflight === 'sempre200') return responder(res, 200, {}, undefined, cfg);
          if (!req.headers['x-content-length']) return responder(res, 411, { 'X-Reason': 'X-Content-Length required' }, undefined, cfg);
          const p = politica(cfg, req.headers['x-content-type'], req.headers['x-content-length']);
          if (p) return responder(res, p.status, { 'X-Reason': p.motivo }, undefined, cfg);
          return responder(res, 200, {}, undefined, cfg);
        }
        if (ep[2] === 'upload' && req.method === 'PUT') {
          const corpo = await lerCorpo(req);
          const real = crypto.createHash('sha256').update(corpo).digest('hex');
          const declarado = String(req.headers['x-sha-256'] || '');
          if (cfg.exigeAuth) {
            const a = conferirAuth(req.headers.authorization, 'upload', declarado || real, dominio);
            if (!a.ok) return responder(res, 401, { 'X-Reason': 'Authorization required: ' + a.motivo, 'Content-Type': 'text/plain' }, 'unauthorized', cfg);
          }
          if (declarado && declarado !== real) return responder(res, 409, { 'X-Reason': 'X-SHA-256 does not match body', 'Content-Type': 'text/plain' }, 'conflict', cfg);
          const p = politica(cfg, req.headers['content-type'], corpo.length);
          if (p) return responder(res, p.status, { 'X-Reason': p.motivo, 'Content-Type': 'text/plain' }, 'rejected', cfg);
          const jaExistia = alvo.blobs.has(real);
          alvo.blobs.set(real, { bytes: corpo, mime: String(req.headers['content-type'] || 'application/octet-stream').split(';')[0] });
          return responder(res, jaExistia ? 200 : 201, { 'Content-Type': 'application/json' }, descritor(real, corpo.length, req.headers['content-type'], base, cfg), cfg);
        }
        if (ep[2] === 'mirror' && req.method === 'PUT') {
          const corpo = await lerCorpo(req);
          let j = null; try { j = JSON.parse(corpo.toString('utf8')); } catch (e) { j = null; }
          if (!j || typeof j.url !== 'string') return responder(res, 400, { 'X-Reason': 'malformed body', 'Content-Type': 'text/plain' }, 'bad request', cfg);
          const m = /\/([0-9a-f]{64})(\.[a-z0-9]+)?$/.exec(j.url);
          if (!m) return responder(res, 400, { 'X-Reason': 'url without hash', 'Content-Type': 'text/plain' }, 'bad request', cfg);
          const sha = m[1];
          if (cfg.exigeAuth) {
            const a = conferirAuth(req.headers.authorization, 'upload', sha, dominio);
            if (!a.ok) return responder(res, 401, { 'X-Reason': 'Authorization required: ' + a.motivo, 'Content-Type': 'text/plain' }, 'unauthorized', cfg);
          }
          // busca no próprio processo: qualquer servidor falso serve de origem
          let achado = null;
          for (const s of [{ blobs: estado.blobs }].concat(Array.from(estado.servidores.values()))) if (s.blobs.has(sha)) { achado = s.blobs.get(sha); break; }
          if (!achado) return responder(res, 502, { 'X-Reason': 'could not fetch blob from origin', 'Content-Type': 'text/plain' }, 'bad gateway', cfg);
          const p = politica(cfg, achado.mime, achado.bytes.length);
          if (p) return responder(res, p.status, { 'X-Reason': p.motivo, 'Content-Type': 'text/plain' }, 'rejected', cfg);
          const jaExistia = alvo.blobs.has(sha);
          alvo.blobs.set(sha, { bytes: achado.bytes, mime: achado.mime });
          return responder(res, jaExistia ? 200 : 201, { 'Content-Type': 'application/json' }, descritor(sha, achado.bytes.length, achado.mime, base, cfg), cfg);
        }
        return responder(res, 405, { 'Content-Type': 'text/plain' }, 'method not allowed', cfg);
      }

      // blob: GET/HEAD (BUD-01) e DELETE (BUD-12)
      const mb = /^\/(?:([a-z0-9-]+)\/)?([0-9a-f]{64})(\.[a-z0-9]+)?$/.exec(url);
      if (mb) {
        const alvo = servidorDe(mb[1] || null);
        if (!alvo) return responder(res, 404, { 'Content-Type': 'text/plain' }, 'servidor desconhecido');
        const cfg = alvo.cfg, sha = mb[2];
        if (req.method === 'GET' || req.method === 'HEAD') {
          const b = alvo.blobs.get(sha);
          if (!b) return responder(res, 404, { 'X-Reason': 'Blob not found', 'Content-Type': 'text/plain' }, 'not found', cfg);
          const enviar = () => { res.writeHead(200, Object.assign({ 'Content-Type': b.mime || 'application/octet-stream', 'Content-Length': b.bytes.length }, cors)); res.end(req.method === 'HEAD' ? undefined : b.bytes); };
          if (b.atrasoMs) setTimeout(enviar, b.atrasoMs); else enviar();
          return;
        }
        if (req.method === 'DELETE') {
          if (cfg.exigeAuth) {
            const a = conferirAuth(req.headers.authorization, 'delete', sha, dominio);
            if (!a.ok) return responder(res, 401, { 'X-Reason': 'Authorization required: ' + a.motivo, 'Content-Type': 'text/plain' }, 'unauthorized', cfg);
          }
          if (cfg.remocao === 'recusa') return responder(res, 403, { 'X-Reason': 'Deletion not allowed for this account', 'Content-Type': 'text/plain' }, 'forbidden', cfg);
          // P13/P14: o servidor não confirma o apagamento e continua a servir
          // o blob. O app tem de o pôr em `unverified` e reconferir depois.
          if (cfg.remocao === 'incerta') return responder(res, 500, { 'X-Reason': 'Deletion queued', 'Content-Type': 'text/plain' }, 'server error', cfg);
          if (!alvo.blobs.has(sha) || cfg.remocao === 'ausente') return responder(res, 404, { 'X-Reason': 'Blob not found', 'Content-Type': 'text/plain' }, 'not found', cfg);
          alvo.blobs.delete(sha);
          return responder(res, 204, {}, undefined, cfg);
        }
      }
      responder(res, 404, { 'Content-Type': 'text/plain' }, 'not found');
    });

    srv.on('upgrade', (req, socket) => {
      const nome = req.url.replace(/^\//, '').split('?')[0];
      const persona = estado.relays.get(nome);
      const chave = req.headers['sec-websocket-key'];
      estado.log.push('WS ' + nome);
      if (!chave || !persona) { socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n'); return socket.destroy(); }
      estado.sockets.add(socket);
      socket.on('close', () => estado.sockets.delete(socket));
      socket.on('error', () => {});
      const aceite = crypto.createHash('sha1').update(chave + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
      socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + aceite + '\r\n\r\n');
      persona.conexoes = (persona.conexoes || 0) + 1;
      const enviarBruto = (texto) => { try { socket.write(quadro(texto)); } catch (e) {} };
      const enviar = (obj) => enviarBruto(JSON.stringify(obj));
      if (persona.modo === 'fecha') { try { socket.write(Buffer.from([0x88, 0x02, 0x03, 0xe8])); } catch (e) {} socket.end(); return; }
      let buf = Buffer.alloc(0);
      socket.on('data', (d) => {
        buf = Buffer.concat([buf, d]);
        for (;;) {
          const q = lerQuadro(buf); if (!q) break;
          buf = buf.slice(q.tamanho);
          if (q.opcode === 8) { try { socket.write(Buffer.from([0x88, 0x00])); } catch (e) {} socket.end(); return; }
          if (q.opcode === 9) { try { socket.write(Buffer.concat([Buffer.from([0x8a, q.payload.length]), q.payload])); } catch (e) {} continue; }
          if (q.opcode !== 1) continue;
          let msg; try { msg = JSON.parse(q.payload.toString('utf8')); } catch (e) { continue; }
          persona.recebidas = persona.recebidas || []; persona.recebidas.push(msg);
          if (msg[0] === 'REQ') responderReq(persona, msg[1], msg.slice(2), enviar, enviarBruto);
          else if (msg[0] === 'EVENT') receberEvento(persona, msg[1], enviar);
        }
      });
    });

    // escrita: 'aceita' (padrão) | 'recusa' | 'duplicada' | 'muda'
    function receberEvento(p, ev, enviar) {
      const modo = p.escrita || 'aceita';
      if (modo === 'muda') return;
      if (!ev || typeof ev.id !== 'string') return enviar(['OK', '', false, 'invalid: evento malformado']);
      if (verifyEvent && !verifyEvent(ev)) return enviar(['OK', ev.id, false, 'invalid: assinatura inválida']);
      if (modo === 'recusa') return enviar(['OK', ev.id, false, 'blocked: servidor falso não aceita eventos']);
      p.publicados = p.publicados || [];
      const jaTinha = p.publicados.some(e => e.id === ev.id);
      p.publicados.push(ev);
      // substituível (NIP-01, 10000–19999): o novo apaga o anterior do mesmo kind
      if (ev.kind >= 10000 && ev.kind < 20000) p.eventos = (p.eventos || []).filter(e => !(e.kind === ev.kind && e.pubkey === ev.pubkey));
      if (ev.kind === 0 || ev.kind === 3) p.eventos = (p.eventos || []).filter(e => !(e.kind === ev.kind && e.pubkey === ev.pubkey));
      if (ev.kind < 20000 || ev.kind >= 30000) p.eventos = (p.eventos || []).concat([ev]);   // efêmero não é retido
      if (modo === 'duplicada' || jaTinha) return enviar(['OK', ev.id, false, 'duplicate: already have this event']);
      enviar(['OK', ev.id, true, '']);
    }

    function responderReq(p, sub, filtros, enviar, enviarBruto) {
      const modo = p.modo || 'ok';
      if (modo === 'mudo') return;
      if (modo === 'recusa') return enviar(['CLOSED', sub, 'auth-required: servidor falso']);
      const eventos = (p.eventos || []).filter(e => filtros.some(f => casa(f, e)));
      const mandar = () => {
        if (modo === 'lixo') { enviarBruto('{isto não é json'); enviarBruto('"string solta"'); enviar(['EVENT', sub, { id: 'malformado' }]); }
        for (const e of eventos) enviar(['EVENT', p.subErrado ? 'outra-sub' : sub, e]);
        enviar(['EOSE', sub]);
      };
      if (modo === 'lento') setTimeout(mandar, p.atrasoMs || 3000); else mandar();
    }

    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const porta = srv.address().port;
      resolve({
        porta, base: 'https://127.0.0.1:' + porta, estado,
        ws: (nome) => 'wss://127.0.0.1:' + porta + '/' + nome,
        url: (nome) => 'https://127.0.0.1:' + porta + (nome ? '/' + nome : ''),
        relay(nome, cfg) { const p = Object.assign({ modo: 'ok', eventos: [] }, cfg || {}); estado.relays.set(nome, p); return p; },
        // servidor Blossom nomeado (o padrão, sem nome, continua a existir)
        blossom(nome, cfg) { const s = { nome: nome, cfg: Object.assign({}, PADRAO, cfg || {}), blobs: new Map() }; estado.servidores.set(nome, s); return s; },
        blob(bytes, mime, extra) { const sha = crypto.createHash('sha256').update(bytes).digest('hex'); estado.blobs.set(sha, Object.assign({ bytes, mime }, extra || {})); return sha; },
        blobEm(nome, bytes, mime) { const s = estado.servidores.get(nome); const sha = crypto.createHash('sha256').update(bytes).digest('hex'); s.blobs.set(sha, { bytes, mime }); return sha; },
        blobFalso(shaDeclarado, bytes, mime) { estado.blobs.set(shaDeclarado, { bytes, mime }); },
        temBlob(nome, sha) { const s = nome ? estado.servidores.get(nome) : { blobs: estado.blobs }; return !!(s && s.blobs.has(sha)); },
        blobsDe(nome) { const s = nome ? estado.servidores.get(nome) : { blobs: estado.blobs }; return s ? Array.from(s.blobs.keys()) : []; },
        // simula a propagação tardia de P13: o blob some sozinho, depois
        apagarBlob(nome, sha) { const s = nome ? estado.servidores.get(nome) : { blobs: estado.blobs }; return !!(s && s.blobs.delete(sha)); },
        limparBlobs() { estado.blobs.clear(); for (const s of estado.servidores.values()) s.blobs.clear(); },
        publicadosEm(nome) { const p = estado.relays.get(nome); return (p && p.publicados) || []; },
        fechar() { for (const s of estado.sockets) { try { s.destroy(); } catch (e) {} } return new Promise(r => srv.close(() => r())); }
      });
    });
  });
}

module.exports = { iniciar, quadro, lerQuadro, conferirAuth };
