// test/telas/t7_config.test.js — T7 Configurações pela INTERFACE (14 T7), do
// jeito que o dono faz: trocar o título, escolher a inicial, mexer no menu,
// ligar a doação, desligar o crédito do rodapé, esconder a hora — e ver o
// efeito no HTML que o site publicaria. Depois a aba Avançado: relays,
// servidores (com o aviso obrigatório de 03 §6 ao adicionar um de fora da
// lista padrão) e o único gesto destrutivo do painel, "Tirar o site do ar".
const { abrir, coletor, assert, entrarCom, semearSite, esperarT2, lerBanco } = require('../util.js');
const F = require('../fabrica.js');
const fs = require('fs'), path = require('path');

module.exports = async function (ctx, u) {
  const { R, it, pulado } = coletor();
  if (!u.falso) { pulado('telas/t7_config (todos os casos)', 'servidor falso indisponível'); return R; }
  const f = u.falso;
  f.blossom('c1', {}); f.blossom('c2', {}); f.blossom('c-recusa', { remocao: 'recusa' });
  f.relay('c-ok', { escrita: 'aceita', eventos: [] });
  f.relay('c-ok2', { escrita: 'aceita', eventos: [] });
  f.relay('c-recusa', { escrita: 'recusa' });
  f.relay('c-mudo', { escrita: 'muda' });
  const SERVIDORES = [f.url('c1'), f.url('c2')];

  // Sessão com uma página (a Home), um artigo e uma imagem na biblioteca.
  async function sessao(o) {
    o = o || {};
    const ch = F.chave();
    const p = await abrir(ctx, u.url);
    await semearSite(p.pg, ch, { relays: o.relays || [f.ws('c-ok'), f.ws('c-ok2')], servers: o.servidores || SERVIDORES, title: 'Site do teste T7' });
    await entrarCom(p.pg, ch.nsec);
    await esperarT2(p.pg, 30000);
    await p.pg.evaluate(async ([pubkey]) => {
      const db = await Db.abrir(pubkey);
      const site = await db.get('site', 'site');
      const home = Modelo.novaPagina('Início'); home.body = 'Bem-vindo.';
      const sobre = Modelo.novaPagina('Sobre'); sobre.body = 'Quem somos.';
      const artigo = Modelo.novoArtigo('Primeiro artigo'); artigo.body = 'Corpo.'; artigo.date = '2026-08-01T09:30:00Z';
      site.description = 'Uma frase sobre o site';
      site.home = { mode: 'page', page_id: home.id, latest_posts: 5 };
      site.menu = [{ type: 'page', page_id: home.id }, { type: 'blog' }];
      const brutos = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 9, 9, 9, 9]);
      const midia = { id: Modelo.novoId(), path: '/img/retrato.png', mime: 'image/png', size: brutos.length,
        sha256: await Blossom.sha256Hex(brutos), width: 300, height: 60, alt: 'retrato', caption: '',
        bytes: new Blob([brutos], { type: 'image/png' }), status: 'draft', servers: [], removal: null,
        metadata: { stripped: true, removed_segments: [], warning: null }, origin: 'upload',
        created_at: Modelo.agora(), updated_at: Modelo.agora(), previous_status: null };
      await db.escrever([{ op: 'put', store: 'site', chave: 'site', valor: site },
        { op: 'put', store: 'pages', valor: home }, { op: 'put', store: 'pages', valor: sobre },
        { op: 'put', store: 'posts', valor: artigo }, { op: 'put', store: 'media', valor: midia }]);
      db.fechar();
    }, [ch.pubkey]);
    await p.pg.click('#menu .item[data-tela="t7"]');
    await p.pg.waitForSelector('#t7-painel');
    return { p, ch };
  }
  const aba = (pg, nome) => pg.click(`.abas .aba[data-aba="${nome}"]`);
  // "Mostrar as opções avançadas" só existe enquanto o bloco está recolhido —
  // e ele fica aberto pelo resto da sessão desta aba.
  async function abrirAvancado(pg) {
    await aba(pg, 'avancado');
    if (await pg.$('#t7-avancado-mostrar')) await pg.click('#t7-avancado-mostrar');
    await pg.waitForSelector('#t7-relays');
  }
  // Salvar desliga o botão ao COMEÇAR; o que marca o fim é o aviso.
  async function salvar(pg) {
    await pg.click('#t7-salvar');
    await pg.waitForFunction(() => { const e = document.getElementById('t7-aviso'); return !!e && e.textContent.trim().length > 0; }, null, { timeout: 20000 });
    return pg.textContent('#t7-aviso');
  }
  // O HTML da capa como o site o publicaria agora — a prova de que a
  // configuração chegou ao tema, e não só ao banco.
  const homeGerada = (pg) => pg.evaluate(async () => {
    const db = Shell.dados().db;
    const dados = { site: await db.get('site', 'site'), pages: await db.getAll('pages'), posts: await db.getAll('posts'), media: await db.getAll('media') };
    const g = await Gerador.gerarSite(dados);
    const arq = g.arquivos.find(a => a.path === '/index.html');
    const blog = g.arquivos.find(a => a.path === '/blog/primeiro-artigo.html');
    const css = g.arquivos.find(a => a.path === '/tema/estilo.css');
    return { home: arq ? arq.texto : '', artigo: blog ? blog.texto : '', css: css ? css.texto : '' };
  });

  await it('as cinco abas de 14 T7 existem e Site abre por padrão; título e descrição chegam ao <title>/<meta description> do site', async () => {
    const { p } = await sessao();
    const abas = await p.pg.$$eval('.abas .aba', els => els.map(e => [e.getAttribute('data-aba'), e.textContent, e.classList.contains('atual')]));
    assert(abas.length === 5 && abas.map(x => x[0]).join(',') === 'site,doacoes,aparencia,privacidade,avancado', JSON.stringify(abas));
    assert(abas[0][2] === true, 'a aba Site devia abrir escolhida');
    assert(await p.pg.evaluate(() => document.getElementById('t7-salvar').disabled), 'nada mudou: Salvar devia começar desligado');
    await p.pg.fill('#t7-titulo', 'Império de Bostil');
    await p.pg.fill('#t7-descricao', 'Sob a Casca, a Verdade');
    assert(!(await p.pg.evaluate(() => document.getElementById('t7-salvar').disabled)), 'mudou: Salvar devia ligar');
    const aviso = await salvar(p.pg);
    assert(/muda todas as páginas/.test(aviso), aviso);
    assert((await p.pg.textContent('#nome-site')) === 'Império de Bostil', 'a barra devia mostrar o título novo');
    const g = await homeGerada(p.pg);
    assert(/<title>Império de Bostil<\/title>/.test(g.home), g.home.slice(0, 300));
    assert(/<meta name="description" content="Sob a Casca, a Verdade">/.test(g.home), g.home.slice(0, 400));
    await p.pg.close();
    return aviso;
  });

  await it('título ou descrição vazios: a tela diz que são obrigatórios para publicar (05 §3.1)', async () => {
    const { p } = await sessao();
    assert(!(await p.pg.$('#t7-obrigatorios')), 'com os dois preenchidos o aviso não devia aparecer');
    await p.pg.fill('#t7-descricao', '');
    await p.pg.click('#t7-salvar');
    await aba(p.pg, 'doacoes'); await aba(p.pg, 'site');
    const texto = await p.pg.textContent('#t7-obrigatorios');
    assert(/obrigatórios para publicar/.test(texto), texto);
    await p.pg.close();
    return texto;
  });

  await it('página inicial: trocar "uma página fixa" por "a lista de artigos" põe o blog no /index.html; o número de recentes chega à capa', async () => {
    const { p } = await sessao();
    let g = await homeGerada(p.pg);
    assert(/Bem-vindo/.test(g.home), 'a capa devia ser a página fixa');
    await p.pg.check('#t7-home-blog');
    await salvar(p.pg);
    g = await homeGerada(p.pg);
    assert(!/Bem-vindo/.test(g.home) && /Primeiro artigo/.test(g.home), 'a capa devia passar a ser a lista de artigos');
    await p.pg.check('#t7-home-page');
    await p.pg.fill('#t7-recentes', '0');
    await salvar(p.pg);
    g = await homeGerada(p.pg);
    assert(/Bem-vindo/.test(g.home) && !/Primeiro artigo/.test(g.home), 'com 0 recentes a capa não lista artigos');
    await p.pg.close();
    return 'página fixa ↔ lista de artigos, recentes 5 → 0';
  });

  await it('Perfil (kind 0): nome, "sobre" e o avatar escolhido da biblioteca chegam ao banco — e ao evento de identidade', async () => {
    const { p, ch } = await sessao();
    await p.pg.fill('#t7-perfil-nome', 'Dona do site');
    await p.pg.fill('#t7-perfil-sobre', 'Escrevo sobre o que vejo.');
    assert((await p.pg.textContent('#t7-avatar-atual')) === '(nenhuma)');
    await p.pg.click('#t7-avatar-escolher');
    await p.pg.waitForSelector('.grade-capas');
    await p.pg.click('.capa-opcao[data-media-id]');
    await p.pg.waitForSelector('#modal-fundo', { state: 'detached' });
    assert((await p.pg.textContent('#t7-avatar-atual')) === '/img/retrato.png');
    await salvar(p.pg);
    const banco = await lerBanco(p.pg, ch.pubkey);
    const midia = banco.media[0];
    assert(banco.site.profile.name === 'Dona do site' && banco.site.profile.about === 'Escrevo sobre o que vejo.', JSON.stringify(banco.site.profile));
    assert(banco.site.profile.picture_media_id === midia.id, JSON.stringify([banco.site.profile.picture_media_id, midia.id]));
    // o kind 0 que a publicação assinaria já aponta para o blob dessa imagem
    const perfil = await p.pg.evaluate(async () => {
      const db = Shell.dados().db;
      const dados = { site: await db.get('site', 'site'), pages: await db.getAll('pages'), posts: await db.getAll('posts'), media: await db.getAll('media') };
      const plano = Publicar.planear({ dados, gerado: await Gerador.gerarSite(dados), published: null });
      return { url: plano.picture_url, sha: plano.picture_sha, conteudo: JSON.parse(Publicar.conteudoPerfil(dados.site, plano.picture_url)) };
    });
    assert(perfil.sha === midia.sha256 && perfil.conteudo.picture === perfil.url && /\/$|[0-9a-f]{64}$/.test(perfil.url), JSON.stringify(perfil));
    await p.pg.close();
    return perfil.conteudo.picture;
  });

  await it('menu: reordenar com ▲▼, remover, adicionar uma página e um link externo — e a ordem sai no HTML do site', async () => {
    const { p } = await sessao();
    const rotulos = () => p.pg.$$eval('#t7-menu li .cresce', els => els.map(e => e.textContent));
    assert((await rotulos()).join(',') === 'Início,Blog', JSON.stringify(await rotulos()));
    await p.pg.selectOption('#t7-menu-pagina', { label: 'Sobre' });
    await p.pg.click('#t7-menu-add-pagina');
    assert((await rotulos()).join(',') === 'Início,Blog,Sobre', JSON.stringify(await rotulos()));
    // sobe "Sobre" uma posição
    await p.pg.click('#t7-menu li[data-indice="2"] button[title="Subir"]');
    assert((await rotulos()).join(',') === 'Início,Sobre,Blog', JSON.stringify(await rotulos()));
    await p.pg.fill('#t7-menu-rotulo', 'Nostr');
    await p.pg.fill('#t7-menu-url', 'nao é url');
    await p.pg.click('#t7-menu-add-link');
    assert(/Endereço inválido/.test(await p.pg.textContent('#t7-menu-erro')), 'endereço inválido devia ser recusado');
    await p.pg.fill('#t7-menu-url', 'https://nostr.com/');
    await p.pg.click('#t7-menu-add-link');
    assert((await rotulos()).join(',') === 'Início,Sobre,Blog,Nostr ↗', JSON.stringify(await rotulos()));
    await salvar(p.pg);
    const g = await homeGerada(p.pg);
    const menu = (/<nav class="menu"[^>]*>([\s\S]*?)<\/nav>/.exec(g.home) || [])[1] || '';
    const ordem = Array.from(menu.matchAll(/>([^<]+)<\/a>/g)).map(m => m[1]);
    assert(ordem.join(',') === 'Início,Sobre,Blog,Nostr', JSON.stringify(ordem));
    assert(/rel="external noopener noreferrer"/.test(menu), 'o link externo devia sair marcado como externo');
    await p.pg.close();
    return ordem.join(' · ');
  });

  await it('Doações: lightning address + "apoie este site" fazem o bloco aparecer no rodapé; desligar o crédito tira "Publicado com Nostermentor" (M5 aceite 4)', async () => {
    const { p } = await sessao();
    let g = await homeGerada(p.pg);
    assert(/Publicado com Nostermentor/.test(g.home), 'o crédito vem ligado de fábrica');
    assert(!/Apoie este site/.test(g.home), 'sem endereço não há bloco de apoio');
    await aba(p.pg, 'doacoes');
    await p.pg.fill('#t7-lightning', 'bostil@getalby.com');
    await p.pg.check('#t7-bloco-apoio');
    await p.pg.uncheck('#t7-credito');
    await salvar(p.pg);
    g = await homeGerada(p.pg);
    assert(/Apoie este site/.test(g.home) && /bostil@getalby\.com/.test(g.home), g.home.slice(-500));
    assert(!/Publicado com Nostermentor/.test(g.home), 'o crédito devia ter sumido');
    await p.pg.close();
    return 'bloco de apoio ligado, crédito do rodapé desligado';
  });

  await it('Doações: endereço com forma errada é avisado, não bloqueado em silêncio', async () => {
    const { p } = await sessao();
    await aba(p.pg, 'doacoes');
    await p.pg.fill('#t7-lightning', 'isto-não-é-endereço');
    await p.pg.click('#t7-salvar');
    await aba(p.pg, 'site'); await aba(p.pg, 'doacoes');
    const texto = await p.pg.textContent('#t7-lightning-invalido');
    assert(/nome@dominio/.test(texto), texto);
    await p.pg.close();
    return texto;
  });

  await it('Privacidade: a hora de publicação vem DESLIGADA e o artigo sai só com o dia — inclusive no datetime; ligada, a hora aparece', async () => {
    const { p } = await sessao();
    await aba(p.pg, 'privacidade');
    assert(!(await p.pg.isChecked('#t7-hora')), 'show_publish_time devia vir desligado (03 §1.1)');
    assert(/Anonimato não é invisibilidade/.test(await p.pg.textContent('#t7-lembrete-privacidade')));
    let g = await homeGerada(p.pg);
    assert(/datetime="2026-08-01"/.test(g.artigo) && !/09:30/.test(g.artigo), (/<time[^>]*>[^<]*<\/time>/.exec(g.artigo) || [''])[0]);
    await p.pg.check('#t7-hora');
    await salvar(p.pg);
    g = await homeGerada(p.pg);
    assert(/09:30/.test(g.artigo), (/<time[^>]*>[^<]*<\/time>/.exec(g.artigo) || [''])[0]);
    await p.pg.close();
    return (/<time[^>]*>[^<]*<\/time>/.exec(g.artigo) || [''])[0];
  });

  await it('24: o tema Padrão declara cor, letras e medidas; mexer numa cor muda SÓ a folha de estilo, e a tela diz isso em vez de prometer que sobe tudo', async () => {
    const { p, ch } = await sessao();
    await aba(p.pg, 'aparencia');
    assert(/Padrão/.test(await p.pg.textContent('#t7-tema')));
    assert(!(await p.pg.$('#t7-tema-sem-opcoes')), 'o tema já declara opções — a tela não pode continuar a dizer que não tem');
    const controles = await p.pg.$$eval('#t7-tema-opcoes [id^="t7-opcao-"]', els => els.map(e => e.id.replace('t7-opcao-', '') + ':' + (e.tagName === 'SELECT' ? 'select' : e.getAttribute('type'))));
    assert(controles.join(',') === 'esquema:select,cor_destaque:color,fonte_texto:select,fonte_titulos:select,tamanho_texto:select,largura:select,cantos:select,altura_logo:number', controles.join(','));
    await p.pg.selectOption('#t7-opcao-esquema', 'escuro');
    await p.pg.selectOption('#t7-opcao-fonte_texto', 'sem-serifa');
    await p.pg.selectOption('#t7-opcao-largura', 'larga');
    // <input type=color> não se preenche por teclado: põe-se o valor e avisa-se a tela
    await p.pg.$eval('#t7-opcao-cor_destaque', el => { el.value = '#8a2be2'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    const aviso = await salvar(p.pg);
    assert(/só a folha de estilo/.test(aviso), aviso);
    const g = await homeGerada(p.pg);
    assert(/--fundo:#16181d/.test(g.css) && /--acento:#8a2be2/.test(g.css) && /--largura:900px/.test(g.css) && /--fonte-texto:system-ui/.test(g.css), g.css.slice(0, 400));
    const banco = await lerBanco(p.pg, ch.pubkey);
    assert(banco.site.theme.options.esquema === 'escuro' && banco.site.theme.options.cor_destaque === '#8a2be2' && banco.site.theme.options.largura === 'larga', JSON.stringify(banco.site.theme.options));
    await p.pg.close();
    return 'esquema escuro, acento #8a2be2, largura larga — ' + aviso;
  });

  await it('38: o logo escolhido substitui o título no topo de TODAS as páginas, leva o título no alt, e o app avisa quando a imagem é baixa para a altura pedida', async () => {
    const { p, ch } = await sessao();
    await aba(p.pg, 'aparencia');
    assert((await p.pg.textContent('#t7-logo-atual')) === '(nenhum)' && !(await p.pg.$('#t7-logo-remover')), 'sem logo não há o que remover');
    await p.pg.click('#t7-logo-escolher');
    await p.pg.waitForSelector('.grade-capas');
    await p.pg.click('.capa-opcao[data-media-id]');
    await p.pg.waitForSelector('#modal-fundo', { state: 'detached' });
    assert((await p.pg.textContent('#t7-logo-atual')) === '/img/retrato.png');
    // a imagem tem 60 pontos de altura; a altura pedida (44) pede o dobro
    assert(!(await p.pg.$('#t7-logo-baixo[hidden]')) && /60 pontos de altura/.test(await p.pg.textContent('#t7-logo-baixo')), await p.pg.textContent('#t7-logo-baixo'));
    await p.pg.fill('#t7-opcao-altura_logo', '28');
    await p.pg.waitForSelector('#t7-logo-baixo[hidden]', { state: 'attached' });
    const aviso = await salvar(p.pg);
    assert(/subir tudo de novo/.test(aviso), 'o logo está no cabeçalho de todas as páginas: ' + aviso);
    const g = await homeGerada(p.pg);
    const cabecalho = (/<header[\s\S]*?<\/header>/.exec(g.home) || [''])[0];
    assert(/<a class="marca marca-logo" href="\/index\.html"><img src="\/img\/retrato\.png" alt="Site do teste T7" width="300" height="60"><\/a>/.test(cabecalho), cabecalho);
    assert(/marca-logo/.test(g.artigo) && /--logo-altura:28px/.test(g.css), 'o logo tem de estar no artigo também, com a altura pedida');
    const banco = await lerBanco(p.pg, ch.pubkey);
    assert(banco.site.logo_media_id === banco.media[0].id && banco.site.profile.picture_media_id !== banco.media[0].id, 'logo e avatar são campos separados: ' + JSON.stringify([banco.site.logo_media_id, banco.site.profile.picture_media_id]));
    await p.pg.click('#t7-logo-remover');
    assert((await p.pg.textContent('#t7-logo-atual')) === '(nenhum)');
    await salvar(p.pg);
    const g2 = await homeGerada(p.pg);
    assert(!/marca-logo/.test(g2.home) && /<a class="marca" href="\/index\.html">Site do teste T7<\/a>/.test(g2.home), 'remover devia devolver o título em texto');
    await p.pg.close();
    return 'logo no cabeçalho de todas as páginas, com o título no alt; aviso de altura visto e apagado';
  });

  await it('48: os seletores de logo e de avatar mostram miniatura para mídia vinda da REDE, sem bytes locais — achado pelo dono no teste à mão do lote 4', async () => {
    const PNG = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'limpeza', 'limpo.png'));
    const sha = f.blobEm('c1', PNG, 'image/png');
    const { p, ch } = await sessao();
    await p.pg.evaluate(async ([pubkey, sha, tamanho, servidor]) => {
      const db = await Db.abrir(pubkey);
      const daRede = { id: Modelo.novoId(), path: '/img/da-rede.png', mime: 'image/png', size: tamanho,
        sha256: sha, width: null, height: null, alt: 'veio da rede', caption: '', bytes: null,
        status: 'published', servers: [servidor], removal: null,
        metadata: { stripped: null, removed_segments: [], warning: null }, origin: 'network',
        created_at: Modelo.agora(), updated_at: Modelo.agora(), previous_status: null };
      await db.escrever([{ op: 'put', store: 'media', valor: daRede }]);
      db.fechar();
    }, [ch.pubkey, sha, PNG.length, f.url('c1')]);
    // reentra em T7 para o mount reler `media` do banco (a lista já foi lida
    // uma vez, antes do put acima)
    await p.pg.click('#menu .item[data-tela="t6"]'); await p.pg.waitForSelector('#t6-tabela');
    await p.pg.click('#menu .item[data-tela="t7"]'); await p.pg.waitForSelector('#t7-painel');
    await aba(p.pg, 'aparencia');
    await p.pg.click('#t7-logo-escolher');
    await p.pg.waitForSelector('.grade-capas');
    // antes da correção, `miniatura()` devolvia null para quem não tem
    // `bytes` locais — nunca aparecia um <img>, só o caminho em texto
    await p.pg.waitForFunction(() => {
      const opcao = document.querySelector('.capa-opcao[data-media-id] .mini-caixa img');
      return !!opcao;
    }, null, { timeout: 20000 });
    await p.pg.click('#modal-fechar');
    await p.pg.waitForSelector('#modal-fundo', { state: 'detached' });
    // o mesmo modal serve o avatar (aba Site) — mesma função, mesmo achado do
    // dono não ter visto: o cache por sha256 já tem os bytes, não repete a rede
    await aba(p.pg, 'site');
    await p.pg.click('#t7-avatar-escolher');
    await p.pg.waitForSelector('.grade-capas');
    await p.pg.waitForFunction(() => {
      const opcao = document.querySelector('.capa-opcao[data-media-id] .mini-caixa img');
      return !!opcao;
    }, null, { timeout: 20000 });
    await p.pg.close();
    return 'logo e avatar: miniatura da rede baixada e mostrada nos dois seletores';
  });

  await it('Aparência: a pré-visualização abre isolada (iframe sem allow-same-origin) e mostra as opções do rascunho', async () => {
    const { p } = await sessao();
    await aba(p.pg, 'aparencia');
    await p.pg.selectOption('#t7-opcao-esquema', 'escuro');
    await p.pg.click('#t7-previa');
    await p.pg.waitForSelector('#previa-completa');
    const sandbox = await p.pg.getAttribute('#previa-completa', 'sandbox');
    assert(sandbox === 'allow-scripts', 'o iframe da prévia não pode ter allow-same-origin (02 G.2): ' + sandbox);
    const dentro = await p.pg.frameLocator('#previa-completa').locator('h1').first().textContent();
    assert(/Início/.test(dentro), dentro);
    // a prévia usa o RASCUNHO, não o que está gravado — senão mostraria o antes
    const estilo = await p.pg.frameLocator('#previa-completa').locator('style').first().textContent();
    assert(/--fundo:#16181d/.test(estilo), 'a prévia ignorou a opção que ainda não foi salva');
    await p.pg.close();
    return 'prévia isolada, com o rascunho: ' + dentro;
  });

  await it('Avançado vem recolhido com o aviso; abre com um clique — e T2 "Tentar outros relays" já entra com ele aberto', async () => {
    const { p } = await sessao();
    await aba(p.pg, 'avancado');
    assert(/Só mexa aqui/.test(await p.pg.textContent('#t7-avancado-aviso')));
    assert(!(await p.pg.$('#t7-relays')), 'a lista de relays não devia aparecer antes do clique');
    await p.pg.click('#t7-avancado-mostrar');
    await p.pg.waitForSelector('#t7-relays');
    const relays = await p.pg.$$eval('#t7-relays li code', els => els.map(e => e.textContent));
    assert(relays.length === 2, JSON.stringify(relays));
    // o caminho de T2: chave sem site → "Tentar outros relays"
    const ch2 = F.chave();
    const p2 = await abrir(ctx, u.url);
    await semearSite(p2.pg, ch2, { relays: [f.ws('c-ok')], servers: SERVIDORES });
    await entrarCom(p2.pg, ch2.nsec);
    await esperarT2(p2.pg, 30000);
    await p2.pg.click('#outros-relays');
    await p2.pg.waitForSelector('#t7-relays');
    assert(await p2.pg.evaluate(() => document.querySelector('.abas .aba.atual').getAttribute('data-aba') === 'avancado'));
    await p.pg.close(); await p2.pg.close();
    return 'T2 → T7 §Avançado, já aberto';
  });

  await it('Avançado: adicionar e remover relay, recusar endereço inválido, nunca deixar a lista vazia, restaurar a lista padrão de 05 §4', async () => {
    const { p } = await sessao();
    await aba(p.pg, 'avancado'); await p.pg.click('#t7-avancado-mostrar');
    await p.pg.fill('#t7-relay-novo', 'https://nao-e-relay.example');
    await p.pg.click('#t7-relay-add');
    assert(/começar por wss/.test(await p.pg.textContent('#t7-relay-erro')));
    await p.pg.fill('#t7-relay-novo', 'wss://relay.exemplo.test');
    await p.pg.click('#t7-relay-add');
    let relays = await p.pg.$$eval('#t7-relays li code', els => els.map(e => e.textContent));
    assert(relays.length === 3 && relays[2] === 'relay.exemplo.test', JSON.stringify(relays));
    await p.pg.click('#t7-relays li:last-child button.ligacao');
    relays = await p.pg.$$eval('#t7-relays li code', els => els.map(e => e.textContent));
    assert(relays.length === 2, JSON.stringify(relays));
    await p.pg.click('#t7-relays li:last-child button.ligacao');
    await p.pg.click('#t7-relays li:last-child button.ligacao');
    assert(/pelo menos um relay/.test(await p.pg.textContent('#t7-relay-erro')), 'não se pode ficar sem relay');
    await p.pg.click('#t7-relay-padrao');
    relays = await p.pg.$$eval('#t7-relays li code', els => els.map(e => e.textContent));
    assert(relays.length === 8 && relays.includes('nos.lol') && !relays.some(x => /cercatrova/.test(x)), JSON.stringify(relays));
    await p.pg.close();
    return `lista padrão restaurada: ${relays.length} relays`;
  });

  await it('Avançado: "Testar" publica um evento EFÊMERO com chave descartável (a do dono não é usada) e diz aceita/recusou/não respondeu por relay', async () => {
    const { p, ch } = await sessao({ relays: [f.ws('c-ok'), f.ws('c-recusa'), f.ws('c-mudo')] });
    await aba(p.pg, 'avancado'); await p.pg.click('#t7-avancado-mostrar');
    const antes = f.publicadosEm('c-ok').length;
    await p.pg.click('#t7-relay-testar');
    await p.pg.waitForFunction(() => Array.from(document.querySelectorAll('#t7-relays .estado-relay')).filter(e => /aceita escrita|recusou|não respondeu/.test(e.textContent)).length === 3, null, { timeout: 60000 });
    const estados = await p.pg.$$eval('#t7-relays li', els => els.map(e => [e.querySelector('code').textContent, e.querySelector('.estado-relay').textContent]));
    assert(/aceita escrita/.test(estados[0][1]) && /recusou/.test(estados[1][1]) && /não respondeu/.test(estados[2][1]), JSON.stringify(estados));
    const novos = f.publicadosEm('c-ok').slice(antes);
    assert(novos.length === 1 && novos[0].kind === 20169, JSON.stringify(novos.map(e => e.kind)));
    assert(novos[0].pubkey !== ch.pubkey, 'a sonda NÃO pode ser assinada com a chave do dono');
    await p.pg.close();
    return `sonda kind ${novos[0].kind} com chave descartável; ${estados.map(x => x[1]).join(' / ')}`;
  });

  await it('Avançado: adicionar servidor fora da lista padrão exige o aviso de 03 §6 ("o que subir aqui não sai mais"); cancelar não adiciona (M5 aceite 3)', async () => {
    const { p } = await sessao();
    await aba(p.pg, 'avancado'); await p.pg.click('#t7-avancado-mostrar');
    let servidores = await p.pg.$$eval('#t7-servidores li code', els => els.map(e => e.textContent));
    assert(servidores.length === 2, JSON.stringify(servidores));
    await p.pg.fill('#t7-servidor-novo', 'https://cdn.nostrcheck.me');
    await p.pg.click('#t7-servidor-add');
    await p.pg.waitForSelector('#t7-aviso-servidor');
    const aviso = await p.pg.textContent('#t7-aviso-servidor');
    assert(/não sai mais/.test(aviso), aviso);
    await p.pg.click('#modal .acoes button.secundario');           // cancelar
    servidores = await p.pg.$$eval('#t7-servidores li code', els => els.map(e => e.textContent));
    assert(servidores.length === 2, 'cancelar não podia adicionar: ' + JSON.stringify(servidores));
    await p.pg.click('#t7-servidor-add');
    await p.pg.click('#t7-aviso-servidor-ok');
    servidores = await p.pg.$$eval('#t7-servidores li code', els => els.map(e => e.textContent));
    assert(servidores.length === 3 && servidores[2] === 'cdn.nostrcheck.me', JSON.stringify(servidores));
    await salvar(p.pg);
    await p.pg.close();
    return aviso;
  });

  // --- "Tirar o site do ar" (03 §6; M5 aceite 7) ---------------------------

  // Publica de verdade contra o servidor falso e volta a T7 §Avançado.
  async function publicado(o) {
    const s = await sessao(o);
    await s.p.pg.click('#btn-publicar');
    await s.p.pg.waitForSelector('#t8-assinar:not([disabled])', { timeout: 30000 });
    await s.p.pg.click('#t8-assinar');
    await s.p.pg.waitForSelector('#t8-publicado', { timeout: 60000 });
    await s.p.pg.click('#menu .item[data-tela="t7"]');
    await s.p.pg.waitForSelector('#t7-painel');
    await abrirAvancado(s.p.pg);
    await s.p.pg.waitForSelector('#t7-tirar-do-ar');
    return s;
  }

  await it('o bloco "Tirar o site do ar" só existe depois de haver site publicado, diz as duas verdades antes do clique e só liga o botão quando o título é digitado', async () => {
    const { p } = await sessao();
    await aba(p.pg, 'avancado'); await p.pg.click('#t7-avancado-mostrar');
    assert(!(await p.pg.$('#t7-tirar-do-ar')), 'site nunca publicado não tem o que tirar do ar');
    await p.pg.close();

    const s = await publicado();
    const texto = await s.p.pg.textContent('#t7-tirar-do-ar');
    assert(/Não é apagar a história/.test(texto), texto.slice(0, 300));
    assert(/continua aqui e no seu backup/.test(texto), texto.slice(0, 400));
    assert(await s.p.pg.evaluate(() => document.getElementById('t7-tirar-botao').disabled), 'o botão devia começar desligado');
    await s.p.pg.fill('#t7-tirar-confirma', 'Site do teste T');
    assert(await s.p.pg.evaluate(() => document.getElementById('t7-tirar-botao').disabled), 'título pela metade não liga o botão');
    await s.p.pg.fill('#t7-tirar-confirma', 'Site do teste T7');
    assert(!(await s.p.pg.evaluate(() => document.getElementById('t7-tirar-botao').disabled)), 'com o título exato o botão liga');
    // e o título que a confirmação exige é o de AGORA, não o de quando a tela abriu
    await aba(s.p.pg, 'site');
    await s.p.pg.fill('#t7-titulo', 'Outro nome');
    await salvar(s.p.pg);
    await abrirAvancado(s.p.pg);
    await s.p.pg.fill('#t7-tirar-confirma', 'Site do teste T7');
    assert(await s.p.pg.evaluate(() => document.getElementById('t7-tirar-botao').disabled), 'o título antigo não pode continuar a valer');
    await s.p.pg.fill('#t7-tirar-confirma', 'Outro nome');
    assert(!(await s.p.pg.evaluate(() => document.getElementById('t7-tirar-botao').disabled)), 'o título novo devia ligar o botão');
    await s.p.pg.close();
    return 'confirmação por digitação do título (sempre o atual), sem clique acidental';
  });

  await it('M5 aceite 7: tirar do ar publica um manifest VAZIO, apaga os blobs nos dois servidores com placar por servidor, e o conteúdo local sobrevive para republicar', async () => {
    const s = await publicado();
    const banco = await lerBanco(s.p.pg, s.ch.pubkey);
    const shas = Object.keys(banco.published.paths).map(k => banco.published.paths[k]);
    assert(shas.length >= 5, JSON.stringify(Object.keys(banco.published.paths)));
    for (const sha of shas) assert(f.temBlob('c1', sha), 'antes de tirar do ar, o blob devia estar em c1');

    await s.p.pg.fill('#t7-tirar-confirma', 'Site do teste T7');
    await s.p.pg.click('#t7-tirar-botao');
    await s.p.pg.waitForSelector('#t7-tirar-feito', { timeout: 60000 });
    const placar = await s.p.pg.textContent('#t7-tirar-do-ar');
    assert(/Mapa vazio aceito em 2 de 2 relays/.test(placar), placar.slice(0, 300));
    const linhas = await s.p.pg.$$eval('#t7-tirar-placar-servidores li', els => els.map(e => e.textContent));
    assert(linhas.length === 2 && linhas.every(l => /0 recusado/.test(l)), JSON.stringify(linhas));

    // o manifest que ficou nos relays não tem um caminho sequer
    const eventos = f.publicadosEm('c-ok').filter(e => e.kind === 15128);
    const ultimo = eventos[eventos.length - 1];
    assert(ultimo && ultimo.tags.filter(t => t[0] === 'path').length === 0, JSON.stringify((ultimo || {}).tags));
    for (const sha of shas) assert(!f.temBlob('c1', sha) && !f.temBlob('c2', sha), 'o blob ' + sha.slice(0, 8) + ' devia ter saído dos dois servidores');

    // local: nada se perdeu, tudo voltou a "nunca publicado"
    const depois = await lerBanco(s.p.pg, s.ch.pubkey);
    assert(Object.keys(depois.published.paths).length === 0 && depois.published.takedown_at, JSON.stringify(depois.published).slice(0, 200));
    assert(depois.pages.length === 2 && depois.pages.every(x => x.status === 'draft' && x.published_hash === null), JSON.stringify(depois.pages.map(x => [x.title, x.status])));
    assert(depois.posts.length === 1 && depois.posts[0].status === 'draft', JSON.stringify(depois.posts.map(x => [x.title, x.status])));
    assert(depois.media.length === 1 && depois.media[0].status === 'draft' && depois.media[0].servers.length === 0, JSON.stringify(depois.media.map(x => [x.path, x.status])));

    // e o Início para de dizer que o site está no ar
    await s.p.pg.click('#menu .item[data-tela="t3"]');
    await s.p.pg.waitForSelector('#cartao-saude');
    assert(await s.p.pg.$('#saude-fora-do-ar'), 'T3 devia dizer que o site está fora do ar');
    assert(!(await s.p.pg.$('#saude-resumo')), 'T3 não pode continuar a dizer "está em N de M relays"');

    // republicar devolve o site
    await s.p.pg.click('#btn-publicar');
    await s.p.pg.waitForSelector('#t8-assinar:not([disabled])', { timeout: 30000 });
    await s.p.pg.click('#t8-assinar');
    await s.p.pg.waitForSelector('#t8-publicado', { timeout: 60000 });
    const volta = await lerBanco(s.p.pg, s.ch.pubkey);
    assert(Object.keys(volta.published.paths).length === shas.length, JSON.stringify(Object.keys(volta.published.paths)));
    for (const sha of Object.keys(volta.published.paths).map(k => volta.published.paths[k])) assert(f.temBlob('c1', sha), 'o blob devia ter voltado a c1');
    assert(s.p.erros.length === 0, JSON.stringify(s.p.erros));
    await s.p.pg.close();
    return `${shas.length} caminhos fora do ar e de volta; ${linhas.length} servidores no placar`;
  });

  // `15` §5, regra de 2026-08-26: operação demorada exige teste que observe o
  // MEIO, não só o desfecho — a tela tem de continuar a responder e a barra a
  // andar enquanto os blobs são apagados um a um.
  await it('durante o "tirar do ar" a tela relata o progresso passo a passo e a barra avança até o fim, sem trancar a página', async () => {
    const s = await publicado();
    await s.p.pg.fill('#t7-tirar-confirma', 'Site do teste T7');
    await s.p.pg.evaluate(() => {
      window.__amostras = [];
      new MutationObserver(() => {
        const b = document.getElementById('t7-tirar-barra'), t = document.getElementById('t7-tirar-progresso');
        if (!b || !t) return;
        window.__amostras.push({ texto: t.textContent, oculto: b.hidden, valor: b.getAttribute('value'), max: b.getAttribute('max') });
      }).observe(document.getElementById('t7-tirar-do-ar'), { subtree: true, childList: true, characterData: true, attributes: true });
    });
    await s.p.pg.click('#t7-tirar-botao');
    // se a linha de execução estivesse trancada, este clique numa OUTRA aba
    // não seria atendido enquanto o gesto corresse
    await s.p.pg.waitForSelector('#t7-tirar-feito', { timeout: 60000 });
    const am = await s.p.pg.evaluate(() => window.__amostras);
    const textos = am.map(a => a.texto);
    assert(textos.some(t => /Assinando o mapa vazio/.test(t)), JSON.stringify(textos.slice(0, 6)));
    assert(textos.some(t => /Enviando aos relays/.test(t)), JSON.stringify(textos.slice(0, 8)));
    const doApagar = am.filter(a => /^Apagando arquivos: \d+ de \d+$/.test(a.texto) && a.oculto === false);
    const valores = doApagar.map(a => Number(a.valor)).filter(v => !Number.isNaN(v));
    const total = doApagar.length ? Number(doApagar[0].max) : 0;
    assert(doApagar.length >= 3, 'poucas amostras do apagar: ' + JSON.stringify(textos));
    assert(total >= 5 && doApagar.every(a => Number(a.max) === total), 'max instável: ' + JSON.stringify(doApagar.map(a => a.max)));
    assert(valores.length >= 3 && valores[valores.length - 1] > valores[0], 'o <progress> não avançou: ' + JSON.stringify(valores));
    assert(valores[valores.length - 1] === total, 'a barra não chegou ao fim: ' + valores[valores.length - 1] + '/' + total);
    assert(s.p.erros.length === 0, JSON.stringify(s.p.erros));
    await s.p.pg.close();
    return `${doApagar.length} amostras, <progress> ${valores[0]}→${valores[valores.length - 1]}/${total}`;
  });

  await it('tirar do ar quando relay nenhum aceita: a tela diz que o site CONTINUA no ar e nenhum arquivo é apagado', async () => {
    const s = await publicado();
    // troca os relays por um que recusa e um mudo, sem tocar nos servidores
    await s.p.pg.evaluate(async ([recusa, mudo]) => {
      const db = Shell.dados().db;
      const site = await db.get('site', 'site');
      site.network.relays = [recusa, mudo];
      await db.put('site', site, 'site');
    }, [f.ws('c-recusa'), f.ws('c-mudo')]);
    await s.p.pg.click('#menu .item[data-tela="t7"]');
    await s.p.pg.waitForSelector('#t7-painel');
    await abrirAvancado(s.p.pg);
    const banco = await lerBanco(s.p.pg, s.ch.pubkey);
    const shas = Object.keys(banco.published.paths).map(k => banco.published.paths[k]);
    await s.p.pg.fill('#t7-tirar-confirma', 'Site do teste T7');
    await s.p.pg.click('#t7-tirar-botao');
    await s.p.pg.waitForFunction(() => { const e = document.getElementById('t7-tirar-erro'); return e && !e.hidden; }, null, { timeout: 120000 });
    const erro = await s.p.pg.textContent('#t7-tirar-erro');
    assert(/continua no ar/.test(erro) && /nenhum arquivo foi apagado/.test(erro), erro);
    for (const sha of shas) assert(f.temBlob('c1', sha), 'nenhum blob podia ter sido apagado');
    const depois = await lerBanco(s.p.pg, s.ch.pubkey);
    assert(Object.keys(depois.published.paths).length === shas.length, 'a fotografia não podia mudar');
    await s.p.pg.close();
    return erro.slice(0, 90);
  });

  await it('honestidade no placar (P13): servidor que recusa o DELETE é nomeado, e o site sai do ar mesmo assim', async () => {
    const s = await publicado({ servidores: [f.url('c1'), f.url('c-recusa')] });
    await s.p.pg.fill('#t7-tirar-confirma', 'Site do teste T7');
    await s.p.pg.click('#t7-tirar-botao');
    await s.p.pg.waitForSelector('#t7-tirar-feito', { timeout: 60000 });
    const linhas = await s.p.pg.$$eval('#t7-tirar-placar-servidores li', els => els.map(e => e.textContent));
    const recusa = linhas.find(l => /c-recusa/.test(l) || /127\.0\.0\.1/.test(l) && /0 apagado/.test(l));
    assert(linhas.length === 2, JSON.stringify(linhas));
    assert(linhas.some(l => /0 apagado\(s\), [1-9]\d* recusado/.test(l)), JSON.stringify(linhas));
    assert(linhas.some(l => /[1-9]\d* apagado\(s\), 0 recusado/.test(l)), JSON.stringify(linhas));
    assert(/levam minutos/.test(await s.p.pg.textContent('#t7-tirar-do-ar')), 'o aviso de propagação (P1) devia estar no placar');
    await s.p.pg.close();
    return (recusa || linhas.join(' | ')).slice(0, 110);
  });

  await it('"Começar um site novo" (T2) já não é beco sem saída: leva a T7 com o site criado e editável', async () => {
    const ch = F.chave();
    const p = await abrir(ctx, u.url);
    await semearSite(p.pg, ch, { relays: [f.ws('c-ok')], servers: SERVIDORES });
    await entrarCom(p.pg, ch.nsec);
    await esperarT2(p.pg, 30000);
    await p.pg.click('#comecar-site');
    await p.pg.waitForSelector('#t7-painel');
    assert(await p.pg.$('#t7-titulo'), 'a tela devia estar montada, não em stub');
    await p.pg.fill('#t7-titulo', 'Meu site novo');
    await p.pg.fill('#t7-descricao', 'Primeira frase');
    await salvar(p.pg);
    const banco = await lerBanco(p.pg, ch.pubkey);
    assert(banco.site.title === 'Meu site novo' && banco.pages.length === 1, JSON.stringify([banco.site.title, banco.pages.length]));
    assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros }));
    await p.pg.close();
    return 'T2 → T7 com o site criado';
  });

  // --- 31: o contador de "Publicar" e as Configurações ---------------------

  await it('31: mexer SÓ nas Configurações acende o contador de "Publicar", e T3 diz o que mudou', async () => {
    // O relato do dono era este: "só é publicado quando inserimos ou alteramos
    // mídia, página ou artigo". O motor estava certo o tempo todo — trocar o
    // título produz 4 caminhos a atualizar —; cego era o contador, que somava
    // status de registros e o `site` não tem status nenhum.
    const s = await publicado();
    await aba(s.p.pg, 'site');
    await s.p.pg.waitForSelector('#t7-titulo');
    const depoisDePublicar = await s.p.pg.textContent('#btn-publicar');
    assert(/Nada a publicar/.test(depoisDePublicar), 'acabou de publicar: ' + depoisDePublicar);

    await s.p.pg.fill('#t7-titulo', 'Site do teste T7 — outro nome');
    await salvar(s.p.pg);
    const aceso = await s.p.pg.textContent('#btn-publicar');
    assert(/Publicar \(1\)/.test(aceso), 'mudou só o título: ' + aceso);

    // e o motor confirma que há mesmo o que subir — o contador não está a mentir
    // para o outro lado (13 §5.4: `plano.nada`).
    const plano = await s.p.pg.evaluate(async () => {
      const db = Shell.dados().db;
      const dados = { site: await db.get('site', 'site'), pages: await db.getAll('pages'), posts: await db.getAll('posts'), media: await db.getAll('media') };
      const g = await Gerador.gerarSite(dados);
      const pl = Publicar.planear({ dados: dados, published: await db.get('published', 'current'), gerado: g });
      return { nada: pl.nada, atualiza: pl.atualiza.length, kind0: pl.eventos.kind0 };
    });
    assert(plano.nada === false && plano.atualiza > 0, JSON.stringify(plano));

    // T3 tem de dizer o QUE mudou: sem registros pendentes, "0 artigos, 0
    // páginas, 0 mídias" seria pior do que calar.
    await s.p.pg.click('#menu .item[data-tela="t3"]');
    await s.p.pg.waitForSelector('#cartao-alteracoes');
    const resumo = await s.p.pg.textContent('#alteracoes-resumo');
    assert(/Configurações do site alteradas/.test(resumo), resumo);

    // publicar outra vez apaga o aviso — a fotografia nova guarda a configuração
    await s.p.pg.click('#btn-publicar');
    await s.p.pg.waitForSelector('#t8-assinar:not([disabled])', { timeout: 30000 });
    await s.p.pg.click('#t8-assinar');
    await s.p.pg.waitForSelector('#t8-publicado', { timeout: 60000 });
    const apagado = await s.p.pg.textContent('#btn-publicar');
    assert(/Nada a publicar/.test(apagado), 'publicou de novo: ' + apagado);

    assert(s.p.erros.length === 0 && s.p.consoleErros.length === 0, JSON.stringify({ pageerror: s.p.erros, console: s.p.consoleErros }));
    await s.p.pg.close();
    return 'contador 0 → 1 → 0 mexendo só no título; ' + plano.atualiza + ' caminhos a atualizar, kind0 ' + plano.kind0;
  });

  await it('31: fotografia antiga (sem `site_config`) não inventa pendência — e ainda apanha o título pelas tags do manifest', async () => {
    // Quem já tem site publicado por versão anterior não tem a configuração
    // guardada. O caminho de reserva usa só o que a fotografia velha traz;
    // o que ele NÃO pode fazer é acender sozinho e nunca mais apagar.
    const s = await publicado();
    const r = await s.p.pg.evaluate(async () => {
      const db = Shell.dados().db;
      const site = await db.get('site', 'site');
      const pub = await db.get('published', 'current');
      const velha = Object.assign({}, pub); delete velha.site_config;   // como era antes de 2026-08-31
      const media = await db.getAll('media');
      const outro = Object.assign({}, site, { title: 'Nome trocado' });
      const soMenu = Object.assign({}, site, { menu: [] });
      return {
        temCampo: pub.site_config !== undefined,
        parada: Publicar.configPendente(site, velha, media),       // nada mudou → false
        titulo: Publicar.configPendente(outro, velha, media),      // título → apanhado pelas tags
        menu: Publicar.configPendente(soMenu, velha, media),       // menu → fora do alcance da fotografia velha
        exata: Publicar.configPendente(soMenu, pub, media)         // com o campo novo → apanhado
      };
    });
    assert(r.temCampo === true, 'a fotografia nova tem de guardar a configuração');
    assert(r.parada === false, 'sem mudança nenhuma não pode acender');
    assert(r.titulo === true, 'o título está nas tags do manifest, tem de ser apanhado');
    assert(r.menu === false, 'o menu não cabe na fotografia velha — honesto é não adivinhar');
    assert(r.exata === true, 'com a fotografia nova, o menu tem de ser apanhado');
    await s.p.pg.close();
    return 'reserva conservadora: título sim, menu só com a fotografia nova';
  });

  // 12 — a troca de tema na aba Aparência: a lista vem do registo, escolher
  // outro tema troca as opções desenhadas, o aviso diz que muda todas as
  // páginas (é HTML, não só CSS), o CSS gerado é o do tema novo, a prévia
  // também, e o banco guarda id + versão do manifesto com opções vazias.
  // 12 — ESCOLHER o tema mudou de casa em 2026-09-05: o `<select>` desta aba
  // virou a galeria de T12. O que fica aqui é a outra metade: a aba diz qual
  // tema está em uso, desenha as opções DESSE tema, leva à galeria, e o que
  // se muda aqui sai no CSS e na prévia. A troca em si é medida em
  // telas/t12_temas.
  await it('12: a aba Aparência mostra o tema em uso, desenha as opções DELE e leva à galeria; o que se muda aqui sai no CSS e na prévia', async () => {
    const { p, ch } = await sessao();
    await aba(p.pg, 'aparencia');
    assert(/Padrão/.test(await p.pg.textContent('#t7-tema')), 'devia dizer que o tema em uso é o Padrão');
    assert(!(await p.pg.$('#t7-tema-escolha')), 'o seletor de tema saiu desta aba (foi para T12)');
    assert(!(await p.pg.$('#t7-tema-desconhecido')), 'com o Padrão não há aviso de tema desconhecido');
    // o caminho para a galeria existe e leva lá
    await p.pg.click('#t7-ir-temas');
    await p.pg.waitForSelector('#t12-grade');
    assert((await p.pg.evaluate(() => Shell.telaAtual())) === 't12', 'o link devia levar à galeria de temas');
    // e de volta: as opções desenhadas são as do tema em uso
    await p.pg.click('#menu .item[data-tela="t7"]'); await p.pg.waitForSelector('#t7-painel');
    await aba(p.pg, 'aparencia');
    await p.pg.waitForSelector('#t7-opcao-fonte_texto');
    await p.pg.selectOption('#t7-opcao-fonte_texto', 'sem-serifa');
    const aviso = await salvar(p.pg);
    assert(/folha de estilo/.test(aviso), 'mudar uma opção do tema sobe um arquivo, não o site inteiro: ' + aviso);
    const banco = await lerBanco(p.pg, ch.pubkey);
    assert(banco.site.theme.id === 'padrao' && banco.site.theme.options.fonte_texto === 'sem-serifa', JSON.stringify(banco.site.theme));
    await p.pg.click('#t7-previa');
    await p.pg.waitForSelector('#previa-completa');
    const estilo = await p.pg.frameLocator('#previa-completa').locator('style').first().textContent();
    assert(/tema Padrão v4/.test(estilo), 'a prévia devia usar o CSS do Padrão');
    await p.pg.close();
    return 'aba diz "Padrão", sem seletor, link leva a T12, opção do tema muda só o CSS';
  });

  await it('12: um site cujo tema não vem com este app é gerado com o Padrão, e a aba Aparência diz isso de frente', async () => {
    const { p, ch } = await sessao();
    await p.pg.evaluate(async ([pubkey]) => {
      const db = await Db.abrir(pubkey);
      const site = await db.get('site', 'site');
      site.theme = { id: 'tema-de-outra-pessoa', version: 7, options: { x: 'y' } };
      await db.put('site', site, 'site'); db.fechar();
    }, [ch.pubkey]);
    await p.pg.goto(p.pg.url()); // recarregar a tela com o banco novo
    await entrarCom(p.pg, ch.nsec); await esperarT2(p.pg, 30000);
    await p.pg.click('#menu .item[data-tela="t7"]'); await p.pg.waitForSelector('#t7-painel');
    await aba(p.pg, 'aparencia');
    assert(/tema-de-outra-pessoa/.test(await p.pg.textContent('#t7-tema-desconhecido')), 'devia avisar qual tema falta');
    assert(/Padrão/.test(await p.pg.textContent('#t7-tema')), 'o rótulo devia dizer Padrão, que é o que vai gerar');
    const g = await homeGerada(p.pg);
    assert(/tema Padrão v4/.test(g.css), 'o site devia sair com o Padrão');
    await p.pg.close();
    return 'id desconhecido → aviso na tela, rótulo no Padrão, site gerado com o Padrão';
  });

  return R;
};
