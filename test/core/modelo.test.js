// test/core/modelo.test.js — core/modelo.js dentro da página (sem rede).
const { abrir, coletor, assert } = require('../util.js');

module.exports = async function (ctx, u) {
  const { R, it } = coletor();
  const p = await abrir(ctx, u.url);
  const r = await p.pg.evaluate(() => {
    const out = {};
    out.slug = { a: Modelo.slug('Olá, Mundo!'), b: Modelo.slug('Ação & reação — 2026'), c: Modelo.slug('  --x--  '), d: Modelo.slug(''), e: Modelo.slug(null), f: Modelo.slug('Ünïcödé çà') };
    out.valido = { ok: Modelo.slugValido('meu-artigo-2'), maiusc: Modelo.slugValido('Meu'), espaco: Modelo.slugValido('a b'), hifen: Modelo.slugValido('-a'), duplo: Modelo.slugValido('a--b'), reservados: Modelo.RESERVADOS.map(Modelo.slugValido) };
    out.caminhos = { home: Modelo.caminhoDe('home'), blog: Modelo.caminhoDe('blog'), page: Modelo.caminhoDe('page', 'sobre'), post: Modelo.caminhoDe('post', 'x'), img: Modelo.caminhoDe('img', 'a.png'), media: Modelo.caminhoDe('media', 'b.mp4'), sj: Modelo.caminhoDe('site_json') };
    try { Modelo.caminhoDe('outro'); out.caminhoRuim = false; } catch (e) { out.caminhoRuim = true; }
    out.mime = { png: Modelo.mimePorCaminho('/img/a.PNG'), html: Modelo.mimePorCaminho('/index.html'), nada: Modelo.mimePorCaminho('/sem-extensao'), xyz: Modelo.mimePorCaminho('/a.xyz'), mp4: Modelo.mimePorCaminho('/media/v.mp4') };
    const s = Modelo.sitePadrao('ab'.repeat(32), 'npub1teste');
    out.site = { pubkey: s.pubkey, npub: s.npub, relays: s.network.relays.length, servers: s.network.servers.length, tema: s.theme.id, credito: s.donations.footer_credit, hora: s.privacy.show_publish_time, texto: JSON.stringify(s) };
    const pg = Modelo.novaPagina('Quem Somos'), art = Modelo.novoArtigo('Olá');
    out.pagina = { slug: pg.slug, status: pg.status, menu: pg.in_menu, id: /^[0-9a-f-]{36}$/.test(pg.id), formato: pg.body_format, data: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(pg.created_at) };
    out.artigo = { slug: art.slug, temDate: typeof art.date === 'string', tags: Array.isArray(art.tags), capa: art.cover_media_id === null };
    const hd = Modelo.midiaHerdada('/IntankavelBst.webp', 'c'.repeat(64), ['https://s1']);
    out.herdada = { origin: hd.origin, status: hd.status, bytes: hd.bytes, mime: hd.mime, sha: hd.sha256, servers: hd.servers, size: hd.size };
    const t = (st, acao, prev) => { const r = Modelo.transicao({ status: st, previous_status: prev || null, updated_at: 'x' }, acao); return r ? (r.apagar ? 'apagar' : r.registro.status + (r.registro.previous_status ? '/' + r.registro.previous_status : '')) : 'null'; };
    out.transicoes = {
      editarPub: t('published', 'editar'), editarMod: t('modified', 'editar'), editarDraft: t('draft', 'editar'), editarRem: t('removed', 'editar'),
      pubDraft: t('draft', 'publicar'), pubMod: t('modified', 'publicar'), pubRem: t('removed', 'publicar'), pubPub: t('published', 'publicar'),
      remPub: t('published', 'remover'), remMod: t('modified', 'remover'), remDraft: t('draft', 'remover'),
      excDraft: t('draft', 'excluir'), excPub: t('published', 'excluir'),
      desfazerMod: t('removed', 'desfazer_remocao', 'modified'), desfazerPub: t('removed', 'desfazer_remocao', 'published'), desfazerDraft: t('draft', 'desfazer_remocao'),
      lixo: t('published', 'voar'), nulo: Modelo.transicao(null, 'editar')
    };
    const orig = { status: 'published', updated_at: 'antes' }; const tr = Modelo.transicao(orig, 'editar');
    out.copia = orig.status === 'published' && tr.registro.updated_at !== 'antes';
    const c = Modelo.contarPorStatus([{ status: 'draft' }, { status: 'draft' }, { status: 'published' }, { status: 'modified' }, { status: 'removed' }, { status: 'x' }]);
    out.contagem = { c, pend: Modelo.pendentes(c) };
    out.datas = { d: Modelo.formatarData('2026-08-26T09:15:00Z'), dh: Modelo.formatarDataHora('2026-08-26T09:15:00Z'), lixo: Modelo.formatarData('x'), nulo: Modelo.formatarDataHora(null), unix: Modelo.dataDeUnix(1756200000), agora: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(Modelo.agora()) };
    out.uniao = Modelo.uniao(['wss://a/', 'wss://a', ' wss://b '], null, ['wss://b', 7, 'wss://c//']);
    out.urlSite = Modelo.urlDoSite('npub1x', 'nsite.lol');
    out.congelado = Object.isFrozen(Modelo) && Object.isFrozen(Modelo.RELAYS_PADRAO);
    return out;
  });
  await it('slug: NFD sem diacríticos, minúsculas, hífens (Olá, Mundo! → ola-mundo)', () => assert(r.slug.a === 'ola-mundo' && r.slug.b === 'acao-reacao-2026' && r.slug.c === 'x' && r.slug.d === '' && r.slug.e === '' && r.slug.f === 'unicode-ca', JSON.stringify(r.slug)));
  await it('slugValido: aceita a-z0-9-; recusa maiúsculas, espaço, hífen duplo/inicial e os 9 reservados', () => assert(r.valido.ok && !r.valido.maiusc && !r.valido.espaco && !r.valido.hifen && !r.valido.duplo && r.valido.reservados.every(v => v === false), JSON.stringify(r.valido)));
  await it('caminhoDe: 13 §5.1 (home, blog, page, post, img, media, site.json); tipo desconhecido lança', () => assert(r.caminhos.home === '/index.html' && r.caminhos.blog === '/blog/index.html' && r.caminhos.page === '/sobre.html' && r.caminhos.post === '/blog/x.html' && r.caminhos.img === '/img/a.png' && r.caminhos.media === '/media/b.mp4' && r.caminhos.sj === '/nostermentor/site.json' && r.caminhoRuim, JSON.stringify(r.caminhos)));
  await it('mimePorCaminho: por extensão (maiúscula incluída); null sem extensão/desconhecida', () => assert(r.mime.png === 'image/png' && r.mime.html === 'text/html' && r.mime.nada === null && r.mime.xyz === null && r.mime.mp4 === 'video/mp4', JSON.stringify(r.mime)));
  await it('sitePadrao: 13 §3 — 8 relays, 2 servidores, tema padrao, crédito ligado, hora escondida, sem "nsec" no JSON', () => assert(r.site.relays === 8 && r.site.servers === 2 && r.site.tema === 'padrao' && r.site.credito === true && r.site.hora === false && !/nsec/i.test(r.site.texto) && r.site.npub === 'npub1teste', JSON.stringify(r.site).slice(0, 200)));
  await it('novaPagina / novoArtigo: rascunho, uuid, markdown, datas ISO UTC', () => assert(r.pagina.slug === 'quem-somos' && r.pagina.status === 'draft' && r.pagina.menu && r.pagina.id && r.pagina.formato === 'markdown' && r.pagina.data && r.artigo.slug === 'ola' && r.artigo.temDate && r.artigo.tags && r.artigo.capa, JSON.stringify([r.pagina, r.artigo])));
  await it('midiaHerdada: origin network, published, bytes null, mime por extensão, sha e servers do manifest (13 §4.3)', () => assert(r.herdada.origin === 'network' && r.herdada.status === 'published' && r.herdada.bytes === null && r.herdada.mime === 'image/webp' && r.herdada.sha === 'c'.repeat(64) && r.herdada.servers[0] === 'https://s1' && r.herdada.size === null, JSON.stringify(r.herdada)));
  await it('transicao: a máquina de estados de 13 §4.4 (inclusive desfazer remoção com previous_status)', () => {
    const e = { editarPub: 'modified', editarMod: 'modified', editarDraft: 'draft', editarRem: 'null', pubDraft: 'published', pubMod: 'published', pubRem: 'apagar', pubPub: 'published', remPub: 'removed/published', remMod: 'removed/modified', remDraft: 'null', excDraft: 'apagar', excPub: 'null', desfazerMod: 'modified', desfazerPub: 'published', desfazerDraft: 'null', lixo: 'null', nulo: null };
    const dif = Object.keys(e).filter(k => r.transicoes[k] !== e[k]).map(k => k + '=' + r.transicoes[k] + '≠' + e[k]);
    assert(dif.length === 0, dif.join(', '));
    assert(r.copia, 'transicao alterou o objeto original ou não mexeu no updated_at');
  });
  await it('contarPorStatus / pendentes', () => assert(r.contagem.c.draft === 2 && r.contagem.c.published === 1 && r.contagem.c.modified === 1 && r.contagem.c.removed === 1 && r.contagem.c.total === 6 && r.contagem.pend === 4, JSON.stringify(r.contagem)));
  await it('datas: AAAA-MM-DD / AAAA-MM-DD HH:MM em UTC (T-10); lixo → vazio; dataDeUnix', () => assert(r.datas.d === '2026-08-26' && r.datas.dh === '2026-08-26 09:15' && r.datas.lixo === '' && r.datas.nulo === '' && r.datas.unix === new Date(1756200000 * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z') && r.datas.agora, JSON.stringify(r.datas)));
  await it('uniao: normaliza (barra final, espaços), deduplica, ignora não-strings', () => assert(JSON.stringify(r.uniao) === JSON.stringify(['wss://a', 'wss://b', 'wss://c']), JSON.stringify(r.uniao)));
  await it('urlDoSite e congelamento', () => assert(r.urlSite === 'https://npub1x.nsite.lol/' && r.congelado));
  await it('sem erros de página/console', () => assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros })));
  await p.pg.close();
  return R;
};
