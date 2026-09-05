// test/telas/t6_midia.test.js — T6 completo (M5), pela INTERFACE: a
// biblioteca com miniatura, "onde está" e metadados; editar a descrição;
// excluir o que nunca foi publicado; a aba de ARQUIVOS HERDADOS (14 T2c/T-7,
// com o aviso de colisão que bloqueia T8); e o relato de remoção por
// servidor com o "Reconferir" — a resposta a P13/P14, que o servidor falso
// sabe encenar e a rede real não dá sob encomenda.
// Em T6a: os avisos de tamanho de 05 §2.2 e o cache `network.capabilities`,
// que poupa um HEAD por arquivo do mesmo tipo (uma conexão Tor a menos).
const { abrir, coletor, assert, entrarCom, semearSite, esperarT2, lerBanco } = require('../util.js');
const F = require('../fabrica.js');
const fs = require('fs'), path = require('path');

module.exports = async function (ctx, u) {
  const { R, it, pulado } = coletor();
  if (!u.falso) { pulado('telas/t6_midia (todos os casos)', 'servidor falso indisponível'); return R; }
  const f = u.falso;
  f.blossom('x1', {}); f.blossom('x2', {});
  f.blossom('x-incerto', { remocao: 'incerta' });        // aceita o upload, não confirma o DELETE (P13)
  f.blossom('x-sem-remocao', { remocao: 'recusa' });     // aceita o upload e nunca deixa apagar (P14)
  f.blossom('x-so-midia', { tiposRecusados: ['text/html'] });
  f.relay('x-ok', { escrita: 'aceita', eventos: [] });
  const SERVIDORES = [f.url('x1'), f.url('x2')];
  const EXIF = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'limpeza', 'exif.jpg'));
  const paginas = [];
  // ids como os do app (13 §4), gerados aqui porque estes registros são
  // semeados a partir do Node e não de dentro da página.
  let seq = 0;
  const Modelo_novoId = () => 'm-teste-' + (++seq).toString(16).padStart(8, '0');

  async function sessao(o) {
    o = o || {};
    const ch = F.chave();
    const p = await abrir(ctx, u.url);
    paginas.push(p);
    await semearSite(p.pg, ch, { relays: [f.ws('x-ok')], servers: o.servidores || SERVIDORES, title: 'Site do teste T6' });
    await entrarCom(p.pg, ch.nsec);
    await esperarT2(p.pg, 30000);
    await p.pg.evaluate(async ([pubkey, extra]) => {
      const db = await Db.abrir(pubkey);
      const site = await db.get('site', 'site');
      const home = Modelo.novaPagina('Início'); home.body = 'Bem-vindo.';
      site.home = { mode: 'page', page_id: home.id, latest_posts: 5 };
      site.description = 'Uma frase sobre o site';
      const ops = [{ op: 'put', store: 'site', chave: 'site', valor: site }, { op: 'put', store: 'pages', valor: home }];
      for (const m of (extra.media || [])) ops.push({ op: 'put', store: 'media', valor: m });
      if (extra.published) ops.push({ op: 'put', store: 'published', chave: 'current', valor: extra.published });
      for (const mt of (extra.meta || [])) ops.push({ op: 'put', store: 'meta', valor: mt });
      await db.escrever(ops);
      db.fechar();
    }, [ch.pubkey, o.extra || {}]);
    await p.pg.click('#menu .item[data-tela="t3"]');
    await p.pg.waitForSelector('#t3');
    return { p, ch };
  }
  async function irAMidia(pg) { await pg.click('#menu .item[data-tela="t6"]'); await pg.waitForSelector('#t6a'); }
  async function escolherArquivo(pg, nome, conteudo, mime) {
    await pg.setInputFiles('#t6a-arquivos', { name: nome, mimeType: mime, buffer: conteudo });
    await pg.waitForSelector('#t6a-pendentes .pendente');
    await pg.waitForFunction(() => !document.querySelector('#t6a-pendentes .pre.verificando'), null, { timeout: 20000 });
  }
  const midiaRede = (caminho, sha, mime) => ({
    id: 'm-' + caminho.replace(/[^a-z0-9]/gi, ''), path: caminho, mime: mime || 'text/html', size: null, sha256: sha,
    width: null, height: null, alt: '', caption: '', bytes: null, status: 'published', servers: [], removal: null,
    metadata: { stripped: null, removed_segments: [], warning: null }, origin: 'network',
    created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z', previous_status: null
  });

  await it('T6 biblioteca (14 T6): a linha traz miniatura, dimensões medidas, estado, "só neste navegador — entra no backup obrigatoriamente" e "metadados limpos"', async () => {
    const { p, ch } = await sessao();
    await irAMidia(p.pg);
    await escolherArquivo(p.pg, 'casa.jpg', EXIF, 'image/jpeg');
    await p.pg.click('#t6a-adicionar');
    await p.pg.waitForSelector('#t6-tabela tr[data-path="/img/casa.jpg"]');
    const linha = await p.pg.evaluate(() => {
      const tr = document.querySelector('#t6-tabela tr[data-path="/img/casa.jpg"]');
      const img = tr.querySelector('img.mini');
      return { mini: img ? img.getAttribute('src').slice(0, 5) : null, texto: tr.textContent,
        estado: tr.querySelector('.estado').textContent, temAcoes: !!tr.querySelector('.t6-excluir') };
    });
    const banco = await lerBanco(p.pg, ch.pubkey);
    const m = banco.media[0];
    assert(linha.mini === 'blob:', 'devia haver miniatura dos bytes locais: ' + linha.mini);
    assert(/só neste navegador — entra no backup/.test(linha.texto), linha.texto);
    assert(/metadados limpos/.test(linha.texto), linha.texto);
    assert(linha.estado === 'só neste navegador' && linha.temAcoes, JSON.stringify(linha));
    assert(m.width > 0 && m.height > 0, 'as dimensões deviam ter sido medidas: ' + JSON.stringify([m.width, m.height]));
    assert(new RegExp(m.width + ' × ' + m.height).test(linha.texto), 'dimensões na linha: ' + linha.texto);
    await p.pg.close();
    return `${m.width}×${m.height}, miniatura local`;
  });

  await it('T6: "Editar descrição" grava alt e legenda; um arquivo JÁ PUBLICADO passa a "alterado" (o alt vai no site.json)', async () => {
    const sha = 'a7'.repeat(32);
    const publicada = Object.assign(midiaRede('/img/velha.png', sha, 'image/png'), { origin: 'upload', servers: [f.url('x1')], size: 10 });
    const { p, ch } = await sessao({ extra: { media: [publicada] } });
    await irAMidia(p.pg);
    await p.pg.click('#t6-tabela tr[data-path="/img/velha.png"] .t6-editar');
    await p.pg.waitForSelector('#t6-edit-alt');
    await p.pg.fill('#t6-edit-alt', 'Uma casa antiga');
    await p.pg.fill('#t6-edit-legenda', 'Foto de 1994');
    await p.pg.click('#t6-edit-salvar');
    await p.pg.waitForFunction(() => !document.getElementById('modal-fundo'));
    const banco = await lerBanco(p.pg, ch.pubkey);
    const m = banco.media.find(x => x.path === '/img/velha.png');
    assert(m.alt === 'Uma casa antiga' && m.caption === 'Foto de 1994', JSON.stringify([m.alt, m.caption]));
    assert(m.status === 'modified', 'devia entrar na fila de publicação: ' + m.status);
    assert(m.sha256 === sha, 'o arquivo não muda — só a descrição');
    await p.pg.close();
  });

  await it('T6: "Excluir" existe só para o que nunca foi publicado e apaga na hora (13 §4.4); o publicado oferece "Remover", que é lápide', async () => {
    const publicada = Object.assign(midiaRede('/img/pub.png', 'b7'.repeat(32), 'image/png'), { origin: 'upload', servers: [f.url('x1')], size: 10 });
    const { p, ch } = await sessao({ extra: { media: [publicada] } });
    await irAMidia(p.pg);
    await escolherArquivo(p.pg, 'nova.jpg', EXIF, 'image/jpeg');
    await p.pg.click('#t6a-adicionar');
    await p.pg.waitForSelector('#t6-tabela tr[data-path="/img/nova.jpg"]');
    const botoes = await p.pg.evaluate(() => ({
      rascunho: !!document.querySelector('tr[data-path="/img/nova.jpg"] .t6-excluir'),
      rascunhoRemover: !!document.querySelector('tr[data-path="/img/nova.jpg"] .t6-remover'),
      publicado: !!document.querySelector('tr[data-path="/img/pub.png"] .t6-remover'),
      publicadoExcluir: !!document.querySelector('tr[data-path="/img/pub.png"] .t6-excluir')
    }));
    assert(botoes.rascunho && !botoes.rascunhoRemover, JSON.stringify(botoes));
    assert(botoes.publicado && !botoes.publicadoExcluir, JSON.stringify(botoes));
    await p.pg.click('tr[data-path="/img/nova.jpg"] .t6-excluir');
    await p.pg.waitForSelector('#t6-excluir-ok');
    await p.pg.click('#t6-excluir-ok');
    await p.pg.waitForFunction(() => !document.querySelector('tr[data-path="/img/nova.jpg"]'));
    // o publicado, esse, vira lápide — não sai do banco
    await p.pg.click('tr[data-path="/img/pub.png"] .t6-remover');
    await p.pg.waitForSelector('#t6b-remover');
    await p.pg.click('#t6b-remover');
    await p.pg.waitForFunction(() => { const tr = document.querySelector('tr[data-path="/img/pub.png"]'); return tr && /remover/.test(tr.textContent); });
    const banco = await lerBanco(p.pg, ch.pubkey);
    assert(banco.media.length === 1 && banco.media[0].path === '/img/pub.png', JSON.stringify(banco.media.map(x => x.path)));
    assert(banco.media[0].status === 'removed' && banco.media[0].previous_status === 'published', JSON.stringify(banco.media[0].status));
    await p.pg.close();
    return 'rascunho apagado na hora, publicado virou lápide';
  });

  await it('T6 aba "Arquivos herdados" (14 T2c/T-7): eles saem da Biblioteca, ganham aba própria com a explicação — e o que colide com um caminho do app vem marcado', async () => {
    const { p } = await sessao({ extra: { media: [midiaRede('/index.html', 'c7'.repeat(32)), midiaRede('/sobre.html', 'd7'.repeat(32))] } });
    await irAMidia(p.pg);
    const biblioteca = await p.pg.evaluate(() => ({
      abas: [...document.querySelectorAll('#t6-abas .aba')].map(x => x.textContent),
      linhas: [...document.querySelectorAll('#t6-tabela tr[data-path]')].map(x => x.dataset.path),
      vazio: !!document.getElementById('t6-vazio')
    }));
    assert(biblioteca.abas.join() === 'Biblioteca,Arquivos herdados', JSON.stringify(biblioteca.abas));
    assert(biblioteca.linhas.length === 0 && biblioteca.vazio, 'herdado não é da Biblioteca: ' + JSON.stringify(biblioteca));
    await p.pg.click('#t6-abas .aba[data-aba="herdados"]');
    await p.pg.waitForSelector('#t6-tabela tr[data-path="/index.html"]');
    const herdados = await p.pg.evaluate(() => ({
      linhas: [...document.querySelectorAll('#t6-tabela tr[data-path]')].map(x => x.dataset.path).sort(),
      colide: [...document.querySelectorAll('#t6-tabela tr.colide')].map(x => x.dataset.path),
      apoio: document.getElementById('t6-lista').textContent,
      podeRemover: !!document.querySelector('tr[data-path="/index.html"] .t6-remover')
    }));
    assert(herdados.linhas.join() === '/index.html,/sobre.html', JSON.stringify(herdados.linhas));
    assert(herdados.colide.join() === '/index.html', 'só a capa colide com o que o app gera: ' + JSON.stringify(herdados.colide));
    assert(/publicados nesta chave por outra ferramenta/.test(herdados.apoio), herdados.apoio);
    assert(herdados.podeRemover, 'o dono tem de poder removê-los, um a um');
    await p.pg.close();
    return '2 herdados, 1 em colisão';
  });

  await it('T6 relato de remoção + "Reconferir" (P13/P14): o placar diz servidor por servidor o que ficou; reconferir troca "aceitou, ainda a confirmar" por "ainda está" — e por "já não está" quando o servidor enfim apaga', async () => {
    const servidores = [f.url('x-incerto'), f.url('x-sem-remocao')];
    const { p, ch } = await sessao({ servidores: servidores });
    await irAMidia(p.pg);
    await escolherArquivo(p.pg, 'some.jpg', EXIF, 'image/jpeg');
    await p.pg.click('#t6a-adicionar');
    await p.pg.waitForSelector('#t6-tabela tr[data-path="/img/some.jpg"]');
    // publica (o blob entra nos dois servidores)
    await p.pg.click('#btn-publicar'); await p.pg.waitForSelector('#t8-assinar', { timeout: 20000 });
    await p.pg.click('#t8-assinar'); await p.pg.waitForSelector('#t8-publicado', { timeout: 60000 });
    // remove e publica de novo: é a publicação que tenta o DELETE
    await irAMidia(p.pg);
    await p.pg.click('tr[data-path="/img/some.jpg"] .t6-remover');
    await p.pg.waitForSelector('#t6b-remover'); await p.pg.click('#t6b-remover');
    await p.pg.waitForFunction(() => { const t = document.querySelector('tr[data-path="/img/some.jpg"]'); return t && /remover/.test(t.textContent); });
    await p.pg.click('#btn-publicar'); await p.pg.waitForSelector('#t8-assinar', { timeout: 20000 });
    await p.pg.click('#t8-assinar'); await p.pg.waitForSelector('#t8-publicado', { timeout: 60000 });

    const banco = await lerBanco(p.pg, ch.pubkey);
    const meta = banco.meta.find(x => String(x.key).indexOf('removal/') === 0);
    assert(meta, 'o relato devia sobreviver ao registro: ' + JSON.stringify(banco.meta.map(x => x.key)));
    assert(meta.value.unverified.length === 1 && meta.value.refused_by.length === 1, JSON.stringify(meta.value));
    const sha = meta.key.slice(8);
    assert(f.temBlob('x-incerto', sha) && f.temBlob('x-sem-remocao', sha), 'nenhum dos dois apagou de fato');

    await irAMidia(p.pg);
    await p.pg.waitForSelector('#t6-relato .t6-reconferir');
    const antes = await p.pg.textContent('#t6-relato');
    assert(/aceitou, ainda a confirmar/.test(antes) && /não deixou apagar/.test(antes), antes);
    await p.pg.click('#t6-relato .t6-reconferir');
    await p.pg.waitForSelector('#t6-relato ul.reconferido');
    const um = await p.pg.textContent('#t6-relato ul.reconferido');
    assert(/ainda está em/.test(um) && !/já não está/.test(um), 'com o blob nos dois, nada sumiu: ' + um);

    // o servidor "incerto" enfim propaga a remoção (P13: minutos depois)
    f.apagarBlob('x-incerto', sha);
    await p.pg.click('#t6-relato .t6-reconferir');
    await p.pg.waitForFunction(() => /já não está em/.test(document.getElementById('t6-relato').textContent), null, { timeout: 20000 });
    const dois = await p.pg.textContent('#t6-relato ul.reconferido');
    assert(/já não está em/.test(dois) && /ainda está em/.test(dois), 'um sumiu, o outro continua público: ' + dois);
    const banco2 = await lerBanco(p.pg, ch.pubkey);
    const meta2 = banco2.meta.find(x => x.key === meta.key);
    assert(meta2.value.recheck && meta2.value.recheck.gone.length === 1 && meta2.value.recheck.still_there.length === 1, JSON.stringify(meta2.value.recheck));
    assert(meta2.value.unverified.length === 1, 'o placar do dia da remoção não é reescrito: ' + JSON.stringify(meta2.value.unverified));
    await p.pg.close();
    return 'por conferir → ainda está → já não está';
  });

  await it('T6a: arquivo acima de 20 MB avisa que vai ficar em menos cópias (05 §2.2), sem impedir nada', async () => {
    const { p } = await sessao();
    await irAMidia(p.pg);
    const grande = Buffer.alloc(21 * 1024 * 1024, 7);
    await escolherArquivo(p.pg, 'video.mp4', grande, 'video/mp4');
    const est = await p.pg.evaluate(() => ({
      aviso: (document.querySelector('.t6a-grande') || {}).textContent || '',
      pode: !document.getElementById('t6a-adicionar').disabled
    }));
    assert(/menos cópias/.test(est.aviso), 'faltou o aviso de 20 MB: ' + est.aviso);
    assert(est.pode, 'o aviso não bloqueia — só diz a verdade antes');
    await p.pg.close();
    return est.aviso.slice(0, 60);
  });

  await it('T6a: o cache de `network.capabilities` responde pelo segundo arquivo do mesmo tipo — nenhum HEAD novo ao servidor que já recusou (uma conexão Tor a menos)', async () => {
    const { p, ch } = await sessao({ servidores: [f.url('x-so-midia')] });
    await irAMidia(p.pg);
    await escolherArquivo(p.pg, 'pagina.html', Buffer.from('<p>oi</p>'), 'text/html');
    const primeiro = await p.pg.textContent('#t6a-pendentes .pre');
    assert(/vai recusar/.test(primeiro), primeiro);
    const banco = await lerBanco(p.pg, ch.pubkey);
    const cap = banco.site.network.capabilities[f.url('x-so-midia')];
    assert(cap && cap.refuses.join() === 'text/html', 'o cache devia guardar o TIPO: ' + JSON.stringify(cap));
    const antes = f.estado.log.filter(l => /^HEAD \/x-so-midia\/upload/.test(l)).length;
    await p.pg.setInputFiles('#t6a-arquivos', []);
    await escolherArquivo(p.pg, 'outra.html', Buffer.from('<p>outra</p>'), 'text/html');
    const depois = f.estado.log.filter(l => /^HEAD \/x-so-midia\/upload/.test(l)).length;
    const segundo = await p.pg.evaluate(() => [...document.querySelectorAll('#t6a-pendentes .pendente')].pop().querySelector('.pre').textContent);
    assert(depois === antes, 'o segundo arquivo não podia ir à rede: ' + antes + ' → ' + depois);
    assert(/vai recusar/.test(segundo) && /já verificado antes/.test(segundo), segundo);
    await p.pg.close();
    return `${antes} HEAD no primeiro, 0 no segundo`;
  });

  await it('43: com muitos arquivos, o resumo e o botão "Adicionar" ficam ANTES da lista — e o que tem problema sobe ao topo', async () => {
    const { p } = await sessao({ servidores: [f.url('x-so-midia')] });   // recusa text/html
    await irAMidia(p.pg);
    const pequeno = Buffer.alloc(1024, 3);
    for (let i = 0; i < 8; i++) await escolherArquivo(p.pg, 'foto-' + i + '.png', pequeno, 'image/png');
    await escolherArquivo(p.pg, 'pagina.html', Buffer.from('<p>oi</p>'), 'text/html');   // este NENHUM servidor aceita
    await p.pg.waitForFunction(() => document.querySelectorAll('#t6a-pendentes .pendente').length === 9, null, { timeout: 20000 });
    const r = await p.pg.evaluate(() => {
      const barra = document.getElementById('t6a-barra');
      const lista = document.getElementById('t6a-pendentes');
      const btn = document.getElementById('t6a-adicionar');
      const primeiro = lista.querySelector('.pendente');
      return {
        barraVisivel: !barra.hidden,
        // o botão tem de vir ANTES da lista no documento: era o defeito
        botaoAntesDaLista: !!(btn.compareDocumentPosition(lista) & Node.DOCUMENT_POSITION_FOLLOWING),
        resumo: document.getElementById('t6a-resumo').textContent,
        aviso: document.getElementById('t6a-resumo-aviso').textContent,
        primeiroBloqueado: primeiro.classList.contains('bloqueado'),
        // e a lista rola dentro de si, em vez de empurrar a página
        rola: getComputedStyle(lista).overflowY
      };
    });
    assert(r.barraVisivel && r.botaoAntesDaLista, JSON.stringify(r));
    assert(/9 arquivo\(s\)/.test(r.resumo), r.resumo);
    assert(/1 não pode\(m\) subir/.test(r.aviso), r.aviso);
    assert(r.primeiroBloqueado, 'o arquivo que não pode subir tem de estar no topo, não perdido no meio de 9');
    assert(r.rola === 'auto' || r.rola === 'scroll', 'a lista tem de rolar dentro de si: ' + r.rola);
    await p.pg.close();
    return r.resumo + ' — ' + r.aviso;
  });

  await it('46: extensão que a lista não conhece não vira `.bin` quando o navegador sabe que é mídia — `.bin` mataria o vídeo na página do leitor', async () => {
    const { p, ch } = await sessao();
    await irAMidia(p.pg);
    const bytes = Buffer.alloc(64, 9);
    await escolherArquivo(p.pg, 'ferias.mov', bytes, 'video/quicktime');       // agora está na tabela
    await escolherArquivo(p.pg, 'gravacao.xyz', bytes, 'video/algum-formato'); // fora da tabela, mas o navegador diz que é vídeo
    await escolherArquivo(p.pg, 'sei-la.dat', bytes, '');                      // nem o navegador sabe: `bin` é honesto
    await p.pg.waitForFunction(() => document.querySelectorAll('#t6a-pendentes .pendente').length === 3, null, { timeout: 20000 });
    await p.pg.click('#t6a-adicionar');
    await p.pg.waitForSelector('#t6-tabela');
    const banco = await lerBanco(p.pg, ch.pubkey);
    const caminhos = banco.media.map(m => m.path).sort();
    assert(caminhos.indexOf('/media/ferias.mov') !== -1, JSON.stringify(caminhos));
    assert(caminhos.indexOf('/media/gravacao.xyz') !== -1, JSON.stringify(caminhos));
    assert(caminhos.indexOf('/media/sei-la.bin') !== -1, 'sem tipo nenhum, `bin` continua a ser a resposta certa: ' + JSON.stringify(caminhos));
    // e o `.mov` passa a ter mime derivável do caminho — é disso que a
    // reconstrução pela rede depende para saber o que é o arquivo
    const mime = await p.pg.evaluate(() => Modelo.mimePorCaminho('/media/ferias.mov'));
    assert(mime === 'video/quicktime', 'mimePorCaminho: ' + mime);
    await p.pg.close();
    return caminhos.join(' · ');
  });

  // --- 32(a) e 36: mídia da rede, numa máquina onde não há bytes -----------

  await it('32(a): mídia vinda da REDE (sem bytes locais) ganha miniatura baixada sob demanda — o caso que o dono viu no Tails com o banco vazio', async () => {
    const PNG = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'limpeza', 'limpo.png'));
    const sha = f.blobEm('x1', PNG, 'image/png');
    // como o app a reconstrói da rede: descrita no site.json, SEM bytes
    const daRede = { id: Modelo_novoId(), path: '/img/da-rede.png', mime: 'image/png', size: PNG.length,
      sha256: sha, width: null, height: null, alt: 'veio da rede', caption: '', bytes: null,
      status: 'published', servers: [f.url('x1')], removal: null,
      metadata: { stripped: null, removed_segments: [], warning: null }, origin: 'upload',
      created_at: '2026-08-30T10:00:00Z', updated_at: '2026-08-30T10:00:00Z', previous_status: null };
    const { p, ch } = await sessao({ extra: { media: [daRede] } });
    await p.pg.click('#menu .item[data-tela="t6"]');
    await p.pg.waitForSelector('#t6-tabela');
    // antes de baixar não há <img>; o módulo só vai à rede quando a linha entra em vista
    await p.pg.waitForFunction(() => {
      const c = document.querySelector('#t6-tabela .mini-caixa');
      return !!(c && c.querySelector('img'));
    }, null, { timeout: 30000 });
    const r = await p.pg.evaluate(() => {
      const img = document.querySelector('#t6-tabela .mini-caixa img');
      return { src: img.getAttribute('src'), alt: img.getAttribute('alt'), lazy: img.getAttribute('loading') };
    });
    assert(/^blob:/.test(r.src), 'a CSP do painel é img-src self data: blob: — tem de ser blob:, nunca https: direto: ' + r.src);
    assert(r.alt === 'veio da rede' && r.lazy === 'lazy', JSON.stringify(r));
    // e os bytes NÃO foram parar ao banco (13 D17: cache de sessão; P38: no Tails é RAM)
    const banco = await lerBanco(p.pg, ch.pubkey);
    assert(banco.media.length === 1 && !banco.media[0].bytes, 'os bytes não podem ser gravados no banco: ' + JSON.stringify(banco.media.map(m => [m.path, m.bytes])));
    await p.pg.close();
    return 'miniatura da rede em blob:, sem tocar no banco';
  });

  await it('32(a): arquivo GRANDE não baixa sozinho — mostra um botão, porque rolar a lista não pode custar megabytes pelo Tor', async () => {
    const PNG = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'limpeza', 'limpo.png'));
    const sha = f.blobEm('x2', PNG, 'image/png');
    const grande = { id: Modelo_novoId(), path: '/img/enorme.png', mime: 'image/png',
      size: 8 * 1024 * 1024,                      // o que o site.json declara: 8 MB
      sha256: sha, width: null, height: null, alt: 'enorme', caption: '', bytes: null,
      status: 'published', servers: [f.url('x2')], removal: null,
      metadata: { stripped: null, removed_segments: [], warning: null }, origin: 'upload',
      created_at: '2026-08-30T10:00:00Z', updated_at: '2026-08-30T10:00:00Z', previous_status: null };
    const { p } = await sessao({ extra: { media: [grande] } });
    await p.pg.click('#menu .item[data-tela="t6"]');
    await p.pg.waitForSelector('#t6-tabela .ver-mini');
    assert(!(await p.pg.$('#t6-tabela .mini-caixa img')), 'não podia ter baixado sozinho');
    await p.pg.click('#t6-tabela .ver-mini');
    await p.pg.waitForSelector('#t6-tabela .mini-caixa img', { timeout: 30000 });
    await p.pg.close();
    return 'acima do teto espera o clique, e o clique baixa';
  });

  await it('sem erros de página/console em nenhuma das sessões', () => {
    const erros = paginas.flatMap(p => p.erros.concat(p.consoleErros));
    assert(erros.length === 0, JSON.stringify(erros.slice(0, 5)));
  });
  return R;
};
