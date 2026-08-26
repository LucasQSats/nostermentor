// test/servidor_falso.js — relay Nostr + servidor Blossom FALSOS num só HTTPS
// local (certificado autoassinado gerado por roda.sh; os contextos de teste
// abrem com ignoreHTTPSErrors). Só para testes (P-13): prova T2/T3 e os
// módulos de rede sem internet e com comportamentos que a rede real não dá
// sob encomenda — relay mudo, que fecha, que recusa, que manda lixo, blob
// com hash errado.
//   wss://127.0.0.1:<porta>/<nome>      → relay com a persona registrada em `relay(nome, cfg)`
//   https://127.0.0.1:<porta>/<sha256>  → blob registrado em `blob(bytes, mime)` (GET/HEAD, CORS *)
// Persona: { modo: 'ok'|'vazio'|'mudo'|'fecha'|'recusa'|'lixo'|'lento', eventos: [], atrasoMs, subErrado }
// WebSocket mínimo (RFC 6455): quadros de texto mascarados do cliente, close, ping.
const https = require('https'), crypto = require('crypto'), fs = require('fs');

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

function iniciar(certDir) {
  return new Promise((resolve, reject) => {
    const opts = { key: fs.readFileSync(certDir + '/key.pem'), cert: fs.readFileSync(certDir + '/cert.pem') };
    const estado = { blobs: new Map(), relays: new Map(), log: [], sockets: new Set() };
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, *', 'Access-Control-Allow-Methods': 'GET, HEAD, PUT, DELETE' };
    const srv = https.createServer(opts, (req, res) => {
      estado.log.push(req.method + ' ' + req.url);
      if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
      const m = /^\/([0-9a-f]{64})(\.[a-z0-9]+)?$/.exec(req.url);
      if (m && (req.method === 'GET' || req.method === 'HEAD')) {
        const b = estado.blobs.get(m[1]);
        if (!b) { res.writeHead(404, Object.assign({ 'X-Reason': 'Blob not found', 'Content-Type': 'text/plain' }, cors)); return res.end('not found'); }
        const enviar = () => { res.writeHead(200, Object.assign({ 'Content-Type': b.mime || 'application/octet-stream', 'Content-Length': b.bytes.length }, cors)); res.end(req.method === 'HEAD' ? undefined : b.bytes); };
        if (b.atrasoMs) setTimeout(enviar, b.atrasoMs); else enviar();
        return;
      }
      res.writeHead(404, Object.assign({ 'Content-Type': 'text/plain' }, cors)); res.end('not found');
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
          if (msg[0] === 'REQ') responder(persona, msg[1], msg.slice(2), enviar, enviarBruto);
          else if (msg[0] === 'EVENT') enviar(['OK', msg[1] && msg[1].id, false, 'blocked: servidor falso não aceita eventos']);
        }
      });
    });
    function responder(p, sub, filtros, enviar, enviarBruto) {
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
        relay(nome, cfg) { const p = Object.assign({ modo: 'ok', eventos: [] }, cfg || {}); estado.relays.set(nome, p); return p; },
        blob(bytes, mime, extra) { const sha = crypto.createHash('sha256').update(bytes).digest('hex'); estado.blobs.set(sha, Object.assign({ bytes, mime }, extra || {})); return sha; },
        blobFalso(shaDeclarado, bytes, mime) { estado.blobs.set(shaDeclarado, { bytes, mime }); },
        limparBlobs() { estado.blobs.clear(); },
        fechar() { for (const s of estado.sockets) { try { s.destroy(); } catch (e) {} } return new Promise(r => srv.close(() => r())); }
      });
    });
  });
}

module.exports = { iniciar, quadro, lerQuadro };
