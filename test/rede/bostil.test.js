// test/rede/bostil.test.js — a REDE REAL (05 §4), com a cobaia (P-4):
// aceite 1 de 15 M2 (Bostil → 15128 em ≥ 1 relay, sem site.json, 4
// arquivos herdados, T3 "N de M", manifest igual ao do juiz independente),
// aceite 4 real (reabrir sem duplicar) e aceite 2 (a) real (chave nova →
// "não encontrei um site"). Asserções "≥ 1" (P-9). Só leitura: nada é
// publicado, nada fica na rede.
const { execFileSync } = require('child_process');
const path = require('path');
const { abrir, varrer, nsecDeTeste, coletor, assert, entrarCom, esperarT2, lerBanco } = require('../util.js');
const F = require('../fabrica.js');

const PATHS_BOSTIL = ['/index.html', '/1f95a.png', '/IntankavelBostil.mp4', '/IntankavelBst.webp'];   // 09 §2.1 (públicos)

module.exports = async function (ctx, u) {
  const { R, it, pulado } = coletor();
  const nsec = nsecDeTeste();
  if (!nsec) {
    pulado('Bostil: T2 → T2c com 4 herdados; T3 N de M; manifest = juiz independente', 'NOSTERMENTOR_NSEC_TESTE_ARQUIVO não definido ou sem nsec');
    pulado('Bostil: reabrir sem duplicar (aceite 4 real)', 'idem');
  } else {
    let banco1;
    await it('Bostil (rede real): T2 encontra o 15128 em ≥ 1 relay, sem site.json → T2c com os 4 arquivos herdados; T3 "N de M relays" com N ≥ 1; published.manifest_event verificado; varredura limpa', async () => {
      const p = await abrir(ctx, u.url);
      await p.pg.evaluate((pk) => Db.apagar(pk), u.PUBKEY_BOSTIL);   // começa limpo: primeiro uso
      await entrarCom(p.pg, nsec);
      const t0 = Date.now();
      const d = await esperarT2(p.pg, 70000);
      const dt = Date.now() - t0;
      await p.pg.screenshot({ path: u.captura('bostil-t2c'), fullPage: true });
      assert(d.desfecho === 't2c', 'desfecho: ' + JSON.stringify(d));
      assert(/4 arquivos/.test(await p.pg.textContent('#t2c')), 'T2c sem "4 arquivos"');
      await p.pg.click('#ir-inicio');
      await p.pg.waitForSelector('#t3');
      await p.pg.screenshot({ path: u.captura('bostil-t3'), fullPage: true });
      const est = await p.pg.evaluate(() => ({ saude: document.getElementById('saude-resumo').textContent, relays: [...document.querySelectorAll('#lista-relays li')].map(li => li.getAttribute('data-estado') + ':' + li.querySelector('code').textContent), nome: document.getElementById('nome-site').textContent, herdados: (document.getElementById('herdados-resumo') || {}).textContent }));
      const m = /^Seu site está em (\d+) de (\d+) relays$/.exec(est.saude);
      assert(m && Number(m[1]) >= 1 && Number(m[2]) >= 8, est.saude);
      assert(est.nome === 'Império de Bostil', 'nome do site: ' + est.nome);        // tag title do deploy 8 (09 §2.3)
      banco1 = await lerBanco(p.pg, u.PUBKEY_BOSTIL);
      const paths = banco1.media.map(x => x.path).sort();
      assert(paths.join(',') === PATHS_BOSTIL.slice().sort().join(','), 'herdados: ' + paths.join(','));
      assert(banco1.media.every(x => x.origin === 'network' && /^[0-9a-f]{64}$/.test(x.sha256) && x.servers.length >= 1), 'herdados incompletos');
      assert(banco1.published.manifest_event.pubkey === u.PUBKEY_BOSTIL && banco1.published.manifest_event.kind === 15128 && Object.keys(banco1.published.paths).length === 4, 'published');
      const ok = await p.pg.evaluate((ev) => Chave.verificar(ev), banco1.published.manifest_event);
      assert(ok === true, 'manifest guardado não verifica');
      assert(banco1.site.network.relays.length >= 8 && banco1.site.network.servers.includes('https://cdn.hzrd149.com'), JSON.stringify(banco1.site.network));
      const v = await varrer(p.pg, nsec);
      assert(v.achados.length === 0, v.achados.join(' | '));
      assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros }));
      await p.pg.close();
      return `${est.saude}; ${(dt / 1000).toFixed(1)} s; manifest ${banco1.published.manifest_event_id.slice(0, 12)}…; ${est.relays.join(' ')}`;
    });
    await it('juiz independente (Node, sem o código do app): o manifest mais recente nos relays é o mesmo que o app guardou em published.manifest_event_id', async () => {
      assert(banco1, 'sem carga anterior');
      const relays = banco1.site.network.relays;
      const saida = execFileSync(process.execPath, ['--experimental-websocket', path.join(__dirname, 'consulta_independente.js'), u.PUBKEY_BOSTIL, ...relays], { encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'ignore'] });
      const linha = saida.trim().split('\n').filter(l => l.startsWith('{')).pop();
      const j = JSON.parse(linha);
      assert(j.respondidos >= 1 && j.mais_recente, 'juiz sem resposta: ' + linha.slice(0, 200));
      assert(j.mais_recente.id === banco1.published.manifest_event_id && j.mais_recente.created_at === banco1.published.created_at, `juiz ${j.mais_recente.id.slice(0, 12)} ≠ app ${banco1.published.manifest_event_id.slice(0, 12)}`);
      const comApp = Object.keys(banco1.published.relays).filter(r => banco1.published.relays[r] === 'atual').sort();
      const comJuiz = Object.keys(j.por_relay).filter(r => j.por_relay[r].mais_recente && j.por_relay[r].mais_recente.id === j.mais_recente.id).sort();
      return `juiz: ${j.respondidos}/${j.total} relays; com o manifest atual — app ${comApp.length}, juiz ${comJuiz.length} (diferença esperada por intermitência: ${comApp.filter(x => !comJuiz.includes(x)).concat(comJuiz.filter(x => !comApp.includes(x))).join(',') || 'nenhuma'})`;
    });
    await it('aceite 4 (real): Trancar e entrar de novo → os mesmos 4 herdados (mesmos ids), nada duplicado', async () => {
      const p = await abrir(ctx, u.url);
      await entrarCom(p.pg, nsec);
      const d = await esperarT2(p.pg, 70000);
      assert(d.desfecho === 't2c', JSON.stringify(d));
      const b2 = await lerBanco(p.pg, u.PUBKEY_BOSTIL);
      assert(b2.media.length === 4 && b2.media.map(x => x.id).sort().join() === banco1.media.map(x => x.id).sort().join(), 'ids mudaram/duplicaram: ' + b2.media.length);
      await p.pg.click('#ir-inicio'); await p.pg.waitForSelector('#t3');
      await p.pg.close();
    });
  }
  await it('aceite 2 (a) na rede real: chave nova → T2b "Não encontrei um site publicado com esta chave" (relays padrão responderam)', async () => {
    const ch = F.chave();
    const p = await abrir(ctx, u.url);
    await entrarCom(p.pg, ch.nsec);
    const t0 = Date.now();
    const d = await esperarT2(p.pg, 70000);
    assert(d.desfecho === 't2b-sem-site', JSON.stringify(d));
    assert((await p.pg.textContent('#t2b-sem-site p')) === 'Não encontrei um site publicado com esta chave. Vamos começar um?');
    const m = /(\d+) de (\d+) responderam/.exec(d.passos[0].estado);
    assert(m && Number(m[1]) >= 1 && Number(m[2]) === 8, d.passos[0].estado);
    await p.pg.screenshot({ path: u.captura('chave-nova-t2b'), fullPage: true });
    await p.pg.evaluate((pk) => Db.apagar(pk), ch.pubkey);
    await p.pg.close();
    return `${d.passos[0].estado} em ${((Date.now() - t0) / 1000).toFixed(1)} s` + (d.passos[0].detalhe ? ' — ' + d.passos[0].detalhe : '');
  });
  return R;
};
