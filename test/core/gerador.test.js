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
    // 06 §4: imagem clicável, sem script. Quatro casos numa tacada: local,
    // já linkada pelo dono, data: URI e externa.
    out.clicavel = Gerador.renderizarCorpo('![a](/img/capa.png)\n\n[![b](/img/capa.png)](https://destino.test/)\n\n![c](data:image/png;base64,AAAA)\n\n![d](https://fora.test/x.png)');
    // --- 24: o CSS virou molde --------------------------------------------
    const OPC = { esquema: 'escuro', cor_destaque: '#FF0000', fonte_texto: 'sem-serifa', fonte_titulos: 'igual', tamanho_texto: 'grande', largura: 'larga', cantos: 'arredondados', altura_logo: 60 };
    out.cssPadrao = TemaPadrao.css({});
    out.cssEscuro = TemaPadrao.css(OPC);
    out.cssDeterminista = TemaPadrao.css(OPC) === TemaPadrao.css(JSON.parse(JSON.stringify(OPC)));
    // valor que não bate com o manifesto: cai no padrão. A `cor_destaque` aqui
    // é uma tentativa de INJEÇÃO de CSS — se passasse, a folha do leitor
    // buscaria um pixel ao servidor de quem a escreveu (02 G.2.4).
    out.cssLixo = TemaPadrao.css({ esquema: 'roxo', cor_destaque: '#fff;background:url(https://mau.test/p.gif)', tamanho_texto: 42, altura_logo: 900, largura: '"><style>' });
    out.resolvidoLixo = TemaPadrao.resolver({ esquema: 'roxo', cor_destaque: 'red', altura_logo: 900 });
    // a cor que o dono escolhe pode ficar ilegível sobre o fundo do esquema:
    // o tema afasta-a antes de a usar em texto, e mantém a cor cheia no botão
    out.cssAcentoEscuro = TemaPadrao.css({ esquema: 'escuro', cor_destaque: '#001133' });
    out.cssAcentoClaro = TemaPadrao.css({ esquema: 'claro', cor_destaque: '#fffbe6' });
    // nenhuma combinação pode gerar recurso externo (G.2.4)
    const M = TemaPadrao.manifesto.options;
    out.combinacoes = 0; out.combinacoesLimpas = 0;
    for (const esq of M.esquema.opcoes.map(x => x[0]))
      for (const ft of M.fonte_texto.opcoes.map(x => x[0]))
        for (const fh of M.fonte_titulos.opcoes.map(x => x[0]))
          for (const ct of M.cantos.opcoes.map(x => x[0])) {
            const c = TemaPadrao.css({ esquema: esq, fonte_texto: ft, fonte_titulos: fh, cantos: ct, cor_destaque: '#123456' });
            out.combinacoes++; if (!/url\(|@import|https?:/.test(c)) out.combinacoesLimpas++;
          }
    // 13 §5.3: mexer só numa cor muda a folha de estilo (e o site.json), não as páginas
    const d6 = JSON.parse(JSON.stringify(dados)); d6.site.theme.options = { cor_destaque: '#8a2be2' };
    const g7 = await Gerador.gerarSite(d6);
    out.mudouOpcao = Object.keys(g1.hashes).filter(k => g1.hashes[k] !== g7.hashes[k]).sort();

    // --- 38: o logo no cabeçalho -------------------------------------------
    const d7 = JSON.parse(JSON.stringify(dados)); d7.site.logo_media_id = 'm-1';
    const g8 = await Gerador.gerarSite(d7);
    out.comLogo = g8.arquivos.find(a => a.path === '/index.html').texto;
    out.mudouLogo = Object.keys(g1.hashes).filter(k => g1.hashes[k] !== g8.hashes[k] && /\.html$/.test(k)).length;
    const d8 = JSON.parse(JSON.stringify(dados)); d8.site.logo_media_id = 'nao-existe';
    out.logoFantasma = (await Gerador.gerarSite(d8)).arquivos.find(a => a.path === '/index.html').texto;
    const d9 = JSON.parse(JSON.stringify(dados)); d9.site.logo_media_id = 'm-1'; d9.media[0].width = null; d9.media[0].height = null;
    out.logoSemMedidas = (await Gerador.gerarSite(d9)).arquivos.find(a => a.path === '/index.html').texto;

    // O ícone da aba (favicon): o campo é do SITE e o `<link>` vive no molde
    // compartilhado, logo tem de sair em TODA página e em TODO tema.
    const dF = JSON.parse(JSON.stringify(dados)); dF.site.favicon_media_id = 'm-1';
    const gF = await Gerador.gerarSite(dF);
    out.comFavicon = gF.arquivos.find(a => a.path === '/index.html').texto;
    const temIcone = (t) => /<link rel="icon" href="\/img\/capa\.png" type="image\/png">/.test(t);
    out.htmlSemIcone = gF.arquivos.filter(a => /\.html$/.test(a.path) && !temIcone(a.texto)).map(a => a.path);
    out.htmlComIcone = gF.arquivos.filter(a => /\.html$/.test(a.path) && temIcone(a.texto)).length;
    out.semIconeSaoRedirects = gF.arquivos.filter(a => /\.html$/.test(a.path) && !temIcone(a.texto)).every(a => /http-equiv="refresh"/.test(a.texto));
    // O `<link>` está no molde compartilhado, mas isso é uma AFIRMAÇÃO sobre
    // os 21 temas — mede-se nos 21, não no Padrão. (A lição do t12: um teste
    // escrito contra um caso fixa o que era acidente.)
    out.temas = Temas.todos().length;
    out.temasSemFavicon = [];
    for (const t of Temas.todos()) {
      const d = JSON.parse(JSON.stringify(dF));
      d.site.theme = { id: t.manifesto.id, version: t.manifesto.version, options: {} };
      const g = await Gerador.gerarSite(d);
      const html = g.arquivos.filter(a => /\.html$/.test(a.path));
      const conteudo = html.filter(a => !/http-equiv="refresh"/.test(a.texto));
      if (!conteudo.length || !conteudo.every(a => temIcone(a.texto))) out.temasSemFavicon.push(t.manifesto.id);
    }
    // ícone escolhido que não existe na biblioteca → nenhum <link>, e não um
    // <link> apontando para o vazio (custaria um pedido a cada leitor).
    const dG = JSON.parse(JSON.stringify(dados)); dG.site.favicon_media_id = 'nao-existe';
    out.faviconFantasma = (await Gerador.gerarSite(dG)).arquivos.find(a => a.path === '/index.html').texto;
    // Dentro da prévia o caminho `/img/…` não existe: o ícone tem de sair.
    out.previaComFavicon = Gerador.previa(out.comFavicon, {}, {}, null);
    // ⚠️ A assinatura da configuração fica guardada em `published.site_config`
    // desde a última publicação. Um campo novo INCONDICIONAL a mudaria para
    // todo site já publicado — "Configurações alteradas" para quem não mexeu
    // em nada, e republicação pelo Tor de um HTML idêntico. Por isso o campo
    // só entra quando existe.
    out.assinaturaSemIcone = SiteJson.assinaturaSite(dados.site);
    out.assinaturaComIcone = SiteJson.assinaturaSite(dF.site);
    out.siteJsonComIcone = Object.keys(JSON.parse((await Gerador.gerarSite(dF)).arquivos.find(a => a.path === '/nostermentor/site.json').texto).site).join(',');

    out.shaTotal = await Gerador.sha256Hex(new TextEncoder().encode(g1.arquivos.map(a => a.path + ':' + a.sha256).join('\n')));
    return out;
  });
  // 40 — as duas páginas de etiqueta entram nesta lista de propósito: a partir
  // desta versão cada etiqueta usada por um artigo publicável é um arquivo.
  const esperados = ['/blog/antigo-segundo.html', '/blog/etiqueta/nostr.html', '/blog/etiqueta/teste.html', '/blog/index.html', '/blog/primeiro-artigo.html', '/blog/segundo-artigo.html', '/blog/terceiro.html', '/index.html', '/nostermentor/site.json', '/oculta.html', '/quem-somos.html', '/sobre-nos.html', '/tema/estilo.css'];
  await it('caminhos de 13 §5.1: home, páginas (a Home só em /index.html), aliases, /blog/index.html, artigos, alias de artigo, página por etiqueta (40), CSS do tema, site.json; removida fora', () => assert(JSON.stringify(r.caminhos) === JSON.stringify(esperados), JSON.stringify(r.caminhos)));
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
  await it('o ícone da aba (favicon): sai em TODA página HTML e nos 21 temas, com o `type` do arquivo real; ícone que não existe não gera <link> nenhum; e a prévia não o carrega', () => {
    assert(/<link rel="icon" href="\/img\/capa\.png" type="image\/png">/.test(r.comFavicon), 'sem <link rel=icon>: ' + r.comFavicon.slice(0, 400));
    // As ÚNICAS páginas sem ícone podem ser as de redirecionamento: elas só
    // existem para saltar para outro endereço e ninguém as vê. Pôr o ícone
    // ali custaria a cada leitor um pedido por uma aba que dura um piscar.
    assert(r.semIconeSaoRedirects, 'há página de conteúdo sem o ícone: ' + r.htmlSemIcone.join(','));
    assert(r.htmlComIcone > 0, 'nenhuma página ficou com o ícone');
    assert(r.temas >= 21, 'esperava ao menos 21 temas registrados, veio ' + r.temas);
    assert(r.temasSemFavicon.length === 0, 'temas sem o ícone: ' + r.temasSemFavicon.join(','));
    // Sem ícone escolhido (o caso de todo site que existe hoje) não pode
    // aparecer <link rel=icon> nenhum, senão todo leitor paga um pedido.
    assert(!/rel="icon"/.test(r.sobre) && !/rel="icon"/.test(r.home), 'site sem ícone ganhou <link rel=icon>');
    assert(!/rel="icon"/.test(r.faviconFantasma), 'ícone inexistente virou <link> para o vazio');
    assert(!/rel="icon"/.test(r.previaComFavicon), 'a prévia carrega o ícone, e o caminho não existe dentro dela');
    // Compatibilidade da assinatura: site sem ícone não pode ganhar o campo.
    assert(r.assinaturaSemIcone.indexOf('favicon_media_id') === -1, 'o campo novo entrou na assinatura de um site SEM ícone — todo site publicado diria "configurações alteradas"');
    assert(r.assinaturaComIcone.indexOf('favicon_media_id') > -1, 'o campo não entra na assinatura nem quando há ícone');
    assert(r.siteJsonComIcone === 'pubkey,npub,title,description,language,profile,logo_media_id,home,blog,menu,theme,donations,privacy,favicon_media_id,network', r.siteJsonComIcone);
    return r.temas + ' temas, todos com o ícone em todas as páginas; sem ícone não sai <link> nem muda a assinatura';
  });

  await it('home em modo página: corpo + "últimos artigos" (2) com link para o blog; oculta (in_menu=false) fora do menu mas publicada', () => {
    assert(/Bem-vindo ao <strong>site<\/strong>/.test(r.home) && /class="ultimos"/.test(r.home) && (r.home.match(/<li><a href="\/blog\//g) || []).length === 2 && /Todos os artigos/.test(r.home), r.home.slice(r.home.indexOf('<main'), r.home.indexOf('</main>')));
    assert(!/Oculta/.test(r.home.slice(r.home.indexOf('<nav'), r.home.indexOf('</nav>'))) && r.caminhos.includes('/oculta.html'), 'oculta');
  });
  await it('artigo: data só AAAA-MM-DD no texto E no datetime (T-10), etiquetas, capa com alt/legenda/dimensões; com show_publish_time a hora aparece', () => {
    assert(/<time datetime="2026-08-01">2026-08-01<\/time>/.test(r.a1) && !/10:20/.test(r.a1), 'hora vazou: ' + r.a1.slice(r.a1.indexOf('<p class="meta"'), r.a1.indexOf('<p class="meta"') + 200));
    // 40 — a etiqueta passou de <span> a <a> para a página dela.
    assert(/<a class="etiqueta" href="\/blog\/etiqueta\/nostr\.html">nostr<\/a>/.test(r.a1) && /<img src="\/img\/capa\.png" alt="A capa" width="10" height="5">/.test(r.a1) && /<figcaption>Legenda<\/figcaption>/.test(r.a1), 'etiquetas/capa');
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
  await it('24: o CSS é molde — cada opção do manifesto vira variável, e as mesmas opções dão sempre os mesmos bytes (13 §5.2)', () => {
    // o padrão tem de ficar EXATAMENTE como estava: o azul já se lê sobre o
    // fundo claro, e um site que nunca abriu a aba Aparência não pode mudar de cor
    assert(/--acento:#2271b1;--acento-legivel:#2271b1/.test(r.cssPadrao) && /--fundo:#fbfbfa/.test(r.cssPadrao) && /--logo-altura:44px/.test(r.cssPadrao), r.cssPadrao.slice(0, 400));
    assert(/--fundo:#16181d/.test(r.cssEscuro) && /--acento:#ff0000/.test(r.cssEscuro) && /--largura:900px/.test(r.cssEscuro) && /--base:19px/.test(r.cssEscuro) && /--logo-altura:60px/.test(r.cssEscuro) && /--canto:6px/.test(r.cssEscuro), r.cssEscuro.slice(0, 500));
    assert(r.cssDeterminista, 'as mesmas opções deram bytes diferentes');
  });
  await it('24 (02 G.0/G.2.4): opção que não bate com o manifesto é DESCARTADA — injeção de CSS não chega à folha do leitor', () => {
    assert(!/mau\.test|url\(|@import|<style/.test(r.cssLixo), r.cssLixo.slice(0, 500));
    assert(/--acento:#2271b1/.test(r.cssLixo) && /--fundo:#fbfbfa/.test(r.cssLixo) && /--logo-altura:44px/.test(r.cssLixo) && /--largura:700px/.test(r.cssLixo), 'não voltou ao padrão');
    assert(r.resolvidoLixo.esquema === 'claro' && r.resolvidoLixo.cor_destaque === '#2271b1' && r.resolvidoLixo.altura_logo === 44, JSON.stringify(r.resolvidoLixo));
  });
  await it('24: a cor escolhida pelo dono nunca fica ilegível — o link afasta-se do fundo, o botão fica com a cor cheia e o texto contrasta', () => {
    const escuro = /--acento-legivel:(#[0-9a-f]{6})/.exec(r.cssAcentoEscuro);
    const claro = /--acento-legivel:(#[0-9a-f]{6})/.exec(r.cssAcentoClaro);
    assert(escuro && escuro[1] !== '#001133' && /--acento:#001133/.test(r.cssAcentoEscuro), 'azul quase preto sobre fundo escuro: ' + (escuro && escuro[1]));
    assert(claro && claro[1] !== '#fffbe6' && /--acento:#fffbe6/.test(r.cssAcentoClaro), 'creme sobre fundo claro: ' + (claro && claro[1]));
    assert(/--acento-texto:#111111/.test(r.cssAcentoClaro) && /--acento-texto:#ffffff/.test(r.cssAcentoEscuro), 'texto do botão');
  });
  await it('24: nenhuma combinação de esquema, letras e cantos produz recurso externo (G.2.4)', () => assert(r.combinacoes === 36 && r.combinacoesLimpas === 36, r.combinacoesLimpas + ' de ' + r.combinacoes));
  await it('24 (13 §5.3): mexer só numa cor muda a folha de estilo e o site.json — nenhuma página', () => assert(JSON.stringify(r.mudouOpcao) === JSON.stringify(['/nostermentor/site.json', '/tema/estilo.css']), JSON.stringify(r.mudouOpcao)));
  await it('38: o logo substitui o título no cabeçalho e leva o título no alt; mídia inexistente volta ao texto; e o logo muda todas as páginas (menos os stubs de alias)', () => {
    assert(/<a class="marca marca-logo" href="\/index\.html"><img src="\/img\/capa\.png" alt="Meu Site" width="10" height="5"><\/a>/.test(r.comLogo), (/<header[\s\S]*?<\/header>/.exec(r.comLogo) || [''])[0]);
    assert(!/marca-logo/.test(r.home) && /<a class="marca" href="\/index\.html">Meu Site<\/a>/.test(r.home), 'sem logo, o cabeçalho é o título em texto');
    assert(/<a class="marca" href="\/index\.html">Meu Site<\/a>/.test(r.logoFantasma) && !/marca-logo/.test(r.logoFantasma), 'mídia inexistente devia voltar ao texto');
    assert(/<img src="\/img\/capa\.png" alt="Meu Site">/.test(r.logoSemMedidas), 'sem width/height medidos, o img sai sem os atributos: ' + (/<header[\s\S]*?<\/header>/.exec(r.logoSemMedidas) || [''])[0]);
    assert(r.mudouLogo === r.totalHtml - 2, r.mudouLogo + ' de ' + r.totalHtml);
  });
  await it('site.json (13 §6.1): chaves na ordem, sem rascunhos removidos, sem herdados, sem created_at/updated_at/status; SiteJson.ler lê de volta com os mesmos ids', () => {
    const j = JSON.parse(r.siteJsonTexto);
    assert(Object.keys(j).join(',') === 'format,version,site,pages,posts,media,theme', Object.keys(j).join(','));
    assert(Object.keys(j.site).join(',') === 'pubkey,npub,title,description,language,profile,logo_media_id,home,blog,menu,theme,donations,privacy,network', Object.keys(j.site).join(','));
    assert(j.pages.length === 3 && j.posts.length === 3 && j.media.length === 1 && j.media[0].id === 'm-1', JSON.stringify([j.pages.length, j.posts.length, j.media.map(m => m.id)]));
    assert(!/created_at|updated_at|"status"|published_hash|bytes/.test(r.siteJsonTexto), 'campos locais vazaram');
    assert(r.siteJsonLido.ok && r.siteJsonLido.dados.pages.length === 3 && r.siteJsonLido.dados.posts[0].slug === 'terceiro' && r.siteJsonLido.ignorados === 0, JSON.stringify(r.siteJsonLido).slice(0, 200));
  });
  await it('06 §4: imagem do corpo vira link para o arquivo (nova aba, sem script); a que o dono já linkou fica com o link dele; data: e a capa', () => {
    const c = r.clicavel;
    assert(/<a class="ampliar" href="\/img\/capa\.png" target="_blank" rel="noopener"><img src="\/img\/capa\.png" alt="a"><\/a>/.test(c), 'local: ' + c);
    assert(/<a href="https:\/\/destino\.test\/"><img src="\/img\/capa\.png" alt="b"><\/a>/.test(c) && !/ampliar[^>]*><a href="https:\/\/destino/.test(c), 'link do dono perdido ou duplicado: ' + c);
    assert(/<img src="data:image\/png;base64,AAAA" alt="c">/.test(c) && !/href="data:/.test(c), 'data: virou link: ' + c);
    assert(/<a class="ampliar" href="https:\/\/fora\.test\/x\.png" target="_blank" rel="noopener"><img src="https:\/\/fora\.test\/x\.png"/.test(c), 'externa: ' + c);
    assert((c.match(/class="ampliar"/g) || []).length === 2, 'devia envolver exatamente 2 das 4: ' + c);
    // a capa do artigo também abre, e nada disto traz <script> ao site publicado
    assert(/<figure class="capa"><a class="ampliar" href="\/img\/capa\.png" target="_blank" rel="noopener"><img src="\/img\/capa\.png" alt="A capa" width="10" height="5"><\/a>/.test(r.a1), 'capa: ' + r.a1.slice(r.a1.indexOf('<figure'), r.a1.indexOf('<figure') + 260));
    assert(!/<script/i.test(r.a1) && !/<script/i.test(r.home) && !/<script/i.test(r.blog), 'script no site publicado');
  });
  await it('previaCorpo: CSS embutido (sem <link>), imagem local trocada por data: URI (E4)', () => assert(/<style>/.test(r.previa) && !/<link rel="stylesheet"/.test(r.previa) && /src="data:image\/png;base64,AAAA"/.test(r.previa), r.previa.slice(-300)));
  await it('primeiroParagrafo: texto simples do primeiro <p>', () => assert(r.paragrafo === 'Este é o primeiro parágrafo.', r.paragrafo));
  // 12 — a troca de tema: `site.theme.id` escolhe; desconhecido cai no
  // Padrão; e TODO tema registado cumpre o que TEMAS.md exige do pacote —
  // 8 moldes, CSS sem recurso externo, bytes determinísticos, opções
  // inválidas descartadas (as mesmas provas que o Padrão já dava).
  const rt = await p.pg.evaluate(async () => {
    const out = { temas: {}, ids: Temas.todos().map(t => t.manifesto.id) };
    const site = Modelo.sitePadrao('a'.repeat(64), 'npub1teste'); site.title = 'Meu Site';
    const capa = { id: 'm-capa', path: '/img/capa.png', mime: 'image/png', size: 4, sha256: 'b'.repeat(64), width: 1600, height: 900, alt: 'Capa', caption: 'Legenda', bytes: null, status: 'published', servers: [], removal: null, metadata: { stripped: true, removed_segments: [], warning: null }, origin: 'upload', created_at: Modelo.agora(), updated_at: Modelo.agora(), previous_status: null };
    const pg = Modelo.novaPagina('Sobre'); pg.id = 'p-1'; pg.status = 'published'; pg.body = 'Olá.\n\n[[botao: Fale -> /contato]]\n\n[[artigos: 2, com-capa]]'; pg.cover_media_id = 'm-capa';
    const a1 = Modelo.novoArtigo('Um'); a1.id = 'a-1'; a1.date = '2026-08-01T00:00:00Z'; a1.body = 'Corpo um.'; a1.tags = ['receitas']; a1.cover_media_id = 'm-capa'; a1.status = 'published';
    const a2 = Modelo.novoArtigo('Dois'); a2.id = 'a-2'; a2.date = '2026-08-02T00:00:00Z'; a2.body = 'Corpo dois.'; a2.tags = ['receitas']; a2.status = 'published';
    site.home = { mode: 'page', page_id: 'p-1', latest_posts: 2 };
    const MOLDES = ['layout', 'pagina', 'artigo', 'blog', 'etiqueta', 'alias', 'botao', 'galeria'];
    for (const tema of Temas.todos()) {
      const id = tema.manifesto.id, m = tema.manifesto;
      const dados = { site: Object.assign({}, site, { theme: { id: id, version: m.version, options: {} } }), pages: [pg], posts: [a1, a2], media: [capa] };
      const g = await Gerador.gerarSite(dados);
      const d2 = JSON.parse(JSON.stringify(dados)); d2.posts.reverse();
      const g2 = await Gerador.gerarSite(d2);
      const css = g.arquivos.find(a => a.path === '/tema/estilo.css').texto;
      // lixo em TODAS as opções do manifesto
      const lixo = {}; for (const n of Object.keys(m.options)) lixo[n] = '"><style>@import url(https://mau.test/x)';
      const cssLixo = tema.css(lixo), cssPadrao = tema.css({});
      const resolvido = tema.resolver(lixo);
      out.temas[id] = {
        moldes: MOLDES.filter(k => typeof tema.templates[k] === 'string' && tema.templates[k].length > 10).length,
        marcador: new RegExp('tema ' + m.nome + ' v' + m.version).test(css),
        limpo: !/url\(|@import|https?:/.test(css) && !/url\(|@import|https?:|mau\.test|<style/.test(cssLixo),
        lixoVoltaAoPadrao: cssLixo === cssPadrao,
        resolvidoTodos: Object.keys(m.options).every(n => resolvido[n] === m.options[n].padrao),
        determinista: JSON.stringify(g.hashes) === JSON.stringify(g2.hashes),
        caminhos: g.arquivos.map(a => a.path).sort().join(' '),
        // `\son[a-z]+=`: atributo de evento, não o "on" de dentro de `content=`
        semScript: g.arquivos.filter(a => a.mime === 'text/html').every(a => !/<script|\son[a-z]+=|javascript:/i.test(a.texto)),
        classes: ['cabecalho', 'marca', 'menu', 'principal', 'rodape', 'pagina', 'artigo', 'blog', 'lista-artigos', 'cta', 'botao', 'galeria', 'cartoes', 'cartao'].filter(c => !g.arquivos.some(a => a.mime === 'text/html' && a.texto.indexOf('class="' + c) === -1 && new RegExp('class="[^"]*\\b' + c + '\\b').test(a.texto))).length,
        home: g.arquivos.find(a => a.path === '/index.html').texto
      };
    }
    const gx = await Gerador.gerarSite({ site: Object.assign({}, site, { theme: { id: 'nao-existe', version: 9, options: {} } }), pages: [pg], posts: [a1, a2], media: [capa] });
    out.desconhecidoCaiNoPadrao = /tema Padrão v4/.test(gx.arquivos.find(a => a.path === '/tema/estilo.css').texto);
    out.previaJornal = /tema Jornal v1/.test(Gerador.previa('<link rel="stylesheet" href="/tema/estilo.css">', {}, {}, Temas.porId('jornal')));
    out.previaSemTema = /tema Padrão v4/.test(Gerador.previa('<link rel="stylesheet" href="/tema/estilo.css">', {}, {}));
    return out;
  });
  await it('12: TODO tema registado (Padrão primeiro) tem 8 moldes, CSS limpo, lixo descartado, bytes determinísticos e HTML sem script; id desconhecido cai no Padrão; a prévia usa o tema pedido', () => {
    // Sem lista fixa de ids, de propósito: um tema novo entra nesta prova só
    // por se registar (TEMAS.md §2), e uma lista escrita à mão aqui era o que
    // obrigava a mexer no teste a cada tema. O que se exige é a REGRA — o
    // Padrão primeiro, os restantes por id — e que os quatro originais não
    // desapareçam sem que alguém dê por isso.
    assert(rt.ids[0] === 'padrao', 'o Padrão tem de vir primeiro: ' + rt.ids.join(','));
    const resto = rt.ids.slice(1);
    assert(resto.join(',') === resto.slice().sort().join(','), 'os outros temas vêm por id: ' + resto.join(','));
    assert(new Set(rt.ids).size === rt.ids.length, 'há ids repetidos: ' + rt.ids.join(','));
    for (const id of ['padrao', 'diario', 'jornal', 'moderno']) assert(rt.ids.indexOf(id) !== -1, 'o tema ' + id + ' deixou de estar registado');
    for (const id of rt.ids) {
      const t = rt.temas[id];
      assert(t.moldes === 8, id + ': ' + t.moldes + ' moldes');
      assert(t.marcador, id + ': o CSS não tem o comentário de versão');
      assert(t.limpo, id + ': CSS com recurso externo ou lixo');
      assert(t.lixoVoltaAoPadrao && t.resolvidoTodos, id + ': opção inválida não voltou ao padrão');
      assert(t.determinista, id + ': bytes diferentes em ordem diferente');
      assert(t.semScript, id + ': HTML com script');
      assert(/class="pagina"|class="pagina /.test(t.home) && /class="menu"/.test(t.home) && /class="botao"/.test(t.home) && /class="cartoes"/.test(t.home) && /<a class="marca/.test(t.home), id + ': classes de contrato em falta na capa');
    }
    for (const id of rt.ids) assert(rt.temas[id].caminhos === rt.temas.padrao.caminhos, 'os caminhos gerados não podem depender do tema — ' + id + ' difere do padrao');
    assert(rt.desconhecidoCaiNoPadrao, 'id desconhecido devia cair no Padrão');
    assert(rt.previaJornal && rt.previaSemTema, 'previa(html, uris, opcoes, tema)');
    return rt.ids.length + ' temas (' + rt.ids.join(', ') + ') — 8 moldes, CSS limpo e determinístico em todos';
  });
  await it('sem erros de página/console', () => assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros })));
  R.push({ nome: `hash do site de exemplo neste motor (comparar entre motores): ${r.shaTotal.slice(0, 16)}`, ok: true, detalhe: r.shaTotal, ms: 0 });
  await p.pg.close();
  return R;
};
