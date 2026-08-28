// test/rede/bostil.test.js — a REDE REAL (05 §4), com a cobaia (P-4).
// ⚠️ 2026-08-27: a cobaia MUDOU DE ESTADO. O dono publicou o Bostil pelo
// próprio Nostermentor (manifest com 9 caminhos, `client: nostermentor`,
// `/nostermentor/site.json` incluído — ver `09` §2.6), então o site deixou de
// ser "publicado por outra ferramenta": T2 já não acaba em T2c, vai direto a
// T3 com o site.json conferido. O caminho T2c continua coberto pelo servidor
// falso (`telas/t2_t3`), que não depende da rede.
// O que se prova aqui, contra a rede de verdade: T2 acha o 15128, baixa o
// site.json e confere o hash; o banco recebe páginas/artigos publicados e os
// arquivos que o app NÃO gera ficam como herdados; o manifest guardado
// verifica e é o mesmo que um juiz independente (Node, sem o código do app) vê
// nos relays; reabrir não duplica nada; e uma chave nova dá "não encontrei um
// site". Asserções "≥ 1" (P-9) e tolerantes ao conteúdo — o dono continua a
// editar o site. Só leitura: nada é publicado, nada fica na rede.
const { execFileSync } = require('child_process');
const path = require('path');
const { abrir, varrer, nsecDeTeste, coletor, assert, entrarCom, esperarT2, lerBanco } = require('../util.js');
const F = require('../fabrica.js');

// Os arquivos do deploy antigo que o app não gera e por isso preserva (09 §2.1
// e §2.6). O dono pode remover algum em Mídia → Arquivos herdados: o teste
// exige que TODO herdado esteja nesta lista, não que os três estejam lá.
const HERDADOS_CONHECIDOS = ['/1f95a.png', '/IntankavelBostil.mp4', '/IntankavelBst.webp'];

module.exports = async function (ctx, u) {
  const { R, it, pulado } = coletor();
  const nsec = nsecDeTeste();
  if (!nsec) {
    pulado('Bostil: T2 → T3 com o site.json conferido; herdados preservados; manifest = juiz independente', 'NOSTERMENTOR_NSEC_TESTE_ARQUIVO não definido ou sem nsec');
    pulado('Bostil: reabrir sem duplicar (aceite 4 real)', 'idem');
  } else {
    let banco1;
    await it('Bostil (rede real, agora publicado PELO app): T2 acha o 15128 em ≥ 1 relay, baixa o site.json e confere o hash → T3 direto (sem T2c); páginas/artigos entram como publicados, os arquivos do deploy antigo ficam herdados; published verificado; varredura limpa', async () => {
      const p = await abrir(ctx, u.url);
      await p.pg.evaluate((pk) => Db.apagar(pk), u.PUBKEY_BOSTIL);   // começa limpo: primeiro uso
      await entrarCom(p.pg, nsec);
      const t0 = Date.now();
      const d = await esperarT2(p.pg, 70000);
      const dt = Date.now() - t0;
      assert(d.tela === 't3' && d.desfecho === null, 'esperava T3 direto (o site tem site.json): ' + JSON.stringify(d));
      await p.pg.waitForSelector('#t3');
      await p.pg.screenshot({ path: u.captura('bostil-t3'), fullPage: true });
      const est = await p.pg.evaluate(() => ({
        saude: document.getElementById('saude-resumo').textContent,
        relays: [...document.querySelectorAll('#lista-relays li')].map(li => li.getAttribute('data-estado') + ':' + li.querySelector('code').textContent),
        nome: document.getElementById('nome-site').textContent,
        herdados: (document.getElementById('herdados-resumo') || {}).textContent,
        resumo: (document.getElementById('resumo-carga') || {}).textContent
      }));
      const m = /^Seu site está em (\d+) de (\d+) relays$/.exec(est.saude);
      assert(m && Number(m[1]) >= 1 && Number(m[2]) >= 8, est.saude);
      assert(est.nome === 'Império de Bostil', 'nome do site: ' + est.nome);        // tag title do manifest / site.json
      banco1 = await lerBanco(p.pg, u.PUBKEY_BOSTIL);
      // o site.json trouxe conteúdo estruturado — é a diferença de estado
      assert(banco1.pages.length + banco1.posts.length >= 1, 'sem páginas nem artigos: o site.json não foi aplicado');
      assert(banco1.pages.concat(banco1.posts).every(x => x.status === 'published'), 'algo veio da rede sem status published');
      const herdados = banco1.media.filter(x => x.origin === 'network');
      assert(herdados.length >= 1, 'nenhum arquivo herdado: os do deploy antigo deviam continuar preservados');
      const fora = herdados.map(x => x.path).filter(x => HERDADOS_CONHECIDOS.indexOf(x) < 0);
      assert(fora.length === 0, 'herdado inesperado (o app devia reconhecer como seu): ' + fora.join(','));
      assert(herdados.every(x => /^[0-9a-f]{64}$/.test(x.sha256) && x.servers.length >= 1), 'herdados incompletos');
      assert(banco1.published.manifest_event.pubkey === u.PUBKEY_BOSTIL && banco1.published.manifest_event.kind === 15128, 'published');
      const caminhos = Object.keys(banco1.published.paths);
      assert(caminhos.indexOf('/nostermentor/site.json') >= 0 && caminhos.indexOf('/index.html') >= 0 && caminhos.length >= 5, 'caminhos: ' + caminhos.join(','));
      const ok = await p.pg.evaluate((ev) => Chave.verificar(ev), banco1.published.manifest_event);
      assert(ok === true, 'manifest guardado não verifica');
      assert(banco1.site.network.relays.length >= 8 && banco1.site.network.servers.includes('https://cdn.hzrd149.com'), JSON.stringify(banco1.site.network));
      const v = await varrer(p.pg, nsec);
      assert(v.achados.length === 0, v.achados.join(' | '));
      assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros }));
      await p.pg.close();
      return `${est.saude}; ${(dt / 1000).toFixed(1)} s; ${banco1.pages.length} páginas, ${banco1.posts.length} artigos, ${herdados.length} herdados; manifest ${banco1.published.manifest_event_id.slice(0, 12)}…; ${est.relays.join(' ')}`;
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
    await it('aceite 4 (real): Trancar e entrar de novo → os mesmos registros (mesmos ids), nada duplicado', async () => {
      const p = await abrir(ctx, u.url);
      await entrarCom(p.pg, nsec);
      const d = await esperarT2(p.pg, 70000);
      assert(d.tela === 't3' && d.desfecho === null, JSON.stringify(d));
      const b2 = await lerBanco(p.pg, u.PUBKEY_BOSTIL);
      const ids = (b) => b.pages.concat(b.posts).concat(b.media).map(x => x.id).sort().join();
      assert(ids(b2) === ids(banco1), 'ids mudaram ou duplicaram: ' + [b2.pages.length, b2.posts.length, b2.media.length].join('/') + ' contra ' + [banco1.pages.length, banco1.posts.length, banco1.media.length].join('/'));
      await p.pg.waitForSelector('#t3');
      await p.pg.close();
      return `${b2.pages.length} páginas, ${b2.posts.length} artigos, ${b2.media.length} arquivos — os mesmos ids`;
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
