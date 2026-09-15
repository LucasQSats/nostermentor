// test/core/externos.test.js — `Gerador.externos`, o juiz do aviso da tela
// Publicar: o que no HTML publicado faz o navegador de QUEM LÊ falar com outro
// servidor sem clicar em nada (e o formulário, que envia ao clicar).
// A tabela abaixo não é lista de desejos. A coluna do meio é o corpo como o
// dono escreve; o esperado vem do que o Firefox e o Chrome FIZERAM em
// 2026-09-15 com esse corpo, depois do mesmo filtro da publicação, servido como
// se fosse o gateway (35 casos). Nos dois motores igual, salvo `http:` e
// `<picture>`, que só um dos dois buscou — e entram mesmo assim. O vídeo com
// `preload="none"` e o `<track>` não buscaram ao abrir; buscam ao dar play, e
// entram também.
// O juiz tem de acusar TUDO o que buscou (um aviso que cala é pior do que
// nenhum) e não pode acusar link, endereço local, `data:` nem o que o filtro já
// removeu. Depois, o outro lado da balança: um site com links para fora, botão,
// contatos, convite Nostr, galeria, logo e ícone dá ZERO achados em TODOS os
// temas registrados.
const { abrir, coletor, assert } = require('../util.js');

const X = 'https://externo.test/';
// [id, corpo, esperado: 'carrega' | 'envia' | '']
const CASOS = [
  ['md-imagem', '![a](' + X + 'md.png)', 'carrega'],
  ['img-src', '<img src="' + X + 'img.png" alt="a">', 'carrega'],
  ['img-http', '<img src="http://externo.test/http.png" alt="a">', 'carrega'],
  ['img-relativo-protocolo', '<img src="//externo.test/pr.png" alt="a">', 'carrega'],
  ['img-espaco', '<img src=" ' + X + 'espaco.png" alt="a">', 'carrega'],
  ['img-maiusculas', '<IMG SRC="HTTPS://EXTERNO.TEST/M.PNG" alt="a">', 'carrega'],
  ['img-srcset', '<img srcset="' + X + 'srcset.png 1x" src="/img/local.png" alt="a">', 'carrega'],
  ['img-lazy', '<img loading="lazy" src="' + X + 'lazy.png" alt="a">', 'carrega'],
  ['picture-source', '<picture><source srcset="' + X + 'picture.png"><img src="/img/local.png" alt="a"></picture>', 'carrega'],
  ['video-src-auto', '<video src="' + X + 'v-auto.mp4" controls></video>', 'carrega'],
  ['video-src-none (busca ao dar play)', '<video src="' + X + 'v-none.mp4" preload="none" controls></video>', 'carrega'],
  ['video-poster', '<video poster="' + X + 'poster.png" preload="none" controls></video>', 'carrega'],
  ['video-source', '<video controls><source src="' + X + 'v-source.mp4" type="video/mp4"></video>', 'carrega'],
  ['video-track (busca ao dar play)', '<video controls preload="none"><track kind="captions" src="' + X + 'track.vtt" default></video>', 'carrega'],
  ['audio-src', '<audio src="' + X + 'audio.mp3" controls></audio>', 'carrega'],
  ['style-background', '<div style="background-image:url(' + X + 'style-bg.png);width:50px;height:50px">x</div>', 'carrega'],
  ['style-aspas', '<div style="background:url(&quot;' + X + 'style-aspas.png&quot;);width:50px;height:50px">x</div>', 'carrega'],
  ['style-image-set', '<div style="background-image:image-set(\'' + X + 'image-set.png\' 1x);width:50px;height:50px">x</div>', 'carrega'],
  ['style-list', '<ul style="list-style-image:url(' + X + 'list.png)"><li>x</li></ul>', 'carrega'],
  ['style-border-image', '<div style="border:10px solid;border-image:url(' + X + 'border.png) 30 round">x</div>', 'carrega'],
  ['style-cursor', '<div style="cursor:url(' + X + 'cursor.png), auto;width:50px;height:50px">x</div>', 'carrega'],
  ['style-content', '<div style="width:50px;height:50px;content:url(' + X + 'content.png)">x</div>', 'carrega'],
  ['table-background', '<table background="' + X + 'table-bg.png"><tr><td>x</td></tr></table>', 'carrega'],
  ['td-background', '<table><tr><td background="' + X + 'td-bg.png">x</td></tr></table>', 'carrega'],
  ['input-image', '<input type="image" src="' + X + 'input.png" alt="a">', 'carrega'],
  ['form-action', '<form action="' + X + 'form"><input name="a"><button>Enviar</button></form>', 'envia'],
  ['svg-image (o filtro remove)', '<svg width="20" height="20"><image href="' + X + 'svg.png" width="20" height="20"/></svg>', ''],
  ['object-data (o filtro remove)', '<object data="' + X + 'object.png"></object>', ''],
  ['embed-src (o filtro remove)', '<embed src="' + X + 'embed.png">', ''],
  ['iframe (o filtro remove)', '<iframe src="' + X + 'iframe.html"></iframe>', ''],
  ['link-css (o filtro remove)', '<link rel="stylesheet" href="' + X + 'link.css">', ''],
  ['a-href', '<a href="' + X + 'a.html">um link</a>', ''],
  ['md-link', '[um link](' + X + 'md.html)', ''],
  ['a-ping (o filtro remove o ping)', '<a href="/x.html" ping="' + X + 'ping">um link</a>', ''],
  ['img-relativo', '<img src="/img/local.png" alt="a">', ''],
  ['img-data', '<img src="data:image/png;base64,iVBORw0KGgo=" alt="a">', ''],
  ['nostr-link', '<a href="nostr:npub10xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqpkge6d">nostr</a>', '']
];
// O juiz corre também sobre o HTML inteiro da página, que inclui o MOLDE do
// tema — e o molde não passa pelo filtro. Por isso reconhece o que o filtro
// removeria, e não confunde o que não busca nada.
const BRUTOS = [
  ['link-stylesheet', '<link rel="stylesheet" href="' + X + 'a.css">', 'carrega'],
  ['link-icon', '<link rel="icon" href="//externo.test/i.png">', 'carrega'],
  ['link-canonical (não busca)', '<link rel="canonical" href="' + X + '">', ''],
  ['script-src', '<scr' + 'ipt src="' + X + 'a.js"></scr' + 'ipt>', 'carrega'],
  ['iframe-src', '<iframe src="' + X + 'f.html"></iframe>', 'carrega'],
  ['svg-image', '<svg><image href="' + X + 's.png"/></svg>', 'carrega'],
  ['tag-style', '<style>body{background:url(//externo.test/b.png)}</style>', 'carrega'],
  ['style-data-com-namespace (não busca)', '<div style="background:url(&quot;data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\'></svg>&quot;)">x</div>', ''],
  ['formaction', '<form><button formaction="' + X + 'f">ir</button></form>', 'envia'],
  ['relativo-e-local', '<img src="/img/a.png"><link rel="stylesheet" href="/tema/estilo.css"><div style="background:url(/img/b.png)">x</div>', '']
];

module.exports = async function (ctx, u) {
  const { R, it } = coletor();
  const p = await abrir(ctx, u.url);
  const r = await p.pg.evaluate(async ([casos, brutos, npub, pubkey]) => {
    const out = { filtrados: [], brutos: [], temas: [] };
    for (const [id, corpo, esperado] of casos) {
      const limpo = Gerador.renderizarCorpo(corpo);
      out.filtrados.push({ id, esperado, achados: Gerador.externos(limpo), limpo: limpo.slice(0, 160) });
    }
    for (const [id, html, esperado] of brutos) out.brutos.push({ id, esperado, achados: Gerador.externos(html) });
    out.dedup = Gerador.externos('<img src="https://a.test/1.png"><img src="https://A.TEST/2.png"><form action="https://a.test/f"></form><img src="https://b.test/3.png">');
    out.vazios = [Gerador.externos(''), Gerador.externos(null), Gerador.externos(undefined)];

    // --- o outro lado: um site cheio de coisas que NÃO buscam nada, em todo tema
    const site = Modelo.sitePadrao(pubkey, npub);
    site.title = 'Site sem nada de fora'; site.description = 'Links, botões e contatos, mas nenhum arquivo de outro servidor';
    const home = Modelo.novaPagina('Início');
    home.body = 'Olá.\n\n[[botao: Fale comigo -> https://botao.exemplo.test/contato]]\n\n[[artigos: 3, com-capa]]\n\n[[contatos: Fale comigo]]\n\n[um link](https://link.exemplo.test/) e <a href="https://outro.exemplo.test/">outro</a>\n\n![foto](/img/capa.png)';
    const artigo = Modelo.novoArtigo('Um artigo'); artigo.body = 'Corpo com [link](https://x.exemplo.test/).'; artigo.date = '2026-08-01T00:00:00Z'; artigo.tags = ['viagens']; artigo.cover_media_id = 'm-capa';
    home.id = 'p-home'; artigo.id = 'a-1';
    site.home = { mode: 'page', page_id: home.id, latest_posts: 3 };
    site.menu = [{ type: 'page', page_id: home.id }, { type: 'blog' }, { type: 'link', label: 'Fora', href: 'https://menu.exemplo.test/' }];
    site.logo_media_id = 'm-capa'; site.favicon_media_id = 'm-capa';
    site.donations = { lightning_address: 'doar@exemplo.test', support_block: true, footer_credit: true };
    site.contacts = [{ kind: 'link', value: 'https://contato.exemplo.test/@site', label: 'Mastodon' }];
    site.messages = { enabled: true, relays: ['wss://relay.exemplo.test'] };
    const midia = { id: 'm-capa', path: '/img/capa.png', mime: 'image/png', size: 4, sha256: 'b'.repeat(64), width: 64, height: 64, alt: 'A capa', caption: '', bytes: null, status: 'published', servers: [], removal: null, metadata: { stripped: true, removed_segments: [], warning: null }, origin: 'upload', created_at: Modelo.agora(), updated_at: Modelo.agora(), previous_status: null };
    for (const t of Temas.todos()) {
      const dados = JSON.parse(JSON.stringify({ site, pages: [home], posts: [artigo], media: [midia] }));
      dados.site.theme = { id: t.manifesto.id, version: t.manifesto.version, options: {} };
      const g = await Gerador.gerarSite(dados);
      const html = g.arquivos.filter(a => a.mime === 'text/html');
      const homeHtml = (g.arquivos.find(a => a.path === '/index.html') || {}).texto || '';
      out.temas.push({ id: t.manifesto.id, paginas: html.length,
        achados: html.map(a => ({ path: a.path, x: Gerador.externos(a.texto) })).filter(y => y.x.length),
        // prova de que o site de exemplo TEM o que se diz que tem — senão "zero achados" não mediria nada
        temLinkFora: /href="https:\/\/link\.exemplo\.test\/"/.test(homeHtml), temBotao: /botao\.exemplo\.test/.test(homeHtml),
        temContato: /contato\.exemplo\.test/.test(homeHtml), temLogoLocal: /src="\/img\/capa\.png"/.test(homeHtml) });
    }
    return out;
  }, [CASOS, BRUTOS, u.NPUB_BOSTIL, u.PUBKEY_BOSTIL]);

  const comoFoi = (x) => x.achados.map(a => a.como + ':' + a.host).join(',') || '(nada)';
  await it(`o filtro e depois o juiz, nos ${CASOS.length} corpos (35 medidos nos dois motores, mais maiúsculas e link em Markdown): acusa tudo o que buscou arquivo de fora (com o host certo), o formulário como "envia", e nada do que não busca`, () => {
    assert(r.filtrados.length === CASOS.length, 'casos ' + r.filtrados.length + ' de ' + CASOS.length);
    const erros = [];
    for (const x of r.filtrados) {
      const ok = x.esperado === '' ? x.achados.length === 0 : (x.achados.length === 1 && x.achados[0].como === x.esperado && x.achados[0].host === 'externo.test');
      if (!ok) erros.push(x.id + ' → ' + comoFoi(x) + ' | limpo: ' + x.limpo);
    }
    assert(erros.length === 0, erros.join(' ;; '));
    return r.filtrados.filter(x => x.esperado).length + ' acusados, ' + r.filtrados.filter(x => !x.esperado).length + ' em silêncio';
  });

  await it(`sobre HTML sem filtro (o molde do tema não passa por ele), nos ${BRUTOS.length} casos: stylesheet, ícone, script, iframe, svg e <style> acusados; canonical, data: com "http://www.w3.org" dentro e endereço local, não`, () => {
    assert(r.brutos.length === BRUTOS.length, 'casos ' + r.brutos.length + ' de ' + BRUTOS.length);
    const erros = r.brutos.filter(x => (x.esperado === '' ? x.achados.length !== 0 : !(x.achados.length === 1 && x.achados[0].como === x.esperado && x.achados[0].host === 'externo.test')))
      .map(x => x.id + ' → ' + comoFoi(x));
    assert(erros.length === 0, erros.join(' ;; '));
  });

  await it('sem repetir: o mesmo servidor (com maiúsculas ou não) conta uma vez por jeito — "carrega" e "envia" separados —, na ordem em que aparece; vazio e nulo dão lista vazia', () => {
    assert(JSON.stringify(r.dedup) === JSON.stringify([{ host: 'a.test', como: 'carrega' }, { host: 'a.test', como: 'envia' }, { host: 'b.test', como: 'carrega' }]), JSON.stringify(r.dedup));
    assert(r.vazios.every(v => Array.isArray(v) && v.length === 0), JSON.stringify(r.vazios));
  });

  await it('o outro lado da balança: um site com link, botão e menu para fora, contatos, convite Nostr, doação, galeria, logo e ícone locais dá ZERO achados em TODOS os temas registrados (e o site tem mesmo essas coisas)', () => {
    assert(r.temas.length >= 22, 'temas medidos: ' + r.temas.length);
    const semProva = r.temas.filter(t => !(t.temLinkFora && t.temBotao && t.temContato && t.temLogoLocal));
    assert(semProva.length === 0, 'o site de exemplo não tem o que devia em: ' + JSON.stringify(semProva.map(t => t.id)));
    const comAchados = r.temas.filter(t => t.achados.length);
    assert(comAchados.length === 0, JSON.stringify(comAchados));
    return r.temas.length + ' temas, ' + r.temas.reduce((s, t) => s + t.paginas, 0) + ' páginas HTML, 0 achados';
  });

  await it('sem erros de página/console', () => assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros })));
  await p.pg.close();
  return R;
};
