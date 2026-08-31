// test/core/site_json.test.js — leitura do site.json (13 §6) com lista branca.
const { abrir, coletor, assert } = require('../util.js');
const F = require('../fabrica.js');

module.exports = async function (ctx, u) {
  const { R, it } = coletor();
  const p = await abrir(ctx, u.url);
  const ch = F.chave();
  const bom = F.siteExemplo(ch, { relays: ['wss://r1', 'ws://inseguro', 'lixo', 'wss://r2/'], servers: ['https://s1/', 'http://s2'] }).texto;
  const sujo = F.siteExemplo(ch, { mutar: (d) => {
    d.site.nsec = 'nsec1nao'; d.site.evil = { x: 1 }; d.site.menu = [{ type: 'link', label: 'x', href: 'javascript:alert(1)' }, { type: 'link', label: 'ok', href: 'https://x.y' }, { type: 'page', page_id: 'p-home' }, { type: 'bogus' }];
    d.pages.push({ id: 'sem-slug', title: 'x' }); d.pages.push({ id: 'p-home', slug: 'dup', title: 'duplicado' }); d.posts.push({ slug: 'sem-id', title: 'x' });
    d.media.push({ id: 'm-2', path: 'sem-barra.png', sha256: 'a'.repeat(64) }); d.media.push({ id: 'm-3', path: '/x.png', sha256: 'curto' });
    d.pages[0].evil = 'x'; d.pages[0].status = 'draft'; d.pages[0].in_menu = 'sim';
  } }).texto;
  const v2 = F.siteExemplo(ch, { version: 2 }).texto;
  const r = await p.pg.evaluate(([bom, sujo, v2]) => {
    const out = {};
    const a = SiteJson.ler(bom);
    out.bom = { ok: a.ok, pages: a.dados.pages.length, posts: a.dados.posts.length, media: a.dados.media.length, ignorados: a.ignorados, titulo: a.dados.site.title, relays: a.dados.site.network.relays, servers: a.dados.site.network.servers, home: a.dados.site.home, tags: a.dados.posts[0].tags, aliases: a.dados.pages[1].aliases, tema: a.dados.theme };
    const b = SiteJson.ler(sujo);
    out.sujo = { ok: b.ok, chaves: Object.keys(b.dados.site).sort(), menu: b.dados.site.menu, pages: b.dados.pages.length, posts: b.dados.posts.length, media: b.dados.media.length, ignorados: b.ignorados, pagChaves: Object.keys(b.dados.pages[0]).sort(), inMenu: b.dados.pages[0].in_menu, texto: JSON.stringify(b.dados) };
    out.v2 = SiteJson.ler(v2);
    out.json = SiteJson.ler('{nope');
    out.formato = SiteJson.ler(JSON.stringify({ format: 'outro', version: 1 }));
    out.estrutura = SiteJson.ler(JSON.stringify({ format: 'nostermentor-site', version: 0 }));
    out.vazio = SiteJson.ler(JSON.stringify({ format: 'nostermentor-site', version: 1 }));
    out.array = SiteJson.ler('[1,2]');
    try { SiteJson.decodificar(new Uint8Array([0xff, 0xfe, 0xc0])); out.utf8 = 'nao lancou'; } catch (e) { out.utf8 = 'lancou'; }
    out.decod = SiteJson.decodificar(new TextEncoder().encode('{"a":"é"}'));
    out.constantes = { caminho: SiteJson.CAMINHO, formato: SiteJson.FORMATO, igualModelo: SiteJson.CAMINHO === Modelo.CAMINHO_SITE_JSON };
    return out;
  }, [bom, sujo, v2]);
  await it('site.json válido: 2 páginas, 3 artigos, 1 mídia; relays só wss:, servidores só https:, sem barra final', () => assert(r.bom.ok && r.bom.pages === 2 && r.bom.posts === 3 && r.bom.media === 1 && r.bom.ignorados === 0 && r.bom.titulo === 'Site de Teste' && JSON.stringify(r.bom.relays) === '["wss://r1","wss://r2"]' && JSON.stringify(r.bom.servers) === '["https://s1"]' && r.bom.home.mode === 'page' && r.bom.home.page_id === 'p-home' && r.bom.tags[0] === 'nostr' && r.bom.aliases[0] === 'quem-somos' && r.bom.tema.id === 'padrao', JSON.stringify(r.bom)));
  await it('lista branca: campos desconhecidos (nsec, evil, status) caem; menu com javascript:/bogus cai; registros sem id/slug/sha inválido caem e contam em `ignorados`; id duplicado cai', () => {
    assert(r.sujo.ok, 'não leu');
    assert(!r.sujo.chaves.includes('nsec') && !r.sujo.chaves.includes('evil'), 'campos estranhos passaram: ' + r.sujo.chaves.join(','));
    assert(!/nsec1nao|evil|javascript:/.test(r.sujo.texto), 'conteúdo sujo passou');
    assert(r.sujo.menu.length === 2 && r.sujo.menu[0].type === 'link' && r.sujo.menu[1].type === 'page', JSON.stringify(r.sujo.menu));
    assert(r.sujo.pages === 2 && r.sujo.posts === 3 && r.sujo.media === 1 && r.sujo.ignorados === 5, JSON.stringify([r.sujo.pages, r.sujo.posts, r.sujo.media, r.sujo.ignorados]));
    assert(!r.sujo.pagChaves.includes('status') && !r.sujo.pagChaves.includes('evil') && r.sujo.inMenu === false, r.sujo.pagChaves.join(','));
  });
  await it('versão maior → recusa com codigo versao_maior e a mensagem de 13 §7.4', () => assert(!r.v2.ok && r.v2.codigo === 'versao_maior' && /Nostermentor mais novo/.test(r.v2.motivo), JSON.stringify(r.v2)));
  await it('JSON inválido / formato errado / versão 0 / array → recusa sem lançar; objeto mínimo válido → 0 registros', () => assert(r.json.codigo === 'json' && r.formato.codigo === 'formato' && r.estrutura.codigo === 'estrutura' && r.array.codigo === 'formato' && r.vazio.ok && r.vazio.dados.pages.length === 0, JSON.stringify([r.json, r.formato, r.estrutura, r.array, r.vazio.ok])));
  await it('decodificar: UTF-8 estrito (bytes inválidos lançam)', () => assert(r.utf8 === 'lancou' && r.decod === '{"a":"é"}', r.utf8));
  await it('constantes: CAMINHO = /nostermentor/site.json = Modelo.CAMINHO_SITE_JSON', () => assert(r.constantes.igualModelo && r.constantes.formato === 'nostermentor-site'));
  // 35 — a capa da PÁGINA é dado: o tema padrão não a desenha, mas ela tem de
  // sobreviver ao ida-e-volta pelo site.json. Sem os DOIS lados (escrever e
  // ler) a capa some assim que o dono reconstrói o site noutra máquina.
  const capa = await p.pg.evaluate(async () => {
    const pag = Modelo.novaPagina('Sobre');
    pag.cover_media_id = 'm-capa';
    const site = Modelo.sitePadrao('a'.repeat(64), 'npub1teste');
    site.title = 'Site'; site.description = 'd';
    const midia = { id: 'm-capa', path: '/img/c.jpg', mime: 'image/jpeg', size: 10,
      sha256: 'b'.repeat(64), width: 800, height: 600, alt: 'capa', caption: '' };
    const texto = SiteJson.escrever({ site: site, pages: [pag], posts: [], media: [midia] });
    const lido = SiteJson.ler(texto);
    // e o tema padrão NÃO a desenha na página (decisão do dono, 2026-08-31),
    // enquanto o do artigo continua a aparecer
    const dados = { site: site, pages: [pag], posts: [], media: [midia] };
    const htmlPag = Gerador.htmlDe(dados, pag, 'page');
    const art = Modelo.novoArtigo('Um artigo'); art.cover_media_id = 'm-capa'; art.date = '2026-08-01T00:00:00Z';
    const htmlArt = Gerador.htmlDe({ site: site, pages: [], posts: [art], media: [midia] }, art, 'post');
    return {
      nascePreenchido: 'cover_media_id' in Modelo.novaPagina('X'),
      noJson: /"cover_media_id":"m-capa"/.test(texto),
      voltou: lido.ok ? lido.dados.pages[0].cover_media_id : null,
      paginaSemFigura: !/<figure class="capa"/.test(htmlPag),
      artigoComFigura: /<figure class="capa"/.test(htmlArt)
    };
  });
  await it('35: a capa da página nasce no registro, entra no site.json e volta dele — sem os dois lados não sobrevive a reconstruir pela rede', () =>
    assert(capa.nascePreenchido && capa.noJson && capa.voltou === 'm-capa', JSON.stringify(capa)));
  await it('35: o tema Padrão NÃO desenha a capa na página (é dado para os temas que virão), mas continua a desenhá-la no artigo', () =>
    assert(capa.paginaSemFigura && capa.artigoComFigura, JSON.stringify(capa)));

  await it('sem erros de página/console', () => assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros })));
  await p.pg.close();
  return R;
};
