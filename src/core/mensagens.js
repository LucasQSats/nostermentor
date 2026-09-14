/* core/mensagens.js — as mensagens privadas do dono do site (NIP-17), lidas e
   escritas SÓ neste navegador. Sem DOM, sem estado de tela.

   A spec, relida em texto cru em 2026-09-12 (NIP-17 `999f9bfbf5fe`, NIP-59
   `2ab507db10`, NIP-44 `733a047180`, NIP-42 `e65954922b28`) — 05 §5:
     rumor (kind 14, SEM assinatura) → selo (kind 13, assinado pela chave real
     de quem escreve, cifra NIP-44) → envelope (kind 1059, assinado por chave
     descartável, tag `p` com o destinatário). Um envelope por destinatário e
     outro para o próprio remetente — é assim que o dono relê o que enviou.

   Três regras que custaram medição e que este módulo existe para cumprir:
   1. ⚠️ A DATA É A DO RUMOR. As do selo e do envelope são aleatorizadas "up to
      two days in the past" de propósito (medido: um selo com ~21 h de atraso).
      Ordenar pela do envelope dá uma lista embaralhada.
   2. ⚠️ `nip59.unwrapEvent` confere a assinatura do selo E que
      `rumor.pubkey === seal.pubkey` — mas `unwrapManyEvents` o chama dentro de
      um `try/catch` VAZIO, e a mensagem inválida sumiria sem deixar rastro. Aqui o laço
      é nosso e cada erro tem nome (`abrirVarias`).
   3. ⚠️ O `id` do rumor vem de FORA e não é assinado: quem escreve pode pôr
      nele o que quiser. Como é a chave do armazém `messages`, um id forjado
      sobrescreveria a mensagem de outra pessoa. Por isso ele é RECALCULADO
      (`idDoRumor`) e o que veio é descartado.

   O que NÃO se faz aqui (02 G.0 e 14 T13): nada de `innerHTML` — o conteúdo é
   texto de estranhos e quem o insere usa `textContent`; nenhuma imagem de
   perfil de terceiro é buscada; nenhuma mensagem é decifrada em formato antigo
   (kind 4 só se CONTA). */
const Mensagens = (function () {
  'use strict';

  // Kinds (NIP-17 / NIP-59 / NIP-42 / NIP-09), nenhum inventado.
  const KIND_APAGAR = 5, KIND_REACAO = 7, KIND_SELO = 13, KIND_MENSAGEM = 14,
        KIND_ARQUIVO = 15, KIND_ANTIGO = 4, KIND_ENVELOPE = 1059,
        KIND_ENVELOPE_EFEMERO = 21059, KIND_CAIXA = 10050, KIND_AUTH = 22242;
  // O que pode chegar dentro de um envelope e o painel sabe tratar.
  const KINDS_MIOLO = Object.freeze([KIND_MENSAGEM, KIND_ARQUIVO, KIND_REACAO, KIND_APAGAR]);
  // Conversa: o que vira linha na lista. Reação e deleção não viram (14 T13).
  const KINDS_CONVERSA = Object.freeze([KIND_MENSAGEM, KIND_ARQUIVO]);

  const MAX_ENVELOPES = 500;          // teto de uma busca; o relay costuma dar bem menos
  const MAX_TEXTO = 16384;            // teto do que se envia; a spec não impõe, o bom senso sim
  const RE_HEX64 = /^[0-9a-f]{64}$/;

  // A caixa de entrada de fábrica e o teto de relays vivem no `core/modelo.js`,
  // com o resto da infraestrutura padrão (05 §4) — aqui só se usam.

  function eHex64(s) { return typeof s === 'string' && RE_HEX64.test(s); }
  function agoraUnix() { return Math.floor(Date.now() / 1000); }

  // --- a caixa de entrada (kind 10050) -------------------------------------

  // NIP-17: lista com 1 a 3 relays, em tags `relay`. Sem ela, um cliente que
  // siga a spec NÃO manda mensagem nenhuma para este site.
  function modeloCaixa(relays, agoraS) {
    const lista = Modelo.uniao(relays).slice(0, Modelo.MAX_RELAYS_CAIXA);
    return { kind: KIND_CAIXA, created_at: Number.isInteger(agoraS) ? agoraS : agoraUnix(),
      tags: lista.map(u => ['relay', u]), content: '' };
  }
  // Lê a caixa de entrada de alguém a partir do evento 10050 dele.
  function relaysDaCaixa(evento) {
    if (!evento || !Array.isArray(evento.tags)) return [];
    const urls = evento.tags.filter(t => Array.isArray(t) && t[0] === 'relay').map(t => String(t[1] || ''));
    return Modelo.uniao(urls.filter(Relay.urlValida)).slice(0, Modelo.MAX_RELAYS_CAIXA);
  }

  // --- filtros de consulta -------------------------------------------------

  // Os envelopes endereçados a mim. O 21059 (efêmero) fica DE FORA de propósito:
  // o NIP-59 diz que os relays não o guardam, logo procurá-lo é gastar conexão.
  function filtroEnvelopes(pubkey, opts) {
    opts = opts || {};
    const f = { kinds: [KIND_ENVELOPE], '#p': [pubkey], limit: Math.min(opts.limite || MAX_ENVELOPES, MAX_ENVELOPES) };
    if (Number.isInteger(opts.desde)) f.since = opts.desde;
    return f;
  }
  // Formato antigo: só para CONTAR e avisar. Não se decifra nada — o módulo
  // `nip04` não entra no app e o formato é `unrecommended` pela própria spec.
  function filtroAntigas(pubkey) { return { kinds: [KIND_ANTIGO], '#p': [pubkey], limit: 100 }; }
  function filtroCaixa(pubkey) { return { kinds: [KIND_CAIXA], authors: [pubkey], limit: 1 }; }

  // --- o id do rumor, recalculado -----------------------------------------

  // NIP-01: id = sha256 de JSON.stringify([0, pubkey, created_at, kind, tags,
  // content]). O que vem no rumor é DADO e não é assinado (regra 3 do topo).
  async function idDoRumor(rumor) {
    const serie = JSON.stringify([0, rumor.pubkey, rumor.created_at, rumor.kind, rumor.tags || [], rumor.content == null ? '' : rumor.content]);
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(serie));
    return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
  }

  function rumorBemFormado(r) {
    return !!r && typeof r === 'object' && !Array.isArray(r)
      && eHex64(r.pubkey) && Number.isInteger(r.created_at) && r.created_at >= 0
      && Number.isInteger(r.kind) && typeof r.content === 'string'
      && Array.isArray(r.tags) && r.tags.every(t => Array.isArray(t) && t.every(x => typeof x === 'string'));
  }

  // --- abrir um envelope ---------------------------------------------------

  // → { ok: true, rumor } | { ok: false, motivo }
  // `motivo`: 'kind' | 'assinatura' | 'selo' | 'forma' | 'kind_miolo' | 'erro'
  // O selo é conferido pela biblioteca (assinatura + `rumor.pubkey ===
  // seal.pubkey`); aqui se confere ainda a assinatura do PRÓPRIO envelope, que
  // a biblioteca não vê, e se recalcula o id.
  async function abrir(envelope, sk) {
    if (!envelope || envelope.kind !== KIND_ENVELOPE) return { ok: false, motivo: 'kind' };
    if (!Chave.verificar(envelope)) return { ok: false, motivo: 'assinatura' };
    let rumor;
    try { rumor = NT.nip59.unwrapEvent(envelope, sk); }
    catch (e) { return { ok: false, motivo: 'selo', detalhe: e && e.message ? String(e.message).slice(0, 120) : '' }; }
    if (!rumorBemFormado(rumor)) return { ok: false, motivo: 'forma' };
    if (KINDS_MIOLO.indexOf(rumor.kind) === -1) return { ok: false, motivo: 'kind_miolo', kind: rumor.kind };
    const id = await idDoRumor(rumor);
    return { ok: true, rumor: {
      id: id, pubkey: rumor.pubkey, created_at: rumor.created_at, kind: rumor.kind,
      tags: rumor.tags, content: rumor.content
    } };
  }

  // Laço explícito, com o erro NOMEADO — nunca `unwrapManyEvents` (regra 2).
  // → { mensagens: [...], invalidas: n, porMotivo: {motivo: n}, ignorados: n }
  async function abrirVarias(envelopes, sk, meuPubkey) {
    const mensagens = [], porMotivo = Object.create(null);
    let invalidas = 0, ignorados = 0;
    for (const env of envelopes || []) {
      let r;
      try { r = await abrir(env, sk); }
      catch (e) { r = { ok: false, motivo: 'erro' }; }
      if (!r.ok) {
        // Envelope de kind que não sabemos abrir não é "mensagem inválida": é
        // coisa que não nos diz respeito. São contadas à parte para a tela não
        // acusar uma pessoa de mandar lixo quando só mandou outra coisa.
        if (r.motivo === 'kind_miolo') ignorados++;
        else { invalidas++; porMotivo[r.motivo] = (porMotivo[r.motivo] || 0) + 1; }
        continue;
      }
      mensagens.push(registroDaMensagem(r.rumor, env, meuPubkey));
    }
    return { mensagens: mensagens, invalidas: invalidas, porMotivo: porMotivo, ignorados: ignorados };
  }

  function valorDeTag(ev, nome) {
    const t = (ev.tags || []).find(x => Array.isArray(x) && x[0] === nome);
    return t ? String(t[1] == null ? '' : t[1]) : '';
  }
  function valoresDeTag(ev, nome) {
    return (ev.tags || []).filter(x => Array.isArray(x) && x[0] === nome).map(x => String(x[1] == null ? '' : x[1]));
  }

  // O registro que vai para o armazém `messages` (13 §2, migração v2).
  // `peer` é sempre O OUTRO LADO da conversa: no que eu recebo, quem escreveu;
  // na minha própria cópia, a quem escrevi. É o que faz a lista ser por PESSOA.
  function registroDaMensagem(rumor, envelope, meuPubkey) {
    const minha = rumor.pubkey === meuPubkey;
    const destinos = valoresDeTag(rumor, 'p').filter(eHex64);
    const outros = destinos.filter(p => p !== meuPubkey);
    const peer = minha ? (outros[0] || destinos[0] || rumor.pubkey) : rumor.pubkey;
    const exp = envelope ? Number(valorDeTag(envelope, 'expiration')) : NaN;
    return {
      id: rumor.id,
      peer: peer,
      autor: rumor.pubkey,
      minha: minha,
      kind: rumor.kind,
      // ⚠️ a data do RUMOR, nunca a do envelope (regra 1 do topo)
      created_at: rumor.created_at,
      // O conteúdo guardado é o dos quatro kinds que sabemos abrir, e só deles.
      // ⚠️ Numa reação (kind 7) o conteúdo É o emoji: zerá-lo fazia a reação
      // chegar e não colar em lugar nenhum, em silêncio.
      content: String(rumor.content || ''),
      assunto: valorDeTag(rumor, 'subject').slice(0, 200),
      responde_a: valoresDeTag(rumor, 'e').filter(eHex64),
      // Grupo = mais de uma pessoa na conversa. Na mensagem que RECEBO, eu
      // conto entre os destinatários; na cópia do que EU mandei, não.
      grupo: minha ? outros.length > 1 : destinos.length > 1,
      expira_em: Number.isInteger(exp) && exp > 0 ? exp : null,
      apagada: false,
      reacoes: [],
      wrap_id: envelope && eHex64(envelope.id) ? envelope.id : null
    };
  }

  // --- juntar o que chegou -------------------------------------------------

  // Aplica os kinds que NÃO são conversa sobre os que são:
  //   kind 5 — "apaguei o que enviei": a spec diz remover OU marcar; marcamos,
  //            que é o honesto. Só vale sobre mensagem do MESMO autor.
  //   kind 7 — reação: é colada na mensagem a que responde; nunca vira linha
  //            solta na lista (seria uma conversa vazia).
  // Devolve só as mensagens de conversa, com o que sobrou aplicado nelas.
  function consolidar(registros) {
    const porId = new Map();
    for (const m of registros || []) if (KINDS_CONVERSA.indexOf(m.kind) !== -1 && !porId.has(m.id)) porId.set(m.id, Object.assign({}, m, { reacoes: (m.reacoes || []).slice() }));
    for (const m of registros || []) {
      if (m.kind === KIND_APAGAR) {
        for (const alvo of m.responde_a) {
          const a = porId.get(alvo);
          if (a && a.autor === m.autor) a.apagada = true;     // ninguém apaga o que não escreveu
        }
      } else if (m.kind === KIND_REACAO) {
        for (const alvo of m.responde_a) {
          const a = porId.get(alvo);
          if (!a) continue;
          const simbolo = String(m.content || '').slice(0, 16);
          if (simbolo && a.reacoes.indexOf(simbolo) === -1) a.reacoes.push(simbolo);
        }
      }
    }
    return Array.from(porId.values());
  }

  // Uma linha por PESSOA (escolha dele, 2026-09-12), ordenada pela data da
  // última mensagem — a do rumor. `pessoas` é o que o armazém `peers` guarda.
  // → [{ pubkey, npub, apelido, nome, arquivado, bloqueado, mensagens: [...],
  //      ultima, quantas, previa }]
  function agrupar(mensagens, pessoas) {
    const porPessoa = new Map();
    const info = new Map();
    for (const p of pessoas || []) if (p && eHex64(p.pubkey)) info.set(p.pubkey, p);
    for (const m of consolidar(mensagens)) {
      let c = porPessoa.get(m.peer);
      if (!c) {
        const i = info.get(m.peer) || {};
        c = { pubkey: m.peer, npub: npubDe(m.peer), apelido: String(i.apelido || ''), nome: String(i.nome || ''),
          arquivado: !!i.arquivado, bloqueado: !!i.bloqueado, mensagens: [] };
        porPessoa.set(m.peer, c);
      }
      c.mensagens.push(m);
    }
    const saida = Array.from(porPessoa.values());
    for (const c of saida) {
      c.mensagens.sort(porData);
      const u = c.mensagens[c.mensagens.length - 1];
      c.ultima = u ? u.created_at : 0;
      c.quantas = c.mensagens.length;
      c.previa = u ? primeiraLinha(u) : '';
      c.grupo = c.mensagens.some(m => m.grupo);
    }
    // Da mais recente para a mais antiga (14 T13); o desempate pela pubkey
    // mantém a ordem estável quando dois carimbos coincidem.
    saida.sort((a, b) => (b.ultima - a.ultima) || (a.pubkey < b.pubkey ? -1 : a.pubkey > b.pubkey ? 1 : 0));
    return saida;
  }
  function porData(a, b) { return (a.created_at - b.created_at) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); }
  function primeiraLinha(m) {
    if (m.apagada) return '';
    if (m.kind === KIND_ARQUIVO) return '';
    return String(m.content || '').split(/\r\n|\r|\n/)[0].slice(0, 140);
  }
  function npubDe(pubkey) { try { return NT.nip19.npubEncode(pubkey); } catch (e) { return ''; } }
  function pubkeyDeNpub(npub) {
    try { const d = NT.nip19.decode(String(npub).trim()); return d && d.type === 'npub' && eHex64(d.data) ? d.data : null; }
    catch (e) { return null; }
  }

  // Busca no que está em mãos: apelido, nome, npub ou texto (14 T13).
  function filtrar(conversas, opts) {
    opts = opts || {};
    const q = String(opts.busca || '').trim().toLowerCase();
    const estado = opts.estado || 'ativas';
    return (conversas || []).filter(function (c) {
      if (estado === 'ativas' && (c.arquivado || c.bloqueado)) return false;
      if (estado === 'arquivadas' && !c.arquivado) return false;
      if (estado === 'bloqueadas' && !c.bloqueado) return false;
      if (!q) return true;
      if (String(c.apelido || '').toLowerCase().indexOf(q) !== -1) return true;
      if (String(c.nome || '').toLowerCase().indexOf(q) !== -1) return true;
      if (String(c.npub || '').toLowerCase().indexOf(q) !== -1) return true;
      return c.mensagens.some(m => String(m.content || '').toLowerCase().indexOf(q) !== -1);
    });
  }

  // O nome que a linha mostra: apelido do dono > nome que a pessoa publicou >
  // npub abreviada. Nunca a imagem (14 T13 decisão 4).
  function nomeDe(conversa) {
    if (conversa.apelido) return conversa.apelido;
    if (conversa.nome) return conversa.nome;
    return Chave.abreviar(conversa.npub || '');
  }
  // Só o `name`/`display_name` do kind 0, em texto. A URL do avatar é lida e
  // DESCARTADA de propósito: buscá-la entregaria o IP do dono ao servidor de um
  // desconhecido, e a CSP já a proíbe.
  function nomeDoPerfil(evento) {
    if (!evento || evento.kind !== 0) return '';
    let o;
    try { o = JSON.parse(evento.content); } catch (e) { return ''; }
    if (!o || typeof o !== 'object') return '';
    const n = o.name || o.display_name || '';
    return typeof n === 'string' ? n.slice(0, 100) : '';
  }

  // --- escrever ------------------------------------------------------------

  // Dois envelopes com o MESMO rumor: um para quem lê, outro para o próprio
  // dono (é a cópia que ele relê depois). Montar o rumor UMA vez e embrulhá-lo
  // duas é o que garante o mesmo `id` nos dois — o `nip17.wrapManyEvents` da
  // biblioteca monta um rumor por envelope, e dois `created_at` cruzando o
  // segundo dariam ids diferentes, ou seja, a mesma mensagem duas vezes na
  // lista. → { rumor, paraEle, paraMim }
  async function montarResposta(texto, sk, destinoPubkey, opts) {
    opts = opts || {};
    const conteudo = String(texto == null ? '' : texto);
    if (!conteudo.trim()) throw new Error('mensagem vazia');
    if (conteudo.length > MAX_TEXTO) throw new Error('mensagem longa demais');
    if (!eHex64(destinoPubkey)) throw new Error('destinatário inválido');
    const meu = NT.getPublicKey(sk);
    const tags = [['p', destinoPubkey]];
    if (opts.respondeA && eHex64(opts.respondeA)) tags.push(['e', opts.respondeA, '', 'reply']);
    if (opts.assunto) tags.push(['subject', String(opts.assunto).slice(0, 200)]);
    const modelo = { kind: KIND_MENSAGEM, created_at: Number.isInteger(opts.agoraS) ? opts.agoraS : agoraUnix(), tags: tags, content: conteudo };
    const paraEle = NT.nip59.wrapEvent(modelo, sk, destinoPubkey);
    const paraMim = NT.nip59.wrapEvent(modelo, sk, meu);
    const rumor = Object.assign({}, modelo, { pubkey: meu });
    rumor.id = await idDoRumor(rumor);
    return { rumor: rumor, paraEle: paraEle, paraMim: paraMim, destino: destinoPubkey, meu: meu };
  }

  // --- a rede --------------------------------------------------------------

  // Busca os envelopes endereçados ao dono nos relays da caixa e os abre aqui,
  // neste navegador. → { mensagens, invalidas, porMotivo, ignorados, porRelay,
  //                     quando, relaysOk, envelopes }
  // ⚠️ `assinarAuth` é obrigatório para os relays que só entregam ao dono
  // identificado; sem ele a consulta volta vazia e `porRelay` diz qual foi.
  // ⚠️ A CHAVE não vem pela porta: quem chama passa `abrirEnvelopes`, que é o
  // `Shell` que faz o trabalho com a `sk` que só ele tem (02 §B.1). O `sk`
  // direto existe para os testes de core, que rodam sem tela.
  async function buscar(o) {
    o = o || {};
    const relays = Modelo.uniao(o.relays);
    const filtro = filtroEnvelopes(o.pubkey, { limite: o.limite, desde: o.desde });
    const resultados = await Relay.consultar(relays, filtro, {
      sinal: o.sinal, timeoutMs: o.timeoutMs, assinarAuth: o.assinarAuth, aoRelay: o.aoRelay });
    // Um envelope pode vir de vários relays: se guarda um por id.
    const porId = new Map();
    for (const r of resultados) for (const ev of r.eventos) if (!porId.has(ev.id)) porId.set(ev.id, ev);
    const envelopes = Array.from(porId.values());
    const aberto = typeof o.abrirEnvelopes === 'function'
      ? await o.abrirEnvelopes(envelopes)
      : await abrirVarias(envelopes, o.sk, o.pubkey);
    return {
      mensagens: aberto.mensagens, invalidas: aberto.invalidas, porMotivo: aberto.porMotivo,
      ignorados: aberto.ignorados,
      porRelay: resultados.map(r => ({ url: r.url, estado: r.estado, auth: r.auth, envelopes: r.eventos.length, detalhe: r.detalhe })),
      relaysOk: resultados.filter(r => r.estado === 'ok').length,
      envelopes: porId.size,
      // Os ids de TODOS os envelopes vistos, abertos ou não: a escuta ao vivo
      // parte daqui e não volta a abrir (nem a contar como inválido) o mesmo.
      idsEnvelopes: Array.from(porId.keys()),
      quando: Modelo.agora()
    };
  }

  // Quantas mensagens em formato antigo (kind 4) existem — só CONTA, não
  // decifra: sem isto, quem escreve de um aplicativo velho desaparece em
  // silêncio, que é o defeito que este produto não pode ter.
  async function contarAntigas(o) {
    o = o || {};
    const r = await Relay.consultar(Modelo.uniao(o.relays), filtroAntigas(o.pubkey), {
      sinal: o.sinal, timeoutMs: o.timeoutMs, assinarAuth: o.assinarAuth });
    const ids = new Set();
    for (const x of r) for (const ev of x.eventos) ids.add(ev.id);
    return ids.size;
  }

  // A caixa de entrada de quem se quer responder. A spec é explícita: sem ela,
  // NÃO se tenta enviar — a tela diz "esta pessoa não publicou onde recebe
  // mensagens" em vez de fingir que enviou.
  // → { relays: [...], achou: bool }
  async function caixaDe(o) {
    o = o || {};
    const r = await Relay.consultar(Modelo.uniao(o.relays), filtroCaixa(o.pubkey), {
      sinal: o.sinal, timeoutMs: o.timeoutMs, assinarAuth: o.assinarAuth });
    let melhor = null;
    for (const x of r) for (const ev of x.eventos) {
      if (ev.kind !== KIND_CAIXA || ev.pubkey !== o.pubkey) continue;   // só o dela, e do kind certo
      if (!Chave.verificar(ev)) continue;                               // veio da rede: é dado (02 G.0)
      if (!melhor || ev.created_at > melhor.created_at) melhor = ev;    // substituível: vale a mais nova
    }
    const relays = melhor ? relaysDaCaixa(melhor) : [];
    return { relays: relays, achou: !!melhor && relays.length > 0, evento: melhor };
  }

  // Envia os dois envelopes: o dela vai à caixa DELA, o meu vai à minha — são
  // caixas diferentes, e mandar o meu para a dela não o traria de volta.
  // → { ok, placarDela, placarMinha }
  async function enviar(o) {
    o = o || {};
    const comum = { sinal: o.sinal, timeoutMs: o.timeoutMs, assinarAuth: o.assinarAuth };
    const dela = await Relay.publicar(Modelo.uniao(o.relaysDela), o.paraEle, comum);
    const placarDela = Relay.placar(dela);
    let placarMinha = null;
    const minhas = Modelo.uniao(o.relaysMeus);
    if (minhas.length && o.paraMim) placarMinha = Relay.placar(await Relay.publicar(minhas, o.paraMim, comum));
    // O desfecho é o DELA: a cópia para mim é conforto, não entrega.
    return { ok: placarDela.ok, placarDela: placarDela, placarMinha: placarMinha, resultados: dela };
  }

  // --- ao vivo (61, 2026-09-14) -------------------------------------------

  // ⚠️⚠️ O filtro da escuta NÃO leva `since` — é a armadilha que a medição de
  // 2026-09-14 pegou (05 §2.0.2). O relay só empurra o que casa com o filtro, e
  // o envelope chega com a data recuada até dois dias (NIP-59): uma escuta com
  // `since = agora` não recebeu NENHUMA das quatro mensagens de teste, nem no
  // `nos.lol` nem no `auth.nostr1.com`. Sem `since`, o relay empurra o que é
  // novo seja qual for a data do envelope — inclusive o de quem tem o relógio
  // atrasado, que um `since = agora − 2 dias` também perderia.
  // O `limit` vale só para o que o relay devolve ao (re)ligar (NIP-01: "for the
  // initial query"): é o que cobre uma queda curta. O que já foi visto não se
  // abre de novo (`jaVistos`).
  const LIMITE_ESCUTA = 100;
  function filtroEscuta(pubkey) { return { kinds: [KIND_ENVELOPE], '#p': [pubkey], limit: LIMITE_ESCUTA }; }

  // Escuta os relays da caixa de entrada, um `Relay.escutar` por relay.
  // o: { relays, pubkey, assinarAuth, sinal, jaVistos: Set, aoEnvelope(env, url),
  //      aoEstado(resumo), timeoutMs?, esperaMinMs?, pulsoMs? }
  // resumo: { estado: 'ligando'|'recebendo'|'sem_conexao'|'recusou',
  //           recebendo, total, porRelay: [{ url, estado, auth, tentativa }] }
  // O mesmo envelope chega por mais de um relay: `aoEnvelope` é chamado UMA vez.
  // ⚠️ A chave não passa por aqui: quem abre o envelope é quem chama (o Shell).
  // → { fechar(), resumo() }
  function escutar(o) {
    o = o || {};
    const relays = Modelo.uniao(o.relays);
    const vistos = o.jaVistos instanceof Set ? o.jaVistos : new Set();
    const porRelay = new Map(relays.map(u => [u, { url: u, estado: 'ligando', auth: '', tentativa: 0 }]));
    function resumir() {
      const lista = Array.from(porRelay.values());
      const recebendo = lista.filter(x => x.estado === 'recebendo').length;
      const recusados = lista.filter(x => x.estado === 'recusou').length;
      // Religando depois de cair também é "sem conexão": o que a pessoa precisa
      // saber é que naquele instante nada está chegando.
      const semConexao = lista.some(x => x.estado === 'caiu' || (x.estado === 'ligando' && x.tentativa > 1));
      let estado = 'ligando';
      if (recebendo > 0) estado = 'recebendo';
      else if (lista.length > 0 && recusados === lista.length) estado = 'recusou';
      else if (semConexao) estado = 'sem_conexao';
      return { estado: estado, recebendo: recebendo, total: lista.length, porRelay: lista.map(x => Object.assign({}, x)) };
    }
    const alcas = relays.map(function (url) {
      return Relay.escutar(url, {
        filtro: function () { return filtroEscuta(o.pubkey); },
        assinarAuth: o.assinarAuth, sinal: o.sinal,
        timeoutMs: o.timeoutMs, esperaMinMs: o.esperaMinMs, pulsoMs: o.pulsoMs,
        aoEvento: function (ev) {
          if (ev.kind !== KIND_ENVELOPE || vistos.has(ev.id)) return;
          vistos.add(ev.id);
          if (typeof o.aoEnvelope === 'function') { try { o.aoEnvelope(ev, url); } catch (e) {} }
        },
        aoEstado: function (e) {
          const atual = porRelay.get(url);
          if (!atual || e.estado === 'fechado') return;      // quem fechou foi quem chamou
          atual.estado = e.estado;
          atual.tentativa = e.tentativa || atual.tentativa;
          if (e.auth) atual.auth = e.auth;
          if (typeof o.aoEstado === 'function') { try { o.aoEstado(resumir()); } catch (x) {} }
        }
      });
    });
    return { fechar: function () { alcas.forEach(a => a.fechar()); }, resumo: resumir };
  }

  // --- NIP-42 --------------------------------------------------------------

  // O evento de identificação. ⚠️ Ele viaja num ["AUTH", ev], NUNCA num
  // ["EVENT", ev] — o engano custou uma rodada inteira de medição na Etapa 0 e
  // fez TODOS os relays parecerem quebrados. Quem o manda é o `core/relay.js`.
  function modeloAuth(urlDoRelay, desafio) {
    return NT.makeAuthEvent(String(urlDoRelay), String(desafio));
  }

  return Object.freeze({
    KIND_APAGAR, KIND_REACAO, KIND_SELO, KIND_MENSAGEM, KIND_ARQUIVO, KIND_ANTIGO,
    KIND_ENVELOPE, KIND_ENVELOPE_EFEMERO, KIND_CAIXA, KIND_AUTH,
    KINDS_MIOLO, KINDS_CONVERSA, MAX_TEXTO, MAX_ENVELOPES, LIMITE_ESCUTA,
    modeloCaixa, relaysDaCaixa, filtroEnvelopes, filtroAntigas, filtroCaixa, filtroEscuta,
    idDoRumor, rumorBemFormado, abrir, abrirVarias, registroDaMensagem,
    consolidar, agrupar, filtrar, nomeDe, nomeDoPerfil, npubDe, pubkeyDeNpub,
    montarResposta, modeloAuth, buscar, contarAntigas, caixaDe, enviar, escutar
  });
})();
