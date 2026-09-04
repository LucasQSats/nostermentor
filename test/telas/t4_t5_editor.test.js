// test/telas/t4_t5_editor.test.js — T4/T5 (listas) e T4a/T5a (editor) pelo
// painel: aceites 1, 2, 3, 6 e 7 de 15 M3 — criar página e artigo (etiquetas,
// data, resumo, capa de mídia rascunho), estados e ações, remover/desfazer/
// excluir, slug (NFD, reservados, travado após publicação com aliases),
// pré-visualização sanitizada em iframe de origem opaca (SecurityError),
// contador de não exportadas, gravação automática (blur e 30 s),
// beforeunload, Definir como Início, filtros/busca, 1200×600, varredura.
const { abrir, varrer, coletor, assert, entrarCom, semearSite, lerBanco } = require('../util.js');
const F = require('../fabrica.js');

const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

module.exports = async function (ctx, u) {
  const { R, it } = coletor();
  const ch = F.chave();
  const relaysMortos = ['wss://127.0.0.1:1/x'];
  const statusSalvo = (pg) => pg.waitForFunction(() => /Salvo/.test(document.getElementById('ed-status').textContent), null, { timeout: 10000 });

  // Entra, "Continuar sem rede" (relay inalcançável falha em < 2 s) → T3
  async function sessao(extra) {
    const p = await abrir(ctx, u.url);
    await semearSite(p.pg, ch, { relays: relaysMortos, servers: [], extra: extra || [] });
    await entrarCom(p.pg, ch.nsec);
    await p.pg.waitForSelector('#continuar-sem-rede', { timeout: 60000 });
    await p.pg.click('#continuar-sem-rede');
    await p.pg.waitForSelector('#t3');
    return p;
  }
  // Como sessao(), mas com uma chave própria e o banco apagado no fim — para
  // não acumular estado que os testes sequenciais desta suíte (mesmo `ch`)
  // dependem em ordem exata (ex.: "últimos artigos" do T3).
  async function sessaoIsolada(extra) {
    const chI = F.chave();
    const p = await abrir(ctx, u.url);
    await semearSite(p.pg, chI, { relays: relaysMortos, servers: [], extra: extra || [] });
    await entrarCom(p.pg, chI.nsec);
    await p.pg.waitForSelector('#continuar-sem-rede', { timeout: 60000 });
    await p.pg.click('#continuar-sem-rede');
    await p.pg.waitForSelector('#t3');
    return { p, ch: chI };
  }
  const limparBanco = (pg) => pg.evaluate(async (pk) => { await Db.apagar(pk); }, ch.pubkey);

  let idPagina = null, idArtigo = null;
  await it('aceite 1/6: T4 vazia → "Nova página" → editor: slug derivado do título (NFD), Salvar → Rascunho, "Salvo neste navegador. Não é backup.", Publicar (1), Backup: 1 não exportadas; lista mostra a linha', async () => {
    const p = await sessao();
    await p.pg.click('#menu .item[data-tela="t4"]');
    await p.pg.waitForSelector('#t4');
    assert((await p.pg.textContent('#lista-vazia')) === 'Nenhuma página ainda.' && (await p.pg.$('#novo-registro')), 'lista vazia');
    await p.pg.click('#novo-registro');
    await p.pg.waitForSelector('#editor[data-tipo="page"]');
    assert((await p.pg.evaluate(() => document.activeElement && document.activeElement.id)) === 'ed-titulo', 'foco no título');
    await p.pg.fill('#ed-titulo', 'Ação & Reação — Olá!');
    assert((await p.pg.inputValue('#ed-slug')) === 'acao-reacao-ola', 'slug: ' + (await p.pg.inputValue('#ed-slug')));
    await p.pg.fill('#ed-descricao', 'Uma descrição');
    await p.pg.fill('#ed-corpo', '# Olá\n\nTexto **negrito**.');
    await p.pg.click('#ed-salvar');
    await statusSalvo(p.pg);
    await p.pg.waitForFunction(() => /^Salvo às/.test(document.getElementById('ed-status').textContent), null, { timeout: 5000 });
    const est = await p.pg.evaluate(() => ({ estado: document.getElementById('ed-estado').textContent, legenda: document.getElementById('ed-legenda').textContent, status: document.getElementById('ed-status').textContent, ultima: document.getElementById('ed-ultima').textContent, publicar: document.getElementById('btn-publicar').textContent, backup: document.getElementById('btn-backup').textContent, titulo: document.querySelector('#editor h1').textContent }));
    assert(est.estado === 'Rascunho' && est.legenda === 'Salvo neste navegador. Não é backup.' && /^Salvo às \d{2}:\d{2} UTC\.$/.test(est.status) && /^Última alteração \d{4}-\d{2}-\d{2}$/.test(est.ultima), JSON.stringify(est));
    // o contador conta GRAVAÇÕES (14 §2): cada saída de campo com texto novo gravou uma vez
    const contador = (await lerBanco(p.pg, ch.pubkey)).meta.find(m => m.key === 'alteracoes_nao_exportadas').value;
    assert(est.publicar === 'Publicar (1)' && contador >= 1 && est.backup === 'Backup: ' + contador + ' não exportadas' && est.titulo === 'Nova página', JSON.stringify(est) + ' contador=' + contador);
    await p.pg.screenshot({ path: u.captura('t4a-editor'), fullPage: false });
    const b = await lerBanco(p.pg, ch.pubkey);
    assert(b.pages.length === 1 && b.pages[0].slug === 'acao-reacao-ola' && b.pages[0].status === 'draft' && b.pages[0].body === '# Olá\n\nTexto **negrito**.' && b.pages[0].in_menu === true && b.pages[0].description === 'Uma descrição', JSON.stringify(b.pages[0]));
    idPagina = b.pages[0].id;
    await p.pg.click('#ed-voltar');
    await p.pg.waitForSelector('#lista-pages');
    const linha = await p.pg.evaluate(() => { const tr = document.querySelector('#lista-pages tbody tr'); return { id: tr.getAttribute('data-id'), status: tr.getAttribute('data-status'), texto: tr.textContent.replace(/\s+/g, ' ').trim(), acoes: [...tr.querySelectorAll('.acoes-linha button')].map(b => b.textContent) }; });
    assert(linha.id === idPagina && linha.status === 'draft' && /Ação & Reação — Olá!/.test(linha.texto) && /\/acao-reacao-ola\.html/.test(linha.texto) && /Rascunho/.test(linha.texto) && /✓/.test(linha.texto), JSON.stringify(linha));
    assert(linha.acoes.join('|') === 'Editar|Ver|Excluir|Definir como Início', linha.acoes.join('|'));
    await p.pg.screenshot({ path: u.captura('t4-lista'), fullPage: true });
    const v = await varrer(p.pg, ch.nsec);
    assert(v.achados.length === 0, v.achados.join(' | '));
    assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros }));
    await p.pg.close();
  });

  await it('aceite 1: T5 "Novo artigo" com data, resumo, etiquetas (minúsculas, sem repetir) e capa de mídia RASCUNHO do banco → T5 lista com Data e Etiquetas em ordem decrescente; "Imagem" da barra insere ![alt](/img/…) e a pré-visualização mostra a imagem por data: (E4)', async () => {
    const midia = { id: 'm-teste', path: '/img/foto.png', mime: 'image/png', size: 70, sha256: 'e'.repeat(64), width: 1, height: 1, alt: 'Uma foto', caption: '', bytes: null, status: 'draft', servers: [], removal: null, metadata: { stripped: true, removed_segments: [], warning: null }, origin: 'upload', created_at: '2026-08-26T00:00:00Z', updated_at: '2026-08-26T00:00:00Z', previous_status: null };
    const p = await sessao([{ op: 'put', store: 'media', valor: midia }]);
    await p.pg.evaluate(async ([pk, b64]) => { const db = await Db.abrir(pk); const m = await db.get('media', 'm-teste'); const bin = atob(b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); m.bytes = new Blob([u8], { type: 'image/png' }); await db.put('media', m); db.fechar(); }, [ch.pubkey, PNG_B64]);
    await p.pg.click('#menu .item[data-tela="t5"]');
    await p.pg.waitForSelector('#t5');
    await p.pg.click('#novo-registro');
    await p.pg.waitForSelector('#editor[data-tipo="post"]');
    await p.pg.fill('#ed-titulo', 'Primeiro artigo');
    await p.pg.fill('#ed-data', '2026-08-20');
    await p.pg.fill('#ed-resumo', 'Resumo do primeiro');
    await p.pg.fill('#ed-etiquetas', 'Nostr, teste , nostr,,');
    await p.pg.click('#ed-capa-escolher');
    await p.pg.waitForSelector('#modal');
    await p.pg.click('.capa-opcao[data-media-id="m-teste"]');
    assert(!(await p.pg.$('#modal')), 'modal da capa não fechou');
    assert((await p.pg.textContent('#ed-capa-atual')) === '/img/foto.png', await p.pg.textContent('#ed-capa-atual'));
    await p.pg.fill('#ed-corpo', 'Texto.');
    await p.pg.click('.ferramenta[data-acao="imagem"]');
    await p.pg.waitForSelector('#modal');
    await p.pg.click('.escolher-imagem[data-path="/img/foto.png"]');
    assert(!(await p.pg.$('#modal')), 'modal não fechou');
    const corpo = await p.pg.inputValue('#ed-corpo');
    assert(corpo === 'Texto.![Uma foto](/img/foto.png)', JSON.stringify(corpo));
    await p.pg.waitForFunction(() => /data:image\/png;base64/.test(document.getElementById('ed-previa').getAttribute('srcdoc') || ''), null, { timeout: 5000 });
    await p.pg.click('#ed-salvar');
    await statusSalvo(p.pg);
    const b = await lerBanco(p.pg, ch.pubkey);
    const a = b.posts[0];
    assert(b.posts.length === 1 && a.slug === 'primeiro-artigo' && a.date === '2026-08-20T00:00:00Z' && a.excerpt === 'Resumo do primeiro' && JSON.stringify(a.tags) === '["nostr","teste"]' && a.cover_media_id === 'm-teste' && a.status === 'draft', JSON.stringify(a));
    idArtigo = a.id;
    // segundo artigo, mais novo, para a ordem
    await p.pg.click('#ed-voltar'); await p.pg.waitForSelector('#lista-posts');
    await p.pg.click('#novo-registro'); await p.pg.waitForSelector('#editor[data-tipo="post"]');
    await p.pg.fill('#ed-titulo', 'Segundo'); await p.pg.fill('#ed-data', '2026-08-25'); await p.pg.click('#ed-salvar'); await statusSalvo(p.pg);
    await p.pg.click('#ed-voltar'); await p.pg.waitForSelector('#lista-posts');
    const linhas = await p.pg.evaluate(() => [...document.querySelectorAll('#lista-posts tbody tr')].map(tr => tr.textContent.replace(/\s+/g, ' ').trim()));
    assert(linhas.length === 2 && /^Segundo\/blog\/segundo\.html2026-08-25Rascunho/.test(linhas[0]) && /^Primeiro artigo\/blog\/primeiro-artigo\.html2026-08-20nostr, testeRascunho/.test(linhas[1]), JSON.stringify(linhas));
    const cab = await p.pg.evaluate(() => [...document.querySelectorAll('#lista-posts th')].map(t => t.textContent));
    assert(cab.join('|') === 'Título|Caminho|Data|Etiquetas|Estado|Atualizada|Ações', cab.join('|'));
    await p.pg.screenshot({ path: u.captura('t5-lista'), fullPage: true });
    assert((await p.pg.textContent('#btn-publicar')) === 'Publicar (4)', await p.pg.textContent('#btn-publicar'));   // 1 página + 2 artigos + 1 mídia rascunho
    assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros }));
    await p.pg.close();
  });

  await it('35: o editor de PÁGINA ganha capa — mesmo modal do artigo, com o aviso de que o tema Padrão não a mostra', async () => {
    const { p, ch: chI } = await sessaoIsolada();
    // uma imagem na biblioteca para haver o que escolher
    await p.pg.evaluate(async (pk) => {
      const db = await Db.abrir(pk);
      const brutos = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]);
      await db.put('media', { id: Modelo.novoId(), path: '/img/capa-pagina.png', mime: 'image/png', size: brutos.length,
        sha256: await Blossom.sha256Hex(brutos), width: 900, height: 300, alt: 'uma capa', caption: '',
        bytes: new Blob([brutos], { type: 'image/png' }), status: 'draft', servers: [], removal: null,
        metadata: { stripped: true, removed_segments: [], warning: null }, origin: 'upload',
        created_at: Modelo.agora(), updated_at: Modelo.agora(), previous_status: null });
      db.fechar();
    }, chI.pubkey);
    await p.pg.click('#menu .item[data-tela="t4"]'); await p.pg.waitForSelector('#t4');
    await p.pg.click('#novo-registro');
    await p.pg.waitForSelector('#editor[data-tipo="page"]');
    assert(await p.pg.$('#ed-capa-escolher'), 'a página tem de ter o botão de capa (35)');
    const apoio = await p.pg.textContent('#ed-capa-apoio');
    assert(/tema Padrão não mostra a capa nas páginas/.test(apoio), apoio);
    await p.pg.fill('#ed-titulo', 'Página com capa');
    await p.pg.click('#ed-capa-escolher');
    await p.pg.waitForSelector('.grade-capas .capa-opcao[data-media-id]');
    await p.pg.click('.grade-capas .capa-opcao[data-media-id]');
    await p.pg.waitForFunction(() => !document.getElementById('modal'), null, { timeout: 5000 });
    assert(/capa-pagina\.png/.test(await p.pg.textContent('#ed-capa-atual')), await p.pg.textContent('#ed-capa-atual'));
    await p.pg.click('#ed-salvar');
    await statusSalvo(p.pg);
    const b = await lerBanco(p.pg, chI.pubkey);
    const pag = b.pages[0];
    assert(pag.cover_media_id && pag.cover_media_id === b.media[0].id, JSON.stringify([pag.cover_media_id, b.media[0].id]));
    // decisão do dono: guardada sim, desenhada não
    const html = await p.pg.evaluate(async () => {
      const db = Shell.dados().db;
      const dados = { site: await db.get('site', 'site'), pages: await db.getAll('pages'), posts: await db.getAll('posts'), media: await db.getAll('media') };
      return Gerador.htmlDe(dados, dados.pages[0], 'page');
    });
    assert(!/<figure class="capa"/.test(html), 'o tema Padrão não pode desenhar a capa na página');
    assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros }));
    await p.pg.evaluate(async (pk) => { await Db.apagar(pk); }, chI.pubkey);
    await p.pg.close();
  });

  await it('36: o modal "Inserir imagem" mostra MINIATURA, não só o nome — com os dois botões preservados', async () => {
    // O caso do dono: seis arquivos `controle`, `controle2`… `controle5`.
    // Uma lista de nomes torna a escolha impossível; a grade da capa já
    // existia desde 2026-08-26 e este modal ficou para trás.
    const { p, ch: chI } = await sessaoIsolada();
    await p.pg.evaluate(async (pk) => {
      const db = await Db.abrir(pk);
      const brutos = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 7, 7, 7, 7]);
      for (const n of ['controle', 'controle2', 'controle3']) {
        await db.put('media', { id: Modelo.novoId(), path: '/img/' + n + '.png', mime: 'image/png', size: brutos.length,
          sha256: await Blossom.sha256Hex(new Uint8Array(brutos.map((b, i) => i === 11 ? n.length : b))),
          width: 640, height: 480, alt: n, caption: '',
          bytes: new Blob([brutos], { type: 'image/png' }), status: 'draft', servers: [], removal: null,
          metadata: { stripped: true, removed_segments: [], warning: null }, origin: 'upload',
          created_at: Modelo.agora(), updated_at: Modelo.agora(), previous_status: null });
      }
      db.fechar();
    }, chI.pubkey);
    await p.pg.click('#menu .item[data-tela="t4"]'); await p.pg.waitForSelector('#t4');
    await p.pg.click('#novo-registro');
    await p.pg.waitForSelector('#editor[data-tipo="page"]');
    await p.pg.click('.ferramenta[data-acao="imagem"]');
    await p.pg.waitForSelector('.grade-inserir');
    const grade = await p.pg.evaluate(() => ({
      opcoes: document.querySelectorAll('.grade-inserir .inserir-opcao').length,
      comImagem: document.querySelectorAll('.grade-inserir .inserir-opcao img').length,
      inserir: document.querySelectorAll('.grade-inserir .escolher-imagem').length,
      comLink: document.querySelectorAll('.grade-inserir .com-link').length,
      semLista: !document.querySelector('.lista-imagens')
    }));
    assert(grade.opcoes === 3 && grade.comImagem === 3, 'cada opção precisa da sua miniatura: ' + JSON.stringify(grade));
    assert(grade.inserir === 3 && grade.comLink === 3, 'os DOIS botões continuam: ' + JSON.stringify(grade));
    assert(grade.semLista, 'a lista de nomes tinha de sair');
    // e continua a inserir o Markdown certo
    await p.pg.click('.escolher-imagem[data-path="/img/controle2.png"]');
    await p.pg.waitForFunction(() => !document.getElementById('modal'), null, { timeout: 5000 });
    const corpo = await p.pg.inputValue('#ed-corpo');
    assert(/!\[controle2\]\(\/img\/controle2\.png\)/.test(corpo), corpo);
    assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros }));
    await p.pg.evaluate(async (pk) => { await Db.apagar(pk); }, chI.pubkey);
    await p.pg.close();
  });

  await it('39: "Vídeo" insere <video> com capa, controls e preload="none" — e a marcação SOBREVIVE ao sanitizador, sem um único script no site', async () => {
    const { p, ch: chI } = await sessaoIsolada();
    await p.pg.evaluate(async (pk) => {
      const db = await Db.abrir(pk);
      const img = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 5, 5, 5, 5]);
      const vid = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109]);   // cabeçalho mp4 (não é vídeo tocável)
      await db.put('media', { id: Modelo.novoId(), path: '/img/capa-video.png', mime: 'image/png', size: img.length,
        sha256: await Blossom.sha256Hex(img), width: 640, height: 360, alt: 'capa do vídeo', caption: '',
        bytes: new Blob([img], { type: 'image/png' }), status: 'draft', servers: [], removal: null,
        metadata: { stripped: true, removed_segments: [], warning: null }, origin: 'upload',
        created_at: Modelo.agora(), updated_at: Modelo.agora(), previous_status: null });
      await db.put('media', { id: Modelo.novoId(), path: '/video/aula.mp4', mime: 'video/mp4', size: vid.length,
        sha256: await Blossom.sha256Hex(vid), width: null, height: null, alt: 'a aula', caption: '',
        bytes: new Blob([vid], { type: 'video/mp4' }), status: 'draft', servers: [], removal: null,
        metadata: { stripped: false, removed_segments: [], warning: 'Este tipo pode conter metadados que o app não remove.' }, origin: 'upload',
        created_at: Modelo.agora(), updated_at: Modelo.agora(), previous_status: null });
      db.fechar();
    }, chI.pubkey);
    await p.pg.click('#menu .item[data-tela="t4"]'); await p.pg.waitForSelector('#t4');
    await p.pg.click('#novo-registro');
    await p.pg.waitForSelector('#editor[data-tipo="page"]');

    // o vídeo NÃO pode aparecer no modal de imagem (era o caso errado: o botão
    // "Imagem" com um mp4 gerava <img src="…mp4">, que não mostra nada)
    await p.pg.click('.ferramenta[data-acao="imagem"]');
    await p.pg.waitForSelector('.grade-inserir');
    const naGradeDeImagem = await p.pg.evaluate(() => [...document.querySelectorAll('.grade-inserir .inserir-opcao')].map(x => x.getAttribute('data-path')));
    assert(naGradeDeImagem.length === 1 && naGradeDeImagem[0] === '/img/capa-video.png', JSON.stringify(naGradeDeImagem));
    await p.pg.click('#modal-fechar');
    await p.pg.waitForFunction(() => !document.getElementById('modal'), null, { timeout: 5000 });

    // o botão próprio: lista os vídeos e diz os limites MEDIDOS
    await p.pg.click('.ferramenta[data-acao="video"]');
    await p.pg.waitForSelector('.escolher-video');
    const limites = await p.pg.textContent('#video-limites');
    assert(/50 MB publica/.test(limites) && /98 MB falhou nas três tentativas/.test(limites) && /0,46 MB\/s/.test(limites), limites);
    await p.pg.click('.escolher-video[data-path="/video/aula.mp4"]');
    await p.pg.waitForSelector('.poster-usar');
    await p.pg.click('.poster-usar[data-path="/img/capa-video.png"]');
    await p.pg.waitForFunction(() => !document.getElementById('modal'), null, { timeout: 5000 });

    const corpo = await p.pg.inputValue('#ed-corpo');
    assert(/<video src="\/video\/aula\.mp4" poster="\/img\/capa-video\.png" controls preload="none">/.test(corpo), corpo);

    // A MEDIÇÃO que interessa: o que o site publicaria depois do DOMPurify.
    const html = await p.pg.evaluate((md) => Gerador.renderizarCorpo(md), corpo);
    assert(/<video/.test(html), 'o <video> não pode ser removido: ' + html);
    assert(/src="\/video\/aula\.mp4"/.test(html) && /poster="\/img\/capa-video\.png"/.test(html), html);
    assert(/controls/.test(html) && /preload="none"/.test(html), 'controls e preload têm de sobreviver: ' + html);
    assert(/<a href="\/video\/aula\.mp4"/.test(html), 'o link de reserva tem de sobreviver: ' + html);
    assert(!/<script/i.test(html) && !/onerror/i.test(html), 'o site publicado continua sem um único script: ' + html);

    assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros }));
    await p.pg.evaluate(async (pk) => { await Db.apagar(pk); }, chI.pubkey);
    await p.pg.close();
  });

  await it('19(b): "Imagem" → "Inserir com link…" produz [![alt](img)](url), Markdown de imagem clicável', async () => {
    const midia = { id: 'm-link', path: '/img/quadro.png', mime: 'image/png', size: 70, sha256: 'f'.repeat(64), width: 1, height: 1, alt: 'Um quadro', caption: '', bytes: null, status: 'draft', servers: [], removal: null, metadata: { stripped: true, removed_segments: [], warning: null }, origin: 'upload', created_at: '2026-08-26T00:00:00Z', updated_at: '2026-08-26T00:00:00Z', previous_status: null };
    const { p, ch: chI } = await sessaoIsolada([{ op: 'put', store: 'media', valor: midia }]);
    await p.pg.evaluate(async ([pk, b64]) => { const db = await Db.abrir(pk); const m = await db.get('media', 'm-link'); const bin = atob(b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); m.bytes = new Blob([u8], { type: 'image/png' }); await db.put('media', m); db.fechar(); }, [chI.pubkey, PNG_B64]);
    await p.pg.click('#menu .item[data-tela="t5"]'); await p.pg.waitForSelector('#t5');
    await p.pg.click('#novo-registro'); await p.pg.waitForSelector('#editor[data-tipo="post"]');
    await p.pg.fill('#ed-titulo', 'Artigo com link'); await p.pg.fill('#ed-corpo', 'Antes.');
    await p.pg.click('.ferramenta[data-acao="imagem"]'); await p.pg.waitForSelector('#modal');
    await p.pg.click('.com-link[data-path="/img/quadro.png"]');
    await p.pg.waitForSelector('#img-link-url');
    await p.pg.fill('#img-link-url', 'https://exemplo.test/original.png');
    await p.pg.click('#img-link-confirmar');
    assert(!(await p.pg.$('#modal')), 'modal não fechou');
    const corpo = await p.pg.inputValue('#ed-corpo');
    assert(corpo === 'Antes.[![Um quadro](/img/quadro.png)](https://exemplo.test/original.png)', corpo);
    await p.pg.click('#ed-salvar'); await statusSalvo(p.pg);
    const b = await lerBanco(p.pg, chI.pubkey);
    assert(b.posts.length === 1 && b.posts[0].body === corpo, 'não persistiu: ' + JSON.stringify(b.posts.map(x => x.body)));
    await p.pg.evaluate(async (pk) => { await Db.apagar(pk); }, chI.pubkey);
    await p.pg.close();
  });

  await it('aceite 2: slug reservado ("blog") e repetido recusados com a mensagem na hora; inválido idem; o slug editado à mão deixa de seguir o título', async () => {
    const p = await sessao();
    await p.pg.click('#menu .item[data-tela="t4"]'); await p.pg.waitForSelector('#t4');
    await p.pg.click('#novo-registro'); await p.pg.waitForSelector('#editor');
    await p.pg.fill('#ed-titulo', 'Blog');
    await p.pg.click('#ed-salvar');
    await p.pg.waitForSelector('#ed-erro:not([hidden])');
    assert((await p.pg.textContent('#ed-erro')) === 'Este caminho é reservado pelo site — escolha outro.', await p.pg.textContent('#ed-erro'));
    await p.pg.fill('#ed-slug', 'acao-reacao-ola');
    await p.pg.click('#ed-salvar');
    await p.pg.waitForFunction(() => /Já existe outro/.test(document.getElementById('ed-erro').textContent));
    await p.pg.fill('#ed-slug', 'Com Espaço');
    await p.pg.click('#ed-salvar');
    await p.pg.waitForFunction(() => /Caminho inválido/.test(document.getElementById('ed-erro').textContent));
    await p.pg.fill('#ed-slug', 'meu-blog');
    await p.pg.fill('#ed-titulo', 'Blog do site');
    assert((await p.pg.inputValue('#ed-slug')) === 'meu-blog', 'slug voltou a seguir o título');
    await p.pg.click('#ed-salvar'); await statusSalvo(p.pg);
    assert(await p.pg.evaluate(() => document.getElementById('ed-erro').hidden), 'erro não sumiu');
    const b = await lerBanco(p.pg, ch.pubkey);
    assert(b.pages.some(x => x.slug === 'meu-blog' && x.title === 'Blog do site'), JSON.stringify(b.pages.map(x => x.slug)));
    // exclui este rascunho pelo editor (confirmação inline)
    await p.pg.click('#ed-excluir'); await p.pg.waitForSelector('#ed-confirmacao');
    assert(/nunca foi publicada\. Excluir apaga de vez\./.test(await p.pg.textContent('#ed-confirmacao')), 'texto da confirmação');
    await p.pg.click('#ed-confirmar');
    await p.pg.waitForSelector('#lista-pages');
    const b2 = await lerBanco(p.pg, ch.pubkey);
    assert(!b2.pages.some(x => x.slug === 'meu-blog') && b2.pages.length === 1, 'não excluiu');
    assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros }));
    await p.pg.close();
  });

  await it('aceite 1/2: página PUBLICADA (simulada) → slug travado + "Renomear caminho…" gera aliases e o estado vira Alterada; lista: Remover → "A remover" riscada com Desfazer; Desfazer → volta a Alterada (previous_status); filtros e busca', async () => {
    const pub = Modelo_pagina('Publicada antiga', 'publicada-antiga', 'published');
    const p = await sessao([{ op: 'put', store: 'pages', valor: pub }]);
    await p.pg.click('#menu .item[data-tela="t4"]'); await p.pg.waitForSelector('#t4');
    await p.pg.click('#lista-pages tr[data-id="' + pub.id + '"] .acao-editar'); await p.pg.waitForSelector('#editor');
    const antes = await p.pg.evaluate(() => ({ slugDesligado: document.getElementById('ed-slug').disabled, renomear: !document.getElementById('ed-renomear').hidden, estado: document.getElementById('ed-estado').textContent, titulo: document.querySelector('#editor h1').textContent, acoes: [...document.querySelectorAll('#ed-acoes-estado button')].map(b => b.id) }));
    assert(antes.slugDesligado && antes.renomear && antes.estado === 'Publicada' && antes.titulo === 'Editar página' && antes.acoes.join() === 'ed-remover', JSON.stringify(antes));
    await p.pg.click('#ed-renomear');
    assert(!(await p.pg.evaluate(() => document.getElementById('ed-slug').disabled)) && /caminho antigo continua funcionando/.test(await p.pg.textContent('#ed-renomear-explica')), 'renomear não liberou');
    await p.pg.fill('#ed-slug', 'publicada-nova');
    await p.pg.click('#ed-salvar'); await statusSalvo(p.pg);
    const b = await lerBanco(p.pg, ch.pubkey);
    const r = b.pages.find(x => x.id === pub.id);
    assert(r.slug === 'publicada-nova' && JSON.stringify(r.aliases) === '["publicada-antiga"]' && r.status === 'modified', JSON.stringify(r));
    assert((await p.pg.textContent('#ed-estado')) === 'Alterada', 'estado no editor');
    await p.pg.click('#ed-voltar'); await p.pg.waitForSelector('#lista-pages');
    const sel = '#lista-pages tr[data-id="' + pub.id + '"]';
    await p.pg.click(sel + ' .acao-remover');
    await p.pg.waitForSelector('#confirmacao-' + pub.id);
    assert(/sai do site na próxima publicação\. Até lá, você pode desfazer\./.test(await p.pg.textContent('#confirmacao-' + pub.id)), 'texto remover');
    await p.pg.click(sel + ' .acao-confirmar');
    await p.pg.waitForSelector(sel + '[data-status="removed"]');
    const linha = await p.pg.evaluate((sel) => { const tr = document.querySelector(sel); return { classe: tr.className, estado: tr.querySelector('.estado').textContent, acoes: [...tr.querySelectorAll('.acoes-linha button')].map(b => b.textContent), riscado: getComputedStyle(tr.querySelector('td.titulo')).textDecorationLine }; }, sel);
    assert(linha.classe === 'removida' && linha.estado === 'A remover' && linha.acoes.join('|') === 'Editar|Ver|Desfazer remoção' && /line-through/.test(linha.riscado), JSON.stringify(linha));
    const b2 = await lerBanco(p.pg, ch.pubkey);
    assert(b2.pages.find(x => x.id === pub.id).previous_status === 'modified', 'previous_status');
    await p.pg.screenshot({ path: u.captura('t4-remover'), fullPage: true });
    // editor com registro removido: campos desligados + aviso + Desfazer
    await p.pg.click(sel + ' .acao-editar'); await p.pg.waitForSelector('#ed-removido');
    assert(await p.pg.evaluate(() => document.getElementById('ed-titulo').disabled && document.getElementById('ed-salvar').disabled && !!document.getElementById('ed-desfazer')), 'editor de removido');
    await p.pg.click('#ed-desfazer'); await p.pg.waitForSelector('#editor:not(:has(#ed-removido))');
    assert((await p.pg.textContent('#ed-estado')) === 'Alterada', 'desfazer no editor: ' + (await p.pg.textContent('#ed-estado')));
    await p.pg.click('#ed-voltar'); await p.pg.waitForSelector('#lista-pages');
    // filtros e busca
    const contar = () => p.pg.evaluate(() => document.querySelectorAll('#lista-pages tbody tr').length);
    await p.pg.click('.filtro[data-filtro="modified"]'); assert((await contar()) === 1, 'filtro alteradas');
    await p.pg.click('.filtro[data-filtro="removed"]'); assert((await contar()) === 0 && !(await p.pg.evaluate(() => document.getElementById('lista-vazia').hidden)) && (await p.pg.textContent('#lista-vazia')) === 'Nenhuma página com este filtro.', 'filtro a remover');
    await p.pg.click('.filtro[data-filtro="todos"]'); assert((await contar()) === 2, 'todas');
    await p.pg.fill('#busca', 'ANTIGA'); assert((await contar()) === 1, 'busca');
    assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros }));
    await p.pg.close();
  });

  await it('M5: UI de aliases — "Endereços antigos" no editor; Remover apaga o alias da página E grava uma lápide de mídia (removed, origin upload) pelo sha256 que estava publicado', async () => {
    const sha = 'a'.repeat(64);
    const pub = Object.assign(Modelo_pagina('Com alias', 'com-alias-nova', 'published'), { aliases: ['com-alias-velha'] });
    const publicado = { manifest_event: null, manifest_event_id: null, created_at: 1, paths: { '/com-alias-velha.html': sha }, relays: {}, servers: { [sha]: ['https://cdn.exemplo.test'] }, metadata_events: {}, health: {} };
    const p = await sessao([{ op: 'put', store: 'pages', valor: pub }, { op: 'put', store: 'published', chave: 'current', valor: publicado }]);
    await p.pg.click('#menu .item[data-tela="t4"]'); await p.pg.waitForSelector('#t4');
    await p.pg.click('#lista-pages tr[data-id="' + pub.id + '"] .acao-editar'); await p.pg.waitForSelector('#editor');
    const lista = await p.pg.evaluate(() => [...document.querySelectorAll('#ed-aliases-lista li code')].map(x => x.textContent));
    assert(lista.join() === '/com-alias-velha.html', 'a lista de aliases devia mostrar o endereço antigo: ' + JSON.stringify(lista));
    await p.pg.click('#ed-aliases-lista button');
    await p.pg.waitForSelector('#ed-alias-remover');
    const modal = await p.pg.textContent('#modal-corpo, .modal-corpo');
    assert(/com-alias-velha\.html/.test(modal) && /sempre funciona/.test(modal) && /continua acessível para quem tiver o link/.test(modal), modal.slice(0, 300));
    await p.pg.click('#ed-alias-remover');
    await p.pg.waitForFunction(() => document.getElementById('ed-aliases').hidden, null, { timeout: 10000 });
    const b = await lerBanco(p.pg, ch.pubkey);
    const reg = b.pages.find(x => x.id === pub.id);
    assert((reg.aliases || []).length === 0, 'o alias devia ter saído da página: ' + JSON.stringify(reg.aliases));
    const lapide = b.media.find(m => m.path === '/com-alias-velha.html');
    assert(lapide && lapide.status === 'removed' && lapide.sha256 === sha && lapide.origin === 'upload' && lapide.previous_status === 'published' && JSON.stringify(lapide.servers) === '["https://cdn.exemplo.test"]', JSON.stringify(lapide));
    // a lápide é uma mídia como outra qualquer para T6: aparece na Biblioteca
    // (não em "Herdados", que é só `origin: 'network'`) como uma linha
    // "removida" comum, com "Desfazer" — sem quebrar miniatura/onde-está para
    // um caminho .html sem bytes locais.
    await p.pg.click('#ed-voltar'); await p.pg.waitForSelector('#lista-pages');
    await p.pg.click('#menu .item[data-tela="t6"]'); await p.pg.waitForSelector('#t6-tabela');
    const linhaT6 = await p.pg.evaluate(() => {
      const tr = document.querySelector('#t6-tabela tr[data-path="/com-alias-velha.html"]');
      return tr && { classe: tr.className, estado: tr.querySelector('.estado').textContent, acoes: tr.cells[tr.cells.length - 1].textContent };
    });
    assert(linhaT6 && linhaT6.classe === 'removida' && /a remover/i.test(linhaT6.estado), 'a lápide devia aparecer em T6 como removida: ' + JSON.stringify(linhaT6));
    assert(p.erros.length === 0 && p.consoleErros.length === 0, 'a lápide (.html sem bytes) não pode quebrar a tabela de T6: ' + JSON.stringify({ pageerror: p.erros, console: p.consoleErros }));
    await p.pg.close();
    return 'lápide: ' + JSON.stringify([lapide.path, lapide.status, lapide.origin]) + '; em T6: ' + JSON.stringify(linhaT6);
  });

  await it('M5: UI de aliases — remover um alias que NUNCA foi publicado só tira da lista, sem criar lápide (nada a apagar da rede)', async () => {
    const pub = Object.assign(Modelo_pagina('Alias nunca publicado', 'nunca-pub-nova', 'published'), { aliases: ['nunca-pub-velha'] });
    const p = await sessao([{ op: 'put', store: 'pages', valor: pub }]);        // sem registro `published`
    await p.pg.click('#menu .item[data-tela="t4"]'); await p.pg.waitForSelector('#t4');
    await p.pg.click('#lista-pages tr[data-id="' + pub.id + '"] .acao-editar'); await p.pg.waitForSelector('#ed-aliases-lista');
    await p.pg.click('#ed-aliases-lista button'); await p.pg.waitForSelector('#ed-alias-remover'); await p.pg.click('#ed-alias-remover');
    await p.pg.waitForFunction(() => document.getElementById('ed-aliases').hidden, null, { timeout: 10000 });
    const b = await lerBanco(p.pg, ch.pubkey);
    assert((b.pages.find(x => x.id === pub.id).aliases || []).length === 0, 'o alias devia ter saído mesmo sem lápide');
    assert(!b.media.some(m => m.path === '/nunca-pub-velha.html'), 'não havia nada publicado nesse caminho — não devia nascer lápide');
    await p.pg.close();
  });

  await it('19(d): "Ver online" aparece na lista e no editor para quem já foi publicado (não para rascunho), com o endereço público certo', async () => {
    const pub = Modelo_pagina('Já publicada', 'ja-publicada', 'published');
    const rasc = Modelo_pagina('Rascunho', 'rascunho-nunca-publicado', 'draft');
    const { p, ch: chI } = await sessaoIsolada([{ op: 'put', store: 'pages', valor: pub }, { op: 'put', store: 'pages', valor: rasc }]);
    await p.pg.click('#menu .item[data-tela="t4"]'); await p.pg.waitForSelector('#t4');
    const esperado = 'https://' + chI.npub + '.nsite.lol/ja-publicada.html';
    const linkPub = await p.pg.getAttribute('#lista-pages tr[data-id="' + pub.id + '"] .acao-ver-online', 'href');
    assert(linkPub === esperado, linkPub);
    assert(!(await p.pg.$('#lista-pages tr[data-id="' + rasc.id + '"] .acao-ver-online')), 'rascunho não devia ter link');
    await p.pg.click('#lista-pages tr[data-id="' + pub.id + '"] .acao-editar'); await p.pg.waitForSelector('#editor');
    assert((await p.pg.getAttribute('#ed-ver-online', 'href')) === esperado, 'link no editor');
    await p.pg.click('#ed-voltar'); await p.pg.waitForSelector('#lista-pages');
    await p.pg.click('#lista-pages tr[data-id="' + rasc.id + '"] .acao-editar'); await p.pg.waitForSelector('#editor');
    assert(!(await p.pg.$('#ed-ver-online')), 'rascunho não devia ter link no editor');
    await p.pg.evaluate(async (pk) => { await Db.apagar(pk); }, chI.pubkey);
    await p.pg.close();
  });

  await it('aceite 3: pré-visualização — <script>/onerror= sanitizados; iframe sem allow-same-origin: script lá dentro não lê parent.document (SecurityError); "Ver como ficará" abre a página inteira com o tema em modal isolado', async () => {
    const p = await sessao();
    await p.pg.click('#menu .item[data-tela="t4"]'); await p.pg.waitForSelector('#t4');
    await p.pg.click('#lista-pages tr[data-id="' + idPagina + '"] .acao-editar'); await p.pg.waitForSelector('#editor');
    await p.pg.fill('#ed-corpo', 'Oi <script>parent.document.title="x"</script><img src=x onerror="alert(1)"> **ok**');
    await p.pg.waitForFunction(() => /<strong>ok<\/strong>/.test(document.getElementById('ed-previa').getAttribute('srcdoc') || ''), null, { timeout: 5000 });
    const pv = await p.pg.evaluate(() => { const f = document.getElementById('ed-previa'); return { sandbox: f.getAttribute('sandbox'), srcdoc: f.getAttribute('srcdoc'), titulo: document.title }; });
    assert(pv.sandbox === 'allow-scripts' && !/<script/.test(pv.srcdoc) && !/onerror/.test(pv.srcdoc) && /<style>/.test(pv.srcdoc) && pv.titulo === 'Nostermentor', JSON.stringify([pv.sandbox, pv.srcdoc.length, pv.titulo]));
    // prova da origem opaca: um iframe com o MESMO sandbox tenta ler o painel
    const sonda = await p.pg.evaluate(() => new Promise((res) => {
      const f = document.createElement('iframe'); f.setAttribute('sandbox', document.getElementById('ed-previa').getAttribute('sandbox'));
      window.addEventListener('message', function h(ev) { if (ev.data && ev.data.sonda) { window.removeEventListener('message', h); res(ev.data); } });
      f.srcdoc = '<script>var r={sonda:1};try{r.titulo=parent.document.title;r.leu=true}catch(e){r.leu=false;r.erro=e.name}try{indexedDB.open("x");r.idb=true}catch(e){r.idb=false;r.idbErro=e.name}parent.postMessage(r,"*")<\/script>';
      document.body.appendChild(f); setTimeout(() => res({ sonda: 1, timeout: true }), 5000);
    }));
    assert(sonda.leu === false && sonda.erro === 'SecurityError', JSON.stringify(sonda));
    await p.pg.click('#ed-ver'); await p.pg.waitForSelector('#previa-completa');
    const pc = await p.pg.evaluate(() => ({ sandbox: document.getElementById('previa-completa').getAttribute('sandbox'), srcdoc: document.getElementById('previa-completa').getAttribute('srcdoc'), titulo: document.querySelector('#modal h2').textContent }));
    assert(pc.sandbox === 'allow-scripts' && /<html lang=/.test(pc.srcdoc) && /class="cabecalho"/.test(pc.srcdoc) && /<strong>ok<\/strong>/.test(pc.srcdoc) && !/<script/.test(pc.srcdoc) && /<style>/.test(pc.srcdoc) && pc.titulo === 'Como ficará no site', JSON.stringify([pc.sandbox, pc.titulo]));
    await p.pg.screenshot({ path: u.captura('t4a-ver-como-ficara'), fullPage: false });
    await p.pg.keyboard.press('Escape');
    assert(!(await p.pg.$('#modal')), 'Esc não fechou o modal');
    assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros }));
    await p.pg.close();
    return 'sonda: ' + JSON.stringify(sonda);
  });

  await it('aceite 6/7: gravação automática ao sair do campo (blur) e, sem blur, aos 30 s — verificável no banco; o contador sobe a cada gravação; sair pelo menu com texto não salvo grava; beforeunload pede confirmação', async () => {
    const p = await sessao();
    await p.pg.click('#menu .item[data-tela="t4"]'); await p.pg.waitForSelector('#t4');
    await p.pg.click('#lista-pages tr[data-id="' + idPagina + '"] .acao-editar'); await p.pg.waitForSelector('#editor');
    const antes = (await lerBanco(p.pg, ch.pubkey));
    const contadorAntes = (antes.meta.find(m => m.key === 'alteracoes_nao_exportadas') || {}).value || 0;
    await p.pg.fill('#ed-descricao', 'blur salva');
    await p.pg.click('#ed-titulo');   // sai do campo
    await p.pg.waitForFunction(() => /Salvo automaticamente/.test(document.getElementById('ed-status').textContent), null, { timeout: 5000 });
    let b = await lerBanco(p.pg, ch.pubkey);
    assert(b.pages.find(x => x.id === idPagina).description === 'blur salva', 'blur não gravou');
    const t0 = Date.now();
    await p.pg.type('#ed-corpo', '\n\nDigitado sem sair do campo.');
    // sondagem do banco em laço (waitForFunction não espera uma Promise devolvida pela função)
    const esperarNoBanco = async (re, ms) => { const fim = Date.now() + ms; while (Date.now() < fim) { const b = await lerBanco(p.pg, ch.pubkey); if (re.test(b.pages.find(x => x.id === idPagina).body)) return true; await new Promise(r => setTimeout(r, 1000)); } return false; };
    assert(await esperarNoBanco(/Digitado sem sair do campo/, 45000), 'a gravação automática não aconteceu em 45 s');
    const segundos = (Date.now() - t0) / 1000;
    assert(segundos >= 20 && segundos <= 40, 'gravação automática em ' + segundos.toFixed(1) + ' s');
    b = await lerBanco(p.pg, ch.pubkey);
    const contador = b.meta.find(m => m.key === 'alteracoes_nao_exportadas').value;
    assert(contador === contadorAntes + 2 && (await p.pg.textContent('#btn-backup')) === 'Backup: ' + contador + ' não exportadas', 'contador ' + contadorAntes + ' → ' + contador);
    // sair pelo menu com texto novo não salvo → grava ao desmontar
    await p.pg.type('#ed-corpo', ' E mais isto.');
    await p.pg.click('#menu .item[data-tela="t3"]'); await p.pg.waitForSelector('#t3');
    assert(await esperarNoBanco(/E mais isto\./, 5000), 'sair pelo menu não gravou');
    // beforeunload (E5): com alteração não salva, fechar a página pergunta
    await p.pg.click('#menu .item[data-tela="t4"]'); await p.pg.waitForSelector('#t4');
    await p.pg.click('#lista-pages tr[data-id="' + idPagina + '"] .acao-editar'); await p.pg.waitForSelector('#editor');
    await p.pg.type('#ed-corpo', ' sujo');
    let dialogo = null;
    p.pg.once('dialog', async (d) => { dialogo = d.type(); await d.dismiss(); });
    await p.pg.close({ runBeforeUnload: true });
    await new Promise(r => setTimeout(r, 1500));
    assert(dialogo === 'beforeunload', 'diálogo: ' + dialogo);
    try { await p.pg.close(); } catch (e) {}
    return `auto em ${segundos.toFixed(1)} s; contador ${contadorAntes} → ${contador}; beforeunload=${dialogo}`;
  });

  await it('T4 "Definir como Início" (confirmação inline) → site.home aponta para a página, selo "Início" e caminho /index.html; editor avisa; T3 "Nova página"/"editar" chegam ao editor', async () => {
    const p = await sessao();
    await p.pg.click('#menu .item[data-tela="t4"]'); await p.pg.waitForSelector('#t4');
    const sel = '#lista-pages tr[data-id="' + idPagina + '"]';
    await p.pg.click(sel + ' .acao-inicio'); await p.pg.waitForSelector('#confirmacao-' + idPagina);
    assert(/regenera todas as páginas/.test(await p.pg.textContent('#confirmacao-' + idPagina)), 'aviso');
    await p.pg.click(sel + ' .acao-confirmar');
    await p.pg.waitForSelector(sel + ' .selo');
    const linha = await p.pg.evaluate((sel) => { const tr = document.querySelector(sel); return { selo: tr.querySelector('.selo').textContent.trim(), caminho: tr.querySelector('code').textContent, temInicio: !!tr.querySelector('.acao-inicio') }; }, sel);
    assert(linha.selo === 'Início' && linha.caminho === '/index.html' && !linha.temInicio, JSON.stringify(linha));
    const b = await lerBanco(p.pg, ch.pubkey);
    assert(b.site.home.mode === 'page' && b.site.home.page_id === idPagina && b.site.menu.some(m => m.type === 'page' && m.page_id === idPagina), JSON.stringify(b.site.home));
    await p.pg.click(sel + ' .acao-editar'); await p.pg.waitForSelector('#ed-eh-inicio');
    await p.pg.click('#menu .item[data-tela="t3"]'); await p.pg.waitForSelector('#t3');
    await p.pg.click('#cartao-atalhos button:nth-of-type(2)');   // Nova página
    await p.pg.waitForSelector('#editor[data-tipo="page"]');
    assert((await p.pg.evaluate(() => Shell.telaAtual())) === 't4' && (await p.pg.evaluate(() => document.querySelector('#menu .item.atual').getAttribute('data-tela'))) === 't4', 'menu marcado');
    await p.pg.click('#menu .item[data-tela="t3"]'); await p.pg.waitForSelector('#t3');
    await p.pg.click('#cartao-ultimos .ligacao');   // editar o último artigo
    await p.pg.waitForSelector('#editor[data-tipo="post"]');
    const tituloAberto = await p.pg.inputValue('#ed-titulo');
    assert(tituloAberto === 'Segundo', 'editar do T3 abriu: ' + JSON.stringify(tituloAberto) + '; últimos em T3: ' + JSON.stringify(await p.pg.evaluate(() => Shell.telaAtual())));
    assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros }));
    await p.pg.close();
  });

  await it('"Publicar (N)" aceso leva a T8 real (diff com o total e o botão "Assinar e publicar"); barra de ferramentas envolve a seleção (negrito, título, lista, link, código)', async () => {
    const p = await sessao();
    await p.pg.click('#btn-publicar'); await p.pg.waitForSelector('#t8-total', { timeout: 15000 });
    const total = await p.pg.textContent('#t8-total');
    assert(/^\d+ arquivo\(s\), .+ para subir, \d+ relays\.$/.test(total), total);
    assert(await p.pg.$('#t8-assinar'), 'faltou o botão de publicar');
    await p.pg.click('#menu .item[data-tela="t5"]'); await p.pg.waitForSelector('#t5');
    await p.pg.click('#novo-registro'); await p.pg.waitForSelector('#editor');
    await p.pg.fill('#ed-corpo', 'abc def');
    const aplicar = async (acao, ini, fim) => { await p.pg.evaluate(([i, f]) => { const t = document.getElementById('ed-corpo'); t.focus(); t.setSelectionRange(i, f); }, [ini, fim]); await p.pg.click('.ferramenta[data-acao="' + acao + '"]'); return p.pg.inputValue('#ed-corpo'); };
    assert((await aplicar('negrito', 0, 3)) === '**abc** def', 'negrito');
    assert((await aplicar('titulo', 0, 0)) === '## **abc** def', 'título');
    assert((await aplicar('link', 11, 14)) === '## **abc** [def](https://)', 'link: ' + (await p.pg.inputValue('#ed-corpo')));
    await p.pg.fill('#ed-corpo', 'um\ndois');
    assert((await aplicar('lista', 0, 7)) === '- um\n- dois', 'lista');
    await p.pg.fill('#ed-corpo', 'x');
    assert((await aplicar('codigo', 0, 1)) === '`x`' && (await aplicar('italico', 3, 3)) === '`x`*texto em itálico*', 'código/itálico: ' + (await p.pg.inputValue('#ed-corpo')));
    await p.pg.close();
  });

  // ---- lote 30 + 37 + 40 + 32(c) --------------------------------------------
  await it('37/30: os dois botões novos da barra escrevem o marcador em LINHA PRÓPRIA (que é a única forma de ele valer), e a prévia lateral já mostra o botão e a galeria', async () => {
    const { p, ch: chI } = await sessaoIsolada();
    // dois artigos publicados, para a galeria ter o que mostrar
    await p.pg.evaluate(async (pk) => {
      const db = await Db.abrir(pk);
      for (const [t, d, tag] of [['Bolo', '2026-08-01T00:00:00Z', 'receitas'], ['Pão', '2026-08-10T00:00:00Z', 'receitas']]) {
        const a = Modelo.novoArtigo(t); a.date = d; a.body = 'x'; a.tags = [tag]; a.status = 'published';
        await db.put('posts', a);
      }
      db.fechar();
    }, chI.pubkey);
    await p.pg.click('#menu .item[data-tela="t4"]'); await p.pg.waitForSelector('#t4');
    await p.pg.click('#novo-registro');
    await p.pg.waitForSelector('#editor[data-tipo="page"]');
    await p.pg.fill('#ed-titulo', 'Com blocos');
    // o cursor no meio de uma linha com texto: o marcador tem de saltar para baixo
    await p.pg.fill('#ed-corpo', 'Olá mundo');
    await p.pg.evaluate(() => { const t = document.getElementById('ed-corpo'); t.setSelectionRange(3, 3); t.focus(); });
    await p.pg.click('.ferramenta[data-acao="botao"]');
    await p.pg.waitForSelector('#botao-confirmar');
    await p.pg.fill('#botao-texto', 'Fale comigo');
    await p.pg.fill('#botao-destino', '/contato');
    await p.pg.click('#botao-confirmar');
    await p.pg.waitForFunction(() => !document.getElementById('modal'), null, { timeout: 5000 });
    await p.pg.click('.ferramenta[data-acao="artigos"]');
    await p.pg.waitForSelector('#artigos-confirmar');
    await p.pg.fill('#artigos-n', '2');
    await p.pg.selectOption('#artigos-etiqueta', 'receitas');
    await p.pg.click('#artigos-confirmar');
    await p.pg.waitForFunction(() => !document.getElementById('modal'), null, { timeout: 5000 });
    const corpo = await p.pg.inputValue('#ed-corpo');
    assert(/^Olá mundo\n\n\[\[botao: Fale comigo -> \/contato\]\]\n\n\[\[artigos: 2, com-capa, etiqueta=receitas\]\]$/.test(corpo), JSON.stringify(corpo));
    // a prévia lateral desenha os dois blocos com os artigos REAIS
    await p.pg.waitForFunction(() => {
      const f = document.getElementById('ed-previa');
      return f && /class="botao"/.test(f.srcdoc || '') && /class="cartoes"/.test(f.srcdoc || '');
    }, null, { timeout: 8000 });
    const previa = await p.pg.evaluate(() => document.getElementById('ed-previa').srcdoc);
    assert(/<a class="botao" href="\/contato">Fale comigo<\/a>/.test(previa), previa.slice(previa.indexOf('<article'), previa.indexOf('</article>')));
    // contar a TAG, não a classe: o CSS do tema vai embutido na prévia e tem
    // duas regras `.cartao-titulo` (ver a nota em core/blocos).
    assert((previa.match(/<h3 class="cartao-titulo">/g) || []).length === 2, 'a prévia devia mostrar os 2 artigos da etiqueta');
    assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros }));
    await p.pg.evaluate(async (pk) => { await Db.apagar(pk); }, chI.pubkey);
    await p.pg.close();
  });

  await it('37: o modal do botão recusa endereço que não é do site nem http(s) ANTES de escrever no texto — o mesmo juiz que o gerador usa', async () => {
    const { p, ch: chI } = await sessaoIsolada();
    await p.pg.click('#menu .item[data-tela="t4"]'); await p.pg.waitForSelector('#t4');
    await p.pg.click('#novo-registro');
    await p.pg.waitForSelector('#editor[data-tipo="page"]');
    await p.pg.click('.ferramenta[data-acao="botao"]');
    await p.pg.waitForSelector('#botao-confirmar');
    // sem texto: recusa e diz porquê
    await p.pg.fill('#botao-destino', '/ok');
    await p.pg.click('#botao-confirmar');
    assert(await p.pg.isVisible('#botao-erro'), 'devia recusar botão sem rótulo');
    // esquema perigoso: recusa e o modal fica aberto
    await p.pg.fill('#botao-texto', 'Clique');
    await p.pg.fill('#botao-destino', 'javascript:alert(1)');
    await p.pg.click('#botao-confirmar');
    assert(await p.pg.$('#botao-confirmar'), 'o modal não podia fechar com endereço inválido');
    const erro = await p.pg.textContent('#botao-erro');
    assert(/Endereço inválido/.test(erro), erro);
    assert((await p.pg.inputValue('#ed-corpo')) === '', 'nada podia ter sido escrito no texto');
    await p.pg.click('#botao-cancelar');
    await p.pg.waitForFunction(() => !document.getElementById('modal'), null, { timeout: 5000 });
    assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros }));
    await p.pg.evaluate(async (pk) => { await Db.apagar(pk); }, chI.pubkey);
    await p.pg.close();
  });

  await it('51: o botão "HTML" avisa do que o filtro tira ANTES de inserir, insere o já limpo e em linha própria, e a prévia mostra a caixa', async () => {
    const { p, ch: chI } = await sessaoIsolada();
    await p.pg.click('#menu .item[data-tela="t4"]'); await p.pg.waitForSelector('#t4');
    await p.pg.click('#novo-registro');
    await p.pg.waitForSelector('#editor[data-tipo="page"]');
    await p.pg.fill('#ed-titulo', 'Com HTML');
    await p.pg.fill('#ed-corpo', 'Antes.');
    await p.pg.evaluate(() => { const t = document.getElementById('ed-corpo'); t.focus(); t.setSelectionRange(6, 6); });
    await p.pg.click('.ferramenta[data-acao="html"]');
    await p.pg.waitForSelector('#html-confirmar');
    assert(await p.pg.isDisabled('#html-confirmar'), 'com a caixa vazia o botão tinha de estar desligado');

    // 1) o que o filtro tira aparece, com o motivo, e o dono ainda não inseriu nada
    await p.pg.fill('#html-fonte', '    <div class="caixa-html-51">\n        <p>Uma caixa</p>\n        <button onclick="alert(1)">b</button>\n    </div>\n    <scr' + 'ipt>alert(2)</scr' + 'ipt>');
    await p.pg.waitForSelector('#html-removidos-lista li');
    const listado = await p.pg.textContent('#html-removidos-lista');
    assert(/<script>/.test(listado) && /onclick=/.test(listado), 'o aviso tinha de nomear os dois: ' + listado);
    assert(/não roda programas/.test(listado), 'o aviso tinha de dizer porquê: ' + listado);
    assert((await p.pg.inputValue('#ed-corpo')) === 'Antes.', 'nada podia ter sido escrito antes do clique');

    // 2) insere o JÁ LIMPO, sem indentação e em linha própria
    await p.pg.click('#html-confirmar');
    await p.pg.waitForFunction(() => !document.getElementById('modal'), null, { timeout: 5000 });
    const corpo = await p.pg.inputValue('#ed-corpo');
    assert(!/<script/i.test(corpo) && !/onclick/i.test(corpo), 'o que o filtro tirou entrou no texto: ' + corpo);
    assert(corpo.indexOf('\n\n<div class="caixa-html-51">') !== -1, 'tinha de entrar em linha própria, com linha em branco antes: ' + JSON.stringify(corpo));
    // Dedent é da indentação COMUM: entrou com 4 na linha de fora e 8 na de
    // dentro, sai com 0 e 4. É a primeira linha que decide se aquilo vira
    // bloco de código — as de dentro ficam recuadas para ele poder reler.
    assert(/\n {4}<p>Uma caixa<\/p>\n/.test(corpo), 'o recuo devia ter descido 4 de cada linha: ' + JSON.stringify(corpo));

    // 3) a prévia lateral mostra a caixa (e não o código dela). Lê-se pelo
    // `srcdoc`: o iframe é de origem OPACA (02 G.2.2, sem allow-same-origin),
    // logo `contentDocument` não se alcança daqui — e é para não se alcançar.
    await p.pg.waitForFunction(() => /class="caixa-html-51"/.test((document.getElementById('ed-previa') || {}).srcdoc || ''), null, { timeout: 8000 });
    const previa = await p.pg.evaluate(() => document.getElementById('ed-previa').srcdoc);
    assert(/<div class="caixa-html-51">/.test(previa), 'a caixa não entrou como elemento');
    assert(!/&lt;div class="caixa-html-51"/.test(previa), 'a caixa entrou ESCAPADA — o leitor ia ver a tag em vez da caixa');
    assert(!/<pre><code>/.test(previa), 'saiu como bloco de código: ' + previa.slice(previa.indexOf('<article'), previa.indexOf('<article') + 300));
    assert(!/alert\(/.test(previa) && !/onclick/i.test(previa), 'o que o filtro tirou chegou à prévia');

    // 4) colar SÓ o que não entra: não insere nada e diz porquê
    await p.pg.click('.ferramenta[data-acao="html"]');
    await p.pg.waitForSelector('#html-fonte');
    await p.pg.fill('#html-fonte', '<scr' + 'ipt>alert(3)</scr' + 'ipt>');
    await p.pg.waitForSelector('#html-nada');
    assert(await p.pg.isDisabled('#html-confirmar'), 'não havia nada para inserir');
    // "não sobrou nada" sem dizer o quê deixaria quem colou um <iframe> do
    // YouTube sem saber porquê: a lista de motivos tem de continuar lá
    const nada = await p.pg.textContent('#html-removidos-lista');
    assert(/<script>/.test(nada) && /não roda programas/.test(nada), 'com tudo removido o motivo tem de aparecer na mesma: ' + nada);
    await p.pg.click('#html-cancelar');
    await p.pg.waitForFunction(() => !document.getElementById('modal'), null, { timeout: 5000 });
    assert((await p.pg.inputValue('#ed-corpo')) === corpo, 'o texto mudou depois de cancelar');

    assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros }));
    await p.pg.evaluate(async (pk) => { await Db.apagar(pk); }, chI.pubkey);
    await p.pg.close();
  });

  await it('32(c): escolher uma imagem grande como capa cria a miniatura guardada, liga-a à original, conta como alteração a publicar — e a miniatura NÃO volta a aparecer no seletor de capa', async () => {
    const { p, ch: chI } = await sessaoIsolada();
    // uma imagem de verdade, grande o bastante para compensar reduzir
    await p.pg.evaluate(async (pk) => {
      const c = document.createElement('canvas'); c.width = 1600; c.height = 1200;
      const cx = c.getContext('2d');
      cx.fillStyle = '#2271b1'; cx.fillRect(0, 0, 1600, 1200);
      cx.fillStyle = '#ffffff'; cx.fillRect(120, 120, 900, 700);
      cx.fillStyle = '#b32d2e'; cx.fillRect(300, 300, 400, 200);
      const blob = await new Promise(res => c.toBlob(res, 'image/png'));
      const brutos = new Uint8Array(await blob.arrayBuffer());
      const db = await Db.abrir(pk);
      await db.put('media', { id: 'm-grande', path: '/img/praia.png', mime: 'image/png', size: brutos.length,
        sha256: await Blossom.sha256Hex(brutos), width: 1600, height: 1200, alt: 'A praia', caption: '',
        bytes: new Blob([brutos], { type: 'image/png' }), status: 'draft', servers: [], removal: null,
        metadata: { stripped: true, removed_segments: [], warning: null }, origin: 'upload',
        created_at: Modelo.agora(), updated_at: Modelo.agora(), previous_status: null });
      db.fechar();
    }, chI.pubkey);
    await p.pg.click('#menu .item[data-tela="t5"]'); await p.pg.waitForSelector('#t5');
    await p.pg.click('#novo-registro');
    await p.pg.waitForSelector('#editor[data-tipo="post"]');
    await p.pg.fill('#ed-titulo', 'Com capa grande');
    await p.pg.click('#ed-capa-escolher');
    await p.pg.waitForSelector('.grade-capas .capa-opcao[data-media-id="m-grande"]');
    await p.pg.click('.grade-capas .capa-opcao[data-media-id="m-grande"]');
    await p.pg.waitForFunction(() => !document.getElementById('modal'), null, { timeout: 5000 });
    // a miniatura nasce em segundo plano; o dono vê a linha de estado
    // esperar o RESULTADO, não o "preparando" — que também contém a frase
    await p.pg.waitForFunction(() => /Criada uma versão pequena|Não consegui criar/.test((document.getElementById('ed-mini') || {}).textContent || ''), null, { timeout: 30000 });
    const aviso = await p.pg.textContent('#ed-mini');
    assert(/Criada uma versão pequena/.test(aviso), 'estado da miniatura: ' + aviso);
    const b = await lerBanco(p.pg, chI.pubkey);
    const original = b.media.find(m => m.id === 'm-grande');
    const mini = b.media.find(m => m.id !== 'm-grande');
    assert(mini, 'a miniatura não foi gravada: ' + JSON.stringify(b.media.map(m => m.path)));
    assert(original.thumb_media_id === mini.id, 'a original não ficou ligada à miniatura: ' + original.thumb_media_id);
    assert(mini.path === '/img/praia-mini.webp' || mini.path === '/img/praia-mini.png', 'caminho da miniatura: ' + mini.path);
    assert(mini.width === 480 && mini.height === 360, JSON.stringify([mini.width, mini.height]));
    assert(mini.size < original.size, 'a miniatura tem de ser menor: ' + mini.size + ' vs ' + original.size);
    assert(original.status === 'draft', 'a original não muda de estado: os bytes dela são os mesmos');
    // e não volta a aparecer como imagem escolhível
    await p.pg.click('#ed-capa-escolher');
    await p.pg.waitForSelector('.grade-capas');
    const opcoes = await p.pg.$$eval('.grade-capas .capa-opcao[data-media-id]', els => els.map(e => e.getAttribute('data-media-id')));
    assert(JSON.stringify(opcoes) === JSON.stringify(['m-grande']), 'a miniatura apareceu no seletor: ' + JSON.stringify(opcoes));
    await p.pg.keyboard.press('Escape');
    assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros }));
    await p.pg.evaluate(async (pk) => { await Db.apagar(pk); }, chI.pubkey);
    await p.pg.close();
  });

  await it('cabe em 1200×600: editor sem rolagem horizontal, "Salvar" visível sem rolar; lista idem', async () => {
    const p = await sessao();
    await p.pg.click('#menu .item[data-tela="t5"]'); await p.pg.waitForSelector('#t5');
    const medir = (id) => p.pg.evaluate((id) => { const b = document.getElementById(id); const r = b.getBoundingClientRect(); return { larguraDoc: document.documentElement.scrollWidth, janela: innerWidth, visivel: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth }; }, id);
    const m1 = await medir('novo-registro');
    await p.pg.click('#lista-posts tbody tr .acao-editar'); await p.pg.waitForSelector('#editor');
    const m2 = await medir('ed-salvar');
    await p.pg.screenshot({ path: u.captura('t5a-1200x600'), fullPage: false });
    assert(m1.larguraDoc <= m1.janela && m1.visivel && m2.larguraDoc <= m2.janela && m2.visivel, JSON.stringify([m1, m2]));
    await p.pg.close();
    return `lista ${m1.larguraDoc}px, editor ${m2.larguraDoc}px em ${m1.janela}px`;
  });

  await it('varredura final: nenhuma nsec em DOM/armazenamento; banco limpo', async () => {
    const p = await sessao();
    const v = await varrer(p.pg, ch.nsec);
    assert(v.achados.length === 0, v.achados.join(' | '));
    await p.pg.click('#btn-trancar'); await p.pg.waitForSelector('#t1');
    await limparBanco(p.pg);
    await p.pg.close();
  });

  return R;
};

function Modelo_pagina(titulo, slug, status) {
  const t = '2026-08-20T00:00:00Z';
  return { id: 'pg-' + slug, slug, aliases: [], title: titulo, description: '', body: 'corpo', body_format: 'markdown', status, created_at: t, updated_at: t, published_hash: 'f'.repeat(64), previous_status: null, in_menu: true };
}
