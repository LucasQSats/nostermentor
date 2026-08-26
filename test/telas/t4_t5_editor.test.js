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
    await p.pg.selectOption('#ed-capa', 'm-teste');
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

  await it('"Publicar (N)" aceso leva a T8 com a mensagem honesta ("chega no marco M4"); barra de ferramentas envolve a seleção (negrito, título, lista, link, código)', async () => {
    const p = await sessao();
    await p.pg.click('#btn-publicar'); await p.pg.waitForSelector('#t8');
    assert(/Publicar chega no marco M4/.test(await p.pg.textContent('#t8 p')), await p.pg.textContent('#t8 p'));
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
