// test/core/gerador.test.js — core/gerador.js + tema padrão + SiteJson.escrever
// dentro da página (sem rede): aceite 3 (sanitização) e 4 (determinismo e
// 13 §5.3) de 15 M3, caminhos de 13 §5.1, aliases, menu, home em modo
// página/blog, datas sem hora (T-10), site.json com leitura de volta.
const { abrir, coletor, assert } = require('../util.js');

module.exports = async function (ctx, u) {
  const { R, it } = coletor();
  const p = await abrir(ctx, u.url);
  const r = await p.pg.evaluate(async () => {
    const out = {};
    const site = Modelo.sitePadrao('a'.repeat(64), 'npub1teste');
    site.title = 'Meu Site'; site.description = 'Descrição do site'; site.language = 'pt-BR';
    const home = Modelo.novaPagina('Início'); home.body = 'Bem-vindo ao **site**.'; home.status = 'published';
    const sobre = Modelo.novaPagina('Sobre nós'); sobre.body = 'Quem somos.'; sobre.aliases = ['quem-somos']; sobre.status = 'published';
    const oculta = Modelo.novaPagina('Oculta'); oculta.in_menu = false; oculta.body = 'x';
    const removida = Modelo.novaPagina('Removida'); removida.status = 'removed';
    site.home = { mode: 'page', page_id: home.id, latest_posts: 2 };
    site.menu = [{ type: 'page', page_id: home.id }, { type: 'blog' }, { type: 'link', label: 'Externo', href: 'https://exemplo.test/' }];
    const midia = { id: 'm-1', path: '/img/capa.png', mime: 'image/png', size: 4, sha256: 'b'.repeat(64), width: 10, height: 5, alt: 'A capa', caption: 'Legenda', bytes: null, status: 'published', servers: [], removal: null, metadata: { stripped: true, removed_segments: [], warning: null }, origin: 'upload', created_at: Modelo.agora(), updated_at: Modelo.agora(), previous_status: null };
    const herdado = Modelo.midiaHerdada('/velho.png', 'c'.repeat(64), []);
    const a1 = Modelo.novoArtigo('Primeiro artigo'); a1.date = '2026-08-01T10:20:30Z'; a1.body = 'Primeiro parágrafo do primeiro.\n\nSegundo parágrafo.'; a1.tags = ['nostr', 'teste']; a1.cover_media_id = 'm-1'; a1.status = 'published';
    const a2 = Modelo.novoArtigo('Segundo artigo'); a2.date = '2026-08-10T00:00:00Z'; a2.body = 'Dois.'; a2.excerpt = 'Resumo explícito'; a2.aliases = ['antigo-segundo'];
    const a3 = Modelo.novoArtigo('Terceiro'); a3.date = '2026-08-20T00:00:00Z'; a3.body = '<script>alert(1)</script><p onclick="x()">olá</p><img src="x" onerror="alert(2)"><a href="javascript:alert(3)">j</a><iframe src="https://x"></iframe><object data="x"></object><style>body{}</style>\n\n## Sub\n\n- um\n- dois\n\n[link](https://ok.test/) ![alt](/img/capa.png) `cod`';
    // ids FIXOS: o site.json leva os ids, e o hash só é comparável entre motores/rodadas com entrada idêntica
    home.id = 'p-home'; sobre.id = 'p-sobre'; oculta.id = 'p-oculta'; removida.id = 'p-removida'; a1.id = 'a-1'; a2.id = 'a-2'; a3.id = 'a-3'; herdado.id = 'm-herdado';
    site.home.page_id = home.id; site.menu[0].page_id = home.id;
    const dados = { site, pages: [home, sobre, oculta, removida], posts: [a1, a2, a3], media: [midia, herdado] };
    const g1 = await Gerador.gerarSite(dados);
    const g2 = await Gerador.gerarSite(JSON.parse(JSON.stringify(dados)));
    out.caminhos = g1.arquivos.map(a => a.path).sort();
    out.identico = JSON.stringify(g1.hashes) === JSON.stringify(g2.hashes) && g1.arquivos.every((a, i) => a.texto === g2.arquivos[i].texto);
    out.porId = Object.keys(g1.porId).length;
    out.hashHome = g1.porId[home.id] === g1.hashes['/index.html'];
    const t = (path) => g1.arquivos.find(a => a.path === path).texto;
    out.home = t('/index.html'); out.sobre = t('/sobre-nos.html'); out.alias = t('/quem-somos.html'); out.blog = t('/blog/index.html'); out.a1 = t('/blog/primeiro-artigo.html'); out.a3 = t('/blog/terceiro.html'); out.aliasPost = t('/blog/antigo-segundo.html'); out.css = t('/tema/estilo.css');
    out.siteJsonTexto = t('/nostermentor/site.json');
    out.siteJsonLido = SiteJson.ler(out.siteJsonTexto);
    out.bom = g1.arquivos.every(a => a.bytes[0] !== 0xEF);
    out.crlf = g1.arquivos.some(a => a.texto.indexOf('\r') !== -1);
    // 13 §5.3: mudar o corpo de uma página → só ela + site.json
    const d2 = JSON.parse(JSON.stringify(dados)); d2.pages[1].body = 'Quem somos, agora diferente.';
    const g3 = await Gerador.gerarSite(d2);
    out.mudouPagina = Object.keys(g1.hashes).filter(k => g1.hashes[k] !== g3.hashes[k]).sort();
    // mudar o título de um artigo → o artigo, /blog/index.html, /index.html (latest_posts>0), site.json
    const d3 = JSON.parse(JSON.stringify(dados)); d3.posts[2].title = 'Terceiro (novo título)';
    const g4 = await Gerador.gerarSite(d3);
    out.mudouArtigo = Object.keys(g1.hashes).filter(k => g1.hashes[k] !== g4.hashes[k]).sort();
    // mudar o título de uma página do menu → todas as páginas HTML (o menu está em todas)
    const d4 = JSON.parse(JSON.stringify(dados)); d4.pages[1].title = 'Sobre (novo)';
    const g5 = await Gerador.gerarSite(d4);
    out.mudouMenu = Object.keys(g1.hashes).filter(k => g1.hashes[k] !== g5.hashes[k] && /\.html$/.test(k)).length;
    out.totalHtml = Object.keys(g1.hashes).filter(k => /\.html$/.test(k)).length;
    // home em modo blog + hora visível
    const d5 = JSON.parse(JSON.stringify(dados)); d5.site.home = { mode: 'blog', page_id: null, latest_posts: 5 }; d5.site.privacy.show_publish_time = true;
    const g6 = await Gerador.gerarSite(d5);
    out.homeBlog = g6.arquivos.find(a => a.path === '/index.html').texto; out.a1ComHora = g6.arquivos.find(a => a.path === '/blog/primeiro-artigo.html').texto;
    out.caminhosBlog = g6.arquivos.map(a => a.path).sort();
    out.corpo = Gerador.renderizarCorpo('# H1\n\nTexto *it* **neg**\n\n<b onmouseover="x">b</b> <span style="color:red">s</span>');
    out.previa = Gerador.previaCorpo('Tít', 'oi ![a](/img/capa.png)', { '/img/capa.png': 'data:image/png;base64,AAAA' });
    out.paragrafo = Gerador.primeiroParagrafo(Gerador.renderizarCorpo('# Título\n\nEste é o **primeiro** parágrafo.\n\nSegundo.'));
    out.shaTotal = await Gerador.sha256Hex(new TextEncoder().encode(g1.arquivos.map(a => a.path + ':' + a.sha256).join('\n')));
    return out;
  });
  const esperados = ['/blog/antigo-segundo.html', '/blog/index.html', '/blog/primeiro-artigo.html', '/blog/segundo-artigo.html', '/blog/terceiro.html', '/index.html', '/nostermentor/site.json', '/oculta.html', '/quem-somos.html', '/sobre-nos.html', '/tema/estilo.css'];
  await it('caminhos de 13 §5.1: home, páginas (a Home só em /index.html), aliases, /blog/index.html, artigos, alias de artigo, CSS do tema, site.json; removida fora', () => assert(JSON.stringify(r.caminhos) === JSON.stringify(esperados), JSON.stringify(r.caminhos)));
  await it('aceite 4: gerar duas vezes → bytes idênticos; UTF-8 sem BOM; só \\n', () => assert(r.identico && r.bom && !r.crlf, JSON.stringify([r.identico, r.bom, r.crlf])));
  await it('published_hash por id: 3 páginas + 3 artigos; o da Home é o hash de /index.html', () => assert(r.porId === 6 && r.hashHome, r.porId + ' ' + r.hashHome));
  await it('aceite 4 (13 §5.3): corpo de uma página → só ela + site.json', () => assert(JSON.stringify(r.mudouPagina) === JSON.stringify(['/nostermentor/site.json', '/sobre-nos.html']), JSON.stringify(r.mudouPagina)));
  await it('aceite 4 (13 §5.3): título de um artigo → o artigo, /blog/index.html, /index.html (latest_posts) e site.json', () => assert(JSON.stringify(r.mudouArtigo) === JSON.stringify(['/blog/index.html', '/blog/terceiro.html', '/index.html', '/nostermentor/site.json']), JSON.stringify(r.mudouArtigo)));
  await it('aceite 4 (13 §5.3): título de página no menu → todo HTML muda (menos o stub de alias do artigo, que não tem menu nem esse título)', () => assert(r.mudouMenu === r.totalHtml - 1, r.mudouMenu + ' de ' + r.totalHtml));
  await it('aceite 3: <script>, on*=, javascript:, <iframe>, <object>, <style> saem; Markdown (h2, lista, link, imagem, código) fica', () => {
    const a = r.a3;
    assert(!/<script/i.test(a) && !/onclick|onerror/i.test(a) && !/javascript:/i.test(a) && !/<iframe|<object|<style/i.test(a), 'sobrou algo perigoso: ' + a.slice(a.indexOf('<article'), a.indexOf('<article') + 400));
    assert(/<h2>Sub<\/h2>/.test(a) && /<li>um<\/li>/.test(a) && /<a href="https:\/\/ok\.test\/">link<\/a>/.test(a) && /<img src="\/img\/capa\.png" alt="alt">/.test(a) && /<code>cod<\/code>/.test(a) && /<p>olá<\/p>/.test(a), 'Markdown perdido: ' + a.slice(a.indexOf('<article'), a.indexOf('<article') + 500));
    assert(/<b>b<\/b>/.test(r.corpo) && /style="color:red"/.test(r.corpo) && !/onmouseover/.test(r.corpo), r.corpo);
  });
  await it('layout: <html lang>, <title> "Página – Site", meta description, link do CSS, menu com aria-current, link externo marcado, crédito do rodapé', () => {
    const s = r.sobre;
    assert(/<html lang="pt-BR">/.test(s) && /<title>Sobre nós – Meu Site<\/title>/.test(s) && /<meta name="description" content="Quem somos\.">/.test(s), s.slice(0, 400));
    assert(/<link rel="stylesheet" href="\/tema\/estilo\.css">/.test(s) && /<a href="\/index\.html">Início<\/a>/.test(s) && /<a href="\/blog\/index\.html">Blog<\/a>/.test(s) && /<a href="https:\/\/exemplo\.test\/" rel="external noopener noreferrer">Externo<\/a>/.test(s), 'menu: ' + s.slice(s.indexOf('<nav'), s.indexOf('</nav>')));
    assert(/<a href="\/sobre-nos\.html" aria-current="page">Sobre nós<\/a>/.test(s), 'aria-current');
    assert(/Publicado com Nostermentor/.test(s) && !/href="http/.test(s.slice(s.indexOf('<footer'))), 'rodapé');
    assert(/<a href="\/index\.html" aria-current="page">Início<\/a>/.test(r.home) && /<title>Meu Site<\/title>/.test(r.home), 'home: título/menu');
  });
  await it('home em modo página: corpo + "últimos artigos" (2) com link para o blog; oculta (in_menu=false) fora do menu mas publicada', () => {
    assert(/Bem-vindo ao <strong>site<\/strong>/.test(r.home) && /class="ultimos"/.test(r.home) && (r.home.match(/<li><a href="\/blog\//g) || []).length === 2 && /Todos os artigos/.test(r.home), r.home.slice(r.home.indexOf('<main'), r.home.indexOf('</main>')));
    assert(!/Oculta/.test(r.home.slice(r.home.indexOf('<nav'), r.home.indexOf('</nav>'))) && r.caminhos.includes('/oculta.html'), 'oculta');
  });
  await it('artigo: data só AAAA-MM-DD no texto E no datetime (T-10), etiquetas, capa com alt/legenda/dimensões; com show_publish_time a hora aparece', () => {
    assert(/<time datetime="2026-08-01">2026-08-01<\/time>/.test(r.a1) && !/10:20/.test(r.a1), 'hora vazou: ' + r.a1.slice(r.a1.indexOf('<p class="meta"'), r.a1.indexOf('<p class="meta"') + 200));
    assert(/<span class="etiqueta">nostr<\/span>/.test(r.a1) && /<img src="\/img\/capa\.png" alt="A capa" width="10" height="5">/.test(r.a1) && /<figcaption>Legenda<\/figcaption>/.test(r.a1), 'etiquetas/capa');
    assert(/<time datetime="2026-08-01T10:20:30Z">2026-08-01 10:20 UTC<\/time>/.test(r.a1ComHora), 'com hora: ' + r.a1ComHora.slice(r.a1ComHora.indexOf('<time'), r.a1ComHora.indexOf('<time') + 80));
  });
  await it('blog: artigos por data decrescente, resumo explícito ou derivado do primeiro parágrafo; home em modo blog é a listagem', () => {
    const b = r.blog;
    const ordem = [...b.matchAll(/<a href="\/blog\/([a-z-]+)\.html">/g)].map(m => m[1]);
    assert(JSON.stringify(ordem) === JSON.stringify(['terceiro', 'segundo-artigo', 'primeiro-artigo']), JSON.stringify(ordem));
    assert(/<p class="resumo">Resumo explícito<\/p>/.test(b) && /<p class="resumo">Primeiro parágrafo do primeiro\.<\/p>/.test(b), 'resumos');
    // em modo blog a página "Início" deixa de ser a Home e passa a viver em /inicio.html como qualquer página
    assert(/class="blog"/.test(r.homeBlog) && r.caminhosBlog.includes('/inicio.html') && r.caminhosBlog.includes('/blog/index.html'), 'home blog: ' + JSON.stringify(r.caminhosBlog));
  });
  await it('alias: stub com meta refresh para o caminho atual (página e artigo)', () => assert(/<meta http-equiv="refresh" content="0; url=\/sobre-nos\.html">/.test(r.alias) && /<meta http-equiv="refresh" content="0; url=\/blog\/segundo-artigo\.html">/.test(r.aliasPost), r.alias));
  await it('tema: CSS sem url()/@import/http (G.2.4)', () => assert(!/url\(|@import|https?:/.test(r.css) && r.css.length > 500, 'css'));
  await it('site.json (13 §6.1): chaves na ordem, sem rascunhos removidos, sem herdados, sem created_at/updated_at/status; SiteJson.ler lê de volta com os mesmos ids', () => {
    const j = JSON.parse(r.siteJsonTexto);
    assert(Object.keys(j).join(',') === 'format,version,site,pages,posts,media,theme', Object.keys(j).join(','));
    assert(Object.keys(j.site).join(',') === 'pubkey,npub,title,description,language,profile,home,blog,menu,theme,donations,privacy,network', Object.keys(j.site).join(','));
    assert(j.pages.length === 3 && j.posts.length === 3 && j.media.length === 1 && j.media[0].id === 'm-1', JSON.stringify([j.pages.length, j.posts.length, j.media.map(m => m.id)]));
    assert(!/created_at|updated_at|"status"|published_hash|bytes/.test(r.siteJsonTexto), 'campos locais vazaram');
    assert(r.siteJsonLido.ok && r.siteJsonLido.dados.pages.length === 3 && r.siteJsonLido.dados.posts[0].slug === 'terceiro' && r.siteJsonLido.ignorados === 0, JSON.stringify(r.siteJsonLido).slice(0, 200));
  });
  await it('previaCorpo: CSS embutido (sem <link>), imagem local trocada por data: URI (E4)', () => assert(/<style>/.test(r.previa) && !/<link rel="stylesheet"/.test(r.previa) && /src="data:image\/png;base64,AAAA"/.test(r.previa), r.previa.slice(-300)));
  await it('primeiroParagrafo: texto simples do primeiro <p>', () => assert(r.paragrafo === 'Este é o primeiro parágrafo.', r.paragrafo));
  await it('sem erros de página/console', () => assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros })));
  R.push({ nome: `hash do site de exemplo neste motor (comparar entre motores): ${r.shaTotal.slice(0, 16)}`, ok: true, detalhe: r.shaTotal, ms: 0 });
  await p.pg.close();
  return R;
};
