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
   autoria são conferidas por quem usa (Saude/Rede via Chave.verificar).
   NIP-42 (relido em 2026-09-12, commit `e65954922b28` de 2026-09-01): o relay
   manda ["AUTH", <desafio>] e o cliente responde ["AUTH", <evento 22242>] —
   ⚠️ NUNCA ["EVENT", …]: com EVENT, todo relay que exige identificação recusa
   o PRÓPRIO pedido de identificação, e a leitura fácil é "este relay está
   quebrado" (o engano custou uma rodada inteira de medição na Etapa 0 dos
   Contatos). O desafio vale enquanto a conexão viver e pode chegar ANTES do
   EOSE. Só se responde a ele quando quem chamou passou `assinarAuth` — ou
   seja, só com chave na memória e só nos relays da caixa de entrada
   (14 T13 decisão 5): identificar-se conta ao relay que aquela npub está ali,
   e isso só se paga onde é indispensável para ler. */
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
  // NIP-42: os dois prefixos que significam "identifique-se". Aparecem tanto
  // em OK como em CLOSED.
  function pedeIdentificacao(mensagem) {
    const p = prefixoDe(mensagem);
    return p === 'auth-required' || p === 'restricted';
  }

  // --- leitura -------------------------------------------------------------

  // → { url, estado, eventos, ms, detalhe, auth }
  // estado: 'ok' (EOSE) | 'timeout' | 'erro' (conexão) | 'fechou' (antes do EOSE)
  //         | 'recusou' (CLOSED) | 'invalida' (URL) | 'cancelado'
  // auth (NIP-42): '' (o relay não pediu) | 'ok' (nós nos identificamos e ele aceitou)
  //         | 'recusado' (ele recusou o 22242) | 'exigida' (pediu e não havia
  //         chave, ou quem chamou não autorizou) | 'falhou' (não deu para assinar)
  function consultarUm(url, filtro, opts) {
    opts = opts || {};
    const timeoutMs = opts.timeoutMs || TIMEOUT_PADRAO_MS, sinal = opts.sinal || null;
    const assinarAuth = typeof opts.assinarAuth === 'function' ? opts.assinarAuth : null;
    const inicio = Date.now();
    return new Promise(function (resolve) {
      const r = { url: url, estado: 'erro', eventos: [], ms: 0, detalhe: '', auth: '' };
      if (!urlValida(url)) { r.estado = 'invalida'; return resolve(r); }
      if (sinal && sinal.aborted) { r.estado = 'cancelado'; return resolve(r); }
      let ws = null, terminou = false, timer = null;
      let desafio = null, idAuth = null, jaTentouAuth = false, fechouPorAuth = false;
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
      // Responde ao desafio assim que ele chega (o NIP-42 permite, e cobre de
      // uma vez os dois relays que se veem na prática: o que fecha com
      // `auth-required` e o que manda o desafio antes do EOSE e entrega vazio).
      function identificar() {
        if (jaTentouAuth || !assinarAuth || !desafio || terminou) return;
        jaTentouAuth = true;
        let ev;
        try { ev = assinarAuth(url, desafio); } catch (e) { ev = null; }
        if (!eventoBemFormado(ev)) { r.auth = 'falhou'; return; }
        idAuth = ev.id;
        // ⚠️ ["AUTH", ev] — nunca ["EVENT", ev]. Ver o cabeçalho.
        try { ws.send(JSON.stringify(['AUTH', ev])); } catch (e) { r.auth = 'falhou'; }
      }
      function repetirPedido() {
        if (terminou) return;
        // O relay reentrega tudo desde o início: o que já se juntou antes de
        // nos identificarmos seria contado duas vezes.
        r.eventos = [];
        try { ws.send(JSON.stringify(['REQ', sub, filtro])); } catch (e) { fim('erro', e && e.message); }
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
        else if (tipo === 'AUTH' && typeof msg[1] === 'string') {
          desafio = msg[1];
          if (assinarAuth) identificar(); else if (!r.auth) r.auth = 'exigida';
        }
        else if (tipo === 'OK' && idAuth && msg[1] === idAuth) {
          if (msg[2] === true) { r.auth = 'ok'; repetirPedido(); }
          else { r.auth = 'recusado'; r.detalhe = String(msg[3] == null ? '' : msg[3]).slice(0, 200); if (fechouPorAuth) fim('recusou', r.detalhe || 'auth-required'); }
        }
        else if (tipo === 'CLOSED' && msg[1] === sub) {
          if (pedeIdentificacao(msg[2])) {
            r.auth = r.auth === 'ok' ? 'ok' : (assinarAuth ? r.auth || 'exigida' : 'exigida');
            // Já identificados e ainda assim fechado: é recusa de verdade.
            if (r.auth === 'ok') return fim('recusou', msg[2]);
            // Desafio ainda não chegou ou o OK vem a caminho: damos a chance.
            // ⚠️ Só se ESPERA quando há de fato uma identificação em curso.
            // Um relay que fecha com `auth-required` e nunca manda o desafio
            // existe (P44: o damus.io está exatamente assim) — esperar por ele
            // deixava a consulta pendurada até os 45 s do tempo-limite, e a
            // tela parecia travada. Medido pela suíte da T13 em 2026-09-12.
            if (assinarAuth && r.auth !== 'falhou' && r.auth !== 'recusado') {
              fechouPorAuth = true;
              identificar();
              if (idAuth) return;          // o 22242 saiu: agora se espera o OK
              r.auth = 'exigida';          // não havia desafio: não há o que esperar
            }
          }
          fim('recusou', msg[2]);
        }
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

  // --- escuta (61, 2026-09-14) --------------------------------------------
  // A assinatura que FICA ABERTA depois do EOSE. NIP-01, lido em 2026-09-14:
  // "the relay MUST send EOSE and MUST keep the subscription active for newly
  // received matching events"; e o relay pode mandar CLOSED "when a relay
  // decides to kill a subscription on its side". Medido na rede real no mesmo
  // dia, com uma sonda só de leitura enquanto o dono escrevia do noStrudel
  // (05 §2.0.2, P52 do 08):
  //  · `auth.nostr1.com` e `nos.lol` empurram o envelope novo 1 a 2 s depois de
  //    ele ser escrito;
  //  · ⚠️ o relay só empurra o que CASA COM O FILTRO, e o envelope de mensagem
  //    privada vem com a data recuada até dois dias (NIP-59): uma escuta com
  //    `since = agora` não recebeu nenhuma das quatro mensagens. Quem chama não
  //    põe `since` (ver `Mensagens.filtroEscuta`);
  //  · ⚠️ os dois relays DERRUBAM a conexão sem tráfego — o `auth.nostr1.com`
  //    300 s depois do último (8 quedas em 45 min de escuta), o `nos.lol` perto
  //    de 600 s (3 quedas). Um pedido mínimo a cada minuto (REQ por um id que
  //    não existe, fechado no EOSE) manteve a conexão viva 540 s. O navegador
  //    não deixa mandar ping de WebSocket: este é o pulso que sobra;
  //  · a conexão cai mesmo assim (Tor, rede, relay reiniciado): o painel religa
  //    sozinho, com espera crescente, e o que o relay reentrega não se repete.
  // → { fechar(), estado() }. Nunca lança. `aoEstado` recebe
  //   { url, estado, tentativa, auth, esperaMs, detalhe }, com estado:
  //   'ligando' | 'recebendo' | 'caiu' (religa sozinho) | 'recusou' (desiste:
  //   pediu identificação e não a obteve, ou a URL não serve) | 'fechado'.
  // A identificação segue a mesma regra de `consultarUm`: só quando quem chama
  // passa `assinarAuth` (chave na memória, relays da caixa de entrada).
  const ESPERA_MIN_MS = 2000, ESPERA_MAX_MS = 60000;
  // 2 min: menos da metade dos 300 s medidos no relay mais impaciente. O que se
  // mediu funcionando foi 1 min; o intervalo é margem para a latência do Tor.
  const PULSO_MS = 120000;
  // Uma conexão que ficou recebendo pelo menos isto era saudável: a espera volta
  // ao mínimo quando ela cai. Sem isto, a queda de rotina dos 300 s ia
  // alongando a espera até o teto.
  const SAUDAVEL_MS = 30000;
  const ID_INEXISTENTE = '0'.repeat(64);

  function escutar(url, opts) {
    opts = opts || {};
    const assinarAuth = typeof opts.assinarAuth === 'function' ? opts.assinarAuth : null;
    const sinal = opts.sinal || null;
    const timeoutMs = opts.timeoutMs || TIMEOUT_PADRAO_MS;
    const esperaMin = opts.esperaMinMs || ESPERA_MIN_MS, esperaMax = opts.esperaMaxMs || ESPERA_MAX_MS;
    const pulsoMs = opts.pulsoMs === 0 ? 0 : (opts.pulsoMs || PULSO_MS);
    const sub = idAssinatura(), subPulso = idAssinatura();
    // O que já foi entregue a quem chama, entre conexões: ao religar, o relay
    // reentrega o que tem (até o `limit` do filtro), e isso não pode se repetir.
    const vistos = new Set();
    let ws = null, parado = false, tentativa = 0, espera = esperaMin;
    let timerReligar = null, timerEose = null, timerPulso = null, estadoAtual = 'ligando';

    function avisar(estado, extra) {
      estadoAtual = estado;
      if (typeof opts.aoEstado !== 'function') return;
      try { opts.aoEstado(Object.assign({ url: url, estado: estado, tentativa: tentativa }, extra || {})); } catch (e) {}
    }
    function filtroAgora() { return typeof opts.filtro === 'function' ? opts.filtro() : opts.filtro; }
    function soltar() {
      clearTimeout(timerEose); clearInterval(timerPulso);
      timerEose = null; timerPulso = null;
      const w = ws; ws = null;
      if (!w) return;
      w.onopen = null; w.onmessage = null; w.onerror = null; w.onclose = null;
      try { if (w.readyState === 1) w.send(JSON.stringify(['CLOSE', sub])); } catch (e) {}
      try { w.close(); } catch (e) {}
    }
    function parar(estado, extra) {
      if (parado) return;
      parado = true;
      clearTimeout(timerReligar);
      if (sinal) sinal.removeEventListener('abort', fechar);
      soltar();
      avisar(estado, extra);
    }
    function fechar() { parar('fechado'); }
    function desistir(detalhe, auth) { parar('recusou', { detalhe: String(detalhe == null ? '' : detalhe).slice(0, 200), auth: auth || '' }); }
    function religar(detalhe, saudavel) {
      if (parado) return;
      soltar();
      if (saudavel) espera = esperaMin;
      const agora = espera;
      espera = Math.min(espera * 2, esperaMax);
      avisar('caiu', { esperaMs: agora, detalhe: String(detalhe == null ? '' : detalhe).slice(0, 200) });
      timerReligar = setTimeout(ligar, agora);
    }

    function ligar() {
      if (parado) return;
      tentativa++;
      avisar('ligando');
      let w;
      try { w = new WebSocket(url); } catch (e) { return religar(e && e.message); }
      ws = w;
      let desafio = null, idAuth = null, jaTentouAuth = false, auth = '';
      let esperandoAuth = false, repetiu = false, recebendoDesde = 0;
      const saudavel = function () { return recebendoDesde > 0 && Date.now() - recebendoDesde >= SAUDAVEL_MS; };
      const pedir = function () {
        try { w.send(JSON.stringify(['REQ', sub, filtroAgora()])); } catch (e) { religar(e && e.message); }
      };
      const identificar = function () {
        if (jaTentouAuth || !assinarAuth || !desafio) return;
        jaTentouAuth = true;
        let ev;
        try { ev = assinarAuth(url, desafio); } catch (e) { ev = null; }
        if (!eventoBemFormado(ev)) { auth = 'falhou'; return; }
        idAuth = ev.id;
        // ⚠️ ["AUTH", ev] — nunca ["EVENT", ev]. Ver o cabeçalho.
        try { w.send(JSON.stringify(['AUTH', ev])); } catch (e) { auth = 'falhou'; }
      };
      timerEose = setTimeout(function () { if (ws === w) religar('timeout'); }, timeoutMs);
      w.onopen = pedir;
      w.onerror = function () {};                  // o `close` que se segue é quem decide
      w.onclose = function (ev) { if (ws === w) religar('código ' + (ev && ev.code), saudavel()); };
      w.onmessage = function (m) {
        if (ws !== w) return;
        let msg;
        try { msg = JSON.parse(m.data); } catch (e) { return; }      // lixo é ignorado, não derruba
        if (!Array.isArray(msg)) return;
        const tipo = msg[0];
        if (tipo === 'EVENT' && msg[1] === sub) {
          const ev = msg[2];
          if (!eventoBemFormado(ev) || vistos.has(ev.id)) return;
          vistos.add(ev.id);
          if (typeof opts.aoEvento === 'function') { try { opts.aoEvento(ev, url); } catch (e) {} }
        } else if (tipo === 'EOSE' && msg[1] === sub) {
          clearTimeout(timerEose); timerEose = null;
          if (!recebendoDesde) recebendoDesde = Date.now();
          avisar('recebendo', { auth: auth });
          if (pulsoMs > 0 && !timerPulso) {
            timerPulso = setInterval(function () {
              if (ws !== w || w.readyState !== 1) return;
              try { w.send(JSON.stringify(['REQ', subPulso, { ids: [ID_INEXISTENTE] }])); } catch (e) {}
            }, pulsoMs);
          }
        } else if (msg[1] === subPulso) {
          // o pulso só existe para haver tráfego: quando ele responde, é fechado
          if (tipo === 'EOSE') { try { w.send(JSON.stringify(['CLOSE', subPulso])); } catch (e) {} }
        } else if (tipo === 'AUTH' && typeof msg[1] === 'string') {
          desafio = msg[1];
          if (assinarAuth) identificar(); else if (!auth) auth = 'exigida';
        } else if (tipo === 'OK' && idAuth && msg[1] === idAuth) {
          if (msg[2] === true) {
            auth = 'ok';
            if (esperandoAuth) { esperandoAuth = false; repetiu = true; pedir(); }
          } else {
            auth = 'recusado';
            if (esperandoAuth) desistir(msg[3] || 'auth-required', auth);
          }
        } else if (tipo === 'CLOSED' && msg[1] === sub) {
          if (pedeIdentificacao(msg[2])) {
            if (auth === 'ok') {
              // O OK pode chegar ANTES do CLOSED (a ordem não é garantida): o
              // pedido é repetido uma vez; recusado de novo, é recusa de verdade.
              if (!repetiu) { repetiu = true; return pedir(); }
              return desistir(msg[2], auth);
            }
            if (assinarAuth && auth !== 'falhou' && auth !== 'recusado') {
              identificar();
              if (idAuth) { esperandoAuth = true; return; }
            }
            // Pede identificação e nunca mandou o desafio (P44, o damus.io):
            // religar não muda nada, e ficar tentando seria martelar o relay.
            return desistir(msg[2], auth || 'exigida');
          }
          // o relay matou a assinatura do lado dele: religa, com espera
          religar(msg[2], saudavel());
        }
      };
    }

    if (!urlValida(url)) { parado = true; avisar('recusou', { detalhe: 'invalida' }); }
    else if (sinal && sinal.aborted) { parado = true; estadoAtual = 'fechado'; }
    else {
      if (sinal) sinal.addEventListener('abort', fechar);
      ligar();
    }
    return { fechar: fechar, estado: function () { return estadoAtual; } };
  }

  // --- escrita (M4) --------------------------------------------------------

  // → { url, estado, ms, mensagem, prefixo, auth }
  // estado: 'aceito' (OK true, ou `duplicate`) | 'recusado' (OK false)
  //         | 'timeout' (conectou e não respondeu) | 'erro' | 'fechou'
  //         | 'invalida' | 'cancelado'
  // O relay que não responde NUNCA vira sucesso (02 G.1.6: silêncio não é ok).
  // NIP-42 na ESCRITA (desde 2026-09-12): um relay de caixa de entrada pode
  // exigir identificação para ACEITAR — é assim que ele filtra lixo, já que o
  // envelope 1059 vem de chave descartável e não tem reputação (NIP-59). Sem
  // isto, a caixa de entrada que ele escolheu não recebe o próprio 10050.
  function publicarEm(url, evento, opts) {
    opts = opts || {};
    const timeoutMs = opts.timeoutMs || TIMEOUT_PADRAO_MS, sinal = opts.sinal || null;
    const assinarAuth = typeof opts.assinarAuth === 'function' ? opts.assinarAuth : null;
    const inicio = Date.now();
    return new Promise(function (resolve) {
      const r = { url: url, estado: 'erro', ms: 0, mensagem: '', prefixo: '', auth: '' };
      if (!urlValida(url)) { r.estado = 'invalida'; return resolve(r); }
      if (!eventoBemFormado(evento)) { r.estado = 'erro'; r.mensagem = 'evento malformado'; return resolve(r); }
      if (sinal && sinal.aborted) { r.estado = 'cancelado'; return resolve(r); }
      let ws = null, terminou = false, timer = null;
      let desafio = null, idAuth = null, jaTentouAuth = false, reenviou = false;
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
      function identificar() {
        if (jaTentouAuth || !assinarAuth || !desafio || terminou) return;
        jaTentouAuth = true;
        let ev;
        try { ev = assinarAuth(url, desafio); } catch (e) { ev = null; }
        if (!eventoBemFormado(ev)) { r.auth = 'falhou'; return; }
        idAuth = ev.id;
        try { ws.send(JSON.stringify(['AUTH', ev])); } catch (e) { r.auth = 'falhou'; }
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
        if (msg[0] === 'AUTH' && typeof msg[1] === 'string') {
          desafio = msg[1];
          if (assinarAuth) identificar(); else if (!r.auth) r.auth = 'exigida';
          return;
        }
        if (msg[0] === 'OK' && idAuth && msg[1] === idAuth) {
          if (msg[2] === true) {
            r.auth = 'ok';
            // Reenvia UMA vez: o primeiro EVENT foi recusado por falta de
            // identificação, e agora ela existe.
            if (!reenviou && !terminou) { reenviou = true; try { ws.send(JSON.stringify(['EVENT', evento])); } catch (e) { fim('erro', e && e.message); } }
          } else { r.auth = 'recusado'; }
          return;
        }
        if (msg[0] !== 'OK' || msg[1] !== evento.id) return;          // OK de outro evento não é nosso
        const texto = msg[3] == null ? '' : String(msg[3]);
        // `duplicate` = o relay já tem este evento: para o produto é aceite
        if (msg[2] === true || prefixoDe(texto) === 'duplicate') return fim('aceito', texto);
        // "identifique-se": guarda o motivo e espera o desafio em vez de
        // desistir. Sem chave (ou sem autorização de quem chamou), é recusa.
        if (pedeIdentificacao(texto) && assinarAuth && !reenviou && r.auth !== 'recusado' && r.auth !== 'falhou') {
          if (!r.auth) r.auth = 'exigida';
          identificar();
          return;
        }
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
    pedeIdentificacao,
    PULSO_MS, ESPERA_MIN_MS, ESPERA_MAX_MS,
    consultarUm, consultar, escutar, publicarEm, publicar, placar, sondarEscrita
  });
})();
