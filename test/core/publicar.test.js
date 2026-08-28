// test/core/publicar.test.js — core/publicar.js: o diff (sem rede) e a ORDEM
// DE SEGURANÇA (14 T8 passo 4). O que se prova aqui é sobretudo o que NÃO
// acontece: manifest nenhum é assinado enquanto um caminho não tiver casa em
// pelo menos um servidor, e o estado local não muda enquanto a rede não
// confirmar. Contra o servidor falso, com relays e servidores Blossom com
// personas (recusa, mudo, só-mídia).
const { abrir, coletor, assert } = require('../util.js');

module.exports = async function (ctx, u) {
  const { R, it, pulado } = coletor();
  if (!u.falso) { pulado('core/publicar (todos os casos)', 'servidor falso indisponível'); return R; }
  const p = await abrir(ctx, u.url);
  const f = u.falso;
  f.blossom('b1', {}); f.blossom('b2', {}); f.blossom('so-midia', { tiposRecusados: ['text/html'] });
  f.relay('p-ok', { escrita: 'aceita', eventos: [] });
  f.relay('p-ok2', { escrita: 'aceita', eventos: [] });
  f.relay('p-recusa', { escrita: 'recusa' });
  f.relay('p-mudo', { escrita: 'muda' });
  f.relay('p-dup', { escrita: 'duplicada' });

  // Monta um site de exemplo no navegador e devolve { dados, gerado }.
  const SEMENTE = `
    const ch = Chave.gerar();
    const assinar = (m) => Chave.assinar(m, ch.sk);
    const site = Modelo.sitePadrao(ch.pubkey, ch.npub);
    site.title = 'Site de teste'; site.description = 'Uma frase sobre o site';
    site.network.relays = RELAYS; site.network.servers = SERVIDORES;
    const home = Modelo.novaPagina('Início'); home.body = 'Olá.';
    site.home = { mode: 'page', page_id: home.id, latest_posts: 5 };
    const artigo = Modelo.novoArtigo('Primeiro artigo'); artigo.body = 'Corpo do artigo.'; artigo.date = '2026-08-01T00:00:00Z';
    const dados = { site, pages: [home], posts: [artigo], media: [] };
    const gerado = await Gerador.gerarSite(dados);`;

  const naPagina = (corpo, arg) => p.pg.evaluate(new Function('arg', `return (async () => {
    const RELAYS = arg.relays, SERVIDORES = arg.servidores, RECUSA = arg.RECUSA, MUDO = arg.MUDO, DUP = arg.DUP, NOVO = arg.NOVO, SO_MIDIA = arg.SO_MIDIA;
    ${SEMENTE} ${corpo} })()`), arg);
  const infra = { relays: [f.ws('p-ok'), f.ws('p-ok2')], servidores: [f.url('b1'), f.url('b2')] };

  await it('plano do primeiro deploy: tudo sobe (index, blog, a página, o artigo, o css e o site.json), nada atualiza, nada some', async () => {
    const r = await naPagina(`
      const plano = Publicar.planear({ dados, gerado, published: null });
      return { sobe: plano.sobe.map(x => x.path).sort(), atualiza: plano.atualiza.length, some: plano.some.length,
        upload: plano.upload.length, caminhos: plano.caminhos, nada: plano.nada, eventos: plano.eventos, bytes: plano.bytes };`, infra);
    assert(r.nada === false && r.atualiza === 0 && r.some === 0, JSON.stringify(r));
    for (const esperado of ['/index.html', '/blog/index.html', '/blog/primeiro-artigo.html', '/tema/estilo.css', '/nostermentor/site.json'])
      assert(r.sobe.includes(esperado), 'faltou ' + esperado + ' em ' + JSON.stringify(r.sobe));
    assert(r.upload === r.sobe.length && r.bytes > 0, JSON.stringify([r.upload, r.sobe.length]));
    assert(r.eventos.manifest && r.eventos.kind0 && r.eventos.kind10002 && r.eventos.kind10063, JSON.stringify(r.eventos));
    return `${r.caminhos} caminhos, ${r.bytes} B`;
  });

  await it('avatar do perfil (13 §3): o kind 0 sai com `picture` = <servidor>/<sha256>, nomeando o servidor que REALMENTE aceitou o blob; herdada sem arquivo aqui não vira picture', async () => {
    const r = await naPagina(`
      const brutos = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 7, 7]);
      const sha = await Blossom.sha256Hex(brutos);
      const avatar = { id: Modelo.novoId(), path: '/img/eu.png', mime: 'image/png', size: brutos.length, sha256: sha,
        width: null, height: null, alt: '', caption: '', bytes: new Blob([brutos]), status: 'draft', servers: [],
        removal: null, metadata: { stripped: true, removed_segments: [], warning: null }, origin: 'upload',
        created_at: Modelo.agora(), updated_at: Modelo.agora(), previous_status: null };
      site.profile = { name: 'Dono', about: 'sobre mim', picture_media_id: avatar.id };
      // (a) herdada, sem arquivo neste navegador e sem servidor conhecido: nada a anunciar
      const semArquivo = Object.assign({}, avatar, { bytes: null, servers: [], origin: 'network' });
      const urlHerdada = Publicar.urlDoAvatar(site, [semArquivo]);
      const conteudoHerdada = Publicar.conteudoPerfil(site, urlHerdada);
      // (b) com os bytes aqui: a publicação sobe o blob, então o kind 0 pode anunciá-lo
      const dados2 = { site, pages: [home], posts: [artigo], media: [avatar] };
      const g2 = await Gerador.gerarSite(dados2);
      const plano2 = Publicar.planear({ dados: dados2, gerado: g2, published: null });
      const res2 = await Publicar.executar({ plano: plano2, site, assinar, servidores: plano2.servidores, relays: plano2.relays });
      const k0 = (res2.metadados.find(m => m.kind === 0) || {}).evento;
      const aceitos = res2.servidoresPorHash[sha] || [];
      return { urlHerdada, conteudoHerdada, sha, picture_sha: plano2.picture_sha, picture_url: plano2.picture_url,
        kind0: plano2.eventos.kind0, desfecho: res2.desfecho, aceitos,
        conteudo: k0 ? JSON.parse(k0.content) : null, esperado: aceitos[0] + '/' + sha };`, infra);
    assert(r.urlHerdada === null && !/picture/.test(r.conteudoHerdada), 'imagem herdada sem arquivo aqui não pode virar picture: ' + r.conteudoHerdada);
    assert(r.desfecho === 'publicado' && r.picture_sha === r.sha && r.kind0 === true, JSON.stringify([r.desfecho, r.kind0]));
    assert(r.aceitos.length === 2, 'o blob do avatar devia ter subido nos dois servidores: ' + JSON.stringify(r.aceitos));
    assert(r.conteudo && r.conteudo.picture === r.esperado, JSON.stringify([r.conteudo, r.esperado]));
    assert(r.conteudo.name === 'Dono' && r.conteudo.about === 'sobre mim', JSON.stringify(r.conteudo));
    return r.conteudo.picture;
  });

  await it('plano com o site igual ao publicado: "Nada a publicar" (nem eventos)', async () => {
    const r = await naPagina(`
      const published = { paths: Object.assign({}, gerado.hashes), servers: {}, metadata_events: {
        kind0: assinar(Publicar.modeloPerfil(site)), kind10002: assinar(Publicar.modeloRelays(site)), kind10063: assinar(Publicar.modeloServidores(site)) } };
      const plano = Publicar.planear({ dados, gerado, published });
      return { nada: plano.nada, sobe: plano.sobe.length, atualiza: plano.atualiza.length, upload: plano.upload.length, inalterados: plano.inalterados.length, eventos: plano.eventos };`, infra);
    assert(r.nada === true && r.sobe === 0 && r.atualiza === 0 && r.upload === 0, JSON.stringify(r));
    assert(!r.eventos.kind0 && !r.eventos.kind10002 && !r.eventos.kind10063, JSON.stringify(r.eventos));
    return `${r.inalterados} caminhos inalterados`;
  });

  await it('editar um artigo: atualiza o artigo, a lista do blog, a inicial (mostra recentes) e o site.json — e só isso', async () => {
    const r = await naPagina(`
      const published = { paths: Object.assign({}, gerado.hashes), servers: {} };
      const artigo2 = Object.assign({}, artigo, { title: 'Primeiro artigo (revisto)', body: 'Corpo novo.' });
      const dados2 = { site, pages: [home], posts: [artigo2], media: [] };
      const gerado2 = await Gerador.gerarSite(dados2);
      const plano = Publicar.planear({ dados: dados2, gerado: gerado2, published });
      return { atualiza: plano.atualiza.map(x => x.path).sort(), sobe: plano.sobe.map(x => x.path), some: plano.some.map(x => x.path), inalterados: plano.inalterados.map(x => x.path).sort() };`, infra);
    assert(r.sobe.length === 0 && r.some.length === 0, JSON.stringify(r));
    assert(r.atualiza.join() === ['/blog/index.html', '/blog/primeiro-artigo.html', '/index.html', '/nostermentor/site.json'].join(), JSON.stringify(r.atualiza));
    assert(r.inalterados.includes('/tema/estilo.css'), 'o css não devia mudar: ' + JSON.stringify(r.inalterados));
    return r.atualiza.length + ' caminhos';
  });

  await it('herdados (T-7): caminho publicado por outra ferramenta, que o app não gera, continua no mapa com o mesmo hash', async () => {
    const r = await naPagina(`
      const herdado = '/legado/pagina-antiga.txt', shaH = 'a1'.repeat(32);
      const published = { paths: Object.assign({ [herdado]: shaH }, gerado.hashes), servers: {} };
      const plano = Publicar.planear({ dados, gerado, published });
      return { herdados: plano.herdados, mapaTem: plano.mapa[herdado] === shaH, some: plano.some.map(x => x.path), upload: plano.upload.length };`, infra);
    assert(r.mapaTem === true && r.herdados.length === 1 && r.some.length === 0, JSON.stringify(r));
    assert(r.upload === 0, 'herdado não sobe de novo: ' + r.upload);
  });

  await it('colisão com herdado (aceite 2 do M4): o app gera um caminho que já é de um arquivo de outra ferramenta → plano.colisoes nomeia-o e a mídia herdada NÃO é sobreposta em silêncio', async () => {
    const r = await naPagina(`
      const shaH = 'c1'.repeat(32);
      const herdada = { id: Modelo.novoId(), path: '/index.html', mime: 'text/html', sha256: shaH, size: 18830, alt: '', caption: '',
        bytes: null, status: 'published', servers: [SERVIDORES[0]], removal: null, metadata: {}, origin: 'network', created_at: Modelo.agora(), updated_at: Modelo.agora() };
      const dados1 = Object.assign({}, dados, { media: [herdada] });
      const published = { paths: { '/index.html': shaH }, servers: {} };
      const plano = Publicar.planear({ dados: dados1, gerado, published });
      return { colisoes: plano.colisoes.map(c => [c.path, c.sha256_herdado, c.sha256_app]),
        preservados: plano.preservados.map(x => x.path), some: plano.some.map(x => x.path) };`, infra);
    assert(r.colisoes.length === 1 && r.colisoes[0][0] === '/index.html', 'colisões: ' + JSON.stringify(r.colisoes));
    assert(r.colisoes[0][1] !== r.colisoes[0][2], 'a colisão só existe quando o conteúdo difere: ' + JSON.stringify(r.colisoes[0]));
    assert(r.preservados.length === 0, 'o caminho em colisão não é "preservado": ' + JSON.stringify(r.preservados));
    return `colisão em ${r.colisoes[0][0]}`;
  });

  await it('colisão: mesmo caminho com o MESMO conteúdo não é colisão (nada a decidir) e conta como preservado', async () => {
    const r = await naPagina(`
      const shaIgual = gerado.hashes['/index.html'];
      const herdada = { id: Modelo.novoId(), path: '/index.html', mime: 'text/html', sha256: shaIgual, size: 1, alt: '', caption: '',
        bytes: null, status: 'published', servers: [SERVIDORES[0]], removal: null, metadata: {}, origin: 'network', created_at: Modelo.agora(), updated_at: Modelo.agora() };
      const dados1 = Object.assign({}, dados, { media: [herdada] });
      const published = { paths: { '/index.html': shaIgual }, servers: {} };
      const plano = Publicar.planear({ dados: dados1, gerado, published });
      return { colisoes: plano.colisoes.length, preservados: plano.preservados.map(x => x.path) };`, infra);
    assert(r.colisoes === 0, 'não devia haver colisão: ' + JSON.stringify(r));
    assert(r.preservados.includes('/index.html'), 'preservados: ' + JSON.stringify(r.preservados));
  });

  await it('preservados: mídia herdada que o app não gera continua no mapa e aparece ao dono (o bloco de T8 "Fica como está" deixa de ser sempre vazio)', async () => {
    const r = await naPagina(`
      const shaH = 'd1'.repeat(32);
      const herdada = { id: Modelo.novoId(), path: '/1f95a.png', mime: 'image/png', sha256: shaH, size: 100, alt: '', caption: '',
        bytes: null, status: 'published', servers: [SERVIDORES[0]], removal: null, metadata: {}, origin: 'network', created_at: Modelo.agora(), updated_at: Modelo.agora() };
      const dados1 = Object.assign({}, dados, { media: [herdada] });
      const published = { paths: Object.assign({ '/1f95a.png': shaH }, gerado.hashes), servers: {} };
      const plano = Publicar.planear({ dados: dados1, gerado, published });
      return { preservados: plano.preservados.map(x => x.path), colisoes: plano.colisoes.length,
        some: plano.some.map(x => x.path), mapaTem: plano.mapa['/1f95a.png'] === shaH };`, infra);
    assert(r.preservados.length === 1 && r.preservados[0] === '/1f95a.png', JSON.stringify(r));
    assert(r.colisoes === 0 && r.some.length === 0 && r.mapaTem === true, JSON.stringify(r));
  });

  await it('mídia herdada removida pelo dono: deixa de colidir (a publicação desbloqueia) e o caminho passa a ser do app', async () => {
    const r = await naPagina(`
      const shaH = 'c1'.repeat(32);
      const herdada = { id: Modelo.novoId(), path: '/index.html', mime: 'text/html', sha256: shaH, size: 18830, alt: '', caption: '',
        bytes: null, status: 'removed', previous_status: 'published', servers: [SERVIDORES[0]], removal: null, metadata: {}, origin: 'network', created_at: Modelo.agora(), updated_at: Modelo.agora() };
      const dados1 = Object.assign({}, dados, { media: [herdada] });
      const published = { paths: { '/index.html': shaH }, servers: {} };
      const plano = Publicar.planear({ dados: dados1, gerado, published });
      return { colisoes: plano.colisoes.length, atualiza: plano.atualiza.map(x => x.path),
        some: plano.some.map(x => x.path), remover: plano.remover.map(x => x.path) };`, infra);
    assert(r.colisoes === 0, 'depois de removida não há colisão: ' + JSON.stringify(r));
    assert(r.atualiza.includes('/index.html'), 'a capa do app ocupa o caminho: ' + JSON.stringify(r));
    assert(r.remover.includes('/index.html'), 'o blob antigo entra na fila de DELETE (o dono mandou removê-lo): ' + JSON.stringify(r));
  });

  await it('página removida: o caminho sai do mapa (não é "herdado"); mídia removida sai e entra na fila de DELETE', async () => {
    const r = await naPagina(`
      const midia = { id: Modelo.novoId(), path: '/img/foto.webp', mime: 'image/webp', sha256: 'b2'.repeat(32), size: 10, alt: '', caption: '',
        bytes: null, status: 'published', servers: [SERVIDORES[0]], removal: null, metadata: {}, origin: 'upload', created_at: Modelo.agora(), updated_at: Modelo.agora() };
      const outra = Object.assign(Modelo.novaPagina('Sobre'), { body: 'x' });
      const dados1 = { site, pages: [home, outra], posts: [artigo], media: [midia] };
      const g1 = await Gerador.gerarSite(dados1);
      const published = { paths: Object.assign({ '/img/foto.webp': midia.sha256 }, g1.hashes), servers: {} };
      const dados2 = { site, pages: [home, Object.assign({}, outra, { status: 'removed', previous_status: 'published' })], posts: [artigo],
        media: [Object.assign({}, midia, { status: 'removed', previous_status: 'published' })] };
      const g2 = await Gerador.gerarSite(dados2);
      const plano = Publicar.planear({ dados: dados2, gerado: g2, published });
      return { some: plano.some.map(x => [x.path, x.apagar_blob]).sort(), remover: plano.remover.map(x => x.path), herdados: plano.herdados.length };`, infra);
    assert(r.herdados === 0, 'nada disto é herdado: ' + JSON.stringify(r));
    assert(r.some.some(x => x[0] === '/sobre.html' && x[1] === false), JSON.stringify(r.some));
    assert(r.some.some(x => x[0] === '/img/foto.webp' && x[1] === true), JSON.stringify(r.some));
    assert(r.remover.join() === '/img/foto.webp', JSON.stringify(r.remover));
  });

  // Pendência 20 de `00`, aberta no aceite 2 do M4 e fechada no M5.
  await it('aresta da pendência 20: `.html` herdado que está em published.paths SEM `media` no banco NÃO sai do mapa sozinho — a extensão deixou de decidir', async () => {
    const r = await naPagina(`
      const shaH = 'e5'.repeat(32);
      const published = { paths: Object.assign({ '/sobre.html': shaH }, gerado.hashes), servers: {} };
      const plano = Publicar.planear({ dados, gerado, published });      // dados.media = [] de propósito
      return { mapaTem: plano.mapa['/sobre.html'] === shaH, herdados: plano.herdados.map(x => x.path),
        some: plano.some.map(x => x.path), upload: plano.upload.length };`, infra);
    assert(r.mapaTem === true, 'o herdado devia continuar no mapa: ' + JSON.stringify(r));
    assert(r.herdados.join() === '/sobre.html' && r.some.length === 0, JSON.stringify(r));
    assert(r.upload === 0, 'e nada sobe por causa dele: ' + r.upload);
    return 'preservado sem `media` no banco';
  });

  await it('a contraprova da pendência 20: um caminho que ainda é de uma página do app (pelo slug ou por um alias) continua a ser dele; sem registro nenhum, na dúvida PRESERVA', async () => {
    const r = await naPagina(`
      const sobre = Object.assign(Modelo.novaPagina('Sobre'), { body: 'x' });
      const d1 = { site, pages: [home, sobre], posts: [artigo], media: [] };
      const g1 = await Gerador.gerarSite(d1);
      const published = { paths: g1.hashes, servers: {} };
      // (a) renomear: o slug antigo vira alias (13 §4.0) e o gerador publica o stub
      const outra = Object.assign(Modelo.novaPagina('Quem somos'), { body: 'y', aliases: ['sobre'] });
      const d2 = { site, pages: [home, outra], posts: [artigo], media: [] };
      const g2 = await Gerador.gerarSite(d2);
      const plano2 = Publicar.planear({ dados: d2, gerado: g2, published });
      // (b) o dono manda remover: a lápide reivindica o caminho e ele SAI
      const d3 = { site, pages: [home, Object.assign({}, sobre, { status: 'removed', previous_status: 'published' })], posts: [artigo], media: [] };
      const g3 = await Gerador.gerarSite(d3);
      const plano3 = Publicar.planear({ dados: d3, gerado: g3, published });
      // (c) nem página, nem lápide, nem alias: o app não sabe de quem é
      const d4 = { site, pages: [home], posts: [artigo], media: [] };
      const g4 = await Gerador.gerarSite(d4);
      const plano4 = Publicar.planear({ dados: d4, gerado: g4, published });
      return { a: { gera: !!g2.hashes['/sobre.html'], herdados: plano2.herdados.map(x => x.path), some: plano2.some.map(x => x.path) },
               b: { herdados: plano3.herdados.map(x => x.path), some: plano3.some.map(x => x.path) },
               c: { herdados: plano4.herdados.map(x => x.path), some: plano4.some.map(x => x.path) } };`, infra);
    assert(r.a.gera === true, 'o alias devia ser publicado como stub de redirect: ' + JSON.stringify(r.a));
    assert(r.a.herdados.length === 0 && r.a.some.length === 0, 'renomear não apaga nem "herda": ' + JSON.stringify(r.a));
    assert(r.b.some.includes('/sobre.html') && r.b.herdados.length === 0, 'a lápide manda o caminho sair: ' + JSON.stringify(r.b));
    assert(r.c.some.length === 0 && r.c.herdados.includes('/sobre.html'), 'sem registro, preserva: ' + JSON.stringify(r.c));
    return 'alias fica, lápide sai, órfão preserva';
  });

  await it('M5: UI de aliases — remover só o ALIAS (a página continua publicada com outro slug) precisa da lápide de mídia; sem ela, preservaria para sempre', async () => {
    const r = await naPagina(`
      const sobre = Object.assign(Modelo.novaPagina('Sobre'), { body: 'x' });
      const d1 = { site, pages: [home, sobre], posts: [artigo], media: [] };
      const g1 = await Gerador.gerarSite(d1);
      // renomeia: 'sobre' vira alias de 'quem-somos' e é publicado como stub
      const outra = Object.assign(Modelo.novaPagina('Quem somos'), { body: 'y', aliases: ['sobre'] });
      const d2 = { site, pages: [home, outra], posts: [artigo], media: [] };
      const g2 = await Gerador.gerarSite(d2);
      const publicado = { paths: Object.assign({}, g1.hashes, g2.hashes), servers: {} };   // estado ao vivo após as duas publicações
      // M5: o dono clica "Remover" no alias — a página CONTINUA ativa, só o
      // alias sai; sem lápide o caminho cairia em "herdado" (T-7) e ficaria
      // preservado para sempre, sem jeito de apagar depois.
      const semAlias = Object.assign({}, outra, { aliases: [] });
      const d3 = { site, pages: [home, semAlias], posts: [artigo], media: [] };
      const g3 = await Gerador.gerarSite(d3);
      const plano3 = Publicar.planear({ dados: d3, gerado: g3, published: publicado });
      // com a lápide, exatamente como Editor.removerAlias grava (13 §4.3)
      const lapide = { id: 'm-lapide', path: '/sobre.html', mime: 'text/html', size: null, sha256: publicado.paths['/sobre.html'],
        width: null, height: null, alt: '', caption: '', bytes: null, status: 'removed', servers: [], removal: null,
        metadata: { stripped: null, removed_segments: [], warning: null }, origin: 'upload', previous_status: 'published' };
      const d4 = { site, pages: [home, semAlias], posts: [artigo], media: [lapide] };
      const g4 = await Gerador.gerarSite(d4);
      const plano4 = Publicar.planear({ dados: d4, gerado: g4, published: publicado });
      return {
        semLapide: { herdados: plano3.herdados.map(x => x.path), some: plano3.some.map(x => x.path) },
        comLapide: { herdados: plano4.herdados.map(x => x.path), some: plano4.some.map(x => [x.path, x.apagar_blob]) }
      };`, infra);
    assert(r.semLapide.herdados.includes('/sobre.html') && r.semLapide.some.length === 0, 'sem a lápide, o alias morto ficaria preservado para sempre: ' + JSON.stringify(r.semLapide));
    assert(r.comLapide.herdados.length === 0 && JSON.stringify(r.comLapide.some) === '[["/sobre.html",true]]', 'com a lápide, o caminho sai e o app tenta apagar o blob: ' + JSON.stringify(r.comLapide));
    return 'sem lápide preserva para sempre; com lápide sai do mapa e apaga';
  });

  await it('manifest 15128: uma tag path por caminho (com o sha256), server, relay, client=nostermentor e title/description obrigatórios (05 §3.1)', async () => {
    const r = await naPagina(`
      const plano = Publicar.planear({ dados, gerado, published: null });
      const ev = assinar(Publicar.modeloManifest(plano, site, 1700000000));
      const t = (n) => ev.tags.filter(x => x[0] === n);
      return { kind: ev.kind, content: ev.content, verifica: Chave.verificar(ev), paths: t('path').map(x => [x[1], x[2]]),
        server: t('server').map(x => x[1]), relay: t('relay').map(x => x[1]), client: t('client').map(x => x[1]),
        title: t('title').map(x => x[1]), description: t('description').map(x => x[1]), hashes: gerado.hashes, created_at: ev.created_at };`, infra);
    assert(r.kind === 15128 && r.content === '' && r.verifica === true && r.created_at === 1700000000, JSON.stringify([r.kind, r.content, r.verifica]));
    assert(r.paths.length === Object.keys(r.hashes).length, JSON.stringify([r.paths.length, Object.keys(r.hashes).length]));
    for (const [caminho, sha] of r.paths) assert(r.hashes[caminho] === sha, 'hash errado em ' + caminho);
    const ordenados = r.paths.map(x => x[0]);
    assert(ordenados.join() === ordenados.slice().sort().join(), 'as tags path deviam sair em ordem: ' + JSON.stringify(ordenados));
    assert(r.client.join() === 'nostermentor' && r.title.join() === 'Site de teste' && r.description.join() === 'Uma frase sobre o site', JSON.stringify([r.client, r.title, r.description]));
    assert(r.server.length === 2 && r.relay.length === 2, JSON.stringify([r.server, r.relay]));
    return `${r.paths.length} paths + ${r.server.length} server + ${r.relay.length} relay`;
  });

  await it('metadados (05 §3): kind 0 com nome/descrição, 10002 com tags r, 10063 com tags server; só entram no plano quando mudam', async () => {
    const r = await naPagina(`
      const k0 = assinar(Publicar.modeloPerfil(site)), k2 = assinar(Publicar.modeloRelays(site)), k3 = assinar(Publicar.modeloServidores(site));
      const published = { paths: Object.assign({}, gerado.hashes), servers: {}, metadata_events: { kind0: k0, kind10002: k2, kind10063: k3 } };
      const iguais = Publicar.planear({ dados, gerado, published }).eventos;
      const site2 = Object.assign({}, site, { network: Object.assign({}, site.network, { relays: RELAYS.concat(['wss://novo.test']) }) });
      const mudou = Publicar.planear({ dados: { site: site2, pages: [home], posts: [artigo], media: [] }, gerado, published }).eventos;
      return { k0: { kind: k0.kind, conteudo: JSON.parse(k0.content) }, k2: { kind: k2.kind, tags: k2.tags.map(t => t[0]) }, k3: { kind: k3.kind, tags: k3.tags.map(t => t[0]) }, iguais, mudou };`, infra);
    assert(r.k0.kind === 0 && r.k0.conteudo.name === 'Site de teste' && r.k0.conteudo.about === 'Uma frase sobre o site', JSON.stringify(r.k0));
    assert(r.k2.kind === 10002 && r.k2.tags.every(t => t === 'r') && r.k3.kind === 10063 && r.k3.tags.every(t => t === 'server'), JSON.stringify([r.k2, r.k3]));
    assert(!r.iguais.kind0 && !r.iguais.kind10002 && !r.iguais.kind10063, 'sem mudança, nenhum metadado: ' + JSON.stringify(r.iguais));
    assert(r.mudou.kind10002 === true && r.mudou.kind0 === false, 'só a lista de relays mudou: ' + JSON.stringify(r.mudou));
  });

  await it('ORDEM DE SEGURANÇA: um arquivo que nenhum servidor aceita → desfecho falta_servidor, NENHUM manifest assinado, nenhum relay tocado', async () => {
    const antes = f.publicadosEm('p-ok').length;
    const r = await naPagina(`
      const plano = Publicar.planear({ dados, gerado, published: null });
      const res = await Publicar.executar({ plano, site, assinar, servidores: [SO_MIDIA], relays: RELAYS, timeoutMs: 8000 });
      return { desfecho: res.desfecho, manifest: res.manifest, orfaos: (res.orfaos || []).map(x => x.path), relays: res.relaysManifest.length, uploads: res.uploads.length };`,
      Object.assign({ SO_MIDIA: f.url('so-midia') }, infra));
    assert(r.desfecho === 'falta_servidor' && r.manifest === null && r.relays === 0, JSON.stringify(r));
    assert(r.orfaos.length > 0 && f.publicadosEm('p-ok').length === antes, 'relay não pode ter recebido nada: ' + JSON.stringify([r.orfaos.length, antes, f.publicadosEm('p-ok').length]));
    return `${r.orfaos.length} caminhos órfãos → publicação interrompida`;
  });

  await it('blobs sobem mas nenhum relay aceita → "sem_relay": os arquivos ficam na rede (não se perde o trabalho) e o manifest não conta como publicado', async () => {
    const r = await naPagina(`
      const plano = Publicar.planear({ dados, gerado, published: null });
      const res = await Publicar.executar({ plano, site, assinar, servidores: SERVIDORES, relays: [RECUSA, MUDO], timeoutMs: 3000 });
      return { desfecho: res.desfecho, temManifest: !!res.manifest, placar: res.placar, uploads: res.uploads.length, hashes: Object.keys(gerado.hashes).map(k => gerado.hashes[k]) };`,
      Object.assign({ RECUSA: f.ws('p-recusa'), MUDO: f.ws('p-mudo') }, infra));
    assert(r.desfecho === 'sem_relay' && r.temManifest === true && r.placar.com === 0, JSON.stringify([r.desfecho, r.placar]));
    assert(r.hashes.every(h => f.temBlob('b1', h)), 'os blobs deviam ter subido mesmo assim');
    return `${r.uploads} arquivos no ar, 0 de 2 relays`;
  });

  await it('publicação completa: blobs nos 2 servidores, manifest aceito em 2 relays, placar honesto com o mudo e o que recusou', async () => {
    const r = await naPagina(`
      const plano = Publicar.planear({ dados, gerado, published: null });
      const passos = [];
      const res = await Publicar.executar({ plano, site, assinar, servidores: SERVIDORES, relays: RELAYS.concat([RECUSA, MUDO]), timeoutMs: 3000,
        progresso: (x) => passos.push(x.passo) });
      const foto = Publicar.fotografia(res, plano, null);
      return { desfecho: res.desfecho, id: res.manifest.id, placar: res.placar, passos: Array.from(new Set(passos)),
        uploads: res.uploads.map(x => [x.path, x.aceitos.length]), foto: { paths: Object.keys(foto.paths).length, id: foto.manifest_event_id,
          health: foto.health, relays: foto.relays, servers: Object.keys(foto.servers).length }, metadados: res.metadados.map(m => [m.kind, m.placar.com]) };`,
      Object.assign({ RECUSA: f.ws('p-recusa'), MUDO: f.ws('p-mudo') }, infra));
    assert(r.desfecho === 'publicado' && r.placar.com === 2 && r.placar.total === 4, JSON.stringify(r.placar));
    assert(r.uploads.every(x => x[1] === 2), 'cada arquivo nos 2 servidores: ' + JSON.stringify(r.uploads));
    assert(r.passos.join() === ['upload', 'assinar', 'relays', 'metadados'].join(), JSON.stringify(r.passos));
    assert(r.foto.health.relays_with_manifest.length === 2 && r.foto.health.relays_missing.length === 1 && r.foto.health.relays_unreachable.length === 1, JSON.stringify(r.foto.health));
    assert(r.metadados.length === 3 && r.metadados.every(x => x[1] === 2), JSON.stringify(r.metadados));
    // o relay falso guardou o evento e ele é o mesmo
    const guardados = f.publicadosEm('p-ok');
    assert(guardados.some(e => e.id === r.id && e.kind === 15128), 'o relay devia ter o manifest');
    assert([0, 10002, 10063].every(k => guardados.some(e => e.kind === k)), 'faltou metadado no relay: ' + JSON.stringify(guardados.map(e => e.kind)));
    return `${r.uploads.length} arquivos × 2 servidores · manifest em 2 de 4 relays · ${r.foto.paths} caminhos na fotografia`;
  });

  await it('"duplicate" do relay conta como ACEITE (é o caso de republicar num relay que já tem o evento)', async () => {
    const r = await naPagina(`
      const plano = Publicar.planear({ dados, gerado, published: null });
      const res = await Publicar.executar({ plano, site, assinar, servidores: SERVIDORES, relays: [DUP], timeoutMs: 3000 });
      return { desfecho: res.desfecho, estados: res.relaysManifest.map(x => [x.estado, x.prefixo]) };`,
      Object.assign({ DUP: f.ws('p-dup') }, infra));
    assert(r.desfecho === 'publicado' && r.estados[0][0] === 'aceito' && r.estados[0][1] === 'duplicate', JSON.stringify(r));
  });

  await it('republicar (13 §5.5): reenvia o evento guardado SEM a chave — o manifest e os metadados chegam a um relay que não os tinha', async () => {
    f.relay('p-novo', { escrita: 'aceita', eventos: [] });
    const r = await naPagina(`
      const plano = Publicar.planear({ dados, gerado, published: null });
      const res = await Publicar.executar({ plano, site, assinar, servidores: SERVIDORES, relays: RELAYS, timeoutMs: 3000 });
      const foto = Publicar.fotografia(res, plano, null);
      Chave.apagar(ch.sk);                                  // a chave deixa de existir
      const rep = await Publicar.republicar({ published: foto, relays: [NOVO], timeoutMs: 3000 });
      return { desfecho: rep.desfecho, placar: rep.placar, kinds: rep.resultados.map(x => x.kind), id: foto.manifest_event_id };`,
      Object.assign({ NOVO: f.ws('p-novo') }, infra));
    assert(r.desfecho === 'republicado' && r.placar.com === 1, JSON.stringify(r));
    assert(r.kinds.join() === [15128, 0, 10002, 10063].join(), JSON.stringify(r.kinds));
    const guardados = f.publicadosEm('p-novo');
    assert(guardados.some(e => e.id === r.id), 'o relay novo devia ter o manifest reenviado');
    return 'manifest + 3 metadados, sem nsec';
  });

  await it('republicar TRAVA quando a rede está à frente (13 §5.5): health com relays_newer → "concorrente" e nenhum evento chega ao relay', async () => {
    f.relay('p-frente', { escrita: 'aceita', eventos: [] });
    const r = await naPagina(`
      const plano = Publicar.planear({ dados, gerado, published: null });
      const res = await Publicar.executar({ plano, site, assinar, servidores: SERVIDORES, relays: RELAYS, timeoutMs: 3000 });
      const foto = Publicar.fotografia(res, plano, null);
      foto.health = { checked_at: Modelo.agora(), relays_with_manifest: [], relays_outdated: [],
        relays_newer: [arg.FRENTE], relays_missing: [arg.FRENTE], relays_unreachable: [] };
      const rep = await Publicar.republicar({ published: foto, relays: [arg.FRENTE], timeoutMs: 3000 });
      return { desfecho: rep.desfecho, novos: rep.relays_newer, resultados: rep.resultados.length, id: foto.manifest_event_id };`,
      Object.assign({ FRENTE: f.ws('p-frente') }, infra));
    assert(r.desfecho === 'concorrente' && r.resultados === 0 && r.novos.length === 1, JSON.stringify(r));
    assert(f.publicadosEm('p-frente').length === 0, 'o relay à frente NÃO devia ter recebido nada: ' + f.publicadosEm('p-frente').length);
    return 'nada reenviado — o 15128 é substituível e o mais novo ganha';
  });

  await it('republicar sem manifest guardado → "sem_manifest" (nada acontece)', async () => {
    const r = await p.pg.evaluate(() => Publicar.republicar({ published: null, relays: ['wss://x.test'] }));
    assert(r.desfecho === 'sem_manifest' && r.resultados.length === 0, JSON.stringify(r));
  });

  await it('aplicar: rascunhos viram publicados com published_hash, lápides somem, mídia ganha os servidores e a fotografia fica em published/current', async () => {
    const r = await naPagina(`
      const db = await Db.abrir(ch.pubkey);
      await db.limparTudo();
      const midia = { id: Modelo.novoId(), path: '/img/f.png', mime: 'image/png', sha256: await Blossom.sha256Hex(new Uint8Array([1,2,3])), size: 3,
        bytes: new Blob([new Uint8Array([1,2,3])]), status: 'draft', servers: [], removal: null, metadata: {}, origin: 'upload', alt: '', caption: '',
        created_at: Modelo.agora(), updated_at: Modelo.agora(), width: null, height: null };
      const lapide = Object.assign(Modelo.novaPagina('Antiga'), { status: 'removed', previous_status: 'published' });
      const dados3 = { site, pages: [home, lapide], posts: [artigo], media: [midia] };
      const g3 = await Gerador.gerarSite(dados3);
      await db.escrever([{ op: 'put', store: 'site', chave: 'site', valor: site }, { op: 'put', store: 'pages', valor: home }, { op: 'put', store: 'pages', valor: lapide },
        { op: 'put', store: 'posts', valor: artigo }, { op: 'put', store: 'media', valor: midia }]);
      const plano = Publicar.planear({ dados: dados3, gerado: g3, published: null });
      const res = await Publicar.executar({ plano, site, assinar, servidores: SERVIDORES, relays: RELAYS, timeoutMs: 3000 });
      const foto = Publicar.fotografia(res, plano, null);
      await Publicar.aplicar(db, { resultado: res, plano, dados: dados3, gerado: g3, published: foto });
      const pages = await db.getAll('pages'), posts = await db.getAll('posts'), media = await db.getAll('media');
      const atual = await db.get('published', 'current');
      db.fechar();
      return { desfecho: res.desfecho, pages: pages.map(x => [x.title, x.status, !!x.published_hash]), posts: posts.map(x => [x.status, x.published_hash === g3.porId[artigo.id]]),
        media: media.map(x => [x.status, x.servers.length]), fotoId: atual && atual.manifest_event_id, mesmoId: atual && atual.manifest_event_id === res.manifest.id,
        temEvento: !!(atual && atual.manifest_event && atual.manifest_event.sig) };`, infra);
    assert(r.desfecho === 'publicado', JSON.stringify(r));
    assert(r.pages.length === 1 && r.pages[0][1] === 'published' && r.pages[0][2] === true, 'lápide devia sumir e a home ficar publicada: ' + JSON.stringify(r.pages));
    assert(r.posts[0][0] === 'published' && r.posts[0][1] === true, 'published_hash do artigo: ' + JSON.stringify(r.posts));
    assert(r.media[0][0] === 'published' && r.media[0][1] === 2, JSON.stringify(r.media));
    assert(r.mesmoId === true && r.temEvento === true, 'a fotografia guarda o evento assinado inteiro: ' + JSON.stringify([r.fotoId, r.temEvento]));
    return 'lápide apagada, published_hash gravado, mídia em 2 servidores';
  });

  await it('emLotes: respeita o limite de paralelas e preserva a ordem dos resultados', async () => {
    const r = await p.pg.evaluate(async () => {
      let vivos = 0, pico = 0;
      const saida = await Publicar.emLotes([1, 2, 3, 4, 5, 6, 7], 3, async (x) => {
        vivos++; pico = Math.max(pico, vivos);
        await new Promise(r => setTimeout(r, 10));
        vivos--; return x * 2;
      });
      return { saida, pico };
    });
    assert(r.saida.join() === '2,4,6,8,10,12,14' && r.pico === 3, JSON.stringify(r));
    return 'pico ' + r.pico;
  });

  await it('sem erros de página/console', () => assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros })));
  await p.pg.close();
  return R;
};
