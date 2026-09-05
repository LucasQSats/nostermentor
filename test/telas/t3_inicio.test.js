// test/telas/t3_inicio.test.js — T3 Início (14 T3) pela INTERFACE, nos dois
// motores: os seis cartões que o dono vê primeiro. O que o t2_t3 não cobre e
// o M5 fechou: o REENVIO com placar relay por relay (14 T3: "resultado em
// placar na hora"), a TRAVA de publicação concorrente (13 §5.5 — nunca
// reenviar um manifest que a rede já ultrapassou), os atalhos que têm de
// levar às telas certas e o "Ver o site" que diz quando o endereço ainda não
// mostra nada.
const { abrir, coletor, assert, entrarCom, semearSite, esperarT2, lerBanco } = require('../util.js');
const F = require('../fabrica.js');

module.exports = async function (ctx, u) {
  const { R, it, pulado } = coletor();
  if (!u.falso) { pulado('telas/t3_inicio (todos os casos)', 'servidor falso indisponível'); return R; }
  const f = u.falso, servers = [f.base];

  // Site publicado de verdade (manifest assinado + site.json com hash), como
  // a rede o devolveria: é o único jeito de o reenvio ter o que reenviar.
  function siteNaRede(nomeRelay, opts) {
    const ch = F.chave();
    const sj = F.siteExemplo(ch, { servers });
    f.blob(sj.bytes, 'application/json');
    const man = F.manifest(ch, Object.assign({ paths: F.pathsDoExemplo(sj), servers, title: 'Site do teste T3', created_at: F.agora() - 60 }, opts || {}));
    f.relay(nomeRelay, { eventos: [man], escrita: 'aceita' });
    return { ch, sj, man };
  }
  // Chave nova, sem nada publicado: T2 acaba em "não encontrei um site" e o
  // dono começa um site novo (é o estado em que a maioria vê T3 pela 1ª vez).
  async function siteNovo(relays) {
    const ch = F.chave();
    const p = await abrir(ctx, u.url);
    await semearSite(p.pg, ch, { relays: relays, servers, title: 'Site novo' });
    await entrarCom(p.pg, ch.nsec);
    const d = await esperarT2(p.pg, 30000);
    assert(d.desfecho === 't2b-sem-site', 'esperava T2b sem site: ' + JSON.stringify(d));
    await p.pg.click('#comecar-site');
    await p.pg.waitForFunction(() => Shell.telaAtual() === 't7');
    return { p, ch };
  }
  async function irAoInicio(pg) { await pg.click('#menu .item[data-tela="t3"]'); await pg.waitForSelector('#cartao-saude'); }

  await it('reenvio (14 T3): com relay sem o site, "Republicar" reenvia o manifest JÁ ASSINADO — sem a chave — e mostra o placar RELAY POR RELAY (aceitou / recusou); a saúde passa de 1 para 2 de 3', async () => {
    const { ch, man } = siteNaRede('i-atual');
    f.relay('i-sem', { eventos: [], escrita: 'aceita' });
    f.relay('i-recusa', { eventos: [], escrita: 'recusa' });
    const relays = [f.ws('i-atual'), f.ws('i-sem'), f.ws('i-recusa')];
    const p = await abrir(ctx, u.url);
    await semearSite(p.pg, ch, { relays, servers });
    await entrarCom(p.pg, ch.nsec);
    const d = await esperarT2(p.pg, 30000);
    assert(d.tela === 't3', JSON.stringify(d));
    const antes = await p.pg.evaluate(() => ({
      saude: document.getElementById('saude-resumo').textContent,
      botao: (() => { const b = document.getElementById('republicar'); return b ? (b.disabled ? 'desligado' : 'ligado') : 'ausente'; })(),
      apoio: document.querySelector('#cartao-saude .acoes span.apoio').textContent,
      placar: !!document.getElementById('reenvio-placar')
    }));
    assert(antes.saude === 'Seu site está em 1 de 3 relays' && antes.botao === 'ligado' && !antes.placar, JSON.stringify(antes));
    assert(antes.apoio === 'Reenvia o mapa já assinado — não precisa da sua chave.', antes.apoio);
    await p.pg.click('#republicar');
    await p.pg.waitForFunction(() => /2 de 3/.test((document.getElementById('saude-resumo') || {}).textContent || ''), null, { timeout: 25000 });
    const dep = await p.pg.evaluate(() => ({
      saude: document.getElementById('saude-resumo').textContent,
      faixa: document.getElementById('faixa').textContent,
      titulo: document.getElementById('reenvio-titulo').textContent,
      linhas: [...document.querySelectorAll('#reenvio-placar li')].map(li => li.getAttribute('data-reenvio') + '|' + li.querySelector('code').textContent + '|' + li.querySelector('span').textContent),
      estados: [...document.querySelectorAll('#lista-relays li')].map(li => li.getAttribute('data-estado')).join(',')
    }));
    await p.pg.screenshot({ path: u.captura('t3-reenvio'), fullPage: true });
    assert(dep.saude === 'Seu site está em 2 de 3 relays' && dep.estados === 'atual,atual,sem', JSON.stringify(dep));
    assert(/^Reenviado\. Aceito em 1 de 2 relays\./.test(dep.faixa), dep.faixa);
    assert(dep.titulo === 'Resultado do reenvio, relay por relay:', dep.titulo);
    const aceito = dep.linhas.find(l => l.indexOf('i-sem') >= 0), recusado = dep.linhas.find(l => l.indexOf('i-recusa') >= 0);
    assert(dep.linhas.length === 2 && /^aceito\|/.test(aceito) && /aceitou$/.test(aceito), JSON.stringify(dep.linhas));
    assert(/^recusado\|/.test(recusado) && /recusou: blocked/.test(recusado), JSON.stringify(dep.linhas));
    // o evento que chegou ao relay é o MESMO que já estava assinado
    const chegaram = f.publicadosEm('i-sem');
    assert(chegaram.some(e => e.id === man.id && e.kind === 15128), 'o manifest reenviado não chegou ao relay que não o tinha');
    assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros }));
    await p.pg.close();
    return 'placar: ' + dep.linhas.join(' · ');
  });

  await it('trava de publicação concorrente (13 §5.5): relay com manifest MAIS NOVO → "Republicar" fica à vista e DESLIGADO, com a explicação e "Recarregar da rede"; nenhum evento sai daqui', async () => {
    const { ch, sj } = siteNaRede('c-a');
    f.relay('c-b', { eventos: [], escrita: 'aceita' });
    const relays = [f.ws('c-a'), f.ws('c-b')];
    const p = await abrir(ctx, u.url);
    await semearSite(p.pg, ch, { relays, servers });
    await entrarCom(p.pg, ch.nsec);
    await esperarT2(p.pg, 30000);
    // outra máquina publica: o mesmo site, mais novo
    const maisNovo = F.manifest(ch, { paths: F.pathsDoExemplo(sj, F.sha256('outro')), servers, title: 'Site do teste T3', created_at: F.agora() + 30 });
    f.relay('c-a', { eventos: [maisNovo], escrita: 'aceita' });
    await p.pg.click('#verificar-saude');
    await p.pg.waitForSelector('#republicar-travado', { timeout: 25000 });
    const est = await p.pg.evaluate(() => ({
      botao: document.getElementById('republicar').disabled,
      aviso: document.getElementById('republicar-travado').textContent,
      recarregar: !!document.getElementById('recarregar-rede'),
      faixa: document.getElementById('faixa').textContent,
      estados: [...document.querySelectorAll('#lista-relays li')].map(li => li.getAttribute('data-estado')).join(',')
    }));
    await p.pg.screenshot({ path: u.captura('t3-concorrente-travado'), fullPage: true });
    assert(est.botao === true && est.recarregar && est.estados === 'mais_novo,sem', JSON.stringify(est));
    assert(/Não dá para reenviar agora/.test(est.aviso) && /mandaria o seu site para trás/.test(est.aviso), est.aviso);
    assert(/versão mais nova/.test(est.faixa), est.faixa);
    assert(f.publicadosEm('c-b').length === 0, 'nada devia ter sido reenviado com a rede à frente');
    await p.pg.click('#recarregar-rede');
    await p.pg.waitForFunction(() => Shell.telaAtual() === 't2');
    assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros }));
    await p.pg.close();
    return 'travado, com saída para T2';
  });

  await it('atalhos (14 T3 cartão 4): "Novo artigo" e "Nova página" abrem o editor certo, "Enviar mídia" abre T6a com o seletor em foco, "Como apoiar" leva à Ajuda; "Ver o site" tem o endereço do gateway e diz que ainda não foi publicado', async () => {
    f.relay('a-vazio', { modo: 'vazio', eventos: [] });
    const { p, ch } = await siteNovo([f.ws('a-vazio')]);
    await irAoInicio(p.pg);
    const site = await p.pg.evaluate(() => ({
      href: document.getElementById('ver-site').getAttribute('href'),
      aviso: document.getElementById('ver-site-aviso').textContent,
      // Os endereços deixaram de ser uma linha dos atalhos e viraram o cartão
      // 5 — aqui só se confere que o cartão de atalhos NÃO os traz de volta.
      linksAtalhos: [...document.querySelectorAll('#cartao-atalhos a')].map(a => a.textContent),
      naoPublicado: document.getElementById('saude-nao-publicado').textContent
    }));
    assert(site.href === `https://${ch.npub}.nsite.lol/`, site.href);
    assert(/ainda não publicado/.test(site.aviso) && /só mostra o site depois da primeira publicação/.test(site.aviso), site.aviso);
    assert(site.linksAtalhos.join(',') === 'Ver o site', site.linksAtalhos.join(','));
    assert(site.naoPublicado === 'Seu site ainda não foi publicado.', site.naoPublicado);
    await p.pg.click('#cartao-atalhos button:has-text("Novo artigo")');
    await p.pg.waitForSelector('#editor[data-tipo="post"]');
    await irAoInicio(p.pg);
    await p.pg.click('#cartao-atalhos button:has-text("Nova página")');
    await p.pg.waitForSelector('#editor[data-tipo="page"]');
    await irAoInicio(p.pg);
    await p.pg.click('#cartao-atalhos button:has-text("Enviar mídia")');
    await p.pg.waitForSelector('#t6a-arquivos');
    const foco = await p.pg.evaluate(() => document.activeElement && document.activeElement.id);
    assert(foco === 't6a-arquivos', 'o seletor de arquivo não ficou em foco: ' + foco);
    await irAoInicio(p.pg);
    await p.pg.click('#cartao-apoie button:has-text("Como apoiar")');
    await p.pg.waitForFunction(() => Shell.telaAtual() === 't11');
    assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros }));
    await p.pg.close();
    return 'os cinco atalhos chegam onde 14 T3 diz';
  });

  await it('endereços (14 T3 cartão 5): os TRÊS gateways, cada um com o endereço completo e um QR gerado aqui dentro — desenhado, com zona de silêncio, sem buscar nada de fora; e "Copiar" nunca fica mudo', async () => {
    f.relay('a-vazio-qr', { modo: 'vazio', eventos: [] });
    const { p, ch } = await siteNovo([f.ws('a-vazio-qr')]);
    await irAoInicio(p.pg);
    await p.pg.waitForSelector('#cartao-enderecos .qr');
    await p.pg.screenshot({ path: u.captura('t3-enderecos'), fullPage: true });
    const e = await p.pg.evaluate(() => {
      const itens = [...document.querySelectorAll('#cartao-enderecos li.endereco')];
      return {
        n: itens.length,
        hosts: itens.map(li => li.querySelector('.endereco-url a').textContent),
        urls: itens.map(li => li.querySelector('.endereco-completo').textContent),
        hrefs: itens.map(li => li.querySelector('.endereco-url a').getAttribute('href')),
        // O QR tem de ser SVG desenhado no próprio painel: um <img> com src
        // externo seria exatamente o vazamento que este cartão não pode ter.
        qrTags: itens.map(li => li.querySelector('.qr') && li.querySelector('.qr').tagName.toLowerCase()),
        qrRotulos: itens.map(li => li.querySelector('.qr').getAttribute('aria-label')),
        qrCaixas: itens.map(li => li.querySelector('.qr').getAttribute('viewBox')),
        imagens: document.querySelectorAll('#cartao-enderecos img').length,
        aviso: document.getElementById('enderecos-aviso').textContent,
        botoes: itens.map(li => !!li.querySelector('.copiar-endereco') && !!li.querySelector('.baixar-qr')),
        baixarNomes: itens.map(li => li.querySelector('.baixar-qr').getAttribute('download'))
      };
    });
    assert(e.n === 3, 'esperava três endereços, veio ' + e.n);
    assert(e.hosts.join(',') === 'nsite.lol,nsite.cloud,nsite.run', e.hosts.join(','));
    for (let i = 0; i < 3; i++) {
      assert(e.urls[i] === `https://${ch.npub}.${e.hosts[i]}/`, e.urls[i]);
      assert(e.hrefs[i] === e.urls[i], e.hrefs[i] + ' != ' + e.urls[i]);
      assert(e.qrTags[i] === 'svg', 'o QR de ' + e.hosts[i] + ' não é SVG: ' + e.qrTags[i]);
      assert(e.qrRotulos[i].indexOf(e.urls[i]) >= 0, 'o QR não diz o endereço a quem ouve: ' + e.qrRotulos[i]);
      assert(e.botoes[i], 'faltou copiar ou baixar em ' + e.hosts[i]);
      assert(/^qrcode-nsite\.[a-z]+-[a-z0-9]{8}\.png$/.test(e.baixarNomes[i]), e.baixarNomes[i]);
    }
    // Três endereços diferentes têm de dar três códigos diferentes — um QR
    // desenhado uma vez e repetido levaria toda a gente ao mesmo gateway.
    const caminhos = await p.pg.evaluate(() => [...document.querySelectorAll('#cartao-enderecos .qr path')].map(p2 => p2.getAttribute('d')));
    assert(new Set(caminhos).size === 3, 'os três QR têm o mesmo desenho');
    // Zona de silêncio: nada pintado nos 4 módulos da borda (a norma exige, e
    // sem ela muitos leitores não acham o código).
    const margens = await p.pg.evaluate(() => [...document.querySelectorAll('#cartao-enderecos .qr')].map(function (svg) {
      const lado = Number(svg.getAttribute('viewBox').split(' ')[3]);
      const d = svg.querySelector('path').getAttribute('d');
      let fora = 0;
      for (const m of d.matchAll(/M(\d+) (\d+)h(\d+)/g)) {
        const x = +m[1], y = +m[2], w = +m[3];
        if (y < 4 || y >= lado - 4 || x < 4 || x + w > lado - 4) fora++;
      }
      return fora;
    }));
    assert(margens.every(x => x === 0), 'há módulo pintado na zona de silêncio: ' + JSON.stringify(margens));
    assert(e.imagens === 0, 'o cartão tem <img> — o QR tem de ser desenhado aqui, não buscado');
    assert(/nunca foi publicado/.test(e.aviso), e.aviso);
    // "Copiar endereço" é um botão que o dono vai carregar no Tor Browser, e
    // ali a área de transferência pode simplesmente não estar disponível. O
    // que se exige NÃO é que a cópia funcione — é que a tela **diga qual dos
    // dois aconteceu** e nunca fique muda: silêncio depois de um clique é o
    // pior desfecho, porque ele não sabe se copiou.
    await p.pg.click('#cartao-enderecos li.endereco:first-child .copiar-endereco');
    await p.pg.waitForSelector('#cartao-enderecos li.endereco:first-child .endereco-aviso:not([hidden])', { timeout: 5000 });
    const copiaDiz = (await p.pg.textContent('#cartao-enderecos li.endereco:first-child .endereco-aviso')).trim();
    assert(copiaDiz === 'Endereço copiado.' || copiaDiz === 'Não consegui copiar. Selecione o endereço e copie à mão.',
      'a tela não disse o que aconteceu ao copiar: ' + JSON.stringify(copiaDiz));
    // 54 — o painel inteiro estoura a 320 px desde antes deste cartão, e se
    // ele é para telefone ou só para computador é decisão de produto por
    // tomar. Aqui não se julga isso: mede-se se o cartão novo PIOROU o
    // número, escondendo-o e medindo outra vez — que é o único jeito de
    // separar a contribuição dele do estouro que já existia.
    // A 1200 e a 1000 px (a menor janela real medida no Tor Browser, bancada
    // nº 1) a tela tem de caber sem rolagem: isso, sim, é aceite.
    const larguras = {};
    for (const w of [1200, 1000, 320]) {
      await p.pg.setViewportSize({ width: w, height: 800 });
      await p.pg.waitForTimeout(60);
      larguras[w] = await p.pg.evaluate(() => {
        const area = document.getElementById('conteudo').getBoundingClientRect();
        const fora = [...document.querySelectorAll('#cartao-enderecos *')]
          .map(el => ({ el: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''), dir: Math.round(el.getBoundingClientRect().right) }))
          .filter(x => x.dir > Math.round(area.right));
        // Isola a contribuição DESTE cartão: mede, esconde, mede outra vez.
        const c = document.getElementById('cartao-enderecos');
        const com = document.documentElement.scrollWidth;
        c.hidden = true;
        const sem = document.documentElement.scrollWidth;
        c.hidden = false;
        return { scroll: com, semOCartao: sem, cliente: document.documentElement.clientWidth,
          areaDir: Math.round(area.right), fora: fora.slice(0, 6), quantosFora: fora.length };
      });
    }
    assert(larguras[1200].scroll <= larguras[1200].cliente, 'a T3 estoura em 1200 px: ' + JSON.stringify(larguras[1200]));
    assert(larguras[1000].scroll <= larguras[1000].cliente, 'a T3 estoura em 1000 px: ' + JSON.stringify(larguras[1000]));
    assert(larguras[320].scroll === larguras[320].semOCartao, 'o cartão de endereços PIOROU a largura a 320 px: ' + larguras[320].scroll + ' com ele, ' + larguras[320].semOCartao + ' sem ele');
    assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros }));
    await p.pg.close();
    return 'três endereços, três QR distintos, margem limpa e nada de fora; cabe em 1200 e em 1000; a 320 px '
      + larguras[320].scroll + ' com o cartão e ' + larguras[320].semOCartao + ' sem ele (54: o estouro não é dele)';
  });

  await it('cartões 2, 3 e 6 (14 T3): contagens por estado, backup vermelho com "N não exportadas" e a linha da mídia só local, e os CINCO artigos mais recentes por data com o estado e "editar"', async () => {
    f.relay('b-vazio', { modo: 'vazio', eventos: [] });
    const { p, ch } = await siteNovo([f.ws('b-vazio')]);
    await p.pg.evaluate(async (pubkey) => {
      const db = await Db.abrir(pubkey);
      const ops = [];
      const datas = ['2026-01-05', '2026-03-09', '2026-05-14', '2026-06-20', '2026-07-02', '2026-08-11'];
      datas.forEach(function (d, i) {
        const a = Modelo.novoArtigo('Artigo de ' + d);
        a.date = d + 'T00:00:00Z';
        if (i === 0) { a.status = 'published'; a.published_hash = 'x'; }
        if (i === 1) { a.status = 'modified'; a.published_hash = 'x'; }
        ops.push({ op: 'put', store: 'posts', valor: a });
      });
      const bytes = new Blob([new Uint8Array([1, 2, 3, 4])]);
      ops.push({ op: 'put', store: 'media', valor: { id: Modelo.novoId(), path: '/img/local.png', mime: 'image/png', size: 4, sha256: 'a'.repeat(64),
        width: 2, height: 2, alt: '', caption: '', bytes: bytes, status: 'draft', servers: [], removal: null, metadata: {}, origin: 'upload',
        created_at: Modelo.agora(), updated_at: Modelo.agora() } });
      ops.push({ op: 'put', store: 'meta', valor: { key: 'alteracoes_nao_exportadas', value: 7 } });
      await db.escrever(ops);
      db.fechar();
    }, ch.pubkey);
    await irAoInicio(p.pg);
    const est = await p.pg.evaluate(() => ({
      resumo: document.getElementById('alteracoes-resumo').textContent,
      detalhe: document.querySelector('#cartao-alteracoes .apoio').textContent,
      backup: document.getElementById('backup-resumo').textContent,
      backupClasse: document.getElementById('backup-resumo').className,
      midia: document.querySelector('#cartao-backup .apoio').textContent,
      artigos: [...document.querySelectorAll('#cartao-ultimos li')].map(li => li.textContent.replace(/\s+/g, ' ').trim())
    }));
    await p.pg.screenshot({ path: u.captura('t3-cartoes'), fullPage: true });
    // 6 artigos (um já publicado, que não pende) + 1 página (a Home que
    // "Começar um site novo" criou) + 1 mídia
    assert(est.resumo === '5 artigos, 1 páginas, 1 mídias', est.resumo);
    assert(est.detalhe === 'novos: 6 · alterados: 1 · a remover: 0', est.detalhe);
    assert(/^7 alterações não exportadas/.test(est.backup) && /erro/.test(est.backupClasse), est.backup + ' / ' + est.backupClasse);
    assert(est.midia === '1 arquivos de mídia existem só neste navegador — entram obrigatoriamente no backup.', est.midia);
    assert(est.artigos.length === 5, 'esperava 5 artigos, veio ' + est.artigos.length);
    assert(/^2026-08-11 Artigo de 2026-08-11 \(rascunho\) editar$/.test(est.artigos[0]), est.artigos[0]);
    assert(/^2026-03-09 Artigo de 2026-03-09 \(alterado\) editar$/.test(est.artigos[4]), est.artigos[4]);
    await p.pg.click('#cartao-ultimos li:first-child button');
    await p.pg.waitForSelector('#editor[data-tipo="post"]');
    const titulo = await p.pg.inputValue('#ed-titulo');
    assert(titulo === 'Artigo de 2026-08-11', titulo);
    assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros }));
    await p.pg.close();
    return est.resumo + '; ' + est.backup;
  });

  await it('site fora do ar (T7 → Avançado): o cartão de saúde diz "fora do ar desde <data>" em vez de "está em N relays", oferece Publicar, e "Ver o site" avisa que o endereço não mostra nada', async () => {
    f.relay('d-vazio', { modo: 'vazio', eventos: [] });
    const { p, ch } = await siteNovo([f.ws('d-vazio')]);
    await p.pg.evaluate(async (pubkey) => {
      const db = await Db.abrir(pubkey);
      await db.put('published', { manifest_event: { id: 'f'.repeat(64), kind: 15128, pubkey: pubkey, created_at: Modelo.agora(), tags: [], content: '', sig: '0'.repeat(128) },
        manifest_event_id: 'f'.repeat(64), created_at: Modelo.agora(), paths: {}, relays: {}, servers: {}, metadata_events: {},
        takedown_at: '2026-08-27T13:00:00Z',
        health: { checked_at: '2026-08-27T13:00:00Z', relays_with_manifest: ['wss://x.test'], relays_outdated: [], relays_newer: [], relays_missing: [], relays_unreachable: [] } }, 'current');
      db.fechar();
    }, ch.pubkey);
    await irAoInicio(p.pg);
    const est = await p.pg.evaluate(() => ({
      fora: document.getElementById('saude-fora-do-ar').textContent,
      apoio: document.querySelector('#cartao-saude p.apoio').textContent,
      publicar: !!document.getElementById('saude-publicar'),
      resumo: !!document.getElementById('saude-resumo'),
      aviso: document.getElementById('ver-site-aviso').textContent
    }));
    await p.pg.screenshot({ path: u.captura('t3-fora-do-ar'), fullPage: true });
    assert(est.fora === 'Site fora do ar desde 2026-08-27: o mapa publicado está vazio e os endereços do site não mostram nada.', est.fora);
    assert(est.apoio === 'O seu conteúdo continua aqui. Publicar põe tudo de volta no ar.' && est.publicar && !est.resumo, JSON.stringify(est));
    assert(/fora do ar/.test(est.aviso) && /até você publicar de novo/.test(est.aviso), est.aviso);
    await p.pg.click('#saude-publicar');
    await p.pg.waitForFunction(() => Shell.telaAtual() === 't8');
    assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros }));
    await p.pg.close();
  });

  return R;
};
