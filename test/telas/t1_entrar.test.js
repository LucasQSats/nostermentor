// test/telas/t1_entrar.test.js — aceites 1, 2 e 3 de 15 M1, em cada motor:
//   1. abre de file:// sob a CSP com ZERO erros;
//   2. texto inválido → mensagem de 14 T1; nsec do Bostil (colada e por
//      arquivo) → npub de 09 §2; "Não tenho chave" → nsec uma única vez,
//      download chave-<npub8>.txt, "Entrar" só depois;
//   3. a nsec não fica em localStorage/IndexedDB/URL/título/DOM depois de
//      "Entrar" (varredura), nem depois de "Trancar".
const fs = require('fs');
const { abrir, varrer, nsecDeTeste, coletor, assert } = require('../util.js');

const MSG_T1 = 'Isto não é uma chave privada (nsec). A chave começa por nsec1.';
const abreviar = (npub) => npub.slice(0, 9) + '…' + npub.slice(-4);

module.exports = async function (ctx, u) {
  const { R, it, pulado } = coletor();
  const nsecBostil = nsecDeTeste();

  // --- aceite 1: arranque limpo -------------------------------------------
  await it('T0→T1: canário escondido, painel visível, zero erros JS/console/CSP, libs definidas', async () => {
    const p = await abrir(ctx, u.url);
    const est = await p.pg.evaluate(() => ({
      semjs: getComputedStyle(document.getElementById('semjs')).display,
      app: getComputedStyle(document.getElementById('app')).display,
      t1: !!document.getElementById('t1'),
      erros: window.__erros, csp: window.__csp,
      libs: { NT: typeof NT, DOMPurify: typeof DOMPurify, marked: typeof marked, Mustache: typeof Mustache, Textos: typeof Textos, Chave: typeof Chave, Shell: typeof Shell },
      versao: window.APP_VERSION, meta: document.querySelector('meta[name="nostermentor-version"]').content,
      titulo: document.title, origem: String(location.origin), protocolo: location.protocol,
      foco: document.activeElement && document.activeElement.id
    }));
    await p.pg.screenshot({ path: u.captura('t1'), fullPage: true });
    assert(est.semjs === 'none', 'canário visível: ' + est.semjs);
    assert(est.app !== 'none' && est.t1, 'T1 não montou');
    assert(est.erros.length === 0 && est.csp.length === 0 && p.erros.length === 0 && p.consoleErros.length === 0,
      JSON.stringify({ erros: est.erros, csp: est.csp, pageerror: p.erros, console: p.consoleErros }));
    assert(Object.values(est.libs).every(t => t !== 'undefined'), JSON.stringify(est.libs));
    assert(est.versao === est.meta && /^\d+\.\d+\.\d+(-dev)?$/.test(est.versao), 'versão: ' + est.versao + ' / meta ' + est.meta);
    assert(est.protocolo === 'file:', est.protocolo);
    assert(est.foco === 'nsec', 'foco inicial em #' + est.foco);
    await p.pg.close();
    return `versão ${est.versao}; origin=${est.origem}; console=${p.consoleTudo.length} msgs`;
  });

  await it('canário: com o arranque sabotado, o aviso vira "não conseguiu arrancar: …" e o painel não aparece', async () => {
    const p = await (async () => {
      const { novaPagina } = require('../util.js');
      const q = await novaPagina(ctx);
      // sabotagem: a montagem de T1 cria um <section>; fazê-la lançar simula um
      // erro de arranque num script posterior ao onerror (arquivo copiado pela
      // metade, API ausente…). O aviso tem de virar texto, nunca página muda.
      await q.pg.addInitScript(() => {
        const orig = document.createElement.bind(document);
        document.createElement = function (tag) { if (String(tag).toLowerCase() === 'section') throw new Error('sabotagem de teste'); return orig.apply(document, arguments); };
      });
      await q.pg.goto(u.url);
      await q.pg.waitForTimeout(500);
      return q;
    })();
    const est = await p.pg.evaluate(() => ({
      semjs: getComputedStyle(document.getElementById('semjs')).display,
      titulo: document.getElementById('semjs-titulo').textContent,
      app: getComputedStyle(document.getElementById('app')).display,
      arrancou: window.__arrancou
    }));
    await p.pg.screenshot({ path: u.captura('t0-erro'), fullPage: true });
    assert(est.semjs !== 'none' && est.app === 'none' && est.arrancou === false, JSON.stringify(est));
    assert(/^O Nostermentor não conseguiu arrancar: .+\. Se o arquivo foi copiado pela metade, copie-o de novo\.$/.test(est.titulo), est.titulo);
    await p.pg.close();
    return est.titulo.slice(0, 90) + '…';
  });

  // --- aceite 2: colar inválido ---------------------------------------------
  await it('colar texto inválido (frase, npub, hex, nsec truncada) → mensagem exata de 14 T1, sem sair de T1', async () => {
    const p = await abrir(ctx, u.url);
    const casos = ['isto não é uma chave', u.NPUB_BOSTIL, '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798', 'nsec1abc', ''];
    for (const c of casos) {
      await p.pg.fill('#nsec', c);
      await p.pg.click('#entrar-colar');
      const msg = await p.pg.textContent('#erro-colar');
      const visivel = await p.pg.isVisible('#erro-colar');
      assert(visivel && msg === MSG_T1, `caso ${JSON.stringify(c.slice(0, 20))}: visível=${visivel} msg=${JSON.stringify(msg)}`);
      assert(await p.pg.isVisible('#t1') && !(await p.pg.$('#moldura')), 'saiu de T1 com entrada inválida');
    }
    await p.pg.screenshot({ path: u.captura('t1-erro'), fullPage: true });
    assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros }));
    await p.pg.close();
    return casos.length + ' casos';
  });

  await it('botão do olho alterna password ↔ text', async () => {
    const p = await abrir(ctx, u.url);
    const tipos = [await p.pg.getAttribute('#nsec', 'type')];
    await p.pg.click('#olho'); tipos.push(await p.pg.getAttribute('#nsec', 'type'));
    await p.pg.click('#olho'); tipos.push(await p.pg.getAttribute('#nsec', 'type'));
    assert(tipos.join(',') === 'password,text,password', tipos.join(','));
    await p.pg.close();
  });

  // --- aceite 2/3: nsec do Bostil colada ------------------------------------
  if (!nsecBostil) {
    pulado('colar a nsec do Bostil → npub de 09 §2 + varredura + Trancar', 'NOSTERMENTOR_NSEC_TESTE_ARQUIVO não definido ou sem nsec');
    pulado('arquivo com a nsec do Bostil pelo seletor → mesma npub + varredura', 'idem');
  } else {
    await it('colar a nsec do Bostil → moldura com npub abreviada de 09 §2; T2 real começa (passos + npub completa); varredura limpa; Trancar volta a T1 limpo', async () => {
      const p = await abrir(ctx, u.url);
      await p.pg.fill('#nsec', nsecBostil);
      await p.pg.click('#entrar-colar');
      await p.pg.waitForSelector('#moldura', { timeout: 10000 });
      const est = await p.pg.evaluate(() => ({
        abrev: document.getElementById('npub-abrev').textContent,
        completo: (document.getElementById('npub-completo') || {}).textContent,
        t2: (document.getElementById('t2') || {}).textContent || '',
        t1: !!document.getElementById('t1'),
        rodape: document.getElementById('versao').textContent,
        publicar: document.getElementById('btn-publicar').textContent, publicarDesligado: document.getElementById('btn-publicar').disabled,
        backup: document.getElementById('btn-backup').textContent,
        menu: [...document.querySelectorAll('#menu .item')].map(b => b.textContent),
        sessao: Shell.sessao(), temSessao: Shell.temSessao()
      }));
      await p.pg.screenshot({ path: u.captura('t2-bostil'), fullPage: true });
      assert(est.abrev === abreviar(u.NPUB_BOSTIL), 'npub abreviada: ' + est.abrev);
      assert(est.completo === u.NPUB_BOSTIL, 'npub completa em T2: ' + est.completo);
      assert(/Conectando aos relays/.test(est.t2) && /Cancelar/.test(est.t2), 'T2 sem os passos de 14 T2 (M2)');
      assert(!est.t1, 'T1 continua no DOM depois de entrar');
      assert(/^Nostermentor \d+\.\d+\.\d+(-dev)?$/.test(est.rodape), est.rodape);
      assert(est.publicar === 'Nada a publicar' && est.publicarDesligado && est.backup === 'Backup em dia', JSON.stringify([est.publicar, est.backup]));
      assert(est.menu.join('·') === 'Início·Páginas·Artigos·Mídia·Configurações·Ajuda', est.menu.join('·'));
      assert(est.temSessao && est.sessao.npub === u.NPUB_BOSTIL && !('sk' in est.sessao), 'Shell.sessao() expõe algo a mais: ' + Object.keys(est.sessao));
      const v1 = await varrer(p.pg, nsecBostil);
      assert(v1.achados.length === 0, 'varredura após Entrar: ' + v1.achados.join(' | '));
      await p.pg.click('#btn-trancar');
      await p.pg.waitForSelector('#t1', { timeout: 5000 });
      const depois = await p.pg.evaluate(() => ({ moldura: !!document.getElementById('moldura'), temSessao: Shell.temSessao(), nsec: document.getElementById('nsec').value }));
      assert(!depois.moldura && !depois.temSessao && depois.nsec === '', JSON.stringify(depois));
      const v2 = await varrer(p.pg, nsecBostil);
      assert(v2.achados.length === 0, 'varredura após Trancar: ' + v2.achados.join(' | '));
      assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros }));
      await p.pg.close();
      return `bancos IndexedDB: ${JSON.stringify(v1.bancos)}; DOM ${v1.comprimentoHtml} chars varridos`;
    });

    await it('arquivo com a nsec do Bostil pelo seletor (comentário + CRLF) → mesma npub; varredura limpa; arquivo sem chave → aviso', async () => {
      const p = await abrir(ctx, u.url);
      await p.pg.setInputFiles('#arquivo-chave', { name: 'sem-chave.txt', mimeType: 'text/plain', buffer: Buffer.from('só texto\n' + u.NPUB_BOSTIL + '\n') });
      await p.pg.waitForSelector('#erro-arquivo:not([hidden])', { timeout: 5000 });
      const aviso = await p.pg.textContent('#erro-arquivo');
      assert(aviso && aviso.length > 10 && !(await p.pg.$('#moldura')), 'arquivo sem chave: ' + aviso);
      await p.pg.setInputFiles('#arquivo-chave', { name: 'chave.txt', mimeType: 'text/plain', buffer: Buffer.from('# minha chave\r\n\r\n' + nsecBostil + '\r\n' + u.NPUB_BOSTIL + '\r\n') });
      await p.pg.waitForSelector('#moldura', { timeout: 10000 });
      const abrev = await p.pg.textContent('#npub-abrev');
      assert(abrev === abreviar(u.NPUB_BOSTIL), 'npub abreviada: ' + abrev);
      const v = await varrer(p.pg, nsecBostil);
      assert(v.achados.length === 0, 'varredura: ' + v.achados.join(' | '));
      const inputs = await p.pg.evaluate(() => [...document.querySelectorAll('input')].map(i => i.id + '=' + (i.value || '').length));
      assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros }));
      await p.pg.close();
      return 'inputs restantes: ' + inputs.join(',');
    });
  }

  // --- aceite 2/3: Não tenho chave -------------------------------------------
  await it('"Não tenho chave": nsec exibida uma única vez; Entrar bloqueado; download chave-<npub8>.txt com a nsec na 1ª linha libera; após Entrar nada da nsec no DOM', async () => {
    const p = await abrir(ctx, u.url);
    await p.pg.click('#btn-gerar');
    await p.pg.waitForSelector('#gerar:not([hidden])');
    const g = await p.pg.evaluate(() => ({
      nsec: document.getElementById('nsec-nova').textContent, npub: document.getElementById('npub-nova').textContent,
      entrar: document.getElementById('entrar-nova').disabled,
      link: document.getElementById('baixar-chave').textContent, download: document.getElementById('baixar-chave').getAttribute('download'),
      href: document.getElementById('baixar-chave').getAttribute('href')
    }));
    assert(/^nsec1[023456789acdefghjklmnpqrstuvwxyz]{58}$/.test(g.nsec) && /^npub1[023456789acdefghjklmnpqrstuvwxyz]{58}$/.test(g.npub), 'chave nova malformada');
    assert(g.entrar === true, '"Entrar" liberado antes de baixar/confirmar');
    const npub8 = g.npub.slice(5, 13);
    assert(g.download === 'chave-' + npub8 + '.txt' && g.link.endsWith('chave-' + npub8 + '.txt') && /^blob:/.test(g.href), JSON.stringify([g.download, g.link, g.href]));
    await p.pg.screenshot({ path: u.captura('t1-gerar'), fullPage: true });
    const [download] = await Promise.all([p.pg.waitForEvent('download', { timeout: 15000 }), p.pg.click('#baixar-chave')]);
    assert(download.suggestedFilename() === 'chave-' + npub8 + '.txt', 'nome sugerido: ' + download.suggestedFilename());
    const caminho = await download.path();
    const conteudo = fs.readFileSync(caminho, 'utf8');
    fs.unlinkSync(caminho);
    const linhas = conteudo.split('\n');
    assert(linhas[0] === g.nsec && linhas[1] === g.npub, 'conteúdo do arquivo: ' + linhas.slice(0, 2).map(l => l.slice(0, 8)).join(','));
    assert((await p.pg.evaluate(() => document.getElementById('entrar-nova').disabled)) === false, '"Entrar" continua bloqueado depois do download');
    await p.pg.click('#entrar-nova');
    await p.pg.waitForSelector('#moldura', { timeout: 10000 });
    const abrev = await p.pg.textContent('#npub-abrev');
    assert(abrev === abreviar(g.npub), 'npub abreviada: ' + abrev);
    const v = await varrer(p.pg, g.nsec);
    assert(v.achados.length === 0, 'varredura após Entrar com chave nova: ' + v.achados.join(' | '));
    // A revogação do blob não é observável daqui: a CSP do produto
    // (connect-src https: wss:) bloqueia fetch/XHR a blob: — medido em
    // 2026-08-26 nos dois motores. O que se confere é que nenhum blob: sobra
    // referenciado no DOM depois de Entrar (a varredura acima já garante que
    // a nsec não sobra em lugar nenhum).
    const blobsNoDom = await p.pg.evaluate(() => [...document.querySelectorAll('[href],[src]')].map(e => e.getAttribute('href') || e.getAttribute('src')).filter(v => /^blob:/.test(v || '')));
    assert(blobsNoDom.length === 0, 'blob: ainda referenciado no DOM: ' + blobsNoDom.join(','));
    // "uma única vez": ao trancar e gerar de novo, a anterior nunca reaparece
    await p.pg.click('#btn-trancar');
    await p.pg.waitForSelector('#t1');
    await p.pg.click('#btn-gerar');
    await p.pg.waitForSelector('#gerar:not([hidden])');
    const segunda = await p.pg.textContent('#nsec-nova');
    assert(segunda !== g.nsec && /^nsec1/.test(segunda), 'a mesma nsec reapareceu');
    assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros }));
    await p.pg.close();
    return `arquivo ${conteudo.length} B (${linhas.length} linhas); bancos: ${JSON.stringify(v.bancos)}`;
  });

  await it('"Não tenho chave": a caixa "copiei…" também libera Entrar; Cancelar apaga a chave da tela', async () => {
    const p = await abrir(ctx, u.url);
    await p.pg.click('#btn-gerar');
    await p.pg.waitForSelector('#gerar:not([hidden])');
    assert(await p.pg.evaluate(() => document.getElementById('entrar-nova').disabled));
    await p.pg.check('#copiei');
    assert(!(await p.pg.evaluate(() => document.getElementById('entrar-nova').disabled)), 'caixa marcada não liberou');
    await p.pg.uncheck('#copiei');
    assert(await p.pg.evaluate(() => document.getElementById('entrar-nova').disabled), 'desmarcar não voltou a bloquear');
    await p.pg.click('#cancelar-nova');
    const est = await p.pg.evaluate(() => ({ escondido: document.getElementById('gerar').hidden, nsec: document.getElementById('nsec-nova').textContent, href: document.getElementById('baixar-chave').getAttribute('href') }));
    assert(est.escondido && est.nsec === '' && est.href === null, JSON.stringify(est));
    const v = await varrer(p.pg, null);
    assert(v.achados.length === 0, v.achados.join(' | '));
    await p.pg.close();
  });

  // --- moldura e stubs (o que M1 promete além de T1) --------------------------
  await it('moldura: menu leva às telas (T3 desde M2; T4/T5/T9 desde M3; T6 desde M4; T7 desde M5; T11 "ainda não implementado"); Backup abre T9; rodapé com a versão; "Apoie" abre Ajuda', async () => {
    const p = await abrir(ctx, u.url);
    await p.pg.click('#btn-gerar'); await p.pg.check('#copiei'); await p.pg.click('#entrar-nova');
    await p.pg.waitForSelector('#moldura');
    const esperados = [['t3', 'Início', false], ['t4', 'Páginas', false], ['t5', 'Artigos', false], ['t6', 'Mídia', false], ['t7', 'Configurações', false], ['t11', 'Ajuda e Sobre', true]];
    for (const [tela, nome, stub] of esperados) {
      await p.pg.click(`#menu .item[data-tela="${tela}"]`);
      await p.pg.waitForSelector('#conteudo h1', { timeout: 10000 });   // T3 monta depois de ler o banco (assíncrona desde M2)
      const est = await p.pg.evaluate((tela) => ({ h1: document.querySelector('#conteudo h1').textContent, stub: !!document.querySelector('#conteudo .stub'), atual: document.querySelector('#menu .item.atual').getAttribute('data-tela'), tela: Shell.telaAtual() }), tela);
      assert(est.h1 === nome && est.stub === stub && est.atual === tela && est.tela === tela, JSON.stringify(est));
    }
    await p.pg.click('#btn-backup');
    await p.pg.waitForSelector('#conteudo h1');
    assert((await p.pg.textContent('#conteudo h1')) === 'Backup' && !(await p.pg.$('#conteudo .stub')));
    await p.pg.click('#rodape .ligacao');
    await p.pg.waitForSelector('#conteudo h1');
    assert((await p.pg.textContent('#conteudo h1')) === 'Ajuda e Sobre');
    await p.pg.screenshot({ path: u.captura('moldura'), fullPage: true });
    assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros }));
    await p.pg.close();
    return esperados.length + ' itens de menu + Backup + Apoie';
  });

  await it('"Primeira vez no Tails?" mostra e esconde a ajuda embutida', async () => {
    const p = await abrir(ctx, u.url);
    assert(await p.pg.evaluate(() => document.getElementById('ajuda-tails').hidden));
    await p.pg.click('#link-tails');
    const txt = await p.pg.textContent('#ajuda-tails');
    assert(!(await p.pg.evaluate(() => document.getElementById('ajuda-tails').hidden)) && /Documents/.test(txt) && /F5/.test(txt) && /Safest/.test(txt), 'ajuda incompleta');
    await p.pg.click('#link-tails');
    assert(await p.pg.evaluate(() => document.getElementById('ajuda-tails').hidden));
    await p.pg.close();
  });

  await it('cabe em 1200×600 sem rolagem horizontal (T1 e moldura)', async () => {
    const p = await abrir(ctx, u.url);
    const medir = () => p.pg.evaluate(() => ({ larguraDoc: document.documentElement.scrollWidth, janela: innerWidth, botaoVisivel: (() => { const b = document.getElementById('entrar-colar') || document.getElementById('btn-trancar'); const r = b.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })() }));
    const m1 = await medir();
    assert(m1.larguraDoc <= m1.janela && m1.botaoVisivel, 'T1: ' + JSON.stringify(m1));
    await p.pg.click('#btn-gerar'); await p.pg.check('#copiei'); await p.pg.click('#entrar-nova');
    await p.pg.waitForSelector('#moldura');
    const m2 = await medir();
    assert(m2.larguraDoc <= m2.janela && m2.botaoVisivel, 'moldura: ' + JSON.stringify(m2));
    await p.pg.close();
    return `T1 ${m1.larguraDoc}px, moldura ${m2.larguraDoc}px em janela de ${m1.janela}px`;
  });

  return R;
};
