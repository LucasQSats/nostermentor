// test/telas/t12_temas.test.js — T12 Temas pela INTERFACE (14 T12): a galeria
// que substituiu o `<select>` da aba Aparência em 2026-09-05. Mede o que o
// dono faz: abrir a tela pelo menu, ver um cartão por tema com a prévia do
// PRÓPRIO site, escolher outro, salvar, e o site sair com o tema escolhido.
//
// Os dois casos que valem mais que a contagem de cartões:
//  - a prévia de cada cartão é o site gerado com AQUELE tema, e não o mesmo
//    HTML com outro CSS: os quatro temas diferem em seis dos oito moldes, e
//    uma prévia que só trocasse a folha de estilo mentiria (medido 2026-09-05);
//  - o iframe da prévia é `sandbox` SEM `allow-same-origin` (02 G.2): um tema
//    é código que o dono não escreveu, e a prévia não pode ler o painel.
// ⚠️ A prévia lê-se pelo `srcdoc`, nunca pelo `contentDocument` — o iframe é
// de origem opaca de propósito, e `contentDocument` devolve null (02 §F.1).
const { abrir, coletor, assert, entrarCom, semearSite, esperarT2, lerBanco } = require('../util.js');
const F = require('../fabrica.js');

module.exports = async function (ctx, u) {
  const { R, it, pulado } = coletor();
  if (!u.falso) { pulado('telas/t12_temas (todos os casos)', 'servidor falso indisponível'); return R; }
  const f = u.falso;
  f.blossom('t12a', {}); f.relay('t12r', { escrita: 'aceita', eventos: [] });

  // Sessão com conteúdo de verdade: sem página nem artigo a prévia sairia
  // vazia e o caso não mediria nada.
  async function sessao() {
    const ch = F.chave();
    const p = await abrir(ctx, u.url);
    await semearSite(p.pg, ch, { relays: [f.ws('t12r')], servers: [f.url('t12a')], title: 'Caderno de Bordo' });
    await entrarCom(p.pg, ch.nsec);
    await esperarT2(p.pg, 30000);
    await p.pg.evaluate(async ([pubkey]) => {
      const db = await Db.abrir(pubkey);
      const site = await db.get('site', 'site');
      const home = Modelo.novaPagina('Início'); home.body = 'Bem-vindo ao caderno.';
      const artigo = Modelo.novoArtigo('O primeiro mês'); artigo.body = 'Corpo do artigo.'; artigo.date = '2026-08-01T09:30:00Z';
      site.description = 'Notas de quem aprende em voz alta';
      site.home = { mode: 'page', page_id: home.id, latest_posts: 5 };
      site.menu = [{ type: 'page', page_id: home.id }, { type: 'blog' }];
      await db.escrever([{ op: 'put', store: 'site', chave: 'site', valor: site },
        { op: 'put', store: 'pages', valor: home }, { op: 'put', store: 'posts', valor: artigo }]);
      db.fechar();
    }, [ch.pubkey]);
    await irAGaleria(p.pg);
    return { p, ch };
  }

  // Espera as prévias: o aviso "Montando…" esconde-se quando todas estão feitas.
  async function irAGaleria(pg) {
    await pg.click('#menu .item[data-tela="t12"]');
    await pg.waitForSelector('#t12-grade');
    await pg.waitForFunction(() => { const c = document.getElementById('t12-carregando'); return c && c.hidden; }, null, { timeout: 30000 });
  }

  const salvar = async (pg) => { await pg.click('#t12-salvar'); await pg.waitForFunction(() => document.getElementById('t12-salvar').textContent === 'Salvar'); return pg.textContent('#t12-aviso'); };
  const homeGerada = (pg) => pg.evaluate(async () => {
    const db = Shell.dados().db;
    const dados = { site: await db.get('site', 'site'), pages: await db.getAll('pages'), posts: await db.getAll('posts'), media: await db.getAll('media') };
    const g = await Gerador.gerarSite(dados);
    const home = g.arquivos.find(a => a.path === '/index.html');
    const css = g.arquivos.find(a => a.path === '/tema/estilo.css');
    return { home: home ? home.texto : '', css: css ? css.texto : '' };
  });

  await it('a galeria tem um cartão por tema do registo, marca o que está em uso e só ele não oferece "Usar este tema"', async () => {
    const { p } = await sessao();
    const cartoes = await p.pg.$$eval('.tema-cartao[data-tema]', els => els.map(e => ({
      id: e.getAttribute('data-tema'),
      nome: e.querySelector('.tema-nome').textContent,
      emUso: !!e.querySelector('.etiqueta-uso'),
      temUsar: !!e.querySelector('.tema-usar'),
      atual: e.classList.contains('atual')
    })));
    const doRegisto = await p.pg.evaluate(() => Temas.todos().map(t => t.manifesto.id));
    assert(cartoes.length === doRegisto.length, 'um cartão por tema do registo: ' + cartoes.length + ' vs ' + doRegisto.length);
    assert(cartoes.map(c => c.id).join(',') === doRegisto.join(','), 'ordem: ' + cartoes.map(c => c.id).join(','));
    const emUso = cartoes.filter(c => c.emUso);
    assert(emUso.length === 1 && emUso[0].id === 'padrao', 'só o Padrão devia estar em uso: ' + JSON.stringify(emUso));
    assert(emUso[0].atual && !emUso[0].temUsar, 'o tema em uso não oferece "Usar este tema"');
    assert(cartoes.filter(c => c.temUsar).length === doRegisto.length - 1, 'todos os outros oferecem "Usar este tema"');
    // o nome vem do manifesto, não de uma lista escrita à mão no painel
    const nomes = await p.pg.evaluate(() => Temas.todos().map(t => t.manifesto.nome));
    assert(cartoes.map(c => c.nome).join(',') === nomes.join(','), 'os nomes vêm do manifesto: ' + cartoes.map(c => c.nome).join(','));
    await p.pg.close();
    return cartoes.length + ' cartões (' + cartoes.map(c => c.id).join(',') + '), "Em uso" só no padrao';
  });

  // O caso que justifica gerar o site quatro vezes em vez de trocar só o CSS.
  await it('a prévia de cada cartão é o site do dono gerado com AQUELE tema — moldes e CSS, não só a folha de estilo', async () => {
    const { p } = await sessao();
    const previas = await p.pg.$$eval('.tema-cartao[data-tema] .tema-iframe', els => els.map(e => ({
      id: e.closest('.tema-cartao').getAttribute('data-tema'),
      sandbox: e.getAttribute('sandbox'),
      srcdoc: e.srcdoc || ''
    })));
    assert(previas.length >= 4, 'devia haver uma prévia por tema: ' + previas.length);
    for (const pv of previas) {
      assert(pv.sandbox === 'allow-scripts', 'a prévia de um tema não pode ter allow-same-origin (02 G.2): ' + pv.id + ' → ' + pv.sandbox);
      assert(/<style>/.test(pv.srcdoc), 'a prévia leva o CSS embutido, não um <link> que o iframe opaco não resolveria: ' + pv.id);
      assert(!/<link[^>]+estilo\.css/.test(pv.srcdoc), 'não pode sobrar o <link> para /tema/estilo.css: ' + pv.id);
      assert(/Caderno de Bordo/.test(pv.srcdoc), 'a prévia é o site DO DONO, com o título dele: ' + pv.id);
      assert(!/https?:\/\//.test(pv.srcdoc.replace(/https?:\/\/www\.w3\.org/g, '')), 'nada externo pode sair da prévia: ' + pv.id);
    }
    // o CSS de cada prévia é o do seu tema…
    const porTema = {};
    for (const pv of previas) porTema[pv.id] = pv.srcdoc;
    const assinaturas = await p.pg.evaluate(() => { const o = {}; for (const t of Temas.todos()) o[t.manifesto.id] = t.css({}).slice(0, 40); return o; });
    for (const id of Object.keys(assinaturas)) assert(porTema[id].indexOf(assinaturas[id]) !== -1, 'a prévia de ' + id + ' devia trazer o CSS de ' + id);
    // …e o HTML segue os MOLDES, não o CSS. A regra tem dois lados, e os dois
    // importam para a tela:
    //  · dois temas com moldes diferentes TÊM de dar HTML diferente — senão a
    //    prévia barata (um HTML + N folhas de estilo) mentiria, mostrando o
    //    Diário com a estrutura do Padrão;
    //  · dois temas com os MESMOS moldes têm de dar HTML igual — e é isso que
    //    autoriza a tela a gerar uma vez por grupo em vez de uma vez por tema.
    // ⚠️ Isto mudou em 2026-09-05, com 21 temas: antes eram quatro, todos com
    // moldes próprios, e o caso exigia 4 HTML distintos em 4. Hoje 15 dos 21
    // são temas "só de CSS" (TEMAS.md §2) e partilham `Temas.moldes`.
    // ⚠️ A assinatura é só dos moldes que ESTA página usa. A prévia é a capa
    // do site, e a capa deste sítio está em modo "página" (ver `sessao()`
    // acima) — logo passa por `layout` e `pagina`, e por mais nenhum. Assinar
    // os oito daria falso alarme: o Panfleto troca `artigo`, `blog` e
    // `etiqueta` e tem a mesma capa que o Padrão, o que está certo.
    const USADOS = ['layout', 'pagina'];
    const assinaturas2 = await p.pg.evaluate((usados) => { const o = {}; for (const t of Temas.todos()) o[t.manifesto.id] = JSON.stringify(usados.map(k => t.templates[k])); return o; }, USADOS);
    const corpoDe = (id) => porTema[id].replace(/<style>[\s\S]*?<\/style>/, '');
    const ids = Object.keys(porTema);
    for (const a of ids) for (const b of ids) {
      if (a >= b) continue;
      const mesmosMoldes = assinaturas2[a] === assinaturas2[b];
      const mesmoHtml = corpoDe(a) === corpoDe(b);
      if (mesmosMoldes !== mesmoHtml) {
        throw new Error(mesmosMoldes
          ? a + ' e ' + b + ' têm os mesmos moldes de capa e deram HTML diferente — a prévia depende de algo que não são os moldes'
          : a + ' e ' + b + ' têm moldes de capa diferentes e deram o MESMO HTML — a prévia não está a usar os moldes do tema');
      }
    }
    const distintos = new Set(ids.map(corpoDe));
    const grupos = new Set(ids.map(id => assinaturas2[id]));
    assert(distintos.size === grupos.size, 'um HTML distinto por grupo de moldes de capa: ' + distintos.size + ' HTML para ' + grupos.size + ' grupos');
    assert(grupos.size > 1, 'se todos os temas partilhassem moldes, a prévia cara deixaria de se justificar');
    await p.pg.close();
    return previas.length + ' prévias isoladas, CSS do próprio tema, ' + distintos.size + ' HTML distintos para ' + grupos.size + ' jogos de moldes de capa (layout+pagina) em ' + ids.length + ' temas';
  });

  await it('escolher um tema não grava sozinho: o aviso diz "ainda não está salvo" e só o Salvar leva ao banco e ao site', async () => {
    const { p, ch } = await sessao();
    assert(await p.pg.evaluate(() => document.getElementById('t12-salvar').disabled), 'nada mudou: Salvar devia começar desligado');
    await p.pg.click('.tema-cartao[data-tema="jornal"] .tema-usar');
    assert(/ainda não está salvo/i.test(await p.pg.textContent('#t12-aviso')), await p.pg.textContent('#t12-aviso'));
    assert(!(await p.pg.evaluate(() => document.getElementById('t12-salvar').disabled)), 'escolher devia ligar o Salvar');
    // o cartão mudou de lugar na tela, mas o banco ainda não
    assert(await p.pg.$('.tema-cartao[data-tema="jornal"] .etiqueta-uso'), 'o Jornal devia aparecer como em uso no rascunho');
    let banco = await lerBanco(p.pg, ch.pubkey);
    assert(banco.site.theme.id === 'padrao', 'antes do Salvar o banco continua no Padrão: ' + JSON.stringify(banco.site.theme));
    const aviso = await salvar(p.pg);
    assert(/muda todas as páginas/.test(aviso), 'trocar de tema regenera tudo, e a tela tem de o dizer: ' + aviso);
    banco = await lerBanco(p.pg, ch.pubkey);
    assert(banco.site.theme.id === 'jornal' && banco.site.theme.version === 1, JSON.stringify(banco.site.theme));
    assert(JSON.stringify(banco.site.theme.options) === '{}', 'as opções são do tema: trocar limpa-as (TEMAS.md §3): ' + JSON.stringify(banco.site.theme.options));
    const g = await homeGerada(p.pg);
    assert(/tema Jornal v1/.test(g.css), 'o site devia sair com o CSS do Jornal: ' + g.css.slice(0, 120));
    assert(/class="banca"/.test(g.home), 'e com o cabeçalho de banca do Jornal');
    await p.pg.close();
    return 'padrao → jornal: rascunho na tela, banco e site só depois do Salvar';
  });

  // As opções são do tema, não do site: quem troca perde as que tinha. Isso
  // decide COM QUE opções cada cartão se desenha, e a resposta não é a mesma
  // para todos — daí o caso.
  await it('o cartão do tema em uso mostra as opções que o dono escolheu; os outros mostram-se como chegam', async () => {
    const { p } = await sessao();
    // uma opção bem visível no Padrão: o esquema escuro
    await p.pg.evaluate(async () => {
      const db = Shell.dados().db;
      const site = await db.get('site', 'site');
      site.theme = { id: 'padrao', version: 4, options: { esquema: 'escuro' } };
      await db.put('site', site, 'site');
    });
    await p.pg.click('#menu .item[data-tela="t3"]'); await p.pg.waitForSelector('#t3');
    await irAGaleria(p.pg);
    const srcdocs = await p.pg.$$eval('.tema-cartao[data-tema] .tema-iframe', els => {
      const o = {}; for (const e of els) o[e.closest('.tema-cartao').getAttribute('data-tema')] = e.srcdoc || ''; return o;
    });
    const escuroPadrao = await p.pg.evaluate(() => Temas.porId('padrao').css({ esquema: 'escuro' }));
    const claroPadrao = await p.pg.evaluate(() => Temas.porId('padrao').css({}));
    assert(srcdocs.padrao.indexOf(escuroPadrao) !== -1, 'o cartão em uso devia trazer o CSS com o esquema escuro que o dono escolheu');
    assert(srcdocs.padrao.indexOf(claroPadrao) === -1, 'e não o CSS com as opções vazias');
    // já o Jornal desenha-se como chega: é o que "Usar este tema" daria
    const jornalVazio = await p.pg.evaluate(() => Temas.porId('jornal').css({}));
    assert(srcdocs.jornal.indexOf(jornalVazio) !== -1, 'o cartão de um tema NÃO em uso mostra-o com as opções dele por omissão');
    await p.pg.close();
    return 'em uso → com as opções do dono; os outros → como chegam';
  });

  // Decisão dele, 2026-09-05: trocar de tema e voltar não pode perder os
  // ajustes. A gaveta vive em `site.theme_memory`, é LOCAL (não sai no
  // site.json) e vai no backup.
  await it('trocar de tema e voltar traz de volta os ajustes — e a gaveta não sai no site.json nem acende o "Publicar" à toa', async () => {
    const { p, ch } = await sessao();
    // ajusta o Padrão e salva
    await p.pg.click('#menu .item[data-tela="t7"]'); await p.pg.waitForSelector('#t7-painel');
    await p.pg.click('.abas .aba[data-aba="aparencia"]');
    await p.pg.waitForSelector('#t7-opcao-esquema');
    await p.pg.selectOption('#t7-opcao-esquema', 'escuro');
    await p.pg.click('#t7-salvar'); await p.pg.waitForFunction(() => document.getElementById('t7-salvar').textContent === 'Salvar');
    // vai ao Jornal e salva
    await irAGaleria(p.pg);
    await p.pg.click('.tema-cartao[data-tema="jornal"] .tema-usar');
    await salvar(p.pg);
    let banco = await lerBanco(p.pg, ch.pubkey);
    assert(banco.site.theme.id === 'jornal', JSON.stringify(banco.site.theme));
    assert(banco.site.theme_memory && banco.site.theme_memory.padrao && banco.site.theme_memory.padrao.esquema === 'escuro',
      'o ajuste do Padrão devia ficar guardado: ' + JSON.stringify(banco.site.theme_memory));
    // e volta ao Padrão: os ajustes voltam sozinhos
    await p.pg.click('.tema-cartao[data-tema="padrao"] .tema-usar');
    assert(/ajustes que você já tinha feito/.test(await p.pg.textContent('#t12-aviso')), 'a tela devia dizer que os ajustes voltaram: ' + (await p.pg.textContent('#t12-aviso')));
    await salvar(p.pg);
    banco = await lerBanco(p.pg, ch.pubkey);
    assert(banco.site.theme.id === 'padrao' && banco.site.theme.options.esquema === 'escuro',
      'ao voltar ao Padrão o fundo escuro devia voltar: ' + JSON.stringify(banco.site.theme));
    assert(!banco.site.theme_memory.padrao, 'o tema em uso sai da gaveta');
    // a gaveta é LOCAL: nunca no site.json publicado
    const publicado = await p.pg.evaluate(async () => {
      const db = Shell.dados().db;
      return SiteJson.escrever({ site: await db.get('site', 'site'), pages: await db.getAll('pages'), posts: await db.getAll('posts'), media: [] });
    });
    assert(publicado.indexOf('theme_memory') === -1, 'a gaveta não pode sair no site.json publicado');
    // e não muda a assinatura da configuração (não acende "Publicar" à toa)
    const igual = await p.pg.evaluate(async () => {
      const db = Shell.dados().db;
      const s = await db.get('site', 'site');
      const semGaveta = Object.assign({}, s); delete semGaveta.theme_memory;
      semGaveta.theme_memory = { diario: { paginado: 'nao' } };   // gaveta diferente
      return SiteJson.assinaturaSite(s) === SiteJson.assinaturaSite(semGaveta);
    });
    assert(igual, 'mexer na gaveta não pode mudar a assinatura da configuração publicada');
    await p.pg.close();
    return 'padrao(escuro) → jornal → padrao: escuro de volta; fora do site.json e da assinatura';
  });

  await it('"Ver maior" abre a prévia daquele tema isolada, e o Escape fecha', async () => {
    const { p } = await sessao();
    await p.pg.click('.tema-cartao[data-tema="diario"] .tema-ver');
    await p.pg.waitForSelector('#previa-completa');
    const sandbox = await p.pg.getAttribute('#previa-completa', 'sandbox');
    assert(sandbox === 'allow-scripts', 'a prévia grande também não pode ter allow-same-origin: ' + sandbox);
    const srcdoc = await p.pg.$eval('#previa-completa', e => e.srcdoc || '');
    const cssDiario = await p.pg.evaluate(() => Temas.porId('diario').css({}).slice(0, 40));
    assert(srcdoc.indexOf(cssDiario) !== -1, 'o modal devia mostrar o Diário');
    assert(/Diário/.test(await p.pg.textContent('#modal .modal-cabeca h2')), 'o título do modal nomeia o tema');
    await p.pg.keyboard.press('Escape');
    await p.pg.waitForFunction(() => !document.getElementById('modal-fundo'));
    await p.pg.close();
    return 'modal isolado com o CSS do Diário; Escape fecha';
  });

  await it('um tema que este app não conhece: a galeria avisa qual falta e o site continua a sair com o Padrão', async () => {
    const { p, ch } = await sessao();
    await p.pg.evaluate(async ([pubkey]) => {
      const db = await Db.abrir(pubkey);
      const site = await db.get('site', 'site');
      site.theme = { id: 'tema-de-outra-pessoa', version: 7, options: { x: 'y' } };
      await db.put('site', site, 'site'); db.fechar();
    }, [ch.pubkey]);
    await p.pg.goto(p.pg.url());
    await entrarCom(p.pg, ch.nsec); await esperarT2(p.pg, 30000);
    await irAGaleria(p.pg);
    assert(/tema-de-outra-pessoa/.test(await p.pg.textContent('#t12-desconhecido')), 'devia dizer qual tema falta');
    assert(!(await p.pg.$('.tema-cartao .etiqueta-uso')), 'nenhum cartão pode dizer "Em uso": o tema em uso não é nenhum destes');
    const g = await homeGerada(p.pg);
    assert(/tema Padrão v4/.test(g.css), 'o site devia sair com o Padrão');
    await p.pg.close();
    return 'id desconhecido → aviso na galeria, nenhum cartão em uso, site com o Padrão';
  });

  // O cartão de envio existe e está desligado — e o texto tem de dizer POR QUÊ,
  // porque a razão é de privacidade do LEITOR e não uma limitação qualquer.
  await it('o cartão "Enviar um tema" está presente, sem controle de envio, e explica a razão (02 G.2.4)', async () => {
    const { p } = await sessao();
    const cartao = await p.pg.$('#t12-enviar');
    assert(cartao, 'o cartão de envio devia existir, mesmo desligado');
    const t = await p.pg.textContent('#t12-enviar');
    assert(/servidor/.test(t) && /quem visita o seu site|quem visitou/.test(t), 'o texto tem de dizer o que estaria em risco: ' + t.slice(0, 160));
    assert(!(await p.pg.$('#t12-enviar input[type="file"]')), 'não pode haver campo de arquivo enquanto não há validador');
    assert(!(await p.pg.$('#t12-enviar button')), 'nem botão que finja funcionar');
    await p.pg.close();
    return 'cartão presente, sem input nem botão, razão dita por extenso';
  });

  // Responsividade: a galeria é do painel, e o painel também é lido em ecrã
  // pequeno. A grade não pode empurrar a página para o lado — o que estoura
  // no painel a 320 px é a barra do topo, que é anterior a esta tela.
  await it('a grade adapta-se sem estourar: de 1200 a 320 px o conteúdo desta tela cabe na largura disponível', async () => {
    const { p } = await sessao();
    const medidas = [];
    for (const largura of [1200, 1000, 700, 480, 320]) {
      await p.pg.setViewportSize({ width: largura, height: 900 });
      await p.pg.waitForTimeout(150);
      const m = await p.pg.evaluate(() => {
        const limite = document.getElementById('conteudo').getBoundingClientRect().right;
        let piores = 0;
        for (const e of document.querySelectorAll('#t12 *')) {
          const b = e.getBoundingClientRect();
          if (b.width > 0 && b.right > limite + 1) piores++;
        }
        const previa = document.querySelector('.tema-previa');
        const ifr = document.querySelector('.tema-iframe');
        const pb = previa.getBoundingClientRect(), ib = ifr.getBoundingClientRect();
        return { forasDeMedida: piores, previaL: Math.round(pb.width), iframeL: Math.round(ib.width) };
      });
      medidas.push(largura + ':' + m.forasDeMedida);
      assert(m.forasDeMedida === 0, 'a ' + largura + ' px, ' + m.forasDeMedida + ' elementos de T12 passam da área de conteúdo');
      // a prévia encolhe para caber na moldura, seja qual for a largura do cartão
      assert(Math.abs(m.previaL - m.iframeL) <= 2, 'a ' + largura + ' px a prévia devia encher a moldura: moldura ' + m.previaL + ', iframe ' + m.iframeL);
    }
    await p.pg.setViewportSize({ width: 1200, height: 600 });
    await p.pg.close();
    return 'sem estouro em 1200/1000/700/480/320 (' + medidas.join(' ') + '); prévia sempre à medida da moldura';
  });

  return R;
};
