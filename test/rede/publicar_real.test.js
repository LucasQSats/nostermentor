// test/rede/publicar_real.test.js — aceite 1 do M4 na REDE REAL, com uma
// chave descartável gerada aqui: o dono entra, escreve, envia uma imagem com
// EXIF e clica uma vez em "Assinar e publicar". Depois confere-se tudo por
// fora do app (Node, sem o código do produto): os blobs por GET + sha256 nos
// servidores, o manifest 15128 nos relays, o site.json com o hash do
// manifest, e o gateway servindo o /index.html. Na sequência, a metade real
// do aceite 7 do M5: pela mesma UI de T7 já testada contra servidor falso
// (test/telas/t7_config.test.js), "tirar o site do ar" contra a rede real —
// manifest vazio publicado e blobs apagados dos dois servidores — e então o
// gateway conferido a devolver 404 no caminho da capa (05 §2.0/§2.2). O
// evento 15128 fica nos relays (é substituível; o mapa fica vazio); a npub é
// descartável e sem valor.
//
// NÃO corre por omissão: publicar deixa rasto público permanente. Ligue com
//   NOSTERMENTOR_PUBLICAR_REAL=1 test/roda.sh
const { abrir, varrer, coletor, assert, entrarCom, semearSite, esperarT2, lerBanco } = require('../util.js');
const F = require('../fabrica.js');
const { verifyEvent } = require('nostr-tools');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { execFileSync } = require('child_process');

const RELAYS = ['wss://nos.lol', 'wss://relay.damus.io', 'wss://relay.primal.net', 'wss://relay.nsite.lol',
  'wss://relay.wellorder.net', 'wss://nostr-pub.wellorder.net', 'wss://offchain.pub', 'wss://relay.nostr.wirednet.jp'];
const SERVIDORES = ['https://cdn.hzrd149.com', 'https://blossom.primal.net'];
const GATEWAY = 'nsite.lol';

// juiz independente: o mesmo script do teste do Bostil, noutro processo,
// sem nostr-tools do app e sem o código do produto (02 §F).
function juiz(pubkey, relays) {
  const saida = execFileSync(process.execPath, ['--experimental-websocket', path.join(__dirname, 'consulta_independente.js'), pubkey, ...relays],
    { encoding: 'utf8', timeout: 90000, stdio: ['ignore', 'pipe', 'ignore'] });
  return JSON.parse(saida.trim().split('\n').filter(l => l.startsWith('{')).pop());
}
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');

module.exports = async function (ctx, u) {
  const { R, it, pulado } = coletor();
  if (!process.env.NOSTERMENTOR_PUBLICAR_REAL) {
    pulado('rede/publicar_real (todos os casos)', 'publica de verdade na rede — ligue com NOSTERMENTOR_PUBLICAR_REAL=1');
    return R;
  }
  // Um site por execução, não um por motor: publicar deixa rasto público.
  if (u.motor !== 'firefox') { pulado('rede/publicar_real (' + u.motor + ')', 'já publicado no primeiro motor — não se duplica lixo na rede'); return R; }
  const ch = F.chave();
  const EXIF = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'limpeza', 'exif.jpg'));
  let publicado = null;

  await it('aceite 1 (rede real): chave nova → 1 página + 1 artigo + 1 imagem com EXIF → T6a limpa e o pré-flight aceita nos 2 servidores → T8 publica com um clique', async () => {
    const p = await abrir(ctx, u.url);
    await semearSite(p.pg, ch, { relays: RELAYS, servers: SERVIDORES, title: 'Nostermentor — teste M4' });
    await entrarCom(p.pg, ch.nsec);
    await esperarT2(p.pg, 60000);
    await p.pg.evaluate(async ([pubkey, npub]) => {
      const db = await Db.abrir(pubkey);
      const site = await db.get('site', 'site');
      site.description = 'Site descartável criado pelo teste automático do marco M4.';
      const home = Modelo.novaPagina('Início'); home.body = 'Este site foi publicado por um teste automático do Nostermentor e será apagado.';
      const artigo = Modelo.novoArtigo('Publicado pelo app'); artigo.body = 'Primeiro artigo publicado pelo próprio Nostermentor, e não pelo nsyte.'; artigo.date = '2026-08-26T00:00:00Z';
      site.home = { mode: 'page', page_id: home.id, latest_posts: 5 };
      await db.escrever([{ op: 'put', store: 'site', chave: 'site', valor: site }, { op: 'put', store: 'pages', valor: home }, { op: 'put', store: 'posts', valor: artigo }]);
      db.fechar();
    }, [ch.pubkey, ch.npub]);
    await p.pg.click('#menu .item[data-tela="t6"]'); await p.pg.waitForSelector('#t6a');
    await p.pg.setInputFiles('#t6a-arquivos', { name: 'foto-com-exif.jpg', mimeType: 'image/jpeg', buffer: EXIF });
    await p.pg.waitForSelector('#t6a-pendentes .pendente');
    await p.pg.waitForFunction(() => !document.querySelector('#t6a-pendentes .pre.verificando'), null, { timeout: 60000 });
    const pre = await p.pg.evaluate(() => [...document.querySelectorAll('#t6a-pendentes .pre')].map(x => x.textContent.trim()));
    assert(pre.length === 2 && pre.every(x => /vai aceitar/.test(x)), JSON.stringify(pre));
    await p.pg.click('#t6a-adicionar'); await p.pg.waitForSelector('#t6-tabela');

    await p.pg.click('#btn-publicar');
    await p.pg.waitForSelector('#t8-total', { timeout: 60000 });
    await p.pg.click('#t8-assinar');
    await p.pg.waitForSelector('#t8-publicado', { timeout: 300000 });
    const placar = await p.pg.evaluate(() => ({ arquivos: [...document.querySelectorAll('#t8-placar-arquivos li')].map(x => x.textContent), relays: document.getElementById('t8-placar-relays').textContent }));
    const banco = await lerBanco(p.pg, ch.pubkey);
    publicado = { paths: banco.published.paths, id: banco.published.manifest_event_id, evento: banco.published.manifest_event, media: banco.media };
    const v = await varrer(p.pg, ch.nsec);
    assert(v.achados.length === 0, 'varredura: ' + v.achados.join(' | '));
    await p.pg.screenshot({ path: u.captura('m4-publicado-real'), fullPage: true });
    await p.pg.close();
    assert(/aceito em (\d+) de \d+ relays/.test(placar.relays) && !/aceito em 0 de/.test(placar.relays), placar.relays);
    assert(banco.media[0].sha256 !== require('crypto').createHash('sha256').update(EXIF).digest('hex'), 'a imagem devia ter sido limpa antes de subir');
    return `${Object.keys(publicado.paths).length} caminhos · ${placar.relays} · ${placar.arquivos.join(' ')}`;
  });

  await it('juiz independente: cada caminho do manifest volta dos servidores com o sha256 certo (GET + hash, sem o código do app)', async () => {
    assert(publicado, 'a publicação não correu');
    const linhas = [];
    for (const caminho of Object.keys(publicado.paths)) {
      const sha = publicado.paths[caminho];
      let achado = null;
      for (const s of SERVIDORES) {
        try {
          const r = await fetch(s + '/' + sha, { redirect: 'follow' });
          if (!r.ok) continue;
          const b = Buffer.from(await r.arrayBuffer());
          if (sha256(b) === sha) { achado = s; break; }
        } catch (e) {}
      }
      assert(achado, 'não voltou com o hash certo de nenhum servidor: ' + caminho + ' ' + sha);
      linhas.push(caminho);
    }
    return `${linhas.length} caminhos conferidos por hash`;
  });

  await it('juiz independente: o manifest 15128 está nos relays, assinado por esta chave, com title/description e os mesmos caminhos', async () => {
    assert(publicado, 'a publicação não correu');
    const j = juiz(ch.pubkey, RELAYS);
    assert(j.evento && j.mais_recente, 'nenhum relay tem o manifest: ' + JSON.stringify(j.por_relay));
    const com = Object.keys(j.por_relay).filter(r => j.por_relay[r].mais_recente && j.por_relay[r].mais_recente.id === j.mais_recente.id);
    const ev = j.evento;
    assert(verifyEvent(ev) && ev.pubkey === ch.pubkey && ev.kind === 15128, 'evento inválido');
    assert(ev.id === publicado.id, 'o relay tem outro evento: ' + ev.id + ' vs ' + publicado.id);
    const paths = {};
    for (const t of ev.tags) if (t[0] === 'path') paths[t[1]] = t[2];
    // comparação por pares ordenados: a ordem das chaves de um objeto não é
    // contrato (o app guarda na ordem de geração; as tags saem ordenadas)
    const pares = (o) => Object.keys(o).sort().map(k => k + '=' + o[k]).join('\n');
    assert(pares(paths) === pares(publicado.paths), 'mapa diferente do que o app guardou:\n' + pares(paths) + '\n---\n' + pares(publicado.paths));
    const tag = (n) => ev.tags.filter(t => t[0] === n).map(t => t[1]);
    assert(tag('title')[0] === 'Nostermentor — teste M4' && tag('description').length === 1 && tag('client')[0] === 'nostermentor', JSON.stringify([tag('title'), tag('client')]));
    assert(tag('server').length === 2 && tag('relay').length === 8, JSON.stringify([tag('server').length, tag('relay').length]));
    return `${com.length} de ${RELAYS.length} relays com o manifest ${ev.id.slice(0, 12)}… (juiz: ${j.respondidos} responderam)`;
  });

  await it('juiz independente: o site.json do Blossom bate com o hash do manifest e descreve a página, o artigo e a imagem', async () => {
    const caminho = '/nostermentor/site.json';
    const sha = publicado.paths[caminho];
    assert(sha, 'o manifest não tem o site.json');
    let texto = null;
    for (const s of SERVIDORES) { try { const r = await fetch(s + '/' + sha); if (r.ok) { const b = Buffer.from(await r.arrayBuffer()); if (sha256(b) === sha) { texto = b.toString('utf8'); break; } } } catch (e) {} }
    assert(texto, 'não consegui baixar o site.json');
    const j = JSON.parse(texto);
    assert(j.format === 'nostermentor-site' && j.version === 1, JSON.stringify([j.format, j.version]));
    assert(j.pages.length === 1 && j.posts.length === 1 && j.media.length === 1, JSON.stringify([j.pages.length, j.posts.length, j.media.length]));
    assert(j.site.title === 'Nostermentor — teste M4' && !j.site.network.capabilities, 'o cache do pré-flight não pode ir para a rede (13 §6.2)');
    return `${j.pages.length} página, ${j.posts.length} artigo, ${j.media.length} imagem`;
  });

  await it('gateway: https://<npub>.nsite.lol/ serve o index.html publicado (etag = sha256, P1) — com espera, porque o gateway leva minutos', async () => {
    const alvo = `https://${ch.npub}.${GATEWAY}/`;
    const esperado = publicado.paths['/index.html'];
    let ok = null, ultimo = '';
    for (let i = 0; i < 12 && !ok; i++) {
      try {
        const r = await fetch(alvo, { redirect: 'follow' });
        const b = Buffer.from(await r.arrayBuffer());
        const etag = (r.headers.get('etag') || '').replace(/"/g, '');
        ultimo = r.status + ' etag=' + etag.slice(0, 16);
        if (r.ok && (sha256(b) === esperado || etag === esperado)) ok = { etag, status: r.status, i };
      } catch (e) { ultimo = 'erro ' + e.message; }
      if (!ok) await new Promise(r2 => setTimeout(r2, 10000));
    }
    assert(ok, 'o gateway não serviu o index.html em 2 min — último: ' + ultimo + ' (P1: pode demorar; não é falha do app se os blobs e o manifest estão certos)');
    return `${alvo} em ~${(ok.i + 1) * 10} s`;
  });

  await it('M5 aceite 7 (rede real): pela UI de T7, "tirar o site do ar" publica um manifest VAZIO e apaga os blobs nos dois servidores', async () => {
    assert(publicado, 'a publicação não correu');
    const p = await abrir(ctx, u.url);
    await entrarCom(p.pg, ch.nsec);
    await esperarT2(p.pg, 60000);
    await p.pg.click('#menu .item[data-tela="t7"]');
    await p.pg.waitForSelector('#t7-painel');
    await p.pg.click('.abas .aba[data-aba="avancado"]');
    if (await p.pg.$('#t7-avancado-mostrar')) await p.pg.click('#t7-avancado-mostrar');
    await p.pg.waitForSelector('#t7-tirar-do-ar');
    const titulo = await p.pg.inputValue('#t7-titulo').catch(() => null) || 'Nostermentor — teste M4';
    await p.pg.fill('#t7-tirar-confirma', titulo);
    await p.pg.click('#t7-tirar-botao');
    await p.pg.waitForSelector('#t7-tirar-feito', { timeout: 120000 });
    const placar = await p.pg.textContent('#t7-tirar-do-ar');
    const v = await varrer(p.pg, ch.nsec);
    assert(v.achados.length === 0, 'varredura: ' + v.achados.join(' | '));
    await p.pg.close();
    assert(/Mapa vazio aceito em \d+ de \d+ relays/.test(placar) && !/aceito em 0 de/.test(placar), placar.slice(0, 300));
    return placar.replace(/\s+/g, ' ').trim().slice(0, 200);
  });

  await it('juiz independente: o gateway devolve 404 no caminho da capa depois do "tirar do ar" (05 §2.0/§2.2)', async () => {
    const alvo = `https://${ch.npub}.${GATEWAY}/`;
    let ultimo = null;
    for (let i = 0; i < 18; i++) {
      try {
        const r = await fetch(alvo, { redirect: 'follow' });
        ultimo = r.status;
        if (r.status === 404) return `${alvo} → 404 em ~${(i + 1) * 10} s`;
      } catch (e) { ultimo = 'erro ' + e.message; }
      await new Promise(r2 => setTimeout(r2, 10000));
    }
    assert(false, 'o gateway não passou a devolver 404 em 3 min — último status: ' + ultimo + ' (P1: pode demorar mais)');
  });

  await it('limpeza (aceite 8): nenhum blob de teste continua no ar nos dois servidores', async () => {
    let aindaNoAr = 0;
    for (const sha of Array.from(new Set(Object.values(publicado.paths)))) {
      for (const s of SERVIDORES) { try { const res = await fetch(s + '/' + sha, { method: 'HEAD' }); if (res.ok) aindaNoAr++; } catch (e) {} }
    }
    return `ainda no ar: ${aindaNoAr} (0 esperado; P13: um servidor pode levar minutos a parar de servir)`;
  });

  return R;
};
