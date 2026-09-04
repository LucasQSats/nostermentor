// test/core/blocos.test.js — o lote 30 + 37 + 40 + 32(c): o marcador de blocos,
// o CTA, a página por etiqueta e a miniatura guardada. Tudo dentro da página e
// sem rede. O que esta suíte existe para provar, por ordem de gravidade:
//  1. SEGURANÇA — o HTML do bloco NÃO passa pelo DOMPurify (é molde de tema,
//     como o layout), logo `Gerador.hrefSeguro` é a única barreira entre um
//     `javascript:` escrito no marcador e um `<a>` no site do leitor;
//  2. DETERMINISMO (13 §5.2) — bloco e página de etiqueta têm de dar os mesmos
//     bytes em qualquer motor e em qualquer ordem de entrada;
//  3. o CAMINHO ÚNICO por etiqueta, mesmo quando dois nomes colidem no slug.
const { abrir, coletor, assert } = require('../util.js');

module.exports = async function (ctx, u) {
  const { R, it } = coletor();
  const p = await abrir(ctx, u.url);
  const r = await p.pg.evaluate(async () => {
    const out = {};
    const site = Modelo.sitePadrao('a'.repeat(64), 'npub1teste');
    site.title = 'Meu Site';
    site.home = { mode: 'blog', page_id: null, latest_posts: 0 };

    const capa = { id: 'm-capa', path: '/img/praia.jpg', mime: 'image/jpeg', size: 3000000, sha256: 'b'.repeat(64), width: 4000, height: 3000, alt: 'A praia', caption: '', bytes: null, status: 'published', servers: [], removal: null, metadata: { stripped: true, removed_segments: [], warning: null }, origin: 'upload', created_at: Modelo.agora(), updated_at: Modelo.agora(), previous_status: null };
    const mini = Object.assign({}, capa, { id: 'm-mini', path: '/img/praia-mini.webp', mime: 'image/webp', size: 41000, sha256: 'c'.repeat(64), width: 480, height: 360, alt: '' });
    capa.thumb_media_id = 'm-mini';

    const a1 = Modelo.novoArtigo('Bolo de fubá'); a1.id = 'a-1'; a1.date = '2026-08-01T00:00:00Z'; a1.body = 'Um bolo.'; a1.tags = ['receitas', 'doces']; a1.cover_media_id = 'm-capa'; a1.status = 'published';
    const a2 = Modelo.novoArtigo('Pão'); a2.id = 'a-2'; a2.date = '2026-08-10T00:00:00Z'; a2.body = 'Um pão.'; a2.tags = ['receitas']; a2.status = 'published';
    // capa no MAIS RECENTE de propósito: a galeria pede 2 e é ele que entra.
    // O 'Pão' fica sem capa, para o mesmo caso cobrir cartão com e sem imagem.
    const a3 = Modelo.novoArtigo('Nostr'); a3.id = 'a-3'; a3.date = '2026-08-20T00:00:00Z'; a3.body = 'Protocolo.'; a3.tags = ['técnico']; a3.cover_media_id = 'm-capa'; a3.status = 'published';

    const pag = Modelo.novaPagina('Sobre'); pag.id = 'p-1'; pag.status = 'published';
    pag.body = 'Olá.\n\n[[botao: Fale comigo -> /contato]]\n\n[[artigos: 2, com-capa]]\n\nFim.';
    const dados = { site, pages: [pag], posts: [a1, a2, a3], media: [capa, mini] };

    const g = await Gerador.gerarSite(dados);
    const acha = (c) => { const x = g.arquivos.find(a => a.path === c); return x ? x.texto : ''; };
    out.caminhos = g.arquivos.map(a => a.path).sort();
    out.sobre = acha('/sobre.html');
    out.etReceitas = acha('/blog/etiqueta/receitas.html');
    out.artigo1 = acha('/blog/bolo-de-fuba.html');
    out.tipoEtiqueta = (g.arquivos.find(a => a.path === '/blog/etiqueta/receitas.html') || {}).tipo;
    out.dinamicoSobre = (g.arquivos.find(a => a.path === '/sobre.html') || {}).dinamico;
    out.dinamicoArtigo = (g.arquivos.find(a => a.path === '/blog/bolo-de-fuba.html') || {}).dinamico;

    // determinismo: mesma entrada, ordem dos artigos invertida
    const d2 = JSON.parse(JSON.stringify(dados)); d2.posts.reverse();
    const g2 = await Gerador.gerarSite(d2);
    out.determinista = JSON.stringify(g.hashes) === JSON.stringify(g2.hashes);

    // --- 37: o href é o único ponto de defesa deste <a> --------------------
    const perigosos = ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<b>x', '//mau.test/p', 'vbscript:x', ' javascript:alert(1)', 'file:///etc/passwd'];
    out.recusados = perigosos.filter(x => Gerador.hrefSeguro(x) === null).length;
    out.perigososTotal = perigosos.length;
    out.aceites = [Gerador.hrefSeguro('/contato'), Gerador.hrefSeguro('/'), Gerador.hrefSeguro('https://ok.test/x'), Gerador.hrefSeguro('http://ok.test/')].map(x => x && x.externo);
    const mau = Modelo.novaPagina('Mau'); mau.id = 'p-mau'; mau.status = 'published';
    mau.body = '[[botao: Clique -> javascript:alert(1)]]\n\n[[botao: Aspas" onmouseover="x -> /ok]]';
    const gm = await Gerador.gerarSite({ site, pages: [mau], posts: [], media: [] });
    out.mauHtml = gm.arquivos.find(a => a.path === '/mau.html').texto;

    // --- 40: colisão de slug e etiqueta sem slug ---------------------------
    const c1 = Modelo.novoArtigo('Um'); c1.id = 'c-1'; c1.date = '2026-08-01T00:00:00Z'; c1.tags = ['são paulo']; c1.status = 'published';
    const c2 = Modelo.novoArtigo('Dois'); c2.id = 'c-2'; c2.date = '2026-08-02T00:00:00Z'; c2.tags = ['SAO PAULO', '!!!']; c2.status = 'published';
    const gc = await Gerador.gerarSite({ site, pages: [], posts: [c1, c2], media: [] });
    out.colisaoCaminhos = gc.arquivos.map(a => a.path).filter(x => x.indexOf('/blog/etiqueta/') === 0);
    out.colisaoPagina = gc.arquivos.find(a => a.path === '/blog/etiqueta/sao-paulo.html').texto;
    out.colisaoArtigo2 = gc.arquivos.find(a => a.path === '/blog/dois.html').texto;
    out.etiquetasDe = Modelo.etiquetasDe([c1, c2]).map(e => e.slug + '=' + e.nome + '(' + e.ids.length + ')');

    // --- 30: leitura dos argumentos ---------------------------------------
    out.opcoes = [
      Gerador.opcoesArtigos(''),
      Gerador.opcoesArtigos('3, sem-capa, com-resumo, etiqueta=Receitas'),
      Gerador.opcoesArtigos('999, lixo, etiqueta=')
    ];
    // marcador desconhecido, mal formado ou no meio da linha: fica TEXTO
    const t = Modelo.novaPagina('T'); t.id = 'p-t'; t.status = 'published';
    t.body = '[[naoexiste: x]]\n\nveja [[botao: A -> /b]] aqui\n\n[[botao: sem seta]]\n\n[[artigos: 1, etiqueta=nao-existe]]\n\n```\n[[botao: Exemplo -> /x]]\n```\n\n    [[botao: Indentado -> /y]]';
    const gt = await Gerador.gerarSite({ site, pages: [t], posts: [a1, a2, a3], media: [] });
    out.texto = gt.arquivos.find(a => a.path === '/t.html').texto;

    // a prévia lateral do editor: mesmo caminho, com o contexto passado à mão
    const ctxP = Gerador.contexto(dados);
    out.previaComCtx = Gerador.previaCorpo('T', '[[artigos: 2, com-capa, etiqueta=receitas]]', {}, {}, ctxP);
    out.previaSemCtx = Gerador.previaCorpo('T', '[[artigos: 2]]', {}, {}, null);
    out.corpoDireto = Gerador.renderizarCorpo('[[artigos: 2, com-capa, etiqueta=receitas]]', ctxP);

    // --- 32(c): a galeria serve a MINIATURA -------------------------------
    const semMini = JSON.parse(JSON.stringify(dados));
    semMini.media = [Object.assign({}, capa, { thumb_media_id: null })];
    out.semMini = (await Gerador.gerarSite(semMini)).arquivos.find(a => a.path === '/sobre.html').texto;
    // o campo vem do site.json (dado da rede): apontar para nada, ou para um
    // vídeo, não pode virar <img src> de um vídeo
    const miniFalsa = JSON.parse(JSON.stringify(dados));
    miniFalsa.media = [Object.assign({}, capa), Object.assign({}, mini, { mime: 'video/mp4', path: '/media/x.mp4' })];
    out.miniVideo = (await Gerador.gerarSite(miniFalsa)).arquivos.find(a => a.path === '/sobre.html').texto;
    const miniFantasma = JSON.parse(JSON.stringify(dados));
    miniFantasma.media = [Object.assign({}, capa, { thumb_media_id: 'nao-existe' })];
    out.miniFantasma = (await Gerador.gerarSite(miniFantasma)).arquivos.find(a => a.path === '/sobre.html').texto;
    out.valeAPena = [
      Miniaturas.valeAPena({ mime: 'image/jpeg', width: 4000, size: 3000000 }),
      Miniaturas.valeAPena({ mime: 'image/png', width: 200, size: 9000 }),
      Miniaturas.valeAPena({ mime: 'image/svg+xml', width: 4000, size: 3000000 }),
      Miniaturas.valeAPena({ mime: 'video/mp4', width: 4000, size: 3000000 })
    ];
    // a geração real, com uma imagem de verdade feita aqui
    const c = document.createElement('canvas'); c.width = 1600; c.height = 1200;
    const cx = c.getContext('2d');
    cx.fillStyle = '#2271b1'; cx.fillRect(0, 0, 1600, 1200);
    cx.fillStyle = '#ffffff'; cx.fillRect(100, 100, 900, 700);
    const grande = await new Promise(res => c.toBlob(res, 'image/png'));
    const bytesGrandes = new Uint8Array(await grande.arrayBuffer());
    const feita = await Miniaturas.gerar(bytesGrandes, 'image/png');
    out.mini = feita ? { largura: feita.width, altura: feita.height, mime: feita.mime, menor: feita.bytes.length < bytesGrandes.length } : null;
    // o site.json só ganha a chave quando ela aponta para alguma coisa
    out.jsonComMini = SiteJson.escrever({ site: site, pages: [], posts: [], media: [capa] });
    out.jsonSemMini = SiteJson.escrever({ site: site, pages: [], posts: [], media: [Object.assign({}, capa, { thumb_media_id: null })] });
    out.voltaDoJson = SiteJson.ler(out.jsonComMini).dados.media[0].thumb_media_id;
    return out;
  });

  // ---- 1. segurança -------------------------------------------------------
  await it('37 (segurança): o href do botão é a ÚNICA barreira deste <a> — javascript:, data:, //host, vbscript:, file: e o espaço à frente são todos recusados', () => {
    assert(r.recusados === r.perigososTotal, r.recusados + ' de ' + r.perigososTotal);
    assert(JSON.stringify(r.aceites) === JSON.stringify([false, false, true, true]), JSON.stringify(r.aceites));
  });
  await it('37 (segurança): marcador com javascript: não vira ATRIBUTO nenhum — fica texto à vista; e aspas no rótulo não escapam do href', () => {
    // ⚠️ A asserção certa não é "a palavra javascript não aparece": o marcador
    // recusado fica como TEXTO de propósito (é assim que o dono vê o erro), e
    // aí a palavra aparece mesmo — dentro de um <p>, escapada. O que não pode
    // existir é um ATRIBUTO com esse valor. Foi esta confusão que fez o
    // primeiro teste desta suíte falhar por estar errado, não o produto.
    const corpo = r.mauHtml.slice(r.mauHtml.indexOf('<main'), r.mauHtml.indexOf('</main>'));
    assert(!/=\s*["']?\s*(javascript|data|vbscript):/i.test(r.mauHtml), 'esquema perigoso virou atributo: ' + corpo);
    assert(/<p>\[\[botao: Clique -&gt; javascript:alert\(1\)\]\]<\/p>/.test(r.mauHtml), 'o marcador recusado devia ficar como texto num <p>: ' + corpo);
    assert((corpo.match(/<a /g) || []).length === 1, 'devia haver exatamente um <a> (o botão válido): ' + corpo);
    // Mesma armadilha da linha de cima: `onmouseover=` APARECE — como texto do
    // link, com as aspas já em `&quot;`. O que se prova é que a tag de abertura
    // é exatamente a que devia ser, sem um atributo a mais.
    const tagA = /<a class="botao"[^>]*>/.exec(r.mauHtml);
    assert(tagA && tagA[0] === '<a class="botao" href="/ok">', 'a tag do botão ganhou atributo: ' + (tagA ? tagA[0] : 'não há <a class="botao">'));
    assert(/&quot; onmouseover=&quot;x<\/a>/.test(r.mauHtml), 'as aspas do rótulo tinham de sair escapadas no texto: ' + corpo);
  });

  // ---- 2. o que o dono vê -------------------------------------------------
  await it('37: `[[botao: Texto -> /destino]]` vira <a class="botao"> em linha própria, e o externo leva rel', () => {
    assert(/<p class="cta"><a class="botao" href="\/contato">Fale comigo<\/a><\/p>/.test(r.sobre), r.sobre.slice(r.sobre.indexOf('<article'), r.sobre.indexOf('</article>')));
    assert(!/<p>\[\[/.test(r.sobre), 'sobrou marcador cru');
  });
  await it('30: a galeria sai como grade de cartões com link, título e data — e sem uma linha de script', () => {
    const m = r.sobre.slice(r.sobre.indexOf('<section class="galeria"'), r.sobre.indexOf('</section>') + 10);
    assert(/<ul class="cartoes">/.test(m), 'sem grade: ' + m);
    const links = [...m.matchAll(/<h3 class="cartao-titulo"><a href="([^"]+)">([^<]+)<\/a>/g)].map(x => x[1]);
    assert(JSON.stringify(links) === JSON.stringify(['/blog/nostr.html', '/blog/pao.html']), JSON.stringify(links));
    assert(!/<script/i.test(r.sobre), 'script no site publicado');
  });
  await it('30: o marcador desconhecido, o que está no meio da linha e o que tem argumentos inválidos ficam TEXTO — o erro aparece, não desaparece', () => {
    assert(/\[\[naoexiste: x\]\]/.test(r.texto), 'nome desconhecido sumiu');
    assert(/veja \[\[botao: A -&gt; \/b\]\] aqui/.test(r.texto), 'marcador no meio da linha foi expandido');
    assert(/\[\[botao: sem seta\]\]/.test(r.texto), 'botão sem seta sumiu');
    assert(/class="vazio"/.test(r.texto), 'galeria sem resultado devia dizê-lo');
    // ⚠️ dentro de bloco de código o marcador NÃO vale: sem isto, documentar a
    // própria sintaxe no seu site injetaria um <section> dentro do <pre>.
    assert(/<pre><code>\[\[botao: Exemplo -&gt; \/x\]\]/.test(r.texto), 'marcador dentro de ``` foi expandido: ' + r.texto.slice(r.texto.indexOf('<pre>'), r.texto.indexOf('<pre>') + 200));
    assert(/\[\[botao: Indentado -&gt; \/y\]\]/.test(r.texto) && (r.texto.match(/class="botao"/g) || []).length === 0, 'marcador indentado (bloco de código) foi expandido');
  });
  await it('30: os argumentos são lidos como escrito, e o que não se reconhece é ignorado sem matar o bloco', () => {
    assert(JSON.stringify(r.opcoes[0]) === JSON.stringify({ n: 6, capa: true, resumo: false, etiqueta: null }), JSON.stringify(r.opcoes[0]));
    assert(JSON.stringify(r.opcoes[1]) === JSON.stringify({ n: 3, capa: false, resumo: true, etiqueta: 'receitas' }), JSON.stringify(r.opcoes[1]));
    assert(JSON.stringify(r.opcoes[2]) === JSON.stringify({ n: 6, capa: true, resumo: false, etiqueta: null }), JSON.stringify(r.opcoes[2]));
  });

  // ---- 3. etiquetas -------------------------------------------------------
  await it('40: cada etiqueta usada vira /blog/etiqueta/<slug>.html com os seus artigos, e o artigo liga para lá', () => {
    assert(r.caminhos.includes('/blog/etiqueta/receitas.html') && r.caminhos.includes('/blog/etiqueta/doces.html') && r.caminhos.includes('/blog/etiqueta/tecnico.html'), JSON.stringify(r.caminhos));
    const ordem = [...r.etReceitas.matchAll(/<h2><a href="\/blog\/([a-z-]+)\.html">/g)].map(x => x[1]);
    assert(JSON.stringify(ordem) === JSON.stringify(['pao', 'bolo-de-fuba']), JSON.stringify(ordem));
    assert(/<h1>Etiqueta: receitas<\/h1>/.test(r.etReceitas), 'título');
    assert(/<a class="etiqueta" href="\/blog\/etiqueta\/receitas\.html">receitas<\/a>/.test(r.artigo1), 'a etiqueta do artigo não virou link');
  });
  await it('40: dois nomes que dão o mesmo slug caem numa página só (nunca dois arquivos no mesmo caminho), e etiqueta sem slug fica <span>', () => {
    assert(JSON.stringify(r.colisaoCaminhos) === JSON.stringify(['/blog/etiqueta/sao-paulo.html']), JSON.stringify(r.colisaoCaminhos));
    const n = (r.colisaoPagina.match(/<h2><a href="\/blog\//g) || []).length;
    assert(n === 2, 'a página agrupada devia ter os 2 artigos, tem ' + n);
    assert(/<h1>Etiqueta: SAO PAULO<\/h1>/.test(r.colisaoPagina), 'o nome exibido tem de ser o menor em code point (determinista): ' + r.colisaoPagina.slice(r.colisaoPagina.indexOf('<h1'), r.colisaoPagina.indexOf('</h1>')));
    assert(/<span class="etiqueta">!!!<\/span>/.test(r.colisaoArtigo2), '"!!!" não produz slug e tem de continuar <span>: ' + r.colisaoArtigo2.slice(r.colisaoArtigo2.indexOf('<p class="meta"'), r.colisaoArtigo2.indexOf('<p class="meta"') + 300));
    assert(JSON.stringify(r.etiquetasDe) === JSON.stringify(['sao-paulo=SAO PAULO(2)']), JSON.stringify(r.etiquetasDe));
  });
  await it('40/30 (T8): a página da etiqueta e a página com galeria vêm marcadas, para T8 poder dizer o porquê', () => {
    assert(r.tipoEtiqueta === 'etiqueta', 'tipo: ' + r.tipoEtiqueta);
    assert(r.dinamicoSobre === true && r.dinamicoArtigo === false, JSON.stringify([r.dinamicoSobre, r.dinamicoArtigo]));
  });

  // ---- 4. miniatura -------------------------------------------------------
  await it('32(c): a galeria serve a miniatura guardada quando existe, e cai na original quando não existe', () => {
    assert(/<img src="\/img\/praia-mini\.webp" alt="A praia" width="480" height="360" loading="lazy">/.test(r.sobre), 'não usou a miniatura: ' + r.sobre.slice(r.sobre.indexOf('<section class="galeria"'), r.sobre.indexOf('<section class="galeria"') + 600));
    assert((r.sobre.match(/<a class="cartao-capa"/g) || []).length === 1, 'o cartão sem capa não pode ganhar link de imagem vazio');
    assert(/<img src="\/img\/praia\.jpg" alt="A praia" width="4000" height="3000" loading="lazy">/.test(r.semMini), 'sem miniatura devia cair na original');
    assert(/<img src="\/img\/praia\.jpg"/.test(r.miniVideo) && !/\.mp4/.test(r.miniVideo), 'miniatura que não é imagem tem de ser ignorada');
    assert(/<img src="\/img\/praia\.jpg"/.test(r.miniFantasma), 'miniatura inexistente tem de cair na original');
  });
  await it('32(c): a miniatura só é gerada quando compensa, e quando é gerada cabe em 480 e é menor que a original', () => {
    assert(JSON.stringify(r.valeAPena) === JSON.stringify([true, false, false, false]), JSON.stringify(r.valeAPena));
    assert(r.mini && r.mini.largura === 480 && r.mini.altura === 360 && r.mini.menor, JSON.stringify(r.mini));
    assert(r.mini && /^image\/(webp|png|jpeg)$/.test(r.mini.mime), 'mime produzido: ' + (r.mini || {}).mime);
  });
  await it('32(c): `thumb_media_id` viaja no site.json, mas a chave NÃO aparece quando não há miniatura — senão todo site existente acusava uma alteração que ninguém fez', () => {
    assert(r.jsonComMini.indexOf('"thumb_media_id":"m-mini"') !== -1, r.jsonComMini.slice(0, 300));
    assert(r.jsonSemMini.indexOf('thumb_media_id') === -1, 'a chave apareceu sem valor: ' + r.jsonSemMini);
    assert(r.voltaDoJson === 'm-mini', 'não voltou da rede: ' + r.voltaDoJson);
  });

  await it('30: a prévia lateral do editor desenha a galeria com os artigos reais quando recebe o contexto, e vazia quando não recebe', () => {
    // ⚠️ Contar a CLASSE não serve numa prévia: o CSS do tema vai embutido num
    // `<style>` e tem duas regras `.cartao-titulo`. Contar a TAG é o que conta
    // cartões. Custou uma investigação inteira a perseguir uma duplicação que
    // não existia — o produto estava certo desde o princípio.
    const n = (r.previaComCtx.match(/<h3 class="cartao-titulo">/g) || []).length;
    const nd = (r.corpoDireto.match(/<h3 class="cartao-titulo">/g) || []).length;
    assert(nd === 2, 'cartões no corpo renderizado (sem previa): ' + nd);
    assert(n === 2, 'cartões na prévia com ctx: ' + n);
    assert(!/<h3 class="cartao-titulo">/.test(r.previaSemCtx), 'sem ctx a galeria não podia desenhar nada');
  });

  // ---- 5. determinismo ----------------------------------------------------
  await it('13 §5.2: blocos e páginas de etiqueta não dependem da ordem de entrada — mesmos hashes', () => assert(r.determinista, 'os hashes mudaram com a ordem dos artigos'));

  await it('sem erros de página/console', () => assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros })));
  await p.pg.close();
  return R;
};
