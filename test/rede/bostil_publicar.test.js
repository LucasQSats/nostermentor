// test/rede/bostil_publicar.test.js — ACEITE 2 do M4 (15 §3), na REDE REAL,
// com a cobaia (P-4): entrar com a chave de teste do Bostil (09 §2) → os 4
// arquivos herdados → acrescentar uma página → publicar → o manifest novo
// tem os 4 caminhos antigos + os novos, e o site antigo continua no ar.
// No fim, o Bostil é DEVOLVIDO ao estado anterior.
//
// Duas fases, porque publicar por cima de um site que está no ar é
// irreversível pela metade (o 15128 é substituível, 05 §1):
//   NOSTERMENTOR_BOSTIL_REAL=diff  → vai até T8 e LÊ o diff. Não assina
//                                    nada, não toca na rede. Reversível.
//   NOSTERMENTOR_BOSTIL_REAL=1     → publica de verdade e restaura no fim.
// Sem a variável, tudo fica PULADO (nunca "passado").
const { abrir, varrer, nsecDeTeste, coletor, assert, entrarCom, esperarT2, lerBanco } = require('../util.js');
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const SERVIDORES = ['https://cdn.hzrd149.com', 'https://blossom.primal.net'];
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');

// A fotografia do "antes", guardada na KB antes de a sessão tocar em nada:
// o evento 15128 completo e os 4 blobs com hash conferido. É o que permite
// devolver a cobaia ao lugar.
// O caminho da KB e' LOCAL do dono: vem de NOSTERMENTOR_KB, nunca fixo no
// codigo (o repositorio e' publico; a KB nao vai nele).
const KB = process.env.NOSTERMENTOR_KB || '';
const SALVAGUARDA = path.join(KB, 'CONTEXTO ADICIONAL', 'aceite2-bostil-2026-08-27');

function juiz(pubkey, relays) {
  const saida = execFileSync(process.execPath, ['--experimental-websocket', path.join(__dirname, 'consulta_independente.js'), pubkey, ...relays],
    { encoding: 'utf8', timeout: 90000, stdio: ['ignore', 'pipe', 'ignore'] });
  return JSON.parse(saida.trim().split('\n').filter(l => l.startsWith('{')).pop());
}

// 09 §2.1/§2.3 — estado público do deploy 8, a fotografia do "antes".
const PATHS_BOSTIL = {
  '/1f95a.png': '1531f75f829c1a8e93df4c736c3d5879b93d0cc12f48a21ef623ce8a8b7fcbc8',
  '/index.html': '33312796b1e0c4b7adc8e12e07d0bc3343bd1a270984621808ec20a4dcf46636',
  '/IntankavelBostil.mp4': 'a4d3da32a939d159a10199fb7a0b3a3124be97ece4b76a55f22673e066137b9e',
  '/IntankavelBst.webp': 'b8b9975833b8b808dd7274ea6f8c5367cfd716185d09b0e0221f6b04acb57be7'
};
const TITULO_PAGINA = 'Prova de preservação';

// Lê os blocos do diff de T8 como o dono os vê (rótulo → caminhos).
async function lerDiff(pg) {
  return pg.evaluate(() => {
    const blocos = {};
    for (const d of document.querySelectorAll('#t8-diff .bloco-diff')) {
      blocos[d.getAttribute('data-bloco')] = [...d.querySelectorAll('li code')].map(c => c.textContent);
    }
    return {
      blocos,
      total: (document.getElementById('t8-total') || {}).textContent || '',
      eventos: [...document.querySelectorAll('#t8-eventos li')].map(li => li.textContent)
    };
  });
}

module.exports = async function (ctx, u) {
  const { R, it, pulado } = coletor();
  const fase = process.env.NOSTERMENTOR_BOSTIL_REAL || '';
  const nsec = nsecDeTeste();

  if (!fase) { pulado('rede/bostil_publicar (aceite 2)', 'publica por cima da cobaia — ligue com NOSTERMENTOR_BOSTIL_REAL=diff (só mede) ou =1 (publica e restaura)'); return R; }
  if (!KB) { pulado('rede/bostil_publicar (aceite 2)', 'NOSTERMENTOR_KB não definido — é o caminho local da KB, onde mora a salvaguarda da cobaia'); return R; }
  if (!nsec) { pulado('rede/bostil_publicar (aceite 2)', 'NOSTERMENTOR_NSEC_TESTE_ARQUIVO não definido ou sem nsec (09 §2)'); return R; }
  // Um site por execução, não um por motor: a cobaia é pública.
  if (u.motor !== 'firefox') { pulado('rede/bostil_publicar (' + u.motor + ')', 'a cobaia é uma só — corre no primeiro motor'); return R; }

  let diff = null, banco = null, caminhoNovo = null, bloqueio = null;

  await it('aceite 2 — fase 1 (sem tocar na rede): entrar no Bostil → 4 herdados → acrescentar uma página → T8 mostra o que aconteceria', async () => {
    const p = await abrir(ctx, u.url);
    await p.pg.evaluate((pk) => Db.apagar(pk), u.PUBKEY_BOSTIL);      // começa da rede, não de resto de sessão
    await entrarCom(p.pg, nsec);
    const d = await esperarT2(p.pg, 90000);
    assert(d.desfecho === 't2c', 'T2 não chegou a T2c (site de outra ferramenta): ' + JSON.stringify(d));

    const b0 = await lerBanco(p.pg, u.PUBKEY_BOSTIL);
    const herdados = b0.media.filter(m => m.origin === 'network').map(m => m.path).sort();
    assert(herdados.join(',') === Object.keys(PATHS_BOSTIL).sort().join(','), 'herdados lidos da rede: ' + herdados.join(','));
    assert(Object.keys(b0.published.paths).length === 4, 'published.paths: ' + Object.keys(b0.published.paths).join(','));
    for (const c of Object.keys(PATHS_BOSTIL)) assert(b0.published.paths[c] === PATHS_BOSTIL[c], 'hash mudou na rede desde 09 §2.3: ' + c);

    await p.pg.click('#ir-inicio'); await p.pg.waitForSelector('#t3');
    // a página entra PELA TELA, como o dono a criaria — escrever direto no
    // banco não refresca os contadores e "Publicar" fica desativado.
    await p.pg.click('#menu .item[data-tela="t4"]');
    await p.pg.waitForSelector('#t4');
    await p.pg.click('#novo-registro');
    await p.pg.waitForSelector('#editor[data-tipo="page"]');
    await p.pg.fill('#ed-titulo', TITULO_PAGINA);
    await p.pg.fill('#ed-corpo', 'Página acrescentada pelo teste do aceite 2 do marco M4, para provar que publicar pelo Nostermentor nao apaga o que ja estava no ar.');
    await p.pg.click('#ed-salvar');
    await p.pg.waitForFunction(() => /Salvo/.test(document.getElementById('ed-status').textContent), null, { timeout: 10000 });
    caminhoNovo = await p.pg.evaluate(() => '/' + document.getElementById('ed-slug').value + '/index.html');

    await p.pg.click('#btn-publicar');
    await p.pg.waitForSelector('#t8-total', { timeout: 90000 });
    diff = await lerDiff(p.pg);
    bloqueio = await p.pg.evaluate(() => ({
      desativado: document.getElementById('t8-assinar').disabled,
      erro: (document.getElementById('t8-erro') || {}).textContent || '',
      temBotao: !!document.getElementById('t8-colisao-ir')
    }));
    banco = await lerBanco(p.pg, u.PUBKEY_BOSTIL);
    await p.pg.screenshot({ path: u.captura('bostil-aceite2-diff'), fullPage: true });
    const v = await varrer(p.pg, nsec);
    assert(v.achados.length === 0, 'varredura: ' + v.achados.join(' | '));
    await p.pg.close();                                              // NÃO se clica em #t8-assinar nesta fase
    const linhas = Object.keys(diff.blocos).map(k => k + ': ' + diff.blocos[k].join(' '));
    return linhas.join(' | ') + ' || ' + diff.total;
  });

  await it('aceite 2 — nenhum dos 4 caminhos do Bostil SAI do mapa (T-7): `some` vazio e os 3 arquivos de mídia aparecem como preservados', async () => {
    assert(diff, 'a fase 1 não correu');
    const some = diff.blocos['Some'] || [];
    const perdidos = Object.keys(PATHS_BOSTIL).filter(c => some.includes(c));
    assert(perdidos.length === 0, 'saem do mapa do site: ' + perdidos.join(', '));
    const fica = diff.blocos['Fica como está (veio de outra ferramenta)'] || [];
    const esperados = Object.keys(PATHS_BOSTIL).filter(c => c !== '/index.html').sort();
    assert(fica.slice().sort().join(',') === esperados.join(','), 'preservados mostrados: ' + fica.join(', ') + ' — esperado: ' + esperados.join(', '));
    return `${fica.length} preservados e visíveis ao dono: ${fica.join(', ')}`;
  });

  await it('aceite 2 — a capa herdada colide com a home gerada pelo app → T8 BLOQUEIA a publicação e diz onde resolver (decisão do usuário, 2026-08-27)', async () => {
    assert(bloqueio, 'a fase 1 não correu');
    assert(bloqueio.desativado === true, '"Assinar e publicar" continua ativo — a capa do site antigo seria substituída sem o dono mandar');
    assert(/\/index\.html/.test(bloqueio.erro), 'a mensagem não nomeia o caminho em conflito: ' + bloqueio.erro);
    assert(/outra ferramenta/.test(bloqueio.erro), 'a mensagem não explica de onde vem o arquivo: ' + bloqueio.erro);
    assert(bloqueio.temBotao === true, 'falta o atalho para Mídia, onde o dono resolve');
    return bloqueio.erro;
  });

  await it('aceite 2 — o dono remove a capa antiga em Mídia (um a um, como o contrato manda) → T8 desbloqueia e os outros 3 herdados continuam preservados', async () => {
    const p = await abrir(ctx, u.url);
    await entrarCom(p.pg, nsec);
    const d = await esperarT2(p.pg, 90000);
    assert(d.desfecho === 't2c', JSON.stringify(d));
    await p.pg.click('#ir-inicio'); await p.pg.waitForSelector('#t3');
    await p.pg.click('#menu .item[data-tela="t6"]'); await p.pg.waitForSelector('#t6-tabela');
    await p.pg.click('#t6-abas .aba[data-aba="herdados"]');   // M5: os herdados têm aba própria (14 T6)
    await p.pg.waitForSelector('#t6-tabela tr[data-path="/index.html"]');
    await p.pg.click('#t6-tabela tr[data-path="/index.html"] .t6-remover');
    await p.pg.waitForSelector('#t6b-remover');
    await p.pg.click('#t6b-remover');
    await p.pg.waitForFunction(() => { const tr = document.querySelector('#t6-tabela tr[data-path="/index.html"]'); return tr && tr.classList.contains('removida'); }, null, { timeout: 10000 });
    await p.pg.click('#btn-publicar');
    await p.pg.waitForSelector('#t8-total', { timeout: 90000 });
    const d2 = await lerDiff(p.pg);
    const b2 = await p.pg.evaluate(() => ({ desativado: document.getElementById('t8-assinar').disabled, erro: (document.getElementById('t8-erro') || {}).hidden }));
    await p.pg.screenshot({ path: u.captura('bostil-aceite2-desbloqueado'), fullPage: true });
    await p.pg.close();                                              // ainda NÃO se publica
    assert(b2.desativado === false, '"Assinar e publicar" continua bloqueado depois de o dono remover a capa antiga');
    const fica = d2.blocos['Fica como está (veio de outra ferramenta)'] || [];
    const esperados = Object.keys(PATHS_BOSTIL).filter(c => c !== '/index.html').sort();
    assert(fica.slice().sort().join(',') === esperados.join(','), 'preservados: ' + fica.join(', '));
    // o caminho /index.html não "some": o dono abriu mão da capa antiga e a
    // capa do app toma o lugar dela — o site continua com uma capa.
    const some = d2.blocos['Some'] || [];
    assert(some.length === 0, 'nada devia sair do mapa do site: ' + some.join(', '));
    const atualiza = d2.blocos['Atualiza'] || [];
    assert(atualiza.includes('/index.html'), 'a capa do app devia ocupar o /index.html: ' + atualiza.join(', '));
    return `desbloqueado; /index.html passa a ser a capa do app; ${fica.length} herdados preservados: ${fica.join(', ')}`;
  });


  // ---------------------------------------------------------------------
  // FASE 2 — publicar DE VERDADE por cima da cobaia e devolvê-la ao lugar.
  // Só com NOSTERMENTOR_BOSTIL_REAL=1. A restauração corre num caso
  // próprio, para acontecer mesmo se a publicação falhar a meio.
  // ---------------------------------------------------------------------
  if (fase !== '1') return R;

  const manifestAntes = JSON.parse(fs.readFileSync(path.join(SALVAGUARDA, 'manifest_antes.json'), 'utf8')).evento;
  let publicado = null;

  await it('aceite 2 (REDE REAL): remover a capa herdada → publicar a página nova → o manifest novo tem os 3 caminhos antigos intactos + os novos', async () => {
    assert(manifestAntes && manifestAntes.kind === 15128, 'salvaguarda ausente ou inválida');
    const p = await abrir(ctx, u.url);
    await p.pg.evaluate((pk) => Db.apagar(pk), u.PUBKEY_BOSTIL);
    await entrarCom(p.pg, nsec);
    const d = await esperarT2(p.pg, 90000);
    assert(d.desfecho === 't2c', JSON.stringify(d));
    await p.pg.click('#ir-inicio'); await p.pg.waitForSelector('#t3');

    // 1. a página nova, pela tela
    await p.pg.click('#menu .item[data-tela="t4"]'); await p.pg.waitForSelector('#t4');
    await p.pg.click('#novo-registro'); await p.pg.waitForSelector('#editor[data-tipo="page"]');
    await p.pg.fill('#ed-titulo', TITULO_PAGINA);
    await p.pg.fill('#ed-corpo', 'Pagina publicada pelo teste do aceite 2 do marco M4, para provar que publicar pelo Nostermentor preserva os arquivos que ja estavam no ar. Sera removida a seguir.');
    await p.pg.click('#ed-salvar');
    await p.pg.waitForFunction(() => /Salvo/.test(document.getElementById('ed-status').textContent), null, { timeout: 10000 });

    // 2. o dono remove a capa antiga (o bloqueio obriga-o a decidir)
    await p.pg.click('#menu .item[data-tela="t6"]'); await p.pg.waitForSelector('#t6-tabela');
    await p.pg.click('#t6-abas .aba[data-aba="herdados"]');   // M5: os herdados têm aba própria (14 T6)
    await p.pg.waitForSelector('#t6-tabela tr[data-path="/index.html"]');
    await p.pg.click('#t6-tabela tr[data-path="/index.html"] .t6-remover');
    await p.pg.waitForSelector('#t6b-remover'); await p.pg.click('#t6b-remover');
    await p.pg.waitForFunction(() => { const tr = document.querySelector('#t6-tabela tr[data-path="/index.html"]'); return tr && tr.classList.contains('removida'); }, null, { timeout: 10000 });

    // 3. publicar de verdade
    await p.pg.click('#btn-publicar');
    await p.pg.waitForSelector('#t8-total', { timeout: 90000 });
    assert((await p.pg.evaluate(() => document.getElementById('t8-assinar').disabled)) === false, 'continua bloqueado depois de remover a capa');
    await p.pg.click('#t8-assinar');
    await p.pg.waitForSelector('#t8-publicado', { timeout: 300000 });
    const placar = await p.pg.evaluate(() => ({ relays: document.getElementById('t8-placar-relays').textContent }));
    const banco = await lerBanco(p.pg, u.PUBKEY_BOSTIL);
    publicado = { paths: banco.published.paths, id: banco.published.manifest_event_id };
    await p.pg.screenshot({ path: u.captura('bostil-aceite2-publicado'), fullPage: true });
    const v = await varrer(p.pg, nsec);
    assert(v.achados.length === 0, 'varredura: ' + v.achados.join(' | '));
    await p.pg.close();

    // os 3 herdados que o dono NÃO removeu continuam com o hash exato de antes
    for (const c of Object.keys(PATHS_BOSTIL)) {
      if (c === '/index.html') continue;
      assert(publicado.paths[c] === PATHS_BOSTIL[c], 'herdado perdido ou alterado: ' + c + ' → ' + publicado.paths[c]);
    }
    assert(publicado.paths['/prova-de-preservacao.html'], 'a página nova não entrou no mapa');
    assert(!/aceito em 0 de/.test(placar.relays), placar.relays);
    return `${Object.keys(publicado.paths).length} caminhos · ${placar.relays} · manifest ${publicado.id.slice(0, 12)}…`;
  });

  await it('juiz independente: o manifest publicado está nos relays e traz os 3 caminhos antigos com o mesmo sha256', async () => {
    assert(publicado, 'a publicação não correu');
    const j = juiz(u.PUBKEY_BOSTIL, manifestAntes.tags.filter(t => t[0] === 'relay').map(t => t[1]));
    assert(j.evento && j.mais_recente, 'nenhum relay tem o manifest: ' + JSON.stringify(j.por_relay));
    assert(j.evento.id === publicado.id, 'o relay tem outro evento: ' + j.evento.id.slice(0, 12) + ' vs ' + publicado.id.slice(0, 12));
    const paths = {};
    for (const t of j.evento.tags) if (t[0] === 'path') paths[t[1]] = t[2];
    for (const c of Object.keys(PATHS_BOSTIL)) {
      if (c === '/index.html') continue;
      assert(paths[c] === PATHS_BOSTIL[c], 'no manifest da REDE o herdado mudou: ' + c);
    }
    const com = Object.keys(j.por_relay).filter(r => j.por_relay[r].mais_recente && j.por_relay[r].mais_recente.id === j.evento.id);
    return `${com.length} de ${j.total} relays; ${Object.keys(paths).length} caminhos, os 3 herdados intactos`;
  });

  await it('juiz independente: os 3 blobs herdados continuam a voltar dos servidores com o hash certo (não foram tocados)', async () => {
    const linhas = [];
    for (const c of Object.keys(PATHS_BOSTIL)) {
      if (c === '/index.html') continue;
      const sha = PATHS_BOSTIL[c];
      let achado = null;
      for (const sv of SERVIDORES) {
        try { const r = await fetch(sv + '/' + sha); if (!r.ok) continue; const b = Buffer.from(await r.arrayBuffer()); if (sha256(b) === sha) { achado = sv; break; } } catch (e) {}
      }
      assert(achado, 'não voltou com o hash certo: ' + c);
      linhas.push(c);
    }
    return linhas.length + ' blobs herdados conferidos por hash';
  });

  await it('RESTAURO: reenviar a capa ao Blossom, republicar o manifest original (4 caminhos) e apagar os blobs do teste', async () => {
    const capaSha = PATHS_BOSTIL['/index.html'];
    const capa = fs.readFileSync(path.join(SALVAGUARDA, 'blobs', capaSha));
    assert(sha256(capa) === capaSha, 'a cópia de salvaguarda não bate com o hash — NÃO restaurar às cegas');
    const novos = Object.keys((publicado && publicado.paths) || {})
      .filter(c => !PATHS_BOSTIL[c]).map(c => publicado.paths[c]);

    const p = await abrir(ctx, u.url);
    const r = await p.pg.evaluate(async ([nsec, capaSha, capaArr, evAntes, servidores, novos]) => {
      const val = Chave.validarNsec(nsec);
      const assinar = (m) => Chave.assinar(m, val.sk);
      const saida = {};
      // 1. a capa volta aos servidores
      saida.capa = await Blossom.enviarEmTodos(servidores, { sha: capaSha, bytes: new Uint8Array(capaArr), mime: 'text/html', assinar });
      // 2. manifest NOVO com as tags do original (o 15128 é substituível:
      //    um created_at menor seria recusado, então reassina-se agora)
      const ev = assinar({ kind: 15128, created_at: Math.floor(Date.now() / 1000), tags: evAntes.tags, content: evAntes.content || '' });
      saida.evento = { id: ev.id, created_at: ev.created_at, paths: ev.tags.filter(t => t[0] === 'path').length };
      saida.relays = Relay.placar(await Relay.publicar(evAntes.tags.filter(t => t[0] === 'relay').map(t => t[1]), ev, {}));
      // 3. os blobs do teste saem
      saida.limpeza = [];
      for (const sha of novos) saida.limpeza.push(await Blossom.apagarEmTodos(servidores, { sha, assinar }));
      Chave.apagar(val.sk);
      return saida;
    }, [nsec, capaSha, Array.from(capa), manifestAntes, SERVIDORES, novos]);
    await p.pg.close();

    assert(r.capa.ok, 'a capa NÃO voltou aos servidores: ' + JSON.stringify(r.capa.porServidor.map(x => [x.servidor, x.estado, x.codigo])));
    assert(r.evento.paths === 4, 'o manifest restaurado devia ter 4 caminhos: ' + r.evento.paths);
    assert(r.relays.ok, 'nenhum relay aceitou o manifest restaurado: ' + JSON.stringify(r.relays));
    const apagados = r.limpeza.reduce((n, x) => n + x.deleted_from.length, 0);
    const recusados = r.limpeza.reduce((a, x) => a.concat(x.refused_by), []);
    return `capa em ${r.capa.aceitos.length} servidores · manifest ${r.evento.id.slice(0, 12)}… (4 caminhos) em ${r.relays.com}/${r.relays.total} relays · ${apagados} blobs de teste apagados${recusados.length ? ' · recusas: ' + JSON.stringify(recusados) : ''}`;
  });

  await it('RESTAURO conferido por fora: os gateways voltam a servir a capa original (18.830 B, sha256 33312796…)', async () => {
    const alvo = `https://${u.NPUB_BOSTIL}.nsite.lol/`;
    const esperado = PATHS_BOSTIL['/index.html'];
    let ok = null, ultimo = '';
    for (let i = 0; i < 18 && !ok; i++) {
      try {
        const res = await fetch(alvo, { redirect: 'follow' });
        const b = Buffer.from(await res.arrayBuffer());
        const etag = (res.headers.get('etag') || '').replace(/"/g, '');
        ultimo = res.status + ' ' + b.length + ' B etag=' + etag.slice(0, 12);
        if (res.ok && (sha256(b) === esperado || etag === esperado)) ok = { i, bytes: b.length };
      } catch (e) { ultimo = 'erro ' + e.message; }
      if (!ok) await new Promise(r2 => setTimeout(r2, 10000));
    }
    assert(ok, 'o gateway ainda não voltou à capa original em 3 min — último: ' + ultimo
      + ' (P1: cache de 1 h; os blobs e o manifest é que valem. Conferir de novo mais tarde antes de dar o Bostil por restaurado)');
    return `${alvo} de volta a ${ok.bytes} B em ~${(ok.i + 1) * 10} s`;
  });

  return R;
};
