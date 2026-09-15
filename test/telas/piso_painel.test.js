// test/telas/piso_painel.test.js — o painel da v1 é para COMPUTADOR (decisão
// do dono, 2026-09-15), e a largura mínima que a Ajuda e o LEIA-ME dizem tem de
// ser verdade. Mede a tela de entrar, o desfecho da carga e TODA tela e aba do
// painel a PISO px e a 1000 px (o Tor Browser com a janela solta), nos dois
// motores: nenhuma pode rolar para o lado.
// Medido ao escrever esta suíte: as 22 cabem a 550 px nos dois motores; a 500 a
// tela de entrar já estoura no Chrome, e a 450 estouram todas (a barra do topo,
// com o botão "Trancar", é a primeira a passar). O piso dito fica com margem.
// ⚠️ Antes das telas, o CONTROLE: um elemento largo posto de propósito tem de
// ser acusado — uma régua que nunca reprova não está medindo nada.
// ⚠️ E a lista de telas é conferida contra o MENU antes de ser percorrida: uma
// tela nova no menu que não esteja aqui reprova o caso, em vez de passar verde
// sem ter sido medida.
const { abrir, coletor, assert, entrarCom, semearSite, esperarT2 } = require('../util.js');
const F = require('../fabrica.js');

const PISO = 600;
const TOR_SOLTO = 1000;
const TELAS = [['t3'], ['t4'], ['t4', { novo: true }], ['t5'], ['t5', { novo: true }], ['t6'], ['t6', { aba: 'herdados' }],
  ['t7', { secao: 'site' }], ['t7', { secao: 'doacoes' }], ['t7', { secao: 'aparencia' }], ['t7', { secao: 'privacidade' }], ['t7', { secao: 'avancado' }],
  ['t8'], ['t9'], ['t11', { secao: 'abrir' }], ['t11', { secao: 'blocos' }], ['t11', { secao: 'sobre' }], ['t12'],
  ['t13', { aba: 'mensagens' }], ['t13', { aba: 'onde' }]];

module.exports = async function (ctx, u) {
  const { R, it } = coletor();
  const p = await abrir(ctx, u.url);
  async function medirA(largura) {
    await p.pg.setViewportSize({ width: largura, height: 600 });
    await p.pg.waitForTimeout(250);
    return p.pg.evaluate(() => ({ cw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth }));
  }

  await it('controle: a régua acusa um estouro posto de propósito — sem isto, "nenhuma tela rola" não provaria nada', async () => {
    await p.pg.evaluate(() => { const d = document.createElement('div'); d.id = 'regua-controle'; d.style.width = '2000px'; d.style.height = '1px'; document.body.appendChild(d); });
    const com = await medirA(PISO);
    await p.pg.evaluate(() => document.getElementById('regua-controle').remove());
    const sem = await medirA(PISO);
    await p.pg.setViewportSize({ width: 1200, height: 600 });
    assert(com.sw > com.cw && sem.sw <= sem.cw, JSON.stringify({ com, sem }));
    return `com o elemento largo ${com.sw} > ${com.cw}; sem ele ${sem.sw} ≤ ${sem.cw}`;
  });

  await it(`54: a tela de entrar, a carga e TODAS as telas e abas do painel cabem a ${PISO} px e a ${TOR_SOLTO} px sem rolar para o lado; e a lista medida cobre todo o menu`, async () => {
    const medidas = [];
    async function registrar(rotulo) {
      for (const largura of [PISO, TOR_SOLTO]) medidas.push(Object.assign({ rotulo, largura }, await medirA(largura)));
      await p.pg.setViewportSize({ width: 1200, height: 600 });
    }
    await registrar('t1');
    const ch = F.chave();
    await semearSite(p.pg, ch, { relays: ['wss://127.0.0.1:1/x'], servers: ['https://127.0.0.1:1'], title: 'Site do teste do piso do painel' });
    await entrarCom(p.pg, ch.nsec);
    const d = await esperarT2(p.pg, 30000);
    assert(d.desfecho === 't2b-sem-rede', JSON.stringify(d));
    await registrar('t2b-sem-rede');
    await p.pg.click('#continuar-sem-rede');
    await p.pg.waitForFunction(() => Shell.telaAtual() === 't3', null, { timeout: 15000 });
    // conteúdo com nomes compridos: é o que empurra tabelas e caminhos
    await p.pg.evaluate(async ([pubkey]) => {
      const db = await Db.abrir(pubkey);
      const site = await db.get('site', 'site');
      const home = Modelo.novaPagina('Início'); home.body = 'Bem-vindo.';
      const sobre = Modelo.novaPagina('Sobre nós e o que fazemos por aqui'); sobre.body = 'Quem somos.';
      const artigo = Modelo.novoArtigo('Um artigo com um título razoavelmente comprido para ver a tabela'); artigo.body = 'Corpo.'; artigo.date = '2026-08-01T09:30:00Z'; artigo.tags = ['receitas', 'viagens'];
      site.description = 'Uma frase sobre o site';
      site.home = { mode: 'page', page_id: home.id, latest_posts: 5 };
      site.menu = [{ type: 'page', page_id: home.id }, { type: 'blog' }];
      const brutos = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 9, 9, 9, 9]);
      const midia = { id: Modelo.novoId(), path: '/img/uma-fotografia-com-nome-comprido.png', mime: 'image/png', size: brutos.length,
        sha256: await Blossom.sha256Hex(brutos), width: 300, height: 60, alt: 'retrato', caption: '',
        bytes: new Blob([brutos], { type: 'image/png' }), status: 'draft', servers: [], removal: null,
        metadata: { stripped: true, removed_segments: [], warning: null }, origin: 'upload',
        created_at: Modelo.agora(), updated_at: Modelo.agora(), previous_status: null };
      await db.escrever([{ op: 'put', store: 'site', chave: 'site', valor: site },
        { op: 'put', store: 'pages', valor: home }, { op: 'put', store: 'pages', valor: sobre },
        { op: 'put', store: 'posts', valor: artigo }, { op: 'put', store: 'media', valor: midia }]);
      db.fechar();
    }, [ch.pubkey]);

    const doMenu = await p.pg.evaluate(() => [...document.querySelectorAll('#menu .item')].map(b => b.getAttribute('data-tela')));
    const naLista = new Set(TELAS.map(t => t[0]));
    const faltam = doMenu.filter(t => !naLista.has(t));
    assert(doMenu.length > 0 && faltam.length === 0, 'telas do menu que esta régua não mede: ' + JSON.stringify({ doMenu, faltam }));

    for (const [tela, params] of TELAS) {
      await p.pg.evaluate(([t, pr]) => Shell.ir(t, pr || undefined), [tela, params || null]);
      if (tela === 't8') await p.pg.waitForSelector('#t8-total, #t8-vazio', { timeout: 30000 });
      else await p.pg.waitForFunction((t) => Shell.telaAtual() === t, tela, { timeout: 15000 });
      await p.pg.waitForTimeout(800);
      await registrar(tela + (params ? ' ' + JSON.stringify(params) : ''));
    }
    const esperadas = (TELAS.length + 2) * 2;
    assert(medidas.length === esperadas, 'medidas ' + medidas.length + ' de ' + esperadas);
    const estouros = medidas.filter(m => m.sw > m.cw);
    assert(estouros.length === 0, 'rola para o lado: ' + JSON.stringify(estouros));
    assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros }));
    return `${medidas.length} medidas (${TELAS.length + 2} telas × ${PISO} e ${TOR_SOLTO} px) — nenhuma rola; menu inteiro coberto (${doMenu.join(', ')})`;
  });

  await p.pg.close();
  return R;
};
module.exports.PISO = PISO;
