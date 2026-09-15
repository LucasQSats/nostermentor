// test/telas/t6_t8.test.js — o marco M4 pela INTERFACE, do jeito que o dono
// faz: escolher um arquivo com EXIF, ver o pré-flight por servidor, guardar
// na biblioteca, abrir Publicar, ler o diff, clicar uma vez e ver o placar.
// E os desfechos ruins, que são o que a ordem de segurança promete: upload
// que não tem casa (nenhum manifest assinado), relay nenhum aceitando, e
// outra máquina que publicou primeiro. Contra o servidor falso.
const { abrir, varrer, coletor, assert, entrarCom, semearSite, esperarT2, lerBanco } = require('../util.js');
const F = require('../fabrica.js');
const fs = require('fs'), path = require('path');

module.exports = async function (ctx, u) {
  const { R, it, pulado } = coletor();
  if (!u.falso) { pulado('telas/t6_t8 (todos os casos)', 'servidor falso indisponível'); return R; }
  const f = u.falso;
  f.blossom('m1', {}); f.blossom('m2', {}); f.blossom('img-so', { tiposRecusados: ['text/html', 'application/json'] });
  // M5: servidor que MENTE no pré-flight (sempre 200 no HEAD) mas aplica a
  // política de verdade no PUT — é o único jeito de exercitar a ordem de
  // segurança de `core/publicar.js` agora que T8 prevê e bloqueia de antemão
  // toda recusa que o HEAD já anuncia (14 T8, "não pode subir").
  f.blossom('finge-aceita', { tiposRecusados: ['text/html', 'application/json'], preflight: 'sempre200' });
  const SERVIDORES = [f.url('m1'), f.url('m2')];
  const EXIF = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'limpeza', 'exif.jpg'));

  // Entra com chave nova, aponta o app ao servidor falso e cria conteúdo.
  async function sessao(o) {
    o = o || {};
    const ch = F.chave();
    const p = await abrir(ctx, u.url);
    await semearSite(p.pg, ch, { relays: o.relays || [f.ws('m-ok')], servers: o.servidores || SERVIDORES, title: 'Site do teste M4' });
    await entrarCom(p.pg, ch.nsec);
    await esperarT2(p.pg, 30000);
    // conteúdo mínimo: uma página (que é a Home) e um artigo
    await p.pg.evaluate(async ([pubkey, npub]) => {
      const db = await Db.abrir(pubkey);
      const site = await db.get('site', 'site');
      const home = Modelo.novaPagina('Início'); home.body = 'Bem-vindo ao site.';
      const artigo = Modelo.novoArtigo('Primeiro artigo'); artigo.body = 'Corpo.'; artigo.date = '2026-08-01T00:00:00Z';
      site.home = { mode: 'page', page_id: home.id, latest_posts: 5 };
      site.description = 'Uma frase sobre o site';
      await db.escrever([{ op: 'put', store: 'site', chave: 'site', valor: site }, { op: 'put', store: 'pages', valor: home }, { op: 'put', store: 'posts', valor: artigo }]);
      db.fechar();
    }, [ch.pubkey, ch.npub]);
    await p.pg.click('#menu .item[data-tela="t3"]');
    await p.pg.waitForSelector('#t3');
    return { p, ch };
  }
  async function escolherArquivo(pg, nome, conteudo, mime) {
    await pg.setInputFiles('#t6a-arquivos', { name: nome, mimeType: mime, buffer: conteudo });
    await pg.waitForSelector('#t6a-pendentes .pendente');
    await pg.waitForFunction(() => !document.querySelector('#t6a-pendentes .pre.verificando'), null, { timeout: 20000 });
  }

  f.relay('m-ok', { escrita: 'aceita', eventos: [] });
  f.relay('m-ok2', { escrita: 'aceita', eventos: [] });
  f.relay('m-recusa', { escrita: 'recusa' });
  f.relay('m-mudo', { escrita: 'muda' });

  await it('33: T6a envia DIRETO — nada a preencher, metadados limpos sempre, caminho vindo do nome do arquivo; "Adicionar" guarda como rascunho SEM subir nada', async () => {
    const { p, ch } = await sessao();
    await p.pg.click('#menu .item[data-tela="t6"]'); await p.pg.waitForSelector('#t6a');
    assert(await p.pg.textContent('#t6-vazio'), 'a biblioteca devia começar vazia');
    await escolherArquivo(p.pg, 'IMG_20240812_casa.jpg', EXIF, 'image/jpeg');
    const est = await p.pg.evaluate(() => ({
      // 33 — nenhum campo por arquivo: era isto que fazia cinco imagens virarem
      // uma página comprida.
      campos: document.querySelectorAll('#t6a-pendentes input, #t6a-pendentes textarea').length,
      caminho: document.querySelector('.caminho-final').textContent,
      pre: [...document.querySelectorAll('#t6a-pendentes .pre')].map(x => x.textContent.trim()),
      podeAdicionar: !document.getElementById('t6a-adicionar').disabled
    }));
    assert(est.campos === 0, 'o bloco por arquivo não pode ter campo nenhum: ' + est.campos);
    assert(/\/img\/img-20240812-casa\.jpg/.test(est.caminho), est.caminho);
    assert(est.pre.length === 2 && est.pre.every(x => /vai aceitar/.test(x)), JSON.stringify(est.pre));
    assert(est.podeAdicionar, 'devia poder adicionar');
    await p.pg.click('#t6a-adicionar');
    await p.pg.waitForSelector('#t6-tabela');
    const banco = await lerBanco(p.pg, ch.pubkey);
    const m = banco.media[0];
    assert(banco.media.length === 1 && m.path === '/img/img-20240812-casa.jpg' && m.status === 'draft', JSON.stringify(banco.media.map(x => [x.path, x.status])));
    assert(m.alt === '' && m.caption === '', 'alt e legenda ficam em branco — pedidos depois, na biblioteca');
    // D15 continua honrado, agora sem opção: a limpeza deixou de ser escolha.
    assert(m.metadata.stripped === true, 'os metadados têm de ser limpos sempre');
    assert(m.sha256 !== F.sha256(EXIF), 'o hash devia ser o do arquivo LIMPO, não o do original');
    assert(m.size < EXIF.length, 'o arquivo limpo devia ser menor: ' + m.size + ' vs ' + EXIF.length);
    // e o alt não se perde de vista: a linha discreta leva à biblioteca
    const chamada = await p.pg.textContent('#t6a-descrever');
    assert(/Descrever a?s? 1 imagem/.test(chamada), chamada);
    await p.pg.click('#t6a-descrever');
    await p.pg.waitForSelector('#t6-tabela');
    assert(f.blobsDe('m1').length === 0 && f.blobsDe('m2').length === 0, 'nada pode ter subido em T6a — subir é ato de T8');
    await p.pg.close();
    return `${EXIF.length} B → ${m.size} B, sem um campo para preencher`;
  });

  await it('T6a: servidor que recusa o tipo aparece como "vai recusar" com o motivo; e a marcação copiável entra na lista', async () => {
    const { p } = await sessao({ servidores: [f.url('img-so')] });
    await p.pg.click('#menu .item[data-tela="t6"]'); await p.pg.waitForSelector('#t6a');
    await escolherArquivo(p.pg, 'nota.txt', Buffer.from('só texto'), 'text/plain');
    const pre = await p.pg.textContent('#t6a-pendentes .pre');
    assert(/vai aceitar/.test(pre), 'text/plain não está na lista de recusados: ' + pre);
    await p.pg.setInputFiles('#t6a-arquivos', []);
    await p.pg.close();
  });

  await it('PUBLICAR ponta a ponta: T8 mostra o diff com os porquês, um clique sobe tudo nos 2 servidores, assina o 15128 e o placar diz "2 de 2 relays"; o site sai no ar', async () => {
    const { p, ch } = await sessao({ relays: [f.ws('m-ok'), f.ws('m-ok2')] });
    await p.pg.click('#menu .item[data-tela="t6"]'); await p.pg.waitForSelector('#t6a');
    await escolherArquivo(p.pg, 'foto.jpg', EXIF, 'image/jpeg');
    await p.pg.click('#t6a-adicionar'); await p.pg.waitForSelector('#t6-tabela');
    await p.pg.click('#btn-publicar');
    await p.pg.waitForSelector('#t8-total', { timeout: 20000 });
    const diff = await p.pg.evaluate(() => ({
      sobe: [...document.querySelectorAll('[data-bloco^="Sobe"] li code')].map(x => x.textContent).sort(),
      porques: [...document.querySelectorAll('[data-bloco^="Sobe"] li .apoio')].map(x => x.textContent),
      eventos: [...document.querySelectorAll('#t8-eventos li')].map(x => x.textContent),
      total: document.getElementById('t8-total').textContent,
      tor: !!document.getElementById('t8-tor')
    }));
    assert(diff.sobe.includes('/index.html') && diff.sobe.includes('/blog/primeiro-artigo.html') && diff.sobe.includes('/img/foto.jpg') && diff.sobe.includes('/nostermentor/site.json'), JSON.stringify(diff.sobe));
    assert(diff.porques.some(x => /sempre que algo muda/.test(x)), JSON.stringify(diff.porques));
    assert(diff.eventos.length === 4 && diff.eventos[0] === 'Mapa do site (manifest)', JSON.stringify(diff.eventos));
    assert(diff.tor, 'o aviso do Tor é dito sempre (P21)');

    // 15 §5: observar o MEIO, não só o desfecho — cada passo anunciado tem de
    // chegar a ser pintado (o de assinar é síncrono e escapava; ver 11, 2026-08-27)
    await p.pg.evaluate(() => {
      window.__passos = [];
      window.__barraRelays = [];                       // 34
      new MutationObserver(() => {
        const t = document.getElementById('t8-progresso');
        if (!t || !t.textContent) return;
        window.__passos.push(t.textContent);
        const b = document.getElementById('t8-barra');
        if (/aos relays/.test(t.textContent) && b) window.__barraRelays.push({ visivel: !b.hidden, valor: b.getAttribute('value'), max: b.getAttribute('max') });
      }).observe(document.getElementById('t8-corpo'), { subtree: true, childList: true, characterData: true, attributes: true });
    });
    await p.pg.click('#t8-assinar');
    await p.pg.waitForSelector('#t8-publicado', { timeout: 60000 });
    const passos = await p.pg.evaluate(() => window.__passos);
    for (const esperado of [/Enviando arquivos: \d+ de \d+/, /Assinando o mapa do site/, /Enviando aos relays/])
      assert(passos.some(x => esperado.test(x)), 'passo nunca pintado (' + esperado + '): ' + JSON.stringify(passos));

    // 34 — a barra só servia o upload: com 1 arquivo pequeno e N relays, o dono
    // ficava a olhar para "Enviando aos relays" parado durante a parte lenta.
    const barra = await p.pg.evaluate(() => window.__barraRelays);
    assert(barra.some(x => x.visivel), 'a barra tem de aparecer na fase de relays: ' + JSON.stringify(barra));
    assert(barra.some(x => Number(x.valor) > 0 && Number(x.max) > 0), 'a barra tem de avançar relay a relay: ' + JSON.stringify(barra));
    assert(passos.some(x => /Enviando aos relays: \d+ de \d+ — \d+ aceitaram/.test(x)),
      'quantos aceitaram é o número acionável: ' + JSON.stringify(passos.filter(x => /relays/.test(x))));
    const placar = await p.pg.evaluate(() => ({
      arquivos: [...document.querySelectorAll('#t8-placar-arquivos li')].map(x => x.textContent),
      relays: document.getElementById('t8-placar-relays').textContent,
      verSite: document.getElementById('t8-ver-site').getAttribute('href'),
      backup: !!document.getElementById('t8-exportar'),
      publicarBarra: document.getElementById('btn-publicar').textContent
    }));
    assert(placar.arquivos.length === 2 && placar.arquivos.every(x => /Arquivos: (\d+) de \1 em/.test(x)), JSON.stringify(placar.arquivos));
    assert(/aceito em 2 de 2 relays/.test(placar.relays), placar.relays);
    assert(placar.verSite === `https://${ch.npub}.nsite.lol/` && placar.backup, JSON.stringify(placar));
    assert(placar.publicarBarra === 'Nada a publicar', 'a barra devia zerar: ' + placar.publicarBarra);

    // o que ficou na rede falsa
    const publicados = f.publicadosEm('m-ok');
    const manifest = publicados.filter(e => e.kind === 15128).pop();
    assert(manifest, 'o relay devia ter o manifest');
    const paths = manifest.tags.filter(t => t[0] === 'path');
    const title = manifest.tags.filter(t => t[0] === 'title').map(t => t[1]);
    const client = manifest.tags.filter(t => t[0] === 'client').map(t => t[1]);
    assert(paths.length >= 5 && title[0] === 'Site do teste M4' && client[0] === 'nostermentor', JSON.stringify([paths.length, title, client]));
    for (const [, caminho, sha] of paths) assert(f.temBlob('m1', sha) || f.temBlob('m2', sha), 'blob ausente para ' + caminho);
    assert([0, 10002, 10063].every(k => publicados.some(e => e.kind === k)), 'faltou metadado: ' + JSON.stringify(publicados.map(e => e.kind)));

    // e no banco: tudo publicado, com o mapa assinado guardado
    const banco = await lerBanco(p.pg, ch.pubkey);
    assert(banco.pages.every(x => x.status === 'published' && x.published_hash) && banco.posts.every(x => x.status === 'published'), JSON.stringify(banco.pages.map(x => x.status)));
    assert(banco.media[0].status === 'published' && banco.media[0].servers.length === 2, JSON.stringify(banco.media[0] && [banco.media[0].status, banco.media[0].servers]));
    assert(banco.published && banco.published.manifest_event_id === manifest.id, 'a fotografia devia guardar o mesmo evento');
    const v = await varrer(p.pg, ch.nsec);
    assert(v.achados.length === 0, v.achados.join(' | '));
    await p.pg.close();
    return `${paths.length} caminhos, ${publicados.length} eventos, mídia em 2 servidores`;
  });

  await it('publicar de novo sem mudar nada → "Nada a publicar"; o diff é FINO: mudar só o corpo do artigo não mexe na inicial (que só mostra título e data), mudar o título mexe', async () => {
    const { p, ch } = await sessao({ relays: [f.ws('m-ok')] });
    await p.pg.click('#btn-publicar'); await p.pg.waitForSelector('#t8-total', { timeout: 20000 });
    await p.pg.click('#t8-assinar'); await p.pg.waitForSelector('#t8-publicado', { timeout: 60000 });
    await p.pg.click('#menu .item[data-tela="t3"]'); await p.pg.waitForSelector('#t3');
    await p.pg.evaluate(() => Shell.ir('t8'));
    await p.pg.waitForSelector('#t8-vazio', { timeout: 20000 });
    assert(/Nada a publicar/.test(await p.pg.textContent('#t8-vazio')), 'devia estar tudo igual');

    async function editarArtigo(mudanca) {
      await p.pg.evaluate(async ([pubkey, mudanca]) => {
        const db = await Db.abrir(pubkey);
        const posts = await db.getAll('posts');
        const t = Modelo.transicao(posts[0], 'editar');
        await db.put('posts', Object.assign({}, t.registro, mudanca));
        db.fechar();
      }, [ch.pubkey, mudanca]);
      await p.pg.evaluate(() => Shell.ir('t3'));
      await p.pg.waitForSelector('#t3');
      await p.pg.evaluate(() => Shell.ir('t8'));
      await p.pg.waitForSelector('#t8-total', { timeout: 20000 });
      return p.pg.evaluate(() => [...document.querySelectorAll('[data-bloco^="Atualiza"] li code')].map(x => x.textContent).sort());
    }
    // só o corpo: o artigo, a lista do blog (que mostra o resumo) e o site.json
    const soCorpo = await editarArtigo({ body: 'Corpo revisto.' });
    assert(soCorpo.join() === ['/blog/index.html', '/blog/primeiro-artigo.html', '/nostermentor/site.json'].join(), JSON.stringify(soCorpo));
    // o título aparece TAMBÉM na inicial → /index.html entra
    const comTitulo = await editarArtigo({ title: 'Primeiro artigo (revisto)' });
    assert(comTitulo.includes('/index.html'), 'mudar o título devia mexer na inicial: ' + JSON.stringify(comTitulo));
    await p.pg.close();
    return `corpo → ${soCorpo.length} caminhos; título → ${comTitulo.length}`;
  });

  await it('M5: pré-flight prevê a recusa ANTES do clique → bloco vermelho "não pode subir", botão desligado, nada sobe', async () => {
    const { p, ch } = await sessao({ relays: [f.ws('m-ok')], servidores: [f.url('img-so')] });
    await p.pg.click('#btn-publicar'); await p.pg.waitForSelector('#t8-total', { timeout: 20000 });
    const est = await p.pg.evaluate(() => ({
      erro: document.getElementById('t8-erro').textContent,
      bloqueados: [...document.querySelectorAll('#t8-avisos li.erro')].map(x => x.textContent),
      podeClicar: !document.getElementById('t8-assinar').disabled
    }));
    assert(/não pode subir/.test(est.erro), est.erro);
    assert(est.bloqueados.some(x => /index\.html/.test(x) && /não pode subir/.test(x)), JSON.stringify(est.bloqueados));
    assert(!est.podeClicar, 'o botão devia estar desligado sem precisar de clicar');
    assert(f.blobsDe('img-so').length === 0, 'o pré-flight é um HEAD — nada deveria ter sido enviado');
    const banco = await lerBanco(p.pg, ch.pubkey);
    assert(banco.pages.every(x => x.status !== 'published') && !banco.published, 'o estado local não pode mudar: ' + JSON.stringify(banco.pages.map(x => x.status)));
    await p.pg.close();
    return est.bloqueados[0];
  });

  await it('ORDEM DE SEGURANÇA pela tela: servidor que MENTE no pré-flight mas recusa HTML de verdade no upload → "Publicação interrompida", motivo por servidor, nada muda no banco e nenhum relay recebe evento', async () => {
    const { p, ch } = await sessao({ relays: [f.ws('m-ok')], servidores: [f.url('finge-aceita')] });
    const antes = f.publicadosEm('m-ok').length;
    await p.pg.click('#btn-publicar'); await p.pg.waitForSelector('#t8-total', { timeout: 20000 });
    await p.pg.click('#t8-assinar');
    await p.pg.waitForSelector('#t8-erro:not([hidden])', { timeout: 60000 });
    const est = await p.pg.evaluate(() => ({ erro: document.getElementById('t8-erro').textContent,
      orfaos: [...document.querySelectorAll('#t8-orfaos li')].map(x => x.textContent),
      podeTentar: !document.getElementById('t8-assinar').disabled }));
    assert(/Publicação interrompida/.test(est.erro) && /Nada mudou no seu site/.test(est.erro), est.erro);
    assert(est.orfaos.some(x => /tipo não aceito/.test(x)), JSON.stringify(est.orfaos));
    assert(est.podeTentar, 'o botão devia voltar a funcionar');
    assert(f.publicadosEm('m-ok').length === antes, 'nenhum evento pode ter ido ao relay');
    const banco = await lerBanco(p.pg, ch.pubkey);
    assert(banco.pages.every(x => x.status !== 'published') && !banco.published, 'o estado local não pode mudar: ' + JSON.stringify(banco.pages.map(x => x.status)));
    await p.pg.close();
    return est.orfaos[0];
  });

  await it('publicação interrompida: a imagem que SUBIU passa a dizer "em 1 servidor(es)" em T6 — a linha de apoio de T8 promete isso e, até 2026-08-28, mentia (achado da bancada Tails)', async () => {
    const { p, ch } = await sessao({ relays: [f.ws('m-ok')], servidores: [f.url('finge-aceita')] });
    await p.pg.click('#menu .item[data-tela="t6"]'); await p.pg.waitForSelector('#t6a');
    await escolherArquivo(p.pg, 'subiu.jpg', EXIF, 'image/jpeg');
    await p.pg.click('#t6a-adicionar'); await p.pg.waitForSelector('#t6-tabela');
    await p.pg.click('#btn-publicar'); await p.pg.waitForSelector('#t8-total', { timeout: 20000 });
    await p.pg.click('#t8-assinar');
    await p.pg.waitForSelector('#t8-erro:not([hidden])', { timeout: 60000 });
    const apoio = await p.pg.textContent('#t8-placar');
    assert(/ficam registrados/.test(apoio), 'a promessa continua na tela: ' + apoio);
    const banco = await lerBanco(p.pg, ch.pubkey);
    const img = banco.media.find(m => /subiu/.test(m.path));
    assert(img && (img.servers || []).length === 1, 'o servidor que aceitou a imagem tinha de ficar gravado: ' + JSON.stringify(img && img.servers));
    assert(img.status !== 'published', 'e sem publicar nada: o arquivo continua por publicar (' + img.status + ')');
    await p.pg.click('#menu .item[data-tela="t6"]'); await p.pg.waitForSelector('#t6-tabela');
    const onde = await p.pg.evaluate(() => [...document.querySelectorAll('#t6-tabela .onde')].map(x => x.textContent));
    assert(onde.some(x => /em 1 servidor/.test(x)), 'T6 devia dizer onde o arquivo está: ' + JSON.stringify(onde));
    assert(!onde.some(x => /só neste navegador/.test(x)), 'e já não pode dizer que está só aqui: ' + JSON.stringify(onde));
    await p.pg.close();
    return onde.join(' · ');
  });

  await it('nenhum relay aceita → "os arquivos subiram, mas nenhum relay aceitou": o publicado continua o de antes e o estado local fica por publicar', async () => {
    const { p, ch } = await sessao({ relays: [f.ws('m-recusa'), f.ws('m-mudo')] });
    await p.pg.click('#btn-publicar'); await p.pg.waitForSelector('#t8-total', { timeout: 20000 });
    await p.pg.click('#t8-assinar');
    await p.pg.waitForSelector('#t8-erro:not([hidden])', { timeout: 90000 });
    const est = await p.pg.evaluate(() => ({ erro: document.getElementById('t8-erro').textContent, relays: [...document.querySelectorAll('#t8-relays li')].map(x => x.textContent) }));
    assert(/nenhum relay aceitou o mapa do site/.test(est.erro), est.erro);
    assert(est.relays.length === 2 && est.relays.some(x => /recusou/.test(x)) && est.relays.some(x => /não respondeu/.test(x)), JSON.stringify(est.relays));
    const banco = await lerBanco(p.pg, ch.pubkey);
    assert(!banco.published, 'sem relay não há fotografia');
    assert(banco.pages.every(x => x.status !== 'published'), 'o conteúdo continua por publicar');
    await p.pg.close();
    return est.relays.join(' · ');
  });

  await it('53: imagem de OUTRO servidor e formulário para fora numa página → T8 mostra "Arquivos de outros sites" com o caminho e os servidores, diz o preço para quem lê, fica antes do botão e NÃO impede de publicar; link para fora não entra; sem nada de fora o bloco não aparece', async () => {
    const { p, ch } = await sessao({ relays: [f.ws('m-ok')] });
    await p.pg.click('#btn-publicar'); await p.pg.waitForSelector('#t8-total', { timeout: 20000 });
    assert(!(await p.pg.$('#t8-externos')), 'um site sem nada de fora não pode ter o aviso');
    await p.pg.evaluate(async (pubkey) => {
      const db = await Db.abrir(pubkey);
      const pages = await db.getAll('pages');                 // sessao() cria uma página só: a inicial
      const t = Modelo.transicao(pages[0], 'editar');
      await db.put('pages', Object.assign({}, t.registro, { body: 'Olá.\n\n![foto](https://imagens.exemplo.test/foto.jpg)\n\n<form action="https://formularios.exemplo.test/enviar"><input name="nome"><button>Enviar</button></form>\n\n[um link para fora](https://links.exemplo.test/)' }));
      db.fechar();
    }, ch.pubkey);
    await p.pg.evaluate(() => Shell.ir('t3')); await p.pg.waitForSelector('#t3');
    await p.pg.evaluate(() => Shell.ir('t8'));
    await p.pg.waitForSelector('#t8-externos', { timeout: 20000 });
    const est = await p.pg.evaluate(() => {
      const b = document.getElementById('t8-externos'), btn = document.getElementById('t8-assinar');
      return { titulo: b.querySelector('h2').textContent, texto: b.textContent.replace(/\s+/g, ' '),
        itens: [...b.querySelectorAll('li')].map(li => li.textContent), visivel: !!(b.offsetWidth || b.offsetHeight),
        antesDoBotao: (b.compareDocumentPosition(btn) & Node.DOCUMENT_POSITION_FOLLOWING) > 0, podeClicar: !btn.disabled };
    });
    assert(est.titulo === 'Arquivos de outros sites (1)', est.titulo);
    assert(est.itens.length === 1 && /^\/index\.html — /.test(est.itens[0]) && /busca arquivos em imagens\.exemplo\.test/.test(est.itens[0]) && /envia o formulário para formularios\.exemplo\.test/.test(est.itens[0]), JSON.stringify(est.itens));
    assert(!/links\.exemplo\.test/.test(est.texto), 'link para fora não busca nada — não pode entrar no aviso: ' + est.texto);
    assert(/endereço de internet \(IP\)/.test(est.texto) && /hora da visita/.test(est.texto) && /não impede a publicação/.test(est.texto) && /tela Mídia/.test(est.texto), est.texto);
    assert(est.visivel && est.antesDoBotao && est.podeClicar, JSON.stringify(est));
    await p.pg.screenshot({ path: u.captura('t8-externos'), fullPage: true });
    await p.pg.click('#t8-assinar'); await p.pg.waitForSelector('#t8-publicado', { timeout: 60000 });
    await p.pg.close();
    return est.itens[0];
  });

  await it('guarda de concorrência: outra máquina publicou depois → T8 bloqueia com a faixa e "Recarregar da rede", sem deixar publicar por cima', async () => {
    const { p, ch } = await sessao({ relays: [f.ws('m-ok')] });
    await p.pg.click('#btn-publicar'); await p.pg.waitForSelector('#t8-total', { timeout: 20000 });
    await p.pg.click('#t8-assinar'); await p.pg.waitForSelector('#t8-publicado', { timeout: 60000 });
    // alguém publica um manifest mais novo, com a mesma chave, noutro lugar
    const maisNovo = F.manifest(ch, { paths: { '/index.html': F.sha256('de outra máquina') }, servers: SERVIDORES, created_at: F.agora() + 120 });
    f.estado.relays.get('m-ok').eventos.push(maisNovo);
    await p.pg.evaluate(async (pubkey) => {                       // uma alteração qualquer para haver o que publicar
      const db = await Db.abrir(pubkey);
      const pages = await db.getAll('pages');
      const t = Modelo.transicao(pages[0], 'editar');
      await db.put('pages', Object.assign({}, t.registro, { body: 'texto novo' }));
      db.fechar();
    }, ch.pubkey);
    await p.pg.evaluate(() => Shell.ir('t3')); await p.pg.waitForSelector('#t3');
    await p.pg.evaluate(() => Shell.ir('t8'));
    await p.pg.waitForSelector('#t8-concorrente', { timeout: 30000 });
    const est = await p.pg.evaluate(() => ({ msg: document.getElementById('t8-concorrente').textContent,
      faixa: document.getElementById('faixa').textContent, temAssinar: !!document.getElementById('t8-assinar'), temRecarregar: !!document.getElementById('t8-recarregar') }));
    assert(/Outra máquina publicou este site em \d{4}-\d{2}-\d{2}/.test(est.msg), est.msg);
    assert(!est.temAssinar && est.temRecarregar, 'não pode haver botão de publicar: ' + JSON.stringify(est));
    assert(/Recarregar da rede/.test(est.faixa), est.faixa);
    await p.pg.close();
    return est.msg.slice(0, 60) + '…';
  });

  await it('T3 "Republicar": relay que não tinha o mapa recebe o evento JÁ assinado, com a chave trancada (sem pedir nada ao dono)', async () => {
    f.relay('m-novo', { escrita: 'aceita', eventos: [] });
    const { p, ch } = await sessao({ relays: [f.ws('m-ok'), f.ws('m-novo')] });
    // publica só no primeiro (o segundo entra na lista depois)
    await p.pg.evaluate(async ([pubkey, so]) => { const db = await Db.abrir(pubkey); const site = await db.get('site', 'site'); site.network.relays = [so]; await db.put('site', site, 'site'); db.fechar(); }, [ch.pubkey, f.ws('m-ok')]);
    await p.pg.evaluate(() => Shell.ir('t8')); await p.pg.waitForSelector('#t8-total', { timeout: 20000 });
    await p.pg.click('#t8-assinar'); await p.pg.waitForSelector('#t8-publicado', { timeout: 60000 });
    const antes = f.publicadosEm('m-novo').length;
    await p.pg.evaluate(async ([pubkey, dois]) => { const db = await Db.abrir(pubkey); const site = await db.get('site', 'site'); site.network.relays = dois; await db.put('site', site, 'site'); db.fechar(); }, [ch.pubkey, [f.ws('m-ok'), f.ws('m-novo')]]);
    await p.pg.evaluate(() => Shell.ir('t3')); await p.pg.waitForSelector('#t3');
    await p.pg.click('#verificar-saude');
    await p.pg.waitForSelector('#republicar', { timeout: 30000 });
    await p.pg.click('#republicar');
    await p.pg.waitForFunction(() => /Reenviado/.test(document.getElementById('faixa').textContent) || /Nenhum relay/.test(document.getElementById('faixa').textContent), null, { timeout: 30000 });
    const faixa = await p.pg.textContent('#faixa');
    assert(/Reenviado\. Aceito em 1 de 1 relays\./.test(faixa), faixa);
    const depois = f.publicadosEm('m-novo');
    assert(depois.length > antes && depois.some(e => e.kind === 15128), 'o relay novo devia ter recebido o manifest');
    await p.pg.close();
    return `${depois.length} eventos reenviados`;
  });

  await it('remover mídia (T6b): o modal diz a verdade de 03 §6 antes do clique; ao publicar, o caminho sai do mapa e o DELETE é tentado em cada servidor', async () => {
    const { p, ch } = await sessao({ relays: [f.ws('m-ok')] });
    await p.pg.click('#menu .item[data-tela="t6"]'); await p.pg.waitForSelector('#t6a');
    await escolherArquivo(p.pg, 'sai.jpg', EXIF, 'image/jpeg');
    await p.pg.click('#t6a-adicionar'); await p.pg.waitForSelector('#t6-tabela');
    await p.pg.click('#btn-publicar'); await p.pg.waitForSelector('#t8-total', { timeout: 20000 });
    await p.pg.click('#t8-assinar'); await p.pg.waitForSelector('#t8-publicado', { timeout: 60000 });
    const banco1 = await lerBanco(p.pg, ch.pubkey);
    const sha = banco1.media[0].sha256;
    assert(f.temBlob('m1', sha) && f.temBlob('m2', sha), 'o blob devia estar nos dois servidores');
    await p.pg.click('#menu .item[data-tela="t6"]'); await p.pg.waitForSelector('#t6-tabela');
    await p.pg.click('#t6-tabela .t6-remover');            // M5: "Remover" só existe para o que já foi publicado
    await p.pg.waitForSelector('#t6b-remover');
    const modal = await p.pg.textContent('#modal-corpo, .modal-corpo');
    assert(/sempre funciona/.test(modal) && /continua acessível para quem tiver o endereço/.test(modal), modal.slice(0, 200));
    await p.pg.click('#t6b-remover');
    await p.pg.waitForSelector('#t6-tabela tr.removida');
    await p.pg.click('#btn-publicar'); await p.pg.waitForSelector('#t8-total', { timeout: 20000 });
    const some = await p.pg.evaluate(() => [...document.querySelectorAll('[data-bloco^="Some"] li')].map(x => x.textContent));
    assert(some.some(x => /\/img\/sai\.jpg/.test(x) && /tentar apagar dos servidores/.test(x)), JSON.stringify(some));
    await p.pg.click('#t8-assinar'); await p.pg.waitForSelector('#t8-publicado', { timeout: 60000 });
    const placar = await p.pg.textContent('#t8-placar');
    assert(/apagada de/.test(placar), placar.slice(0, 300));
    assert(!f.temBlob('m1', sha) && !f.temBlob('m2', sha), 'o blob devia ter sido apagado dos dois');
    const manifest = f.publicadosEm('m-ok').filter(e => e.kind === 15128).pop();
    assert(!manifest.tags.some(t => t[0] === 'path' && t[1] === '/img/sai.jpg'), 'o caminho devia ter saído do mapa');
    await p.pg.close();
    return 'apagado dos 2 servidores e fora do mapa';
  });

  await it('16: contador de uso de mídia enxerga a imagem de CAPA de um artigo, não só a citada no corpo', async () => {
    const { p, ch } = await sessao({ relays: [f.ws('m-ok')] });
    await p.pg.click('#menu .item[data-tela="t6"]'); await p.pg.waitForSelector('#t6a');
    await escolherArquivo(p.pg, 'capa.jpg', EXIF, 'image/jpeg');
    await p.pg.click('#t6a-adicionar'); await p.pg.waitForSelector('#t6-tabela');
    const banco = await lerBanco(p.pg, ch.pubkey);
    const media = banco.media[0];
    await p.pg.evaluate(async ([pubkey, mediaId]) => {
      const db = await Db.abrir(pubkey);
      const artigo = (await db.getAll('posts'))[0];   // criado por sessao(), corpo sem citar a imagem
      await db.put('posts', Object.assign({}, artigo, { cover_media_id: mediaId }));
      db.fechar();
    }, [ch.pubkey, media.id]);
    // M5: a mídia é rascunho, então o gesto é "Excluir" (14 T6) — a contagem
    // de uso é dita nos dois modais, porque em ambos o dono precisa dela.
    await p.pg.click('#t6-tabela .t6-excluir');
    await p.pg.waitForSelector('#t6-excluir-ok');
    const modal = await p.pg.textContent('#modal-corpo, .modal-corpo');
    assert(/ainda usam este arquivo: 1/.test(modal), 'devia contar o artigo pela capa, não só pelo corpo: ' + modal.slice(0, 200));
    await p.pg.close();
    return 'capa contada: ' + modal.match(/ainda usam este arquivo: \d+/)[0];
  });

  await it('herdados (T-7): um caminho publicado por outra ferramenta continua no manifest depois de o app publicar', async () => {
    const ch = F.chave();
    const sj = F.siteExemplo(ch, { servers: SERVIDORES });
    f.blobEm('m1', sj.bytes, 'application/json');
    const herdado = '/legado.html', shaH = f.blobEm('m1', Buffer.from('<h1>legado</h1>'), 'text/html');
    const paths = Object.assign(F.pathsDoExemplo(sj), { [herdado]: shaH });
    f.relay('m-herda', { escrita: 'aceita', eventos: [F.manifest(ch, { paths: paths, servers: SERVIDORES, created_at: F.agora() - 300 })] });
    const p = await abrir(ctx, u.url);
    await semearSite(p.pg, ch, { relays: [f.ws('m-herda')], servers: SERVIDORES });
    await entrarCom(p.pg, ch.nsec);
    await esperarT2(p.pg, 30000);
    await p.pg.evaluate(async (pubkey) => {          // uma alteração para haver o que publicar
      const db = await Db.abrir(pubkey);
      const pages = await db.getAll('pages');
      const t = Modelo.transicao(pages[0], 'editar');
      await db.put('pages', Object.assign({}, t.registro, { body: 'mudou' }));
      db.fechar();
    }, ch.pubkey);
    await p.pg.evaluate(() => Shell.ir('t8'));
    await p.pg.waitForSelector('#t8-total', { timeout: 30000 });
    await p.pg.click('#t8-assinar'); await p.pg.waitForSelector('#t8-publicado', { timeout: 90000 });
    const manifest = f.publicadosEm('m-herda').filter(e => e.kind === 15128).pop();
    const tag = manifest.tags.find(t => t[0] === 'path' && t[1] === herdado);
    assert(tag && tag[2] === shaH, 'o caminho herdado devia continuar no mapa com o mesmo hash: ' + JSON.stringify(manifest.tags.filter(t => t[0] === 'path').map(t => t[1])));
    await p.pg.close();
    return herdado + ' preservado';
  });

  return R;
};
