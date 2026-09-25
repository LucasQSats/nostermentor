// test/telas/t13_contatos.test.js — T13 Contatos pela INTERFACE (14 T13).
// Mede o que o dono faz: abrir a tela pelo menu, ligar as mensagens, verificar,
// ver uma linha por pessoa, abrir a conversa, responder, dar apelido, arquivar
// e bloquear.
//
// O que esta suíte existe para provar, além de "a tela aparece":
//  · a lista ordena pela data do MIOLO — um envelope datado de dois dias antes
//    não a desordena (a spec manda aleatorizar a data do envelope);
//  · uma mensagem com uma tag dentro sai como TEXTO, nunca interpretada;
//  · selo forjado aparece como inválida, e não como mensagem de quem não é;
//  · apelido, arquivar e bloquear sobrevivem a recarregar a página — e num
//    banco apagado voltam a zero, com a tela dizendo isso (é o caso do Tails);
//  · o contador de "Publicar" NÃO acende por mensagem que chega;
//  · um relay que exige identificação e não a obtém não quebra a tela.
// Desde a Etapa 2 (2026-09-12), também a aba "Onde me encontrar": os oito
// campos com o aviso de cada canal, o link montado a partir do que o dono
// escreveu, o que NÃO foi salvo dito com todas as letras, a prévia isolada, e
// o botão "Contatos" da barra do editor.
const { abrir, coletor, assert, entrarCom, semearSite, esperarT2, varrer } = require('../util.js');
const F = require('../fabrica.js');

module.exports = async function (ctx, u) {
  const { R, it, pulado } = coletor();
  if (!u.falso) { pulado('telas/t13_contatos (todos os casos)', 'servidor falso indisponível'); return R; }
  const f = u.falso;
  f.relay('t13pub', { escrita: 'aceita', eventos: [] });

  const AGORA = Math.floor(Date.now() / 1000), DOIS_DIAS = 2 * 24 * 3600;

  // Uma sessão com a caixa LIGADA e mensagens à espera no relay falso.
  async function sessao(o) {
    o = o || {};
    const dono = F.chave(), ana = F.chave(), bento = F.chave(), impostor = F.chave();
    const nomeRelay = 't13caixa-' + Math.random().toString(36).slice(2, 8);
    // Ana falou há 1 minuto, mas o envelope leva data de dois dias atrás.
    // Bento falou há 2 horas. Se a ordem viesse do envelope, tudo trocava.
    const deAna = F.mensagem(ana, dono.pubkey, { content: 'Olá! Gostei muito do seu site.', created_at: AGORA - 60, envelopeEm: AGORA - DOIS_DIAS, seloEm: AGORA - DOIS_DIAS });
    const deBento = F.mensagem(bento, dono.pubkey, { content: 'Uma dúvida sobre o artigo.', created_at: AGORA - 7200 });
    const comTag = F.mensagem(bento, dono.pubkey, { content: '<b>negrito</b> e <img src=x onerror=alert(1)>', created_at: AGORA - 3600 });
    const forjada = F.mensagem(ana, dono.pubkey, { content: 'sou a Ana, juro', created_at: AGORA - 30, seloDe: impostor });
    f.relay(nomeRelay, Object.assign({ modo: 'ok', escrita: 'aceita', eventos: [deAna.envelope, deBento.envelope, comTag.envelope, forjada.envelope] }, o.relayCfg || {}));
    // a caixa de entrada da Ana, para o teste de responder
    f.semear(nomeRelay, [F.caixaDeEntrada(ana, [f.ws(nomeRelay)])]);

    const p = await abrir(ctx, u.url);
    await semearSite(p.pg, dono, { relays: [f.ws('t13pub')], servers: [], title: 'Caderno de Bordo' });
    await entrarCom(p.pg, dono.nsec);
    await esperarT2(p.pg, 30000);
    // aponta a caixa de entrada para o relay falso (é o que T7 → Avançado fará)
    await p.pg.evaluate(async ([pubkey, url, ligado, extras]) => {
      const db = await Db.abrir(pubkey);
      const site = await db.get('site', 'site');
      site.messages = { enabled: ligado, relays: [url].concat(extras) };
      await db.put('site', site, 'site');
      db.fechar();
    }, [dono.pubkey, f.ws(nomeRelay), o.desligado !== true, o.relaysExtra || []]);
    return { p, dono, ana, bento, relay: nomeRelay, deAna, deBento, comTag, forjada };
  }

  async function irAContatos(pg) {
    await pg.click('#menu .item[data-tela="t13"]');
    await pg.waitForSelector('#t13', { timeout: 10000 });
  }
  async function verificar(pg) {
    await pg.click('#verificar-mensagens');
    await pg.waitForFunction(() => {
      const b = document.getElementById('verificar-mensagens');
      return b && !b.disabled && document.getElementById('verificacao-quando');
    }, null, { timeout: 20000 });
    await pg.waitForSelector('#lista-conversas', { timeout: 10000 });
  }
  const linhas = (pg) => pg.evaluate(() => Array.from(document.querySelectorAll('#lista-conversas li.conversa')).map(li => ({
    nome: (li.querySelector('strong') || {}).textContent || '',
    data: (li.querySelector('.data') || {}).textContent || '',
    previa: (li.querySelector('.conversa-previa') || {}).textContent || '',
    selos: Array.from(li.querySelectorAll('.selo')).map(s => s.textContent),
    npub: li.getAttribute('data-npub')
  })));

  await it('o menu tem "Contatos" depois de "Mídia", e a tela abre com as duas abas', async () => {
    const s = await sessao();
    const ordem = await s.p.pg.evaluate(() => Array.from(document.querySelectorAll('#menu .item')).map(b => b.textContent));
    assert(ordem.join(' · ') === 'Início · Páginas · Artigos · Mídia · Contatos · Temas · Configurações · Ajuda', ordem.join(' · '));
    await irAContatos(s.p.pg);
    const abas = await s.p.pg.evaluate(() => Array.from(document.querySelectorAll('#t13 .aba')).map(b => b.textContent));
    assert(abas.join(',') === 'Mensagens,Onde me encontrar', abas.join(','));
    await s.p.pg.close();
    return ordem.join(' · ');
  });

  await it('⚠️ a lista ordena pela data do MIOLO: a Ana (envelope de dois dias atrás, mensagem de agora) vem primeiro', async () => {
    const s = await sessao();
    await irAContatos(s.p.pg);
    await verificar(s.p.pg);
    const l = await linhas(s.p.pg);
    assert(l.length === 2, 'esperava 2 pessoas, veio ' + l.length + ': ' + JSON.stringify(l));
    const npubAna = await s.p.pg.evaluate((pk) => Mensagens.npubDe(pk), s.ana.pubkey);
    assert(l[0].npub === npubAna, 'a ordem veio do envelope, não do miolo: ' + JSON.stringify(l.map(x => [x.npub.slice(0, 12), x.data])));
    const hoje = new Date(AGORA * 1000).toISOString().slice(0, 10);
    assert(l[0].data === hoje, 'a data mostrada é a do envelope: ' + l[0].data + ' (esperava ' + hoje + ')');
    assert(l[0].previa === 'Olá! Gostei muito do seu site.', l[0].previa);
    await s.p.pg.close();
    return l.map(x => x.data).join(' · ');
  });

  await it('⚠️ mensagem com uma tag dentro aparece como TEXTO — nada de negrito, nada de <img> no DOM', async () => {
    const s = await sessao();
    await irAContatos(s.p.pg);
    await verificar(s.p.pg);
    // abre a conversa do Bento (a segunda linha)
    await s.p.pg.evaluate(() => document.querySelectorAll('#lista-conversas li.conversa')[1].querySelector('.abrir-conversa').click());
    await s.p.pg.waitForSelector('#mensagens-da-conversa', { timeout: 10000 });
    const g = await s.p.pg.evaluate(() => {
      const ul = document.getElementById('mensagens-da-conversa');
      return { texto: Array.from(ul.querySelectorAll('.corpo')).map(x => x.textContent),
        temB: ul.querySelectorAll('b').length, temImg: ul.querySelectorAll('img').length, html: ul.innerHTML.length };
    });
    assert(g.texto.some(t => t === '<b>negrito</b> e <img src=x onerror=alert(1)>'), JSON.stringify(g.texto));
    assert(g.temB === 0 && g.temImg === 0, '⚠️ a mensagem foi interpretada como HTML: ' + JSON.stringify([g.temB, g.temImg]));
    await s.p.pg.close();
  });

  await it('selo forjado não vira mensagem de quem não é: a tela conta as inválidas e não mostra a conversa', async () => {
    const s = await sessao();
    await irAContatos(s.p.pg);
    await verificar(s.p.pg);
    const aviso = await s.p.pg.evaluate(() => { const e = document.getElementById('mensagens-invalidas'); return e ? e.textContent : null; });
    assert(aviso && /1 mensagens chegaram com selo inválido/.test(aviso), JSON.stringify(aviso));
    const l = await linhas(s.p.pg);
    assert(l.every(x => !x.previa.includes('sou a Ana, juro')), 'a forjada apareceu: ' + JSON.stringify(l.map(x => x.previa)));
    await s.p.pg.close();
    return aviso;
  });

  await it('não há "Nova", nem contagem de não lidas, nem "marcar como lida" — em lugar nenhum da tela', async () => {
    const s = await sessao();
    await irAContatos(s.p.pg);
    await verificar(s.p.pg);
    const g = await s.p.pg.evaluate(() => {
      const t = document.getElementById('t13').textContent;
      return { naoLida: /não lida|nao lida|marcar como lida|\bNova\b/i.test(t), temRelogio: /Última verificação às \d\d:\d\d/.test(t) };
    });
    assert(g.naoLida === false, '⚠️ o lido/não lido voltou à tela — ele o tirou em 2026-09-12');
    assert(g.temRelogio === true, 'falta o relógio da última verificação, que é o que substitui o contador');
    await s.p.pg.close();
  });

  await it('apelido, arquivar e bloquear sobrevivem a recarregar a página (fora do Tails o banco fica)', async () => {
    const s = await sessao();
    await irAContatos(s.p.pg);
    await verificar(s.p.pg);
    // apelido na primeira (Ana), arquivar; bloquear a segunda (Bento)
    await s.p.pg.evaluate(([pkAna, pkBento]) => {
      window.prompt = () => 'A vizinha';
      const li = document.querySelectorAll('#lista-conversas li.conversa');
      li[0].querySelectorAll('.ligacao')[1].click();     // "Dar apelido"
    }, [s.ana.pubkey, s.bento.pubkey]);
    await s.p.pg.waitForFunction(() => /A vizinha/.test(document.getElementById('lista-conversas').textContent), null, { timeout: 10000 });
    await s.p.pg.evaluate(() => document.querySelectorAll('#lista-conversas li.conversa')[1].querySelectorAll('.ligacao')[3].click());  // "Bloquear"
    await s.p.pg.waitForFunction(() => document.querySelectorAll('#lista-conversas li.conversa').length === 1, null, { timeout: 10000 });
    // recarrega: entra de novo com a mesma chave
    await s.p.pg.reload();
    await s.p.pg.waitForFunction(() => window.__arrancou === true, null, { timeout: 30000 });
    await entrarCom(s.p.pg, s.dono.nsec);
    await esperarT2(s.p.pg, 30000);
    await irAContatos(s.p.pg);
    await s.p.pg.waitForSelector('#lista-conversas', { timeout: 10000 });
    const l = await linhas(s.p.pg);
    assert(l.length === 1 && l[0].nome === 'A vizinha', 'o apelido/bloqueio não sobreviveu: ' + JSON.stringify(l));
    // e o bloqueado continua no filtro "Bloqueadas"
    await s.p.pg.evaluate(() => document.querySelector('#filtros-conversas [data-filtro="bloqueadas"]').click());
    const b = await linhas(s.p.pg);
    assert(b.length === 1 && b[0].selos.includes('Bloqueada'), JSON.stringify(b));
    await s.p.pg.close();
    return 'apelido e bloqueio persistiram';
  });

  await it('⚠️ banco apagado (o caso do Tails): tudo volta a zero, e a tela AVISA em vez de fingir', async () => {
    const s = await sessao();
    await irAContatos(s.p.pg);
    await verificar(s.p.pg);
    const antes = (await linhas(s.p.pg)).length;
    // o Tails desligou: o banco desta identidade deixa de existir
    await s.p.pg.evaluate(async (pubkey) => { const db = await Db.abrir(pubkey); await db.limparTudo(); db.fechar(); }, s.dono.pubkey);
    await s.p.pg.reload();
    await s.p.pg.waitForFunction(() => window.__arrancou === true, null, { timeout: 30000 });
    await entrarCom(s.p.pg, s.dono.nsec);
    await esperarT2(s.p.pg, 30000);
    await irAContatos(s.p.pg);
    const g = await s.p.pg.evaluate(() => ({
      conversas: document.querySelectorAll('#lista-conversas li.conversa').length,
      semNada: !!document.getElementById('sem-conversas'),
      aviso: (document.getElementById('aviso-tails') || {}).textContent || '',
      relogio: (document.getElementById('verificacao-quando') || {}).textContent || ''
    }));
    assert(antes === 2 && g.conversas === 0 && g.semNada, JSON.stringify([antes, g.conversas, g.semNada]));
    assert(/esquece tudo ao desligar/.test(g.aviso), 'falta o aviso do Tails: ' + g.aviso);
    assert(/Ainda não verifiquei/.test(g.relogio), 'o relógio mentiu depois de o banco morrer: ' + g.relogio);
    await s.p.pg.close();
    return 'de ' + antes + ' conversas a zero, com aviso';
  });

  await it('responder: dois envelopes saem, o placar diz a quantos relays, e a resposta aparece na conversa', async () => {
    const s = await sessao();
    await irAContatos(s.p.pg);
    await verificar(s.p.pg);
    const antes = f.publicadosEm(s.relay).filter(e => e.kind === 1059).length;
    await s.p.pg.evaluate(() => document.querySelectorAll('#lista-conversas li.conversa')[0].querySelector('.abrir-conversa').click());
    await s.p.pg.waitForSelector('#resposta', { timeout: 10000 });
    const aviso = await s.p.pg.evaluate(() => document.getElementById('resposta-aviso').textContent);
    assert(/assinada pelo seu site/.test(aviso), 'falta dizer que a resposta sai como o site: ' + aviso);
    await s.p.pg.fill('#resposta', 'Obrigado pela mensagem!');
    await s.p.pg.click('#enviar-resposta');
    await s.p.pg.waitForFunction(() => {
      const d = document.getElementById('resposta-desfecho');
      return d && !d.hidden && !/Procurando/.test(d.textContent);
    }, null, { timeout: 30000 });
    const desfecho = await s.p.pg.evaluate(() => document.getElementById('resposta-desfecho').textContent);
    assert(/Enviada a 1 de 1 relays/.test(desfecho), desfecho);
    const depois = f.publicadosEm(s.relay).filter(e => e.kind === 1059);
    assert(depois.length === antes + 2, 'esperava dois envelopes (dela e a cópia), vieram ' + (depois.length - antes));
    assert(depois[depois.length - 1].id !== depois[depois.length - 2].id, 'mandou o mesmo envelope duas vezes');
    // a resposta entra na conversa, do lado do dono
    await s.p.pg.waitForFunction(() => document.querySelectorAll('#mensagens-da-conversa li.minha').length === 1, null, { timeout: 10000 });
    const minha = await s.p.pg.evaluate(() => document.querySelector('#mensagens-da-conversa li.minha .corpo').textContent);
    assert(minha === 'Obrigado pela mensagem!', minha);
    await s.p.pg.close();
    return desfecho;
  });

  await it('sem 10050 da outra pessoa a tela NÃO finge que enviou: diz que não achou onde ela recebe', async () => {
    const s = await sessao();
    await irAContatos(s.p.pg);
    await verificar(s.p.pg);
    // abre a conversa do Bento, que não tem caixa de entrada publicada
    await s.p.pg.evaluate(() => document.querySelectorAll('#lista-conversas li.conversa')[1].querySelector('.abrir-conversa').click());
    await s.p.pg.waitForSelector('#resposta', { timeout: 10000 });
    const antes = f.publicadosEm(s.relay).filter(e => e.kind === 1059).length;
    await s.p.pg.fill('#resposta', 'não deve sair');
    await s.p.pg.click('#enviar-resposta');
    await s.p.pg.waitForFunction(() => {
      const d = document.getElementById('resposta-desfecho');
      return d && !d.hidden && !/Procurando/.test(d.textContent);
    }, null, { timeout: 20000 });
    const desfecho = await s.p.pg.evaluate(() => document.getElementById('resposta-desfecho').textContent);
    assert(/Não achei onde esta pessoa recebe mensagens/.test(desfecho), desfecho);
    assert(f.publicadosEm(s.relay).filter(e => e.kind === 1059).length === antes, '⚠️ mandou a mensagem mesmo sem caixa de entrada');
    await s.p.pg.close();
    return desfecho;
  });

  await it('⚠️ o contador de "Publicar" NÃO acende por mensagem que chega', async () => {
    const s = await sessao();
    const antes = await s.p.pg.evaluate(() => document.getElementById('btn-publicar').textContent);
    await irAContatos(s.p.pg);
    await verificar(s.p.pg);
    const depois = await s.p.pg.evaluate(() => ({
      publicar: document.getElementById('btn-publicar').textContent,
      backup: document.getElementById('btn-backup').textContent
    }));
    assert(depois.publicar === antes, 'o contador mudou de "' + antes + '" para "' + depois.publicar + '"');
    assert(/Backup em dia/.test(depois.backup), 'mensagem que chega virou alteração por exportar: ' + depois.backup);
    await s.p.pg.close();
    return antes + ' → ' + depois.publicar;
  });

  await it('relay que exige identificação e não a consegue: a tela não quebra e diz que não conseguiu verificar', async () => {
    // `auth: 'ler'` com a chave certa passa; para provar a falha, um relay que
    // recusa a leitura como os que pedem identificação e não a processam (P44).
    const s = await sessao({ relayCfg: { modo: 'recusa' } });
    await irAContatos(s.p.pg);
    await verificar(s.p.pg);
    const g = await s.p.pg.evaluate(() => ({
      erroNaTela: (document.getElementById('faixa') || {}).hidden === false,
      semAuth: (document.getElementById('mensagens-sem-auth') || {}).textContent || '',
      mudos: (document.getElementById('mensagens-mudos') || {}).textContent || '',
      semNada: !!document.getElementById('sem-conversas')
    }));
    assert(g.semNada === true, 'mostrou conversas de um relay que recusou');
    assert(/Não consegui verificar 1 relays/.test(g.mudos) || /identificar/.test(g.semAuth), JSON.stringify(g));
    assert(s.p.erros.length === 0, 'a tela lançou: ' + JSON.stringify(s.p.erros));
    await s.p.pg.close();
    return g.mudos || g.semAuth;
  });

  await it('mensagens DESLIGADAS: a tela diz por quê, o botão de verificar fica travado e o cartão da T3 também o diz', async () => {
    const s = await sessao({ desligado: true });
    // a T3 foi montada antes de o banco saber das mensagens: é remontada
    await s.p.pg.evaluate(() => Shell.ir('t3'));
    await s.p.pg.waitForSelector('#cartao-mensagens', { timeout: 10000 });
    const cartao = await s.p.pg.evaluate(() => {
      const e = document.getElementById('mensagens-resumo');
      return e ? e.textContent : null;
    });
    assert(cartao && /desligadas/.test(cartao), 'cartão da T3: ' + cartao);
    await irAContatos(s.p.pg);
    const g = await s.p.pg.evaluate(() => ({
      aviso: (document.getElementById('mensagens-desligado') || {}).textContent || '',
      travado: document.getElementById('verificar-mensagens').disabled
    }));
    assert(/nenhum aplicativo consegue mandar mensagem/.test(g.aviso), g.aviso);
    assert(g.travado === true, 'o botão de verificar não está travado com as mensagens desligadas');
    await s.p.pg.close();
    return g.aviso.slice(0, 60);
  });

  // ==== o interruptor da caixa de entrada (refeito em 2026-09-14: P51, D2–D7 e D9) ====
  // ⚠️ O caso que existia aqui fazia `check` + `click('#salvar-receber')`: sabia
  // qual dos DOIS Salvar era o certo, e passava enquanto nenhuma pessoa conseguia
  // ligar as mensagens (02 §F.2 regra 14). Os casos abaixo afirmam o que a
  // pessoa LÊ — o rótulo, o estado, o que está à vista —, não só o banco.
  const dormir = (ms) => new Promise(r => setTimeout(r, ms));
  const cartaoReceber = (pg) => pg.evaluate(() => {
    const c = document.getElementById('cartao-receber');
    const cb = document.getElementById('receber-mensagens');
    const lab = c.querySelector('label[for="receber-mensagens"]');
    const est = document.getElementById('receber-estado');
    const d = document.getElementById('receber-desfecho');
    return { rotulo: lab ? lab.textContent.trim() : '', marcada: cb ? cb.checked : null, estado: est ? est.textContent : '',
      // `innerText` não conta o que está escondido: é o que a pessoa vê
      salvoVisivel: (c.innerText.match(/Salvo neste navegador/g) || []).length,
      desfecho: d && !d.hidden ? d.textContent : '',
      botoesSalvar: Array.from(document.querySelectorAll('#t13 button')).filter(b => /Salvar/.test(b.textContent)).map(b => b.id) };
  });
  const lerCaixaDoBanco = (s) => s.p.pg.evaluate(async (pubkey) => { const db = await Db.abrir(pubkey); const site = await db.get('site', 'site'); db.fechar(); return site.messages; }, s.dono.pubkey);
  async function irAoInterruptor(pg) {
    await irAContatos(pg);
    await pg.click('#aba-onde');
    await pg.waitForSelector('#cartao-receber', { timeout: 10000 });
  }

  await it('D2–D5: marcar o interruptor GRAVA na hora — o rótulo diz a ação, o estado muda, só há um Salvar na aba, e sair e voltar não desmarca', async () => {
    const s = await sessao({ desligado: true });
    await irAoInterruptor(s.p.pg);
    const relays = await s.p.pg.evaluate(() => Array.from(document.querySelectorAll('#relays-caixa code')).map(c => c.textContent));
    assert(relays.length === 1, JSON.stringify(relays));
    const antes = await cartaoReceber(s.p.pg);
    assert(antes.rotulo === 'Receber mensagens pelo Nostr', 'o rótulo tem de dizer a AÇÃO (D2): ' + antes.rotulo);
    assert(/desligado/i.test(antes.estado) && antes.marcada === false, JSON.stringify(antes));
    assert(antes.salvoVisivel === 0, '"Salvo neste navegador" à vista antes de qualquer clique (D3): ' + antes.salvoVisivel);
    assert(antes.botoesSalvar.join() === 'salvar-contatos', 'só pode haver o Salvar dos contatos (D4): ' + antes.botoesSalvar.join());

    await s.p.pg.check('#receber-mensagens');
    const logo = await cartaoReceber(s.p.pg);
    assert(/ligado/i.test(logo.estado) && !/desligado/i.test(logo.estado), 'o estado não mudou ao marcar (D2): ' + logo.estado);
    // grava sem clicar em mais nada
    let m = null; const t0 = Date.now();
    while (Date.now() - t0 < 10000) { m = await lerCaixaDoBanco(s); if (m && m.enabled === true) break; await dormir(100); }
    assert(m && m.enabled === true && m.relays.length === 1, 'marcar não gravou (D4): ' + JSON.stringify(m));
    await s.p.pg.waitForFunction(() => { const d = document.getElementById('receber-desfecho'); return d && !d.hidden; }, null, { timeout: 10000 });
    const depois = await cartaoReceber(s.p.pg);
    assert(depois.salvoVisivel === 1 && /Só vale na rede depois de publicar/.test(depois.desfecho), 'depois de gravar tem de haver UM aviso de salvo (D3): ' + JSON.stringify(depois));

    // sair da aba e voltar NÃO desmarca (D5)
    await s.p.pg.evaluate(() => Shell.ir('t3'));
    await s.p.pg.waitForSelector('#t3', { timeout: 10000 });
    await irAoInterruptor(s.p.pg);
    const voltou = await cartaoReceber(s.p.pg);
    assert(voltou.marcada === true && /ligado/i.test(voltou.estado) && !/desligado/i.test(voltou.estado), 'sair e voltar desmarcou (D5): ' + JSON.stringify(voltou));
    await s.p.pg.close();
    return antes.estado + ' → ' + logo.estado + ' → (sai e volta) ' + voltou.estado;
  });

  await it('D9: num site JÁ PUBLICADO e sem outra alteração, ligar as mensagens acende o "Publicar" — antes ficava em "Nada a publicar" e o 10050 nunca ia à rede', async () => {
    const s = await sessao({ desligado: true });
    // a fotografia de uma publicação feita com este mesmo site: mesma assinatura, sem 10050
    await s.p.pg.evaluate(async (pubkey) => {
      const db = await Db.abrir(pubkey);
      const site = await db.get('site', 'site');
      await db.put('published', { manifest_event: null, manifest_event_id: null, created_at: 1, paths: {}, relays: {}, servers: {},
        metadata_events: { kind0: null, kind10002: null, kind10063: null, kind10050: null }, site_config: SiteJson.assinaturaSite(site) }, 'current');
      db.fechar();
      await Shell.atualizarBarra();
    }, s.dono.pubkey);
    const antes = await s.p.pg.evaluate(() => { const b = document.getElementById('btn-publicar'); return { t: b.textContent, d: b.disabled }; });
    assert(antes.d === true, 'o cenário de partida não é "nada a publicar": ' + JSON.stringify(antes));
    await irAoInterruptor(s.p.pg);
    await s.p.pg.check('#receber-mensagens');
    await s.p.pg.waitForFunction(() => { const b = document.getElementById('btn-publicar'); return b && !b.disabled; }, null, { timeout: 10000 });
    const depois = await s.p.pg.evaluate(() => document.getElementById('btn-publicar').textContent);
    assert(/\(1\)/.test(depois), depois);
    await s.p.pg.close();
    return antes.t + ' → ' + depois;
  });

  await it('D6: "Ligar as mensagens" leva ao interruptor À VISTA e com o foco nele', async () => {
    const s = await sessao({ desligado: true });
    await irAContatos(s.p.pg);
    await s.p.pg.click('#ir-ligar');
    await s.p.pg.waitForSelector('#receber-mensagens', { timeout: 10000 });
    await s.p.pg.waitForTimeout(200);
    const g = await s.p.pg.evaluate(() => {
      const r = document.getElementById('receber-mensagens').getBoundingClientRect();
      return { topo: Math.round(r.top), fundo: Math.round(r.bottom), janela: innerHeight, foco: document.activeElement && document.activeElement.id };
    });
    assert(g.topo >= 0 && g.fundo <= g.janela, 'o interruptor ficou fora da tela: ' + JSON.stringify(g));
    assert(g.foco === 'receber-mensagens', 'o foco não foi para o interruptor: ' + g.foco);
    await s.p.pg.close();
    return 'topo a ' + g.topo + ' px numa janela de ' + g.janela;
  });

  await it('D7: a T8 lista a caixa de entrada entre os eventos assinados — e não a lista com as mensagens desligadas', async () => {
    async function eventosDaT8(o) {
      const s = await sessao(o);
      await s.p.pg.evaluate(() => Shell.ir('t8'));
      await s.p.pg.waitForSelector('#t8-eventos', { timeout: 30000 });
      const t = await s.p.pg.evaluate(() => Array.from(document.querySelectorAll('#t8-eventos li')).map(x => x.textContent));
      await s.p.pg.close();
      return t;
    }
    const ligadas = await eventosDaT8(), desligadas = await eventosDaT8({ desligado: true });
    assert(ligadas.includes('Caixa de entrada das mensagens'), JSON.stringify(ligadas));
    assert(!desligadas.includes('Caixa de entrada das mensagens'), JSON.stringify(desligadas));
    return ligadas.join(' · ');
  });

  await it('D1 na prévia: ligar as mensagens faz a prévia do bloco mostrar o convite e a npub do site — e desligar tira', async () => {
    const s = await sessao({ desligado: true });
    await s.p.pg.evaluate(async (pubkey) => {
      const db = await Db.abrir(pubkey); const site = await db.get('site', 'site');
      site.contacts = [{ kind: 'email', value: 'contato@exemplo.org', label: '' }];
      await db.put('site', site, 'site'); db.fechar();
    }, s.dono.pubkey);
    await irAoInterruptor(s.p.pg);
    // ⚠️ O que o iframe CARREGOU, não o `srcdoc`: na primeira versão o `srcdoc` já
    // trazia o convite e o iframe continuava mostrando o documento antigo — o
    // `render()` recolocava o iframe na tela e só depois trocava o `srcdoc`.
    // Visto na captura; um caso que lesse só o `srcdoc` passava com o defeito.
    // O Playwright lê o documento do iframe mesmo com o sandbox de origem opaca.
    const previa = async () => {
      const el = await s.p.pg.$('#contatos-previa');
      const fr = el && await el.contentFrame();
      let texto = '';
      try { texto = fr ? await fr.evaluate(() => document.body ? document.body.innerText : '') : ''; } catch (e) { texto = ''; }
      const srcdoc = await s.p.pg.evaluate(() => document.getElementById('contatos-previa').srcdoc);
      return { convite: /Mande uma mensagem privada/.test(texto), email: texto.indexOf('contato@exemplo.org') !== -1, srcdoc: srcdoc, texto: texto };
    };
    const antes = await previa();
    await s.p.pg.check('#receber-mensagens');
    const ligou = await esperarNode(async () => (await previa()).convite, 10000);
    const depois = await previa();
    await s.p.pg.uncheck('#receber-mensagens');
    const desligou = await esperarNode(async () => !(await previa()).convite, 10000);
    await s.p.pg.close();
    assert(antes.email && !antes.convite, 'antes de ligar: ' + JSON.stringify({ email: antes.email, convite: antes.convite }));
    assert(ligou && depois.email && depois.srcdoc.indexOf('href="nostr:' + s.dono.npub + '"') !== -1, 'a prévia não mostrou o convite depois de ligar');
    assert(desligou, 'a prévia continuou convidando depois de desligar');
  });

  await it('com as mensagens ligadas, publicar leva o kind 10050 à rede — e ele traz os relays da caixa', async () => {
    const s = await sessao();
    const r = await s.p.pg.evaluate(async ([pubkey]) => {
      const db = await Db.abrir(pubkey);
      const site = await db.get('site', 'site');
      const dados = { site: site, pages: await db.getAll('pages'), posts: await db.getAll('posts'), media: await db.getAll('media') };
      db.fechar();
      const gerado = await Gerador.gerarSite(dados);
      const plano = Publicar.planear({ dados: dados, gerado: gerado, published: null });
      return { kind10050: plano.eventos.kind10050, modelo: Mensagens.modeloCaixa(site.messages.relays) };
    }, [s.dono.pubkey]);
    assert(r.kind10050 === true, 'com as mensagens ligadas o 10050 tem de entrar no plano');
    assert(r.modelo.kind === 10050 && r.modelo.tags.length === 1 && r.modelo.tags[0][0] === 'relay', JSON.stringify(r.modelo));
    await s.p.pg.close();
    return 'kind 10050 no plano, com ' + r.modelo.tags.length + ' relay';
  });

  await it('quem NUNCA ligou as mensagens não publica 10050 nenhum — nem um vazio', async () => {
    const s = await sessao({ desligado: true });
    const r = await s.p.pg.evaluate(async ([pubkey]) => {
      const db = await Db.abrir(pubkey);
      const site = await db.get('site', 'site');
      const dados = { site: site, pages: await db.getAll('pages'), posts: await db.getAll('posts'), media: await db.getAll('media') };
      db.fechar();
      const gerado = await Gerador.gerarSite(dados);
      const plano = Publicar.planear({ dados: dados, gerado: gerado, published: null });
      return plano.eventos.kind10050;
    }, [s.dono.pubkey]);
    assert(r === false, 'publicou uma caixa de entrada vazia para um site que nunca ligou as mensagens');
    await s.p.pg.close();
  });

  // ==== desligar retira a caixa da rede (decisão de 2026-09-14) ====
  // Antes, desmarcar só gravava no banco: a caixa ficava na rede, o convite nas
  // páginas, o contador apagado — e a faixa dizia que pedia a remoção.
  const fotografiaCom = (s, comCaixa) => s.p.pg.evaluate(async ([pubkey, comCaixa]) => {
    const db = await Db.abrir(pubkey);
    const site = await db.get('site', 'site');
    const caixa = comCaixa ? { kind: 10050, created_at: 1, pubkey: pubkey, tags: site.messages.relays.map(u => ['relay', u]), content: '' } : null;
    await db.put('published', { manifest_event: null, manifest_event_id: null, created_at: 1, paths: {}, relays: {}, servers: {},
      metadata_events: { kind0: null, kind10002: null, kind10063: null, kind10050: caixa }, site_config: SiteJson.assinaturaSite(site) }, 'current');
    db.fechar();
    await Shell.atualizarBarra();
  }, [s.dono.pubkey, comCaixa]);
  const botaoPublicar = (pg) => pg.evaluate(() => { const b = document.getElementById('btn-publicar'); return { t: b.textContent, d: b.disabled }; });
  const faixaVisivel = (pg) => pg.evaluate(() => { const f = document.getElementById('faixa'); return f && !f.hidden ? f.textContent : ''; });

  await it('desligar num site com a caixa JÁ PUBLICADA acende o "Publicar", a faixa diz o que acontece de fato, e a T8 lista o aviso de desligada', async () => {
    const s = await sessao();
    await fotografiaCom(s, true);
    const antes = await botaoPublicar(s.p.pg);
    assert(antes.d === true, 'o cenário de partida não é "nada a publicar": ' + JSON.stringify(antes));
    await irAoInterruptor(s.p.pg);
    await s.p.pg.uncheck('#receber-mensagens');
    await s.p.pg.waitForFunction(() => { const b = document.getElementById('btn-publicar'); return b && !b.disabled; }, null, { timeout: 10000 });
    const depois = await botaoPublicar(s.p.pg);
    assert(/\(1\)/.test(depois.t), depois.t);
    let faixa = ''; const t0 = Date.now();
    while (Date.now() - t0 < 5000 && !faixa) { faixa = await faixaVisivel(s.p.pg); if (!faixa) await dormir(100); }
    assert(/não recebe mais mensagens/.test(faixa) && /outros continuam/.test(faixa) && !/pede a remoção/.test(faixa), 'a faixa tem de dizer o que desligar faz, sem prometer demais: ' + faixa);
    await s.p.pg.evaluate(() => Shell.ir('t8'));
    await s.p.pg.waitForSelector('#t8-eventos', { timeout: 30000 });
    const eventos = await s.p.pg.evaluate(() => Array.from(document.querySelectorAll('#t8-eventos li')).map(x => x.textContent));
    await s.p.pg.close();
    assert(eventos.includes('Aviso de que o site não recebe mais mensagens') && !eventos.includes('Caixa de entrada das mensagens'), JSON.stringify(eventos));
    return antes.t + ' → ' + depois.t + ' · ' + eventos.join(' · ');
  });

  await it('desligar SEM caixa publicada: nada a retirar — o "Publicar" volta a apagar e a faixa não aparece', async () => {
    const s = await sessao();
    await fotografiaCom(s, false);
    const ligada = await botaoPublicar(s.p.pg);
    assert(ligada.d === false, 'ligada e nunca publicada, a caixa tem de estar por publicar: ' + JSON.stringify(ligada));
    await irAoInterruptor(s.p.pg);
    await s.p.pg.uncheck('#receber-mensagens');
    await s.p.pg.waitForFunction(() => { const b = document.getElementById('btn-publicar'); return b && b.disabled; }, null, { timeout: 10000 });
    await dormir(1000);
    const faixa = await faixaVisivel(s.p.pg);
    await s.p.pg.close();
    assert(faixa === '', 'sem caixa na rede, a faixa não tem nada a avisar: ' + faixa);
  });

  await it('nenhuma nsec no DOM, no banco, na URL ou no armazenamento, com a tela inteira usada', async () => {
    const s = await sessao();
    await irAContatos(s.p.pg);
    await verificar(s.p.pg);
    await s.p.pg.evaluate(() => document.querySelectorAll('#lista-conversas li.conversa')[0].querySelector('.abrir-conversa').click());
    await s.p.pg.waitForSelector('#mensagens-da-conversa', { timeout: 10000 });
    const v = await varrer(s.p.pg, s.dono.nsec);
    assert(v.achados.length === 0, JSON.stringify(v.achados));
    assert(s.p.erros.length === 0 && s.p.consoleErros.length === 0, JSON.stringify({ pageerror: s.p.erros, console: s.p.consoleErros }));
    await s.p.pg.screenshot({ path: u.captura('t13-contatos'), fullPage: true });
    await s.p.pg.close();
    return 'varredura limpa';
  });

  // ==== aba "Onde me encontrar" — os oito campos (Etapa 2) =================

  async function irAOnde(pg) {
    await irAContatos(pg);
    await pg.click('#aba-onde');
    await pg.waitForSelector('#cartao-contatos', { timeout: 10000 });
  }
  // Preenche a linha `i` com um canal e um valor, como o dono faria.
  async function preencher(pg, i, kind, valor) {
    await pg.selectOption('.contato-item:nth-of-type(' + (i + 1) + ') .contato-canal', kind);
    await pg.fill('.contato-item:nth-of-type(' + (i + 1) + ') .contato-valor', valor);
  }

  await it('a aba oferece os oito canais, e cada um traz o seu aviso de privacidade', async () => {
    const s = await sessao();
    await irAOnde(s.p.pg);
    await s.p.pg.click('#acrescentar-contato');
    await s.p.pg.waitForSelector('.contato-item', { timeout: 10000 });
    const r = await s.p.pg.evaluate(() => ({
      canais: Array.from(document.querySelectorAll('.contato-item .contato-canal option')).map(o => o.value),
      aviso: (document.querySelector('.contato-aviso') || {}).textContent || ''
    }));
    assert(r.canais.join(',') === 'email,whatsapp,telegram,instagram,x,nostr,signal,link', r.canais.join(','));
    assert(/robôs de spam/.test(r.aviso), 'o aviso do e-mail tem de estar à vista: ' + r.aviso.slice(0, 80));
    // o aviso do WhatsApp é o que mais importa: o número é o telefone dele
    await preencher(s.p.pg, 0, 'whatsapp', '');
    const avisoWa = await s.p.pg.textContent('.contato-aviso');
    assert(/torna o seu telefone público/.test(avisoWa), avisoWa.slice(0, 100));
    await s.p.pg.close();
    return r.canais.length + ' canais, com aviso por canal';
  });

  await it('o que o dono escreve vira o link certo, e o endereço inválido é dito na hora — sem recusar o que ele digitou', async () => {
    const s = await sessao();
    await irAOnde(s.p.pg);
    await s.p.pg.click('#acrescentar-contato');
    await preencher(s.p.pg, 0, 'whatsapp', '+55 (11) 99999-9999');
    await s.p.pg.click('#salvar-contatos');
    await s.p.pg.waitForFunction(() => { const d = document.getElementById('contatos-desfecho'); return d && !d.hidden; }, null, { timeout: 10000 });
    const guardado = await s.p.pg.evaluate(async (pubkey) => {
      const db = await Db.abrir(pubkey);
      const site = await db.get('site', 'site');
      db.fechar();
      return site.contacts;
    }, s.dono.pubkey);
    assert(guardado.length === 1 && guardado[0].kind === 'whatsapp' && guardado[0].value === '5511999999999', JSON.stringify(guardado));

    // agora um errado: o campo NÃO é limpo (seria apagar o que ele escreveu),
    // mas a tela diz que aquilo não serve
    await s.p.pg.click('#acrescentar-contato');
    await preencher(s.p.pg, 1, 'email', 'isto nao e um email');
    await s.p.pg.waitForFunction(() => {
      const e = document.querySelectorAll('.contato-item')[1].querySelector('.contato-erro');
      return e && !e.hidden;
    }, null, { timeout: 5000 });
    const aindaLa = await s.p.pg.inputValue('.contato-item:nth-of-type(2) .contato-valor');
    assert(aindaLa === 'isto nao e um email', 'o campo não pode ser limpo por baixo do dedo: ' + aindaLa);
    await s.p.pg.close();
    return 'link montado a partir do dado';
  });

  await it('salvar o que não é válido não engole nada em silêncio: a tela diz quantos ficaram de fora', async () => {
    const s = await sessao();
    await irAOnde(s.p.pg);
    await s.p.pg.click('#acrescentar-contato');
    await preencher(s.p.pg, 0, 'email', 'nao vale');
    await s.p.pg.click('#salvar-contatos');
    await s.p.pg.waitForFunction(() => { const d = document.getElementById('contatos-desfecho'); return d && !d.hidden; }, null, { timeout: 10000 });
    const t = await s.p.pg.textContent('#contatos-desfecho');
    assert(/1 não foram salvos/.test(t), t);
    await s.p.pg.close();
    return 'o que não passou é dito';
  });

  await it('a prévia mostra o bloco como sai no site, num iframe isolado (sem allow-same-origin)', async () => {
    const s = await sessao();
    await irAOnde(s.p.pg);
    await s.p.pg.click('#acrescentar-contato');
    await preencher(s.p.pg, 0, 'email', 'contato@exemplo.org');
    await s.p.pg.waitForFunction(() => {
      const f = document.getElementById('contatos-previa');
      return f && f.srcdoc && f.srcdoc.indexOf('class="contatos"') !== -1;
    }, null, { timeout: 10000 });
    const r = await s.p.pg.evaluate(() => {
      const f = document.getElementById('contatos-previa');
      return { sandbox: f.getAttribute('sandbox'), srcdoc: f.srcdoc };
    });
    assert(r.sandbox === 'allow-scripts', 'o iframe da prévia tem de ser de origem opaca: ' + r.sandbox);
    assert(r.srcdoc.indexOf('href="mailto:contato@exemplo.org"') !== -1, 'a prévia tem de mostrar o link real');
    assert(r.srcdoc.indexOf('<style>') !== -1, 'a prévia tem de trazer o CSS do tema embutido');
    await s.p.pg.close();
    return 'prévia isolada e com o link real';
  });

  await it('o endereço Nostr deste site entra num clique, e sai em dobro — link e texto para copiar', async () => {
    const s = await sessao();
    await irAOnde(s.p.pg);
    await s.p.pg.click('#acrescentar-contato');
    await s.p.pg.selectOption('.contato-item:nth-of-type(1) .contato-canal', 'nostr');
    await s.p.pg.click('.usar-minha-npub');
    await s.p.pg.waitForFunction(() => {
      const f = document.getElementById('contatos-previa');
      return f && f.srcdoc && f.srcdoc.indexOf('nostr:npub1') !== -1;
    }, null, { timeout: 10000 });
    const r = await s.p.pg.evaluate(() => ({
      valor: document.querySelector('.contato-valor').value,
      srcdoc: document.getElementById('contatos-previa').srcdoc
    }));
    assert(r.valor === s.dono.npub, 'o botão tem de pôr a npub deste site: ' + r.valor);
    assert(r.srcdoc.indexOf('href="nostr:' + s.dono.npub + '"') !== -1, 'falta o link nostr:');
    assert(r.srcdoc.indexOf('<code class="contato-codigo">' + s.dono.npub + '</code>') !== -1, 'falta a npub escrita para copiar');
    await s.p.pg.close();
    return 'npub em link e em texto';
  });

  await it('o contador de "Publicar" acende quando um contato entra — ao contrário do que acontece com mensagem que chega', async () => {
    const s = await sessao();
    await irAOnde(s.p.pg);
    await s.p.pg.click('#acrescentar-contato');
    await preencher(s.p.pg, 0, 'email', 'contato@exemplo.org');
    await s.p.pg.click('#salvar-contatos');
    await s.p.pg.waitForFunction(() => { const d = document.getElementById('contatos-desfecho'); return d && !d.hidden; }, null, { timeout: 10000 });
    const r = await s.p.pg.evaluate(async (pubkey) => {
      const db = await Db.abrir(pubkey);
      const site = await db.get('site', 'site');
      const dados = { site: site, pages: await db.getAll('pages'), posts: await db.getAll('posts'), media: await db.getAll('media') };
      const published = await db.get('published', 'current');
      db.fechar();
      // a pergunta que o contador faz: a configuração mudou em relação ao publicado?
      const fingePublicado = { site_config: SiteJson.assinaturaSite(Object.assign({}, site, { contacts: [] })) };
      return { mudou: SiteJson.assinaturaSite(site) !== fingePublicado.site_config,
        noJson: SiteJson.escrever(dados).indexOf('"contacts"') !== -1, published: !!published };
    }, s.dono.pubkey);
    assert(r.mudou, 'preencher um contato tem de contar como configuração alterada');
    assert(r.noJson, 'o contato tem de viajar no site.json');
    await s.p.pg.close();
    return 'configuração alterada e no site.json';
  });

  await it('o botão "Contatos" da barra do editor escreve o bloco em linha própria', async () => {
    const s = await sessao();
    await s.p.pg.evaluate(async (pubkey) => {
      const db = await Db.abrir(pubkey);
      const site = await db.get('site', 'site');
      site.contacts = [{ kind: 'email', value: 'contato@exemplo.org', label: '' }];
      await db.put('site', site, 'site');
      db.fechar();
    }, s.dono.pubkey);
    await s.p.pg.click('#menu .item[data-tela="t4"]');
    await s.p.pg.waitForSelector('#t4', { timeout: 10000 });
    await s.p.pg.click('#novo-registro');
    await s.p.pg.waitForSelector('#editor[data-tipo="page"]', { timeout: 10000 });
    await s.p.pg.fill('#ed-titulo', 'Fale comigo');
    await s.p.pg.fill('#ed-corpo', 'Primeira linha.');
    await s.p.pg.evaluate(() => { const t = document.getElementById('ed-corpo'); t.focus(); t.setSelectionRange(t.value.length, t.value.length); });
    await s.p.pg.click('.ferramenta[data-acao="contatos"]');
    await s.p.pg.waitForSelector('#contatos-confirmar', { timeout: 10000 });
    await s.p.pg.fill('#contatos-titulo', 'Fale comigo');
    await s.p.pg.click('#contatos-confirmar');
    await s.p.pg.waitForFunction(() => document.getElementById('ed-corpo').value.indexOf('[[contatos') !== -1, null, { timeout: 10000 });
    const corpo = await s.p.pg.inputValue('#ed-corpo');
    assert(corpo === 'Primeira linha.\n\n[[contatos: Fale comigo]]', JSON.stringify(corpo));
    await s.p.pg.close();
    return 'marcador em linha própria';
  });

  // ==== ao vivo (14 T13 decisão 26, 2026-09-14) ============================
  // O servidor falso empurra às assinaturas abertas o que casar com o filtro,
  // como o auth.nostr1.com e o nos.lol fizeram na medição real do mesmo dia.
  const linhasAgora = (pg) => pg.evaluate(() => document.querySelectorAll('#lista-conversas li.conversa').length);
  const estadoEscuta = (pg) => pg.evaluate(() => { const e = document.getElementById('escuta-estado'); return e ? { estado: e.getAttribute('data-estado'), texto: e.textContent } : null; });
  async function esperarNode(cond, ms) {
    const t0 = Date.now();
    while (Date.now() - t0 < (ms || 10000)) { if (await cond()) return true; await dormir(100); }
    return false;
  }
  const recebendo = async (pg) => ((await estadoEscuta(pg)) || {}).estado === 'recebendo';

  await it('ao abrir, a aba Mensagens VERIFICA SOZINHA — sem clique — e passa a receber em tempo real, com o aviso do preço à vista', async () => {
    const s = await sessao();
    await irAContatos(s.p.pg);
    const chegou = await esperarNode(async () => (await linhasAgora(s.p.pg)) === 2, 20000);
    assert(chegou, 'a aba não verificou sozinha: ' + (await linhasAgora(s.p.pg)) + ' conversas');
    const relogio = await s.p.pg.textContent('#verificacao-quando');
    assert(/Última verificação às \d\d:\d\d/.test(relogio), relogio);
    assert(await esperarNode(() => recebendo(s.p.pg), 10000), 'a escuta não chegou a "recebendo": ' + JSON.stringify(await estadoEscuta(s.p.pg)));
    const g = await s.p.pg.evaluate(() => ({ estado: document.getElementById('escuta-estado').textContent, aviso: (document.getElementById('aviso-escuta') || {}).textContent || '' }));
    assert(/Recebendo em tempo real/.test(g.estado), g.estado);
    assert(/em 1 de 1 relays da sua caixa de entrada/.test(g.estado), 'a linha não diz em quantos relays está recebendo: ' + g.estado);
    assert(/sabem que o painel está aberto/.test(g.aviso) && /Tor/.test(g.aviso), 'falta o aviso honesto: ' + g.aviso);
    assert(await esperarNode(async () => f.assinaturasAbertas(s.relay) === 1, 3000), 'assinaturas abertas no relay da caixa: ' + f.assinaturasAbertas(s.relay));
    await s.p.pg.close();
    return g.estado;
  });

  await it('um relay da caixa FALHA e o outro recebe: a linha diz "1 de 2", e não uma frase que faz crer que chega de todos', async () => {
    const recusa = 't13recusa-' + Math.random().toString(36).slice(2, 8);
    f.relay(recusa, { modo: 'recusa' });
    const s = await sessao({ relaysExtra: [f.ws(recusa)] });
    await irAContatos(s.p.pg);
    const disse = await esperarNode(async () => /em 1 de 2 relays da sua caixa de entrada/.test(((await estadoEscuta(s.p.pg)) || {}).texto || ''), 20000);
    const e = await estadoEscuta(s.p.pg);
    await s.p.pg.close();
    assert(disse, 'a linha não contou o relay que falhou: ' + JSON.stringify(e));
    assert(e.estado === 'recebendo', 'com um relay recebendo, o estado devia ser "recebendo": ' + e.estado);
    return e.texto;
  });

  await it('⚠️ chega SEM CLIQUE: a mensagem nova aparece sozinha — e o envelope vem datado de 36 h atrás, o caso que uma escuta com `since = agora` perderia', async () => {
    const s = await sessao();
    await irAContatos(s.p.pg);
    await esperarNode(() => recebendo(s.p.pg), 20000);
    const agora = Math.floor(Date.now() / 1000);
    const nova = F.mensagem(F.chave(), s.dono.pubkey, { content: 'Oi! Cheguei ao vivo.', created_at: agora, envelopeEm: agora - 36 * 3600 });
    const entregas = f.empurrar(s.relay, [nova.envelope]);
    const apareceu = await esperarNode(async () => (await linhasAgora(s.p.pg)) === 3, 10000);
    const l = await linhas(s.p.pg);
    await s.p.pg.close();
    assert(entregas >= 1, 'o servidor falso não tinha assinatura aberta para entregar');
    assert(apareceu && l[0].previa === 'Oi! Cheguei ao vivo.', 'a mensagem não apareceu sozinha: ' + JSON.stringify(l.map(x => x.previa)));
    return entregas + ' entrega · ' + l.length + ' conversas';
  });

  await it('o RASCUNHO da resposta sobrevive a uma mensagem que chega: o texto fica, e o foco e o cursor também', async () => {
    const s = await sessao();
    await irAContatos(s.p.pg);
    await esperarNode(() => recebendo(s.p.pg), 20000);
    await s.p.pg.evaluate(() => document.querySelectorAll('#lista-conversas li.conversa')[0].querySelector('.abrir-conversa').click());
    await s.p.pg.waitForSelector('#resposta', { timeout: 10000 });
    await s.p.pg.click('#resposta');
    await s.p.pg.keyboard.type('Estou escrevendo com calma');
    const contar = () => s.p.pg.evaluate(() => document.querySelectorAll('#mensagens-da-conversa li').length);
    const antes = await contar();
    const deAnaDeNovo = F.mensagem(s.ana, s.dono.pubkey, { content: 'mais uma, enquanto você escreve', created_at: Math.floor(Date.now() / 1000) });
    f.empurrar(s.relay, [deAnaDeNovo.envelope]);
    const chegou = await esperarNode(async () => (await contar()) === antes + 1, 10000);
    const g = await s.p.pg.evaluate(() => ({ valor: document.getElementById('resposta').value, foco: document.activeElement && document.activeElement.id }));
    await s.p.pg.keyboard.type('!');
    const continuou = await s.p.pg.inputValue('#resposta');
    await s.p.pg.close();
    assert(chegou, 'a mensagem nova não entrou na conversa aberta');
    assert(g.valor === 'Estou escrevendo com calma', 'o rascunho sumiu: ' + JSON.stringify(g.valor));
    assert(g.foco === 'resposta', 'o foco saiu do campo: ' + g.foco);
    assert(continuou === 'Estou escrevendo com calma!', 'o cursor não ficou onde estava: ' + JSON.stringify(continuou));
  });

  await it('sair da aba FECHA a conexão (outra tela ou a aba ao lado); a T3 não se conecta a nada; e com as mensagens desligadas nada se conecta', async () => {
    const s = await sessao();
    // (1) a sessão passa pela T2 e pela T3 sem tocar no relay da caixa
    await s.p.pg.evaluate(() => Shell.ir('t3'));
    await s.p.pg.waitForSelector('#cartao-mensagens', { timeout: 10000 });
    await dormir(800);
    const naT3 = f.estado.relays.get(s.relay).conexoes || 0;
    // (2) abrir a aba liga; ir à T3 fecha
    await irAContatos(s.p.pg);
    await esperarNode(async () => f.assinaturasAbertas(s.relay) === 1 && await recebendo(s.p.pg), 20000);
    const aberta = f.ligacoesAbertas(s.relay);
    await s.p.pg.evaluate(() => Shell.ir('t3'));
    const fechouT3 = await esperarNode(async () => f.ligacoesAbertas(s.relay) === 0, 5000);
    // (3) voltar liga de novo; ir à aba "Onde me encontrar" fecha
    await irAContatos(s.p.pg);
    await esperarNode(async () => f.ligacoesAbertas(s.relay) >= 1 && await recebendo(s.p.pg), 20000);
    await s.p.pg.click('#aba-onde');
    const fechouAba = await esperarNode(async () => f.ligacoesAbertas(s.relay) === 0, 5000);
    await s.p.pg.close();
    assert(naT3 === 0, 'a T3 abriu ' + naT3 + ' conexão(ões) com o relay da caixa');
    assert(aberta >= 1 && fechouT3, 'ir à T3 não fechou a conexão: ' + f.ligacoesAbertas(s.relay));
    assert(fechouAba, 'ir à aba "Onde me encontrar" não fechou a conexão');
    // (4) desligadas: abrir a aba não liga nada
    const d = await sessao({ desligado: true });
    await irAContatos(d.p.pg);
    await dormir(1500);
    const conexoes = f.estado.relays.get(d.relay).conexoes || 0;
    const temEstado = await d.p.pg.evaluate(() => !!document.getElementById('escuta-estado'));
    await d.p.pg.close();
    assert(conexoes === 0 && !temEstado, 'com as mensagens desligadas a aba se conectou ao relay: ' + conexoes + ' conexão(ões)');
    return 'T3: ' + naT3 + ' conexões · aberta: ' + aberta + ' · fecha ao sair: sim';
  });

  await it('a conexão caiu (o que o auth.nostr1.com faz aos 300 s sem tráfego): a tela diz "sem conexão", religa sozinha e volta a receber', async () => {
    const s = await sessao();
    await irAContatos(s.p.pg);
    await esperarNode(() => recebendo(s.p.pg), 20000);
    // cada estado que o parágrafo mostrar, registrado na própria página
    await s.p.pg.evaluate(() => {
      window.__estados = [];
      const e = document.getElementById('escuta-estado');
      new MutationObserver(() => window.__estados.push(e.getAttribute('data-estado'))).observe(e, { attributes: true, childList: true, characterData: true, subtree: true });
    });
    f.derrubar(s.relay);
    const ler = () => s.p.pg.evaluate(() => window.__estados.slice());
    const voltou = await esperarNode(async () => { const v = await ler(); return v.includes('sem_conexao') && v[v.length - 1] === 'recebendo'; }, 15000);
    const estados = await ler();
    const textoSemConexao = await s.p.pg.evaluate(() => Textos.t13.mensagens.escuta.semConexao);
    const nova = F.mensagem(F.chave(), s.dono.pubkey, { content: 'depois da queda', created_at: Math.floor(Date.now() / 1000) });
    f.empurrar(s.relay, [nova.envelope]);
    const chegou = await esperarNode(async () => (await linhasAgora(s.p.pg)) === 3, 10000);
    await s.p.pg.close();
    assert(/Sem conexão/.test(textoSemConexao), textoSemConexao);
    assert(voltou, 'não disse "sem conexão" e voltou a receber: ' + JSON.stringify(estados));
    assert(chegou, 'depois de religar, a mensagem nova não chegou');
    return Array.from(new Set(estados)).join(' → ');
  });

  await it('D8 (o caso do Tails): banco vazio e site na rede com a caixa publicada → a T2 religa as mensagens, e a aba verifica e recebe sozinha', async () => {
    const dono = F.chave(), ana = F.chave();
    const sufixo = Math.random().toString(36).slice(2, 8);
    const caixa = 't13d8caixa-' + sufixo, pub = 't13d8pub-' + sufixo;
    const sj = F.siteExemplo(dono, { servers: [f.base] });
    f.blob(sj.bytes, 'application/json');
    f.relay(pub, { modo: 'ok', eventos: [F.manifest(dono, { paths: F.pathsDoExemplo(sj), servers: [f.base] }), F.caixaDeEntrada(dono, [f.ws(caixa)])] });
    f.relay(caixa, { modo: 'ok', eventos: [F.mensagem(ana, dono.pubkey, { content: 'Mensagem que só a rede tem.' }).envelope] });
    const p = await abrir(ctx, u.url);
    // o banco vazio só conhece os relays e o servidor (é o que T7 → Avançado faria)
    await semearSite(p.pg, dono, { relays: [f.ws(pub)], servers: [f.base] });
    await entrarCom(p.pg, dono.nsec);
    const t2 = await esperarT2(p.pg, 30000);
    await irAContatos(p.pg);
    const chegou = await esperarNode(async () => (await linhasAgora(p.pg)) === 1, 20000);
    const g = await p.pg.evaluate(() => ({ desligado: !!document.getElementById('mensagens-desligado'), previa: (document.querySelector('#lista-conversas .conversa-previa') || {}).textContent || '' }));
    const escuta = await estadoEscuta(p.pg);
    await p.pg.close();
    assert(t2.tela === 't3', 'a T2 não carregou o site: ' + JSON.stringify(t2));
    assert(!g.desligado, '⚠️ as mensagens apareceram DESLIGADAS com a caixa publicada na rede (D8)');
    assert(chegou && g.previa === 'Mensagem que só a rede tem.', JSON.stringify(g));
    return 'escuta: ' + (escuta && escuta.estado);
  });

  // ==== escrever para alguém (2026-09-25) ==================================
  // Começar uma conversa com quem nunca escreveu para o site. O caso difícil é o
  // de verdade: a caixa de entrada dela NÃO está nos nossos relays — só a lista
  // de relays dela (10002) está, e é ela que diz onde procurar.

  // A Clara: a lista dela no relay da caixa do site; a caixa dela só num relay
  // DELA, que pede identificação ao ligar (e deixa ler sem ela).
  function clara(s) {
    const ch = F.chave(), sufixo = Math.random().toString(36).slice(2, 8);
    const escreve = 't13clara-escreve-' + sufixo, caixa = 't13clara-caixa-' + sufixo;
    const pEscreve = f.relay(escreve, { modo: 'ok', auth: 'escrever', eventos: [F.caixaDeEntrada(ch, [f.ws(caixa)])] });
    f.relay(caixa, { modo: 'ok', escrita: 'aceita', eventos: [] });
    f.semear(s.relay, [F.relayList(ch, [f.ws(escreve)])]);
    return { ch, escreve, caixa, pEscreve };
  }
  async function abrirCartaoNova(pg) {
    await pg.click('#escrever-para-alguem');
    await pg.waitForSelector('#cartao-nova', { timeout: 10000 });
  }
  const desfechoNova = (pg) => pg.evaluate(() => { const d = document.getElementById('nova-desfecho'); return d && !d.hidden ? d.textContent : ''; });

  await it('⚠️ escrever para quem NUNCA escreveu, com a caixa dela só nos relays DELA: sai, a conversa abre com o placar, e na lista vira uma linha só com a mensagem do dono', async () => {
    const s = await sessao();
    const c = clara(s);
    await irAContatos(s.p.pg);
    await verificar(s.p.pg);
    const meusAntes = f.publicadosEm(s.relay).filter(e => e.kind === 1059).length;
    await abrirCartaoNova(s.p.pg);
    const avisos = await s.p.pg.evaluate(() => document.getElementById('cartao-nova').textContent);
    assert(/assinada pelo seu site/.test(avisos) && /fora do Tor, veem/.test(avisos), 'faltam os avisos no cartão: ' + avisos);
    await s.p.pg.fill('#nova-endereco', 'nostr:' + c.ch.npub);      // como muitos aplicativos copiam
    await s.p.pg.fill('#nova-mensagem', 'Olá! Vi o seu trabalho e queria conversar.');
    await s.p.pg.screenshot({ path: u.captura('t13-escrever'), fullPage: true });
    // O piso do painel (600 px, a suíte piso_painel) mede a aba com o cartão
    // FECHADO; aberto e com a npub inteira no campo, também não pode rolar para o lado.
    const tamanho = s.p.pg.viewportSize();
    await s.p.pg.setViewportSize({ width: 600, height: 600 });
    const piso = await s.p.pg.evaluate(() => ({ cw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth }));
    await s.p.pg.setViewportSize(tamanho);
    assert(piso.sw <= piso.cw, 'o cartão aberto estoura a 600 px: ' + JSON.stringify(piso));
    // DUPLO clique, de propósito: só pode sair UM envelope (a conta vem abaixo).
    await s.p.pg.dblclick('#enviar-nova');
    await s.p.pg.waitForFunction(() => document.querySelectorAll('#mensagens-da-conversa li.minha').length === 1, null, { timeout: 30000 });
    const g = await s.p.pg.evaluate(() => ({
      titulo: (document.querySelector('#lista-conversas > h2') || {}).textContent || '',
      desfecho: (document.getElementById('resposta-desfecho') || {}).textContent || '',
      corpo: (document.querySelector('#mensagens-da-conversa li.minha .corpo') || {}).textContent || '',
      cartao: !!document.getElementById('cartao-nova'),
      botao: !!document.getElementById('escrever-para-alguem'),
      // dentro da conversa o bloco some (a ação ali é responder)
      escondido: document.getElementById('nova-conversa').hidden === true,
      resposta: !!document.getElementById('resposta')
    }));
    const npubCurta = await s.p.pg.evaluate((npub) => Chave.abreviar(npub), c.ch.npub);
    assert(g.titulo === npubCurta, 'a conversa aberta não é a da Clara: ' + g.titulo);
    assert(/Enviada a 1 de 1 relays/.test(g.desfecho), 'placar: ' + g.desfecho);
    assert(g.corpo === 'Olá! Vi o seu trabalho e queria conversar.', g.corpo);
    assert(!g.cartao && g.botao && g.escondido && g.resposta, 'depois de enviar: ' + JSON.stringify(g));
    // o envelope dela foi para a caixa DELA; a cópia, para a do site
    const dela = f.publicadosEm(c.caixa).filter(e => e.kind === 1059);
    assert(dela.length === 1 && dela[0].tags.some(t => t[0] === 'p' && t[1] === c.ch.pubkey), 'envelopes na caixa dela (com um duplo clique): ' + dela.length);
    assert(f.publicadosEm(s.relay).filter(e => e.kind === 1059).length === meusAntes + 1, 'a cópia do dono não foi para a caixa do site');
    // controle e medida: o relay dela pediu identificação, e o painel não deu
    assert((c.pEscreve.desafios || []).length >= 1, 'o relay dela nem pediu identificação — o caso não mede nada');
    assert(f.identificadosEm(c.escreve).length === 0, '⚠️ o painel se identificou ao relay de um estranho');
    const v = await varrer(s.p.pg, s.dono.nsec);
    assert(v.achados.length === 0, JSON.stringify(v.achados));
    // na lista, a conversa que só tem a mensagem do dono é uma linha como as outras
    await s.p.pg.click('#voltar-lista');
    const l = await linhas(s.p.pg);
    const deVolta = await s.p.pg.isVisible('#escrever-para-alguem');
    const erros = { pageerror: s.p.erros, console: s.p.consoleErros };
    await s.p.pg.close();
    const daClara = l.find(x => x.npub === c.ch.npub);
    assert(l.length === 3 && daClara && daClara.previa === 'Olá! Vi o seu trabalho e queria conversar.', JSON.stringify(l));
    assert(l[0].npub === c.ch.npub, 'a conversa nova (a mais recente) não veio primeiro: ' + JSON.stringify(l.map(x => x.npub.slice(0, 12))));
    assert(deVolta, 'de volta à lista, o "Escrever para alguém" não reapareceu');
    assert(erros.pageerror.length === 0 && erros.console.length === 0, JSON.stringify(erros));
    return g.desfecho;
  });

  await it('o endereço é conferido: inválido, o do próprio site, o de quem está bloqueado e o de quem não publicou caixa nenhuma NÃO saem — o texto fica, e Cancelar descarta', async () => {
    const s = await sessao();
    await irAContatos(s.p.pg);
    await verificar(s.p.pg);
    // a lista com o botão FECHADO — o estado em que ele colava na barra dos filtros
    await s.p.pg.screenshot({ path: u.captura('t13-lista'), fullPage: true });
    // bloqueia o Bento pela tela (a segunda linha); nas "Ativas" sobra a Ana
    await s.p.pg.evaluate(() => Array.from(document.querySelectorAll('#lista-conversas li.conversa')[1].querySelectorAll('button')).find(b => b.textContent === 'Bloquear').click());
    await s.p.pg.waitForFunction(() => document.querySelectorAll('#lista-conversas li.conversa').length === 1, null, { timeout: 10000 });
    const antes = f.publicadosEm(s.relay).filter(e => e.kind === 1059).length;
    await abrirCartaoNova(s.p.pg);
    await s.p.pg.fill('#nova-mensagem', 'texto que não pode sumir');
    // enquanto digita: o erro aparece com o endereço cortado, e não com o campo vazio
    await s.p.pg.fill('#nova-endereco', s.ana.npub.slice(0, 20));
    const erroDigitando = await s.p.pg.isVisible('#nova-endereco-erro');
    await s.p.pg.fill('#nova-endereco', '');
    const erroVazio = await s.p.pg.isVisible('#nova-endereco-erro');
    const tentar = async (endereco, re) => {
      await s.p.pg.fill('#nova-endereco', endereco);
      await s.p.pg.click('#enviar-nova');
      const ok = await esperarNode(async () => re.test(await desfechoNova(s.p.pg)), 30000);
      return { ok, texto: await desfechoNova(s.p.pg) };
    };
    const r = {
      invalido: await tentar(s.ana.npub.slice(0, -3), /não é um endereço npub válido/),
      proprio: await tentar(s.dono.npub, /endereço do próprio site/),
      bloqueado: await tentar(s.bento.npub, /está bloqueada/),
      semCaixa: await tentar(F.chave().npub, /Não achei onde esta pessoa recebe mensagens/)
    };
    const texto = await s.p.pg.inputValue('#nova-mensagem');
    await s.p.pg.click('#cancelar-nova');
    await abrirCartaoNova(s.p.pg);
    const depois = { endereco: await s.p.pg.inputValue('#nova-endereco'), texto: await s.p.pg.inputValue('#nova-mensagem'), desfecho: await desfechoNova(s.p.pg) };
    const publicados = f.publicadosEm(s.relay).filter(e => e.kind === 1059).length;
    await s.p.pg.close();
    assert(erroDigitando && !erroVazio, 'erro enquanto digita: cortado=' + erroDigitando + ' vazio=' + erroVazio);
    for (const k of Object.keys(r)) assert(r[k].ok, k + ': ' + r[k].texto);
    assert(texto === 'texto que não pode sumir', 'a mensagem sumiu depois das recusas: ' + JSON.stringify(texto));
    assert(publicados === antes, '⚠️ saiu envelope numa tentativa recusada');
    assert(!depois.endereco && !depois.texto && !depois.desfecho, 'Cancelar não descartou: ' + JSON.stringify(depois));
    return Object.keys(r).length + ' recusas';
  });

  await it('com as mensagens DESLIGADAS, "Escrever para alguém" fica travado e diz por quê', async () => {
    const s = await sessao({ desligado: true });
    await irAContatos(s.p.pg);
    const g = await s.p.pg.evaluate(() => ({ travado: document.getElementById('escrever-para-alguem').disabled, porque: (document.getElementById('escrever-desligado') || {}).textContent || '' }));
    await s.p.pg.close();
    assert(g.travado && /ligue as mensagens primeiro/.test(g.porque), JSON.stringify(g));
  });

  await it('o que se digita no cartão sobrevive a uma mensagem que chega ao vivo — o endereço, o texto e o foco', async () => {
    const s = await sessao();
    await irAContatos(s.p.pg);
    await esperarNode(() => recebendo(s.p.pg), 20000);
    await abrirCartaoNova(s.p.pg);
    await s.p.pg.fill('#nova-endereco', s.ana.npub);
    await s.p.pg.click('#nova-mensagem');
    await s.p.pg.keyboard.type('Escrevendo devagar');
    const nova = F.mensagem(F.chave(), s.dono.pubkey, { content: 'chegou agora', created_at: Math.floor(Date.now() / 1000) });
    f.empurrar(s.relay, [nova.envelope]);
    const chegou = await esperarNode(async () => (await linhasAgora(s.p.pg)) === 3, 10000);
    const g = await s.p.pg.evaluate(() => ({ endereco: document.getElementById('nova-endereco').value, texto: document.getElementById('nova-mensagem').value, foco: document.activeElement && document.activeElement.id }));
    await s.p.pg.close();
    assert(chegou, 'a mensagem nova não chegou à lista');
    assert(g.endereco === s.ana.npub && g.texto === 'Escrevendo devagar' && g.foco === 'nova-mensagem', JSON.stringify(g));
  });

  return R;
};
