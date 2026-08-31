// test/telas/escala.test.js — a biblioteca e os modais do editor com MUITOS
// arquivos. Nasceu como medição, para responder com número à pergunta do dono
// ("isso funciona com dezenas ou centenas?"), e a medição decidiu o desenho:
// com 300 arquivos a tela desenhava em ~130 ms — o tempo NUNCA foi o problema —
// mas abria **300 `blob:` ao mesmo tempo**, e cada um segura os bytes inteiros
// na memória. Com fotos de câmera são gigabytes, e no Tails a biblioteca já
// vive na RAM da sessão (P38 de `08`).
// Por isso o que este arquivo protege agora não é a velocidade: é o TETO.
const { abrir, coletor, assert, entrarCom, semearSite, esperarT2 } = require('../util.js');
const F = require('../fabrica.js');

module.exports = async function (ctx, u) {
  const { R, it, pulado } = coletor();
  if (!u.falso) { pulado('telas/escala', 'servidor falso indisponível'); return R; }
  const f = u.falso;
  f.blossom('e1', {});
  f.relay('e-ok', { escrita: 'aceita', eventos: [] });
  const POR_PAGINA = 24;

  // n imagens + alguns vídeos, para haver o que filtrar por tipo.
  async function comNArquivos(n, videos) {
    const ch = F.chave();
    const p = await abrir(ctx, u.url);
    await semearSite(p.pg, ch, { relays: [f.ws('e-ok')], servers: [f.url('e1')], title: 'Escala' });
    await entrarCom(p.pg, ch.nsec);
    await esperarT2(p.pg, 30000);
    await p.pg.evaluate(async ([pubkey, quantos, quantosVideos]) => {
      const db = await Db.abrir(pubkey);
      const site = await db.get('site', 'site');
      site.description = 'medição de escala';
      const ops = [{ op: 'put', store: 'site', chave: 'site', valor: site }];
      const base = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
      async function põe(path, mime, i) {
        const b = base.slice(); b[8] = i & 255; b[9] = (i >> 8) & 255; b[10] = mime.length & 255;
        ops.push({ op: 'put', store: 'media', valor: { id: Modelo.novoId(), path: path, mime: mime,
          size: b.length, sha256: await Blossom.sha256Hex(b), width: 640, height: 480, alt: '', caption: '',
          bytes: new Blob([b], { type: mime }), status: 'draft', servers: [], removal: null,
          metadata: { stripped: true, removed_segments: [], warning: null }, origin: 'upload',
          created_at: Modelo.agora(), updated_at: Modelo.agora(), previous_status: null } });
      }
      for (let i = 0; i < quantos; i++) await põe('/img/foto-' + i + '.png', 'image/png', i);
      for (let i = 0; i < quantosVideos; i++) await põe('/media/clipe-' + i + '.mp4', 'video/mp4', 1000 + i);
      await db.escrever(ops);
      db.fechar();
    }, [ch.pubkey, n, videos]);
    return { p, ch };
  }

  await it('44: com 300 arquivos a biblioteca mostra 24 por página — o teto é de MEMÓRIA (cada miniatura segura os bytes num blob:), não de velocidade', async () => {
    const { p } = await comNArquivos(300, 6);
    const t0 = Date.now();
    await p.pg.click('#menu .item[data-tela="t6"]');
    await p.pg.waitForSelector('#t6-tabela tbody tr');
    const ms = Date.now() - t0;
    const r = await p.pg.evaluate(() => ({
      linhas: document.querySelectorAll('#t6-tabela tbody tr').length,
      blobs: document.querySelectorAll('#t6-tabela img[src^="blob:"]').length,
      conta: document.querySelector('.paginacao .conta').textContent,
      paginas: [...document.querySelectorAll('.pag-num')].map(b => b.textContent)
    }));
    assert(r.linhas === 24, 'a página tem de ser de 24: ' + r.linhas);
    assert(r.blobs <= 24, 'é isto que tem de ficar limitado — blob: abertos: ' + r.blobs);
    assert(/1–24 de 306/.test(r.conta), r.conta);
    // 1 … 13 (306/24 = 12,75 → 13), com reticências no meio
    assert(r.paginas[0] === '1' && r.paginas[r.paginas.length - 1] === '13', JSON.stringify(r.paginas));
    await p.pg.close();
    return `306 arquivos → 24 linhas e ${r.blobs} blob: em ${ms} ms, 13 páginas`;
  });

  await it('44: filtro por tipo, busca por nome e a última página, na biblioteca', async () => {
    const { p } = await comNArquivos(300, 6);
    await p.pg.click('#menu .item[data-tela="t6"]');
    await p.pg.waitForSelector('#t6-tabela tbody tr');
    // filtro por tipo: 6 vídeos, uma página só
    await p.pg.click('.chip[data-tipo="video"]');
    await p.pg.waitForFunction(() => document.querySelectorAll('#t6-tabela tbody tr').length === 6, null, { timeout: 5000 });
    assert(/1–6 de 6/.test(await p.pg.textContent('.paginacao .conta')), await p.pg.textContent('.paginacao .conta'));
    assert(!(await p.pg.$('.pag-num')), 'com uma página só não há números para clicar');
    // busca dentro do filtro "todos"
    await p.pg.click('.chip[data-tipo="todos"]');
    await p.pg.waitForSelector('#t6-busca');
    await p.pg.fill('#t6-busca', 'foto-29');
    // foto-29, foto-290..299 = 11
    await p.pg.waitForFunction(() => /de 11$/.test(document.querySelector('.paginacao .conta').textContent), null, { timeout: 5000 });
    const focoNaBusca = await p.pg.evaluate(() => document.activeElement && document.activeElement.id);
    assert(focoNaBusca === 't6-busca', 'redesenhar não pode roubar o foco de quem está a escrever: ' + focoNaBusca);
    // busca sem resultado diz isso, em vez de uma tabela vazia
    await p.pg.fill('#t6-busca', 'nao-existe-nada-assim');
    await p.pg.waitForSelector('#t6-sem-resultado');
    // e a última página fecha a conta
    await p.pg.fill('#t6-busca', '');
    await p.pg.waitForFunction(() => document.querySelectorAll('.pag-num').length > 0, null, { timeout: 5000 });
    await p.pg.click('.pag-num[data-pagina="13"]');
    await p.pg.waitForFunction(() => /de 306$/.test(document.querySelector('.paginacao .conta').textContent), null, { timeout: 5000 });
    const ultima = await p.pg.evaluate(() => ({
      conta: document.querySelector('.paginacao .conta').textContent,
      linhas: document.querySelectorAll('#t6-tabela tbody tr').length
    }));
    assert(/289–306 de 306/.test(ultima.conta) && ultima.linhas === 18, JSON.stringify(ultima));
    await p.pg.close();
    return 'tipo, busca e a 13.ª página com as 18 que sobram';
  });

  await it('44: o modal "Inserir imagem" pagina também — era ele que abria 300 blob: de uma vez', async () => {
    const { p } = await comNArquivos(300, 6);
    await p.pg.click('#menu .item[data-tela="t5"]');
    await p.pg.waitForSelector('#t5');
    await p.pg.click('#novo-registro');
    await p.pg.waitForSelector('#editor[data-tipo="post"]');
    const t0 = Date.now();
    await p.pg.click('.ferramenta[data-acao="imagem"]');
    await p.pg.waitForSelector('.grade-inserir .inserir-opcao');
    const ms = Date.now() - t0;
    const r = await p.pg.evaluate(() => ({
      cartoes: document.querySelectorAll('.grade-inserir .inserir-opcao').length,
      blobs: document.querySelectorAll('.grade-inserir img[src^="blob:"]').length,
      conta: document.querySelector('.paginacao .conta').textContent,
      // 45: o cartão mostra o NOME, e o caminho fica no title. O primeiro
      // <span> do cartão é a caixa da miniatura — o nome é o seguinte.
      nome: document.querySelector('.grade-inserir .inserir-opcao > span:not(.mini-caixa)').textContent,
      titulo: document.querySelector('.grade-inserir .inserir-opcao').getAttribute('title')
    }));
    assert(r.cartoes === 24 && r.blobs <= 24, JSON.stringify(r));
    assert(/1–24 de 300/.test(r.conta), r.conta);
    assert(/^foto-\d+\.png$/.test(r.nome), 'o cartão tem de dizer só o nome do arquivo: ' + JSON.stringify(r.nome));
    assert(/^\/img\/foto-\d+\.png$/.test(r.titulo), 'e o caminho inteiro fica no title: ' + JSON.stringify(r.titulo));
    await p.pg.close();
    return `300 imagens → 24 cartões e ${r.blobs} blob: em ${ms} ms; cartão diz "${r.nome}"`;
  });
  return R;
};
