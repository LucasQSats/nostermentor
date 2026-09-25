// test/core/mensagens.test.js — core/mensagens.js: a volta completa das
// mensagens privadas (NIP-17) contra o servidor falso, incluindo o relay que
// PEDE identificação (NIP-42).
//
// As três coisas que esta suíte existe para provar, e que custaram medição:
//   1. a data usada é a do RUMOR — um envelope datado dois dias no passado não
//      desordena a lista (a spec manda aleatorizar a do envelope);
//   2. um selo com autor diferente do miolo é RECUSADO, sempre — sem isso
//      qualquer um se faz passar por outro;
//   3. o 22242 vai num ["AUTH", ev]; o relay falso confere as tags `relay` e
//      `challenge` e a janela de 10 minutos, como a spec pede.
const { abrir, coletor, assert } = require('../util.js');
const F = require('../fabrica.js');

module.exports = async function (ctx, u) {
  const { R, it, pulado } = coletor();
  if (!u.falso) { pulado('core/mensagens (todos os casos)', 'servidor falso indisponível'); return R; }
  const p = await abrir(ctx, u.url);
  const f = u.falso;

  const dono = F.chave();            // o site que recebe
  const ana = F.chave();             // quem escreve
  const bento = F.chave();           // outra pessoa
  const impostor = F.chave();        // sela em nome de quem não é

  const AGORA = Math.floor(Date.now() / 1000);
  const DOIS_DIAS = 2 * 24 * 3600;

  // Ana escreveu ontem; o envelope leva data de dois dias atrás (é o que a
  // spec manda fazer). Se a ordem viesse do envelope, esta seria a mais antiga.
  const deAna1 = F.mensagem(ana, dono.pubkey, { content: 'primeira da Ana', created_at: AGORA - 3600, envelopeEm: AGORA - DOIS_DIAS, seloEm: AGORA - DOIS_DIAS });
  const deAna2 = F.mensagem(ana, dono.pubkey, { content: 'segunda da Ana', created_at: AGORA - 60, envelopeEm: AGORA - DOIS_DIAS });
  const deBento = F.mensagem(bento, dono.pubkey, { content: 'oi, sou o Bento', created_at: AGORA - 7200 });
  const comTag = F.mensagem(bento, dono.pubkey, { content: '<img src=x onerror=alert(1)> <b>negrito</b>', created_at: AGORA - 30 });
  const forjada = F.mensagem(ana, dono.pubkey, { content: 'eu sou a Ana, juro', created_at: AGORA - 10, seloDe: impostor });
  const comArquivo = F.mensagem(ana, dono.pubkey, { kind: 15, content: 'https://exemplo/arquivo', created_at: AGORA - 20 });
  const reacao = F.mensagem(ana, dono.pubkey, { kind: 7, content: '👍', created_at: AGORA - 5, tags: [['p', dono.pubkey], ['e', deAna1.rumor.id]] });
  const apagar = F.mensagem(ana, dono.pubkey, { kind: 5, content: '', created_at: AGORA - 4, tags: [['p', dono.pubkey], ['e', deAna2.rumor.id]] });
  const apagarAlheio = F.mensagem(bento, dono.pubkey, { kind: 5, content: '', created_at: AGORA - 3, tags: [['p', dono.pubkey], ['e', deAna1.rumor.id]] });
  const efemero = F.mensagem(ana, dono.pubkey, { content: 'não devia ser guardada', created_at: AGORA - 2, envelopeKind: 21059 });

  const todos = [deAna1, deAna2, deBento, comTag, forjada, comArquivo, reacao, apagar, apagarAlheio].map(x => x.envelope);
  f.relay('caixa', { modo: 'ok', eventos: todos.concat([F.mensagemAntiga(ana, dono.pubkey), F.mensagemAntiga(bento, dono.pubkey)]) });
  f.relay('caixa-auth', { modo: 'ok', auth: 'ambos', eventos: todos });
  f.relay('caixa-vazia', { modo: 'vazio' });

  // `sk` entra só nos testes de core, que rodam sem tela (no app, quem
  // decifra é o Shell e a chave nunca sai de lá).
  const sk = Array.from(dono.sk);
  const abrirTudo = (envelopes) => p.pg.evaluate(([envs, sk, pubkey]) =>
    Mensagens.abrirVarias(envs, new Uint8Array(sk), pubkey), [envelopes, sk, dono.pubkey]);

  await it('o id do rumor é RECALCULADO e bate com o que a biblioteca calcula (o que vem no rumor não é assinado)', async () => {
    const r = await p.pg.evaluate((rumor) => Mensagens.idDoRumor(rumor), deAna1.rumor);
    assert(r === deAna1.rumor.id, 'esperava ' + deAna1.rumor.id + ', veio ' + r);
  });

  await it('id forjado no rumor é ignorado: a mensagem entra com o id VERDADEIRO, e não sobrescreve a de outra pessoa', async () => {
    // Um envelope cujo rumor declara o id de outra mensagem. Sem recalcular, ele
    // ocuparia a chave dela no armazém `messages`.
    const mentiroso = JSON.parse(JSON.stringify(deBento.rumor));
    mentiroso.id = deAna1.rumor.id;
    const sl = await p.pg.evaluate(() => null);   // o selo é montado no Node, abaixo
    const env = F.envelope(F.selo(mentiroso, bento.sk, dono.pubkey), dono.pubkey);
    const r = await abrirTudo([env]);
    assert(r.mensagens.length === 1, JSON.stringify(r));
    assert(r.mensagens[0].id !== deAna1.rumor.id, 'o id forjado passou: ' + r.mensagens[0].id);
    assert(r.mensagens[0].content === 'oi, sou o Bento', r.mensagens[0].content);
  });

  await it('⚠️ selo com autor diferente do miolo é RECUSADO — nem aberto, nem escondido', async () => {
    const r = await abrirTudo([forjada.envelope]);
    assert(r.mensagens.length === 0 && r.invalidas === 1, JSON.stringify(r));
    assert(r.porMotivo.selo === 1, JSON.stringify(r.porMotivo));
  });

  await it('o laço trata o erro em vez de engoli-lo: 1 forjada entre 3 boas dá 3 mensagens e 1 inválida NOMEADA', async () => {
    const r = await abrirTudo([deAna1.envelope, forjada.envelope, deBento.envelope, deAna2.envelope]);
    assert(r.mensagens.length === 3 && r.invalidas === 1 && r.porMotivo.selo === 1, JSON.stringify([r.mensagens.length, r.invalidas, r.porMotivo]));
  });

  await it('envelope com assinatura adulterada é recusado (a biblioteca não confere a do 1059 — nós conferimos)', async () => {
    const mau = Object.assign({}, deAna1.envelope, { sig: 'f'.repeat(128) });
    const r = await abrirTudo([mau]);
    assert(r.mensagens.length === 0 && r.porMotivo.assinatura === 1, JSON.stringify(r));
  });

  await it('⚠️ a DATA é a do rumor: envelope de dois dias atrás não desordena a lista', async () => {
    const r = await abrirTudo([deAna1.envelope, deAna2.envelope, deBento.envelope]);
    const conversas = await p.pg.evaluate((ms) => Mensagens.agrupar(ms, []), r.mensagens);
    // Pelas datas do RUMOR: Ana falou há 1 min, Bento há 2 h → Ana primeiro.
    assert(conversas.length === 2, 'esperava 2 pessoas, veio ' + conversas.length);
    assert(conversas[0].pubkey === ana.pubkey, 'a ordem veio do envelope, não do rumor: ' + JSON.stringify(conversas.map(c => c.ultima)));
    assert(conversas[0].ultima === AGORA - 60, 'data errada: ' + conversas[0].ultima);
    const todasAsDatas = r.mensagens.map(m => m.created_at);
    assert(!todasAsDatas.includes(AGORA - DOIS_DIAS), 'uma data de envelope vazou para a mensagem');
  });

  await it('uma linha por PESSOA: 4 mensagens de 2 pessoas dão 2 conversas, com a contagem e a prévia certas', async () => {
    const r = await abrirTudo([deAna1.envelope, deAna2.envelope, deBento.envelope, comTag.envelope]);
    const c = await p.pg.evaluate((ms) => Mensagens.agrupar(ms, []), r.mensagens);
    const porPubkey = Object.fromEntries(c.map(x => [x.pubkey, x]));
    assert(c.length === 2, JSON.stringify(c.map(x => x.quantas)));
    assert(porPubkey[ana.pubkey].quantas === 2 && porPubkey[bento.pubkey].quantas === 2, JSON.stringify(c.map(x => x.quantas)));
    assert(porPubkey[ana.pubkey].previa === 'segunda da Ana', porPubkey[ana.pubkey].previa);
  });

  await it('mensagem com uma tag dentro continua TEXTO: o conteúdo chega como foi escrito, sem interpretar', async () => {
    const r = await abrirTudo([comTag.envelope]);
    assert(r.mensagens[0].content === '<img src=x onerror=alert(1)> <b>negrito</b>', r.mensagens[0].content);
  });

  await it('reação (kind 7) não vira conversa vazia: é colada na mensagem a que responde', async () => {
    const r = await abrirTudo([deAna1.envelope, reacao.envelope]);
    const consolidadas = await p.pg.evaluate((ms) => Mensagens.consolidar(ms), r.mensagens);
    assert(consolidadas.length === 1, 'a reação virou mensagem: ' + JSON.stringify(consolidadas.map(m => m.kind)));
    assert(consolidadas[0].reacoes.join('') === '👍', JSON.stringify(consolidadas[0].reacoes));
  });

  await it('pedido de apagar (kind 5) MARCA a mensagem; de outra pessoa, não faz nada', async () => {
    const r = await abrirTudo([deAna1.envelope, deAna2.envelope, apagar.envelope, apagarAlheio.envelope]);
    const c = await p.pg.evaluate((ms) => Mensagens.consolidar(ms), r.mensagens);
    const porId = Object.fromEntries(c.map(m => [m.id, m]));
    assert(porId[deAna2.rumor.id].apagada === true, 'a Ana apagou a própria e não foi marcada');
    assert(porId[deAna1.rumor.id].apagada === false, 'o Bento apagou uma mensagem da Ana — nunca');
  });

  await it('arquivo (kind 15) aparece como mensagem, e é visível — não se esconde o que não se sabe abrir', async () => {
    const r = await abrirTudo([comArquivo.envelope]);
    assert(r.mensagens.length === 1 && r.mensagens[0].kind === 15, JSON.stringify(r.mensagens.map(m => m.kind)));
  });

  await it('grupo (mais de um destinatário) é reconhecido e marcado', async () => {
    const emGrupo = F.mensagem(ana, dono.pubkey, { content: 'a todos', created_at: AGORA, tags: [['p', dono.pubkey], ['p', bento.pubkey]] });
    const r = await abrirTudo([emGrupo.envelope]);
    assert(r.mensagens[0].grupo === true, JSON.stringify(r.mensagens[0]));
  });

  await it('envelope com kind de miolo desconhecido não conta como mensagem inválida (é coisa que não nos diz respeito)', async () => {
    const estranha = F.mensagem(ana, dono.pubkey, { kind: 1, content: 'uma nota pública embrulhada', created_at: AGORA });
    const r = await abrirTudo([estranha.envelope]);
    assert(r.mensagens.length === 0 && r.invalidas === 0 && r.ignorados === 1, JSON.stringify(r));
  });

  await it('o painel NÃO busca o envelope efêmero 21059 (os relays não o guardam): o filtro pede só 1059', async () => {
    const filtro = await p.pg.evaluate((pk) => Mensagens.filtroEnvelopes(pk), dono.pubkey);
    assert(filtro.kinds.length === 1 && filtro.kinds[0] === 1059, JSON.stringify(filtro));
    const r = await abrirTudo([efemero.envelope]);
    assert(r.mensagens.length === 0 && r.porMotivo.kind === 1, 'o 21059 entrou: ' + JSON.stringify(r));
  });

  await it('buscar num relay comum: 9 envelopes, 6 conversas de 2 pessoas, 1 inválida contada', async () => {
    const r = await p.pg.evaluate(([url, sk, pubkey]) => Mensagens.buscar({
      relays: [url], pubkey: pubkey, sk: new Uint8Array(sk), timeoutMs: 8000
    }), [f.ws('caixa'), sk, dono.pubkey]);
    assert(r.envelopes === 9, 'envelopes: ' + r.envelopes);
    assert(r.invalidas === 1, 'inválidas: ' + r.invalidas + ' ' + JSON.stringify(r.porMotivo));
    assert(r.relaysOk === 1 && r.porRelay[0].auth === '', JSON.stringify(r.porRelay));
    return r.mensagens.length + ' mensagens abertas';
  });

  await it('formato antigo (kind 4): CONTA e não decifra — o módulo nip04 não entra no app', async () => {
    const n = await p.pg.evaluate(([url, pubkey]) => Mensagens.contarAntigas({ relays: [url], pubkey: pubkey, timeoutMs: 8000 }), [f.ws('caixa'), dono.pubkey]);
    assert(n === 2, 'esperava 2, veio ' + n);
    const temNip04 = await p.pg.evaluate(() => typeof NT.nip04 !== 'undefined');
    assert(temNip04 === false, 'o módulo nip04 entrou no app');
  });

  // --- NIP-42 --------------------------------------------------------------

  await it('⚠️ relay que exige identificação: SEM chave na sessão não se lê nada, e a tela fica sabendo (auth="exigida")', async () => {
    const r = await p.pg.evaluate(([url, pubkey]) => Relay.consultarUm(url, Mensagens.filtroEnvelopes(pubkey), { timeoutMs: 8000 }), [f.ws('caixa-auth'), dono.pubkey]);
    assert(r.estado === 'recusou' && r.auth === 'exigida', JSON.stringify([r.estado, r.auth, r.detalhe]));
    assert(r.eventos.length === 0, 'entregou mensagens sem identificação');
  });

  await it('⚠️ com identificação: o 22242 vai num ["AUTH", ev], o relay aceita, o REQ é repetido e as mensagens chegam', async () => {
    const antes = f.identificadosEm('caixa-auth').length;
    const r = await p.pg.evaluate(([url, sk, pubkey]) => {
      const skB = new Uint8Array(sk);
      return Relay.consultarUm(url, Mensagens.filtroEnvelopes(pubkey), {
        timeoutMs: 10000,
        assinarAuth: (u, desafio) => Chave.assinar(Mensagens.modeloAuth(u, desafio), skB)
      });
    }, [f.ws('caixa-auth'), sk, dono.pubkey]);
    assert(r.auth === 'ok', 'auth: ' + r.auth + ' — ' + r.detalhe);
    assert(r.estado === 'ok' && r.eventos.length === 9, JSON.stringify([r.estado, r.eventos.length]));
    const ids = f.identificadosEm('caixa-auth');
    assert(ids.length === antes + 1 && ids[ids.length - 1] === dono.pubkey, JSON.stringify(ids));
    assert(f.recusasAuthEm('caixa-auth').length === 0, 'o relay recusou: ' + JSON.stringify(f.recusasAuthEm('caixa-auth')));
    const rec = f.estado.relays.get('caixa-auth').recebidas;
    assert(rec.some(m => m[0] === 'AUTH' && m[1] && m[1].kind === 22242), 'o 22242 não veio num ["AUTH", ev]');
    assert(!rec.some(m => m[0] === 'EVENT' && m[1] && m[1].kind === 22242), '⚠️ o 22242 foi mandado como ["EVENT", ev]');
    return 'identificado e ' + r.eventos.length + ' envelopes';
  });

  await it('o 22242 leva as tags `relay` e `challenge` e a data dentro da janela de 10 minutos', async () => {
    const ev = await p.pg.evaluate(([url, sk]) => Chave.assinar(Mensagens.modeloAuth(url, 'desafio-de-teste'), new Uint8Array(sk)), [f.ws('caixa-auth'), sk]);
    const tag = (n) => (ev.tags.find(t => t[0] === n) || [])[1];
    assert(ev.kind === 22242, 'kind ' + ev.kind);
    assert(tag('relay') === f.ws('caixa-auth'), 'tag relay: ' + tag('relay'));
    assert(tag('challenge') === 'desafio-de-teste', 'tag challenge: ' + tag('challenge'));
    assert(Math.abs(Math.floor(Date.now() / 1000) - ev.created_at) < 600, 'created_at fora da janela');
  });

  await it('sem chave na memória NÃO há identificação: o relay não vê ninguém se identificar', async () => {
    const antes = f.identificadosEm('caixa-auth').length;
    await p.pg.evaluate(([url, pubkey]) => Relay.consultarUm(url, Mensagens.filtroEnvelopes(pubkey), { timeoutMs: 6000 }), [f.ws('caixa-auth'), dono.pubkey]);
    assert(f.identificadosEm('caixa-auth').length === antes, 'alguém se identificou sem chave');
  });

  await it('publicar num relay que exige identificação para ESCREVER: recusa, se identifica e reenvia — o 10050 entra', async () => {
    const r = await p.pg.evaluate(([url, sk, relays]) => {
      const skB = new Uint8Array(sk);
      const ev = Chave.assinar(Mensagens.modeloCaixa(relays), skB);
      return Relay.publicarEm(url, ev, { timeoutMs: 10000, assinarAuth: (u, d) => Chave.assinar(Mensagens.modeloAuth(u, d), skB) });
    }, [f.ws('caixa-auth'), sk, [f.ws('caixa-auth'), f.ws('caixa')]]);
    assert(r.estado === 'aceito' && r.auth === 'ok', JSON.stringify([r.estado, r.auth, r.mensagem]));
    const pubs = f.publicadosEm('caixa-auth').filter(e => e.kind === 10050);
    assert(pubs.length >= 1 && pubs[pubs.length - 1].tags.filter(t => t[0] === 'relay').length === 2, JSON.stringify(pubs.map(e => e.tags)));
  });

  // --- caixa de entrada e envio -------------------------------------------

  await it('a caixa de entrada (10050) é lida da rede e só vale a da PRÓPRIA pessoa, verificada', async () => {
    const boa = F.caixaDeEntrada(ana, [f.ws('caixa'), f.ws('caixa-auth')], { created_at: AGORA });
    const velha = F.caixaDeEntrada(ana, [f.ws('caixa-vazia')], { created_at: AGORA - 9999 });
    const alheia = F.caixaDeEntrada(bento, [f.ws('caixa-vazia')], { created_at: AGORA + 10 });
    f.relay('caixas', { modo: 'ok', eventos: [velha, boa, alheia] });
    const r = await p.pg.evaluate(([url, pk]) => Mensagens.caixaDe({ relays: [url], pubkey: pk, timeoutMs: 8000 }), [f.ws('caixas'), ana.pubkey]);
    assert(r.achou === true && r.relays.length === 2, JSON.stringify(r.relays));
    assert(r.evento.created_at === AGORA, 'pegou a versão antiga do 10050');
  });

  await it('sem 10050 publicado, a spec manda NÃO tentar: `achou` é falso e não há relay nenhum', async () => {
    const r = await p.pg.evaluate(([url, pk]) => Mensagens.caixaDe({ relays: [url], pubkey: pk, timeoutMs: 8000 }), [f.ws('caixa-vazia'), bento.pubkey]);
    assert(r.achou === false && r.relays.length === 0, JSON.stringify(r));
  });

  // --- escrever para quem nunca escreveu para o site (2026-09-25) --------------
  // A caixa de quem nunca escreveu pode não estar nos nossos relays. A NIP-65
  // manda procurar os eventos de uma pessoa nos relays onde ELA escreve.

  // Assina o 22242 com a chave do dono, como o Shell faz na tela.
  const caixaDeComAuth = (relays, pubkey) => p.pg.evaluate(([relays, pk, sk]) => Mensagens.caixaDe({
    relays: relays, pubkey: pk, timeoutMs: 8000,
    assinarAuth: (u, d) => Chave.assinar(Mensagens.modeloAuth(u, d), new Uint8Array(sk)) }), [relays, pubkey, sk]);
  const pedidosEm = (persona) => (persona.recebidas || []).filter(m => m[0] === 'REQ').length;

  await it('o endereço colado vira pubkey: npub sozinha ou como link `nostr:`; nsec, hex, npub cortada, e-mail e vazio NÃO', async () => {
    const npubErrada = ana.npub.slice(0, -1) + (ana.npub.slice(-1) === 'q' ? 'p' : 'q');
    const r = await p.pg.evaluate(([npub, nsec, hex, errada]) => ({
      pura: Mensagens.pubkeyDoEndereco(npub),
      link: Mensagens.pubkeyDoEndereco('  nostr:' + npub + '\n'),
      maiusculo: Mensagens.pubkeyDoEndereco('NOSTR:' + npub),
      nsec: Mensagens.pubkeyDoEndereco(nsec),
      hex: Mensagens.pubkeyDoEndereco(hex),
      cortada: Mensagens.pubkeyDoEndereco(npub.slice(0, -3)),
      errada: Mensagens.pubkeyDoEndereco(errada),
      email: Mensagens.pubkeyDoEndereco('fulano@exemplo.test'),
      vazio: Mensagens.pubkeyDoEndereco('   '),
      nulo: Mensagens.pubkeyDoEndereco(null)
    }), [ana.npub, bento.nsec, ana.pubkey, npubErrada]);
    assert(r.pura === ana.pubkey && r.link === ana.pubkey && r.maiusculo === ana.pubkey, JSON.stringify([r.pura, r.link, r.maiusculo]));
    // ⚠️ a nsec colada por engano não pode virar destinatário (nem ser aceita
    // como "endereço"): o tipo precisa ser npub.
    const recusados = ['nsec', 'hex', 'cortada', 'errada', 'email', 'vazio', 'nulo'].filter(k => r[k] !== null);
    assert(recusados.length === 0, 'aceitou o que não é npub: ' + recusados.join(', '));
    return '3 aceitos · 7 recusados';
  });

  await it('relaysDeEscrita (NIP-65): sem marcador conta como escrita, `read` fica de fora, só wss:, sem repetir, no máximo 4', async () => {
    const ev = { kind: 10002, tags: [
      ['r', 'wss://a.exemplo'], ['r', 'wss://b.exemplo', 'read'], ['r', 'wss://c.exemplo', 'write'],
      ['r', 'https://d.exemplo'], ['r', 'wss://a.exemplo/', 'write'], ['x', 'wss://h.exemplo'],
      ['r', 'wss://e.exemplo'], ['r', 'wss://f.exemplo'], ['r', 'wss://g.exemplo']] };
    const r = await p.pg.evaluate((ev) => ({ lista: Mensagens.relaysDeEscrita(ev), max: Mensagens.MAX_RELAYS_DELA, nada: Mensagens.relaysDeEscrita(null) }), ev);
    const esperado = ['wss://a.exemplo', 'wss://c.exemplo', 'wss://e.exemplo', 'wss://f.exemplo'];
    assert(r.max === 4, 'teto: ' + r.max);
    assert(JSON.stringify(r.lista) === JSON.stringify(esperado), JSON.stringify(r.lista));
    assert(Array.isArray(r.nada) && r.nada.length === 0, JSON.stringify(r.nada));
  });

  await it('⚠️ a caixa só nos relays DELA: a lista (10002) lida nos nossos diz onde procurar, a caixa é achada lá — e o painel NÃO se identifica a eles', async () => {
    const clara = F.chave();
    // Os nossos pedem identificação ao ligar (e deixam ler sem ela): é o
    // CONTROLE — prova, na mesma rodada, que o painel responde ao desafio
    // quando pode. Os dela também pedem, e aí ele não pode responder.
    const nosso = f.relay('n71-nosso', { modo: 'ok', auth: 'escrever', eventos: [
      F.relayList(clara, [[f.ws('n71-dela'), 'write'], [f.ws('n71-leitura'), 'read'], f.ws('n71-ambos')])] });
    const dela = f.relay('n71-dela', { modo: 'ok', auth: 'escrever', eventos: [F.caixaDeEntrada(clara, [f.ws('n71-caixa-clara')])] });
    const ambos = f.relay('n71-ambos', { modo: 'ok', auth: 'escrever', eventos: [] });
    const leitura = f.relay('n71-leitura', { modo: 'ok', eventos: [F.caixaDeEntrada(clara, [f.ws('n71-errado')], { created_at: AGORA + 60 })] });
    const r = await caixaDeComAuth([f.ws('n71-nosso')], clara.pubkey);
    assert(r.achou === true && JSON.stringify(r.relays) === JSON.stringify([f.ws('n71-caixa-clara')]), JSON.stringify(r.relays));
    assert(JSON.stringify(r.relaysDela) === JSON.stringify([f.ws('n71-dela'), f.ws('n71-ambos')]), 'relays da etapa 2: ' + JSON.stringify(r.relaysDela));
    // o relay só de LEITURA dela não é onde ela escreve: nem se pergunta
    assert(pedidosEm(leitura) === 0, 'consultou o relay de leitura dela');
    // No nosso pode haver 2: identificado antes do fim, o painel repete o pedido.
    assert(pedidosEm(nosso) >= 1 && pedidosEm(dela) === 1 && pedidosEm(ambos) === 1, 'pedidos: ' + [pedidosEm(nosso), pedidosEm(dela), pedidosEm(ambos)]);
    // o controle, e depois o que interessa
    assert(f.identificadosEm('n71-nosso').length >= 1, 'CONTROLE: o painel não se identificou nem no NOSSO relay — o caso não mede nada');
    assert((dela.desafios || []).length >= 1 && (ambos.desafios || []).length >= 1, 'os relays dela não chegaram a pedir identificação');
    assert(f.identificadosEm('n71-dela').length === 0 && f.identificadosEm('n71-ambos').length === 0, '⚠️ o painel se identificou a relays escolhidos por um estranho');
    return 'achada em ' + r.relaysDela.length + ' relays dela · identificação só no nosso';
  });

  await it('quando os nossos relays já têm a caixa, os relays dela NEM são consultados', async () => {
    const bia = F.chave();
    f.relay('n71-nosso2', { modo: 'ok', eventos: [F.caixaDeEntrada(bia, [f.ws('n71-caixa-bia')]), F.relayList(bia, [f.ws('n71-dela2')])] });
    const dela = f.relay('n71-dela2', { modo: 'ok', eventos: [F.caixaDeEntrada(bia, [f.ws('n71-outra')], { created_at: AGORA + 60 })] });
    const r = await caixaDeComAuth([f.ws('n71-nosso2')], bia.pubkey);
    assert(r.achou === true && JSON.stringify(r.relays) === JSON.stringify([f.ws('n71-caixa-bia')]), JSON.stringify(r.relays));
    assert(r.relaysDela.length === 0 && pedidosEm(dela) === 0, 'foi aos relays dela sem precisar: ' + JSON.stringify(r.relaysDela) + ' · ' + pedidosEm(dela));
  });

  await it('entre as duas etapas vale a caixa mais NOVA: desligada nos nossos e religada nos dela → achou; religada antes e desligada depois → não', async () => {
    // Dani desligou (caixa vazia) e depois religou — a nova está só nos dela.
    const dani = F.chave(), edu = F.chave();
    f.relay('n71-nosso3', { modo: 'ok', eventos: [
      F.caixaDeEntrada(dani, [], { created_at: AGORA - 100 }), F.relayList(dani, [f.ws('n71-dela3')]),
      // Edu fez o contrário: a caixa VAZIA é a mais nova, e está nos nossos.
      F.caixaDeEntrada(edu, [], { created_at: AGORA }), F.relayList(edu, [f.ws('n71-dela3')])] });
    f.relay('n71-dela3', { modo: 'ok', eventos: [
      F.caixaDeEntrada(dani, [f.ws('n71-caixa-dani')], { created_at: AGORA }),
      F.caixaDeEntrada(edu, [f.ws('n71-caixa-edu')], { created_at: AGORA - 100 })] });
    const d = await caixaDeComAuth([f.ws('n71-nosso3')], dani.pubkey);
    const e = await caixaDeComAuth([f.ws('n71-nosso3')], edu.pubkey);
    assert(d.achou === true && JSON.stringify(d.relays) === JSON.stringify([f.ws('n71-caixa-dani')]), 'Dani: ' + JSON.stringify(d));
    // a de Edu foi procurada (a dos nossos estava vazia), achada, e PERDEU para a mais nova
    assert(e.relaysDela.length === 1 && e.achou === false && e.relays.length === 0, 'Edu: ' + JSON.stringify({ achou: e.achou, relays: e.relays, dela: e.relaysDela }));
  });

  await it('uma lista (10002) forjada — assinada por outra chave em nome dela — não manda o painel a lugar nenhum', async () => {
    const fabi = F.chave(), intruso = F.chave();
    const forjada = Object.assign({}, F.relayList(intruso, [f.ws('n71-armadilha')]), { pubkey: fabi.pubkey });
    f.relay('n71-nosso4', { modo: 'ok', eventos: [forjada] });
    const armadilha = f.relay('n71-armadilha', { modo: 'ok', eventos: [F.caixaDeEntrada(fabi, [f.ws('n71-caixa-falsa')])] });
    const r = await caixaDeComAuth([f.ws('n71-nosso4')], fabi.pubkey);
    assert(r.achou === false && r.relaysDela.length === 0 && pedidosEm(armadilha) === 0, JSON.stringify({ r, pedidos: pedidosEm(armadilha) }));
  });

  await it('responder produz DOIS envelopes — um para ela, um para mim — com o MESMO id de rumor', async () => {
    const r = await p.pg.evaluate(([sk, para]) => Mensagens.montarResposta('obrigado pela mensagem', new Uint8Array(sk), para)
      .then(x => ({ rumor: x.rumor, paraEle: x.paraEle, paraMim: x.paraMim })), [sk, ana.pubkey]);
    assert(r.paraEle.kind === 1059 && r.paraMim.kind === 1059, 'kinds: ' + [r.paraEle.kind, r.paraMim.kind]);
    assert(r.paraEle.id !== r.paraMim.id, 'os dois envelopes são o mesmo evento');
    assert(r.paraEle.pubkey !== r.paraMim.pubkey, 'os dois usaram a mesma chave descartável');
    const destino = (ev) => (ev.tags.find(t => t[0] === 'p') || [])[1];
    assert(destino(r.paraEle) === ana.pubkey && destino(r.paraMim) === dono.pubkey, 'destinos: ' + [destino(r.paraEle), destino(r.paraMim)]);
    // ⚠️ A prova que importa: o mesmo rumor nos dois. Se fossem rumores
    // diferentes, a cópia que volta da rede apareceria como mensagem nova.
    const aberto = await p.pg.evaluate(([envs, sk, pubkey]) => Mensagens.abrirVarias(envs, new Uint8Array(sk), pubkey), [[r.paraMim], sk, dono.pubkey]);
    assert(aberto.mensagens.length === 1 && aberto.mensagens[0].id === r.rumor.id, JSON.stringify([aberto.mensagens[0] && aberto.mensagens[0].id, r.rumor.id]));
    assert(aberto.mensagens[0].minha === true && aberto.mensagens[0].peer === ana.pubkey, JSON.stringify(aberto.mensagens[0]));
  });

  await it('enviar: a mensagem dela vai à caixa DELA e a cópia à minha; o placar é o dela', async () => {
    const r = await p.pg.evaluate(([sk, para, dela, minha]) => Mensagens.montarResposta('resposta de teste', new Uint8Array(sk), para)
      .then(x => Mensagens.enviar({ paraEle: x.paraEle, paraMim: x.paraMim, relaysDela: dela, relaysMeus: minha, timeoutMs: 8000 })),
      [sk, ana.pubkey, [f.ws('caixa')], [f.ws('caixa-vazia')]]);
    assert(r.ok === true && r.placarDela.com === 1, JSON.stringify(r.placarDela));
    assert(r.placarMinha && r.placarMinha.com === 1, JSON.stringify(r.placarMinha));
    const naDela = f.publicadosEm('caixa').filter(e => e.kind === 1059);
    const naMinha = f.publicadosEm('caixa-vazia').filter(e => e.kind === 1059);
    assert(naDela.length === 1 && naMinha.length === 1, 'dela=' + naDela.length + ' minha=' + naMinha.length);
    assert(naDela[0].id !== naMinha[0].id, 'mandou o mesmo envelope às duas caixas');
  });

  await it('mensagem vazia e mensagem longa demais são recusadas ANTES de tocar na rede', async () => {
    const r = await p.pg.evaluate(([sk, para]) => {
      const skB = new Uint8Array(sk);
      return Promise.all([
        Mensagens.montarResposta('   ', skB, para).then(() => 'passou', e => e.message),
        Mensagens.montarResposta('x'.repeat(Mensagens.MAX_TEXTO + 1), skB, para).then(() => 'passou', e => e.message),
        Mensagens.montarResposta('ok', skB, 'nao-e-pubkey').then(() => 'passou', e => e.message)
      ]);
    }, [sk, ana.pubkey]);
    assert(r.every(x => x !== 'passou'), JSON.stringify(r));
  });

  // --- filtros e nomes -----------------------------------------------------

  await it('filtros e busca: ativas/arquivadas/bloqueadas/todas, e busca por apelido, npub e texto', async () => {
    const r = await abrirTudo([deAna1.envelope, deAna2.envelope, deBento.envelope]);
    const saida = await p.pg.evaluate(([ms, pkAna, pkBento]) => {
      const pessoas = [
        { pubkey: pkAna, npub: Mensagens.npubDe(pkAna), apelido: 'Vizinha', arquivado: true, bloqueado: false },
        { pubkey: pkBento, npub: Mensagens.npubDe(pkBento), apelido: '', arquivado: false, bloqueado: true }
      ];
      const c = Mensagens.agrupar(ms, pessoas);
      const n = (o) => Mensagens.filtrar(c, o).map(x => x.apelido || Mensagens.nomeDe(x));
      return {
        ativas: n({ estado: 'ativas' }), arquivadas: n({ estado: 'arquivadas' }),
        bloqueadas: n({ estado: 'bloqueadas' }), todas: n({ estado: 'todas' }),
        porApelido: n({ estado: 'todas', busca: 'vizi' }),
        porTexto: n({ estado: 'todas', busca: 'sou o bento' }),
        porNpub: n({ estado: 'todas', busca: Mensagens.npubDe(pkAna).slice(0, 12) }),
        semNada: n({ estado: 'todas', busca: 'zzzzz' })
      };
    }, [r.mensagens, ana.pubkey, bento.pubkey]);
    assert(saida.ativas.length === 0, 'ativas: ' + JSON.stringify(saida.ativas));
    assert(saida.arquivadas.join() === 'Vizinha', JSON.stringify(saida.arquivadas));
    assert(saida.bloqueadas.length === 1 && saida.todas.length === 2, JSON.stringify([saida.bloqueadas, saida.todas]));
    assert(saida.porApelido.join() === 'Vizinha' && saida.porTexto.length === 1, JSON.stringify([saida.porApelido, saida.porTexto]));
    assert(saida.porNpub.join() === 'Vizinha' && saida.semNada.length === 0, JSON.stringify([saida.porNpub, saida.semNada]));
  });

  await it('o nome vem do apelido > nome publicado > npub abreviada; e a imagem do perfil NUNCA é lida', async () => {
    const perfil = JSON.stringify({ name: 'Ana da Rede', picture: 'https://servidor-de-estranho/avatar.png', about: 'x' });
    const saida = await p.pg.evaluate(([pk, conteudo]) => {
      const ev = { kind: 0, content: conteudo, pubkey: pk, created_at: 1, tags: [], id: 'x', sig: 'y' };
      const base = { pubkey: pk, npub: Mensagens.npubDe(pk), nome: Mensagens.nomeDoPerfil(ev), apelido: '' };
      return {
        doPerfil: Mensagens.nomeDe(base),
        doApelido: Mensagens.nomeDe(Object.assign({}, base, { apelido: 'A vizinha' })),
        daNpub: Mensagens.nomeDe(Object.assign({}, base, { nome: '' })),
        temUrl: JSON.stringify(base).includes('avatar.png')
      };
    }, [ana.pubkey, perfil]);
    assert(saida.doPerfil === 'Ana da Rede' && saida.doApelido === 'A vizinha', JSON.stringify(saida));
    assert(saida.daNpub.indexOf('npub1') === 0 && saida.daNpub.includes('…'), saida.daNpub);
    assert(saida.temUrl === false, '⚠️ a URL do avatar de um estranho entrou no objeto da tela');
  });

  // --- ao vivo (61, 2026-09-14) --------------------------------------------
  const dormir = (ms) => new Promise(r => setTimeout(r, ms));
  await it('⚠️ o filtro da escuta NÃO leva `since` — com since = agora a medição real não recebeu nenhuma de quatro — e só pede 1059 endereçado a mim', async () => {
    const fe = await p.pg.evaluate((pk) => Mensagens.filtroEscuta(pk), dono.pubkey);
    assert(!('since' in fe), '⚠️ a escuta voltou a ter since: ' + JSON.stringify(fe));
    assert(fe.kinds.join() === '1059' && fe['#p'].join() === dono.pubkey && fe.limit > 0, JSON.stringify(fe));
  });

  f.relay('vivo-a', { modo: 'ok', eventos: [] });
  f.relay('vivo-b', { modo: 'ok', auth: 'ler', eventos: [] });
  await it('escutar os dois relays da caixa: o mesmo envelope chega pelos DOIS e sai UMA vez; o resumo diz 2 de 2; o que a verificação já viu não volta', async () => {
    const jaVisto = F.mensagem(ana, dono.pubkey, { content: 'já verificada' }).envelope;
    f.semear('vivo-a', [jaVisto]);
    await p.pg.evaluate(([urls, pubkey, sk, jaVistoId]) => {
      const reg = window.__vivo = { envelopes: [], resumos: [] };
      const chave = new Uint8Array(sk);
      reg.alca = Mensagens.escutar({ relays: urls, pubkey: pubkey, pulsoMs: 0, jaVistos: new Set([jaVistoId]),
        assinarAuth: (u, d) => Chave.assinar(Mensagens.modeloAuth(u, d), chave),
        aoEnvelope: (env, url) => reg.envelopes.push([env.id, url]),
        aoEstado: (r) => reg.resumos.push(r.estado + ' ' + r.recebendo + '/' + r.total) });
    }, [[f.ws('vivo-a'), f.ws('vivo-b')], dono.pubkey, sk, jaVisto.id]);
    const ler = () => p.pg.evaluate(() => ({ envelopes: window.__vivo.envelopes.slice(), resumos: window.__vivo.resumos.slice() }));
    let r = await ler(); const t0 = Date.now();
    while (!r.resumos.includes('recebendo 2/2') && Date.now() - t0 < 10000) { await dormir(100); r = await ler(); }
    assert(r.resumos.includes('recebendo 2/2'), 'os dois relays não chegaram a receber: ' + JSON.stringify(r.resumos));
    const novo = F.mensagem(ana, dono.pubkey, { content: 'pelos dois' }).envelope;
    f.empurrar('vivo-a', [novo]); f.empurrar('vivo-b', [novo]);
    await dormir(600);
    r = await ler();
    assert(r.envelopes.length === 1 && r.envelopes[0][0] === novo.id, 'esperava o envelope novo UMA vez (e nunca o já verificado): ' + JSON.stringify(r.envelopes));
    await p.pg.evaluate(() => window.__vivo.alca.fechar());
    return r.resumos.join(' → ');
  });

  await it('a caixa de entrada guarda no máximo 3 relays (a spec pede de 1 a 3)', async () => {
    const ev = await p.pg.evaluate(() => Mensagens.modeloCaixa(['wss://a.test', 'wss://b.test', 'wss://c.test', 'wss://d.test']));
    assert(ev.kind === 10050 && ev.tags.length === 3, JSON.stringify(ev.tags));
  });

  await it('nenhuma nsec no DOM, no banco ou no armazenamento depois de tudo isto', async () => {
    const v = await require('../util.js').varrer(p.pg, null);
    assert(v.achados.length === 0, JSON.stringify(v.achados));
  });

  return R;
};
