// test/core/responsivo.test.js — RESPONSIVIDADE DO SITE PUBLICADO, medida.
//
// Nasceu do pedido do dono (2026-09-05): antes de escrever a especificação de
// temas, medir o que o tema Padrão faz em telas reais — "qualquer tema deve ter
// prioritariamente alta responsividade com qualquer tamanho de tela". Os
// números que saem daqui são o que a spec vai exigir dos temas futuros, em vez
// de boas intenções genéricas.
//
// O que se mede NÃO é o painel: é o HTML+CSS que o gerador entrega ao LEITOR.
// O site publicado não tem uma linha de script (02 G.0), logo tudo o que
// adapta a página é CSS — e o tema Padrão não tem uma única `@media`: a
// adaptação é fluida por construção (viewport, max-width:100%, flex-wrap,
// grade auto-fill). Isto aqui responde se essa aposta se sustenta.
//
// MÉTODO: gera o site com `Gerador.gerarSite`, embute o CSS e troca as imagens
// por data: URI com `Gerador.previa` (é o que a prévia do painel já faz), põe o
// HTML numa página com `setContent` e redimensiona a janela. Sem rede, sem
// servidor, sem VM — a regra de medir barato antes da bancada.
//
// AS LARGURAS incluem as do Tor Browser, que é onde o leitor deste produto
// está: o letterboxing arredonda a área da página a múltiplos de 200×100 px
// (documentação do Tor Project, consultada em 2026-09-05) para esconder quem
// lê, e essas medidas não são as de celular nem as de desktop. MEDIDO em
// 2026-09-05 na bancada Tails 7.11 (tela 1280×800), com uma página-régua só
// de CSS, no nível de segurança padrão: janela maximizada → 1200×600; janela
// solta → 1000×500. O 800 fica como o múltiplo abaixo, para telas pequenas.
const { abrir, coletor } = require('../util.js');

// [largura, altura, rótulo, éTelefone]
const TELAS = [
  [320, 800, 'celular pequeno', true],
  [360, 800, 'Android comum', true],
  [390, 844, 'iPhone', true],
  [412, 915, 'Android grande', true],
  [768, 1024, 'tablet retrato', false],
  [800, 700, 'Tor Browser em tela pequena (múltiplo de 200)', false],
  [1000, 500, 'Tor Browser, janela solta (medido: Tails 7.11, tela 1280×800)', false],
  [1200, 600, 'Tor Browser maximizado (medido: Tails 7.11, tela 1280×800)', false],
  [1280, 800, 'portátil', false],
  [1920, 1080, 'monitor', false]
];
// Só destas se guarda imagem, para não encher a pasta de resultados.
const CAPTURAR = [320, 390, 768, 1280];
const ALVO_MIN = 24;   // WCAG 2.2 AA (2.5.8): alvo de toque mínimo 24x24 CSS px
const FONTE_MIN = 12;  // abaixo disto é texto que ninguém lê em celular

module.exports = async function (ctx, u) {
  const { R, it } = coletor();
  const p = await abrir(ctx, u.url);

  // --- o site de PIOR CASO, gerado dentro do app ---------------------------
  const sitio = await p.pg.evaluate(async () => {
    const svg = (w, h, cor) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '">' +
      '<rect width="100%" height="100%" fill="' + cor + '"/></svg>');

    const site = Modelo.sitePadrao('a'.repeat(64), 'npub1teste');
    site.title = 'Padaria da Esquina e Confeitaria Artesanal';
    site.description = 'Pão de verdade, todos os dias.';
    site.language = 'pt-BR';

    const md = [
      'Primeiro parágrafo, normal, para haver texto de corpo a medir o',
      'comprimento da linha em telas largas e a quebra em telas estreitas.',
      '',
      '## Um subtítulo qualquer',
      '',
      // 1. palavra gigante sem espaço — o caso clássico que estoura a coluna
      'ContraordenaçãoAdministrativaDesproporcionadamenteInconstitucionalizada é',
      'uma palavra que não cabe em 320 px de largura.',
      '',
      // 2. URL crua colada, que o marked transforma em link longo
      'Veja https://exemplo.test/um/caminho/muito/comprido/que/ninguem/escreveria/a/mao/mas/toda/a/gente/cola.html',
      '',
      // 3. tabela GFM — o tema não tem UMA regra de CSS para `table`
      '| Produto | Segunda | Terça | Quarta | Quinta | Sexta | Sábado |',
      '| --- | --- | --- | --- | --- | --- | --- |',
      '| Pão alentejano | 12 | 14 | 11 | 15 | 20 | 30 |',
      '| Broa de milho | 8 | 9 | 7 | 10 | 12 | 18 |',
      '',
      // 4. bloco de código longo (o `pre` tem overflow:auto — confirmar)
      '```',
      'const umaLinhaDeCodigoDeliberadamenteMuitoCompridaParaNaoCaber = { assim: true, ou: "assado" };',
      '```',
      '',
      // 5. citação e lista
      '> Uma citação para medir a barra lateral do blockquote.',
      '',
      '- primeiro item',
      '- segundo item',
      '',
      // 6. imagem local grande (vira data: URI de 1600x900 na prévia)
      '![Uma fotografia larga](/img/capa.png)',
      '',
      // 7. imagem REMOTA — o caso da pendência 53. Não carrega aqui (fica
      //    marcador), mas prova que passa pelo filtro e chega ao HTML.
      '<img src="https://terceiro.test/pixel.png" alt="de outro servidor">',
      '',
      // 8. os dois blocos do tema
      '[[botao: Encomende o seu pão de véspera aqui -> /encomendas.html]]',
      '',
      '[[artigos: 6, com-capa, com-resumo]]'
    ].join('\n');

    const capa = { id: 'm-capa', path: '/img/capa.png', mime: 'image/png', size: 4, sha256: 'b'.repeat(64), width: 1600, height: 900, alt: 'Uma fotografia larga', caption: 'Legenda da fotografia', bytes: null, status: 'published', servers: [], removal: null, metadata: { stripped: true, removed_segments: [], warning: null }, origin: 'upload', created_at: Modelo.agora(), updated_at: Modelo.agora(), previous_status: null };
    const logo = Object.assign({}, capa, { id: 'm-logo', path: '/img/logo.png', width: 1200, height: 200, alt: 'logo', caption: '' });
    site.logo_media_id = logo.id;

    const home = Modelo.novaPagina('Início'); home.id = 'p-home'; home.body = md; home.status = 'published'; home.cover_media_id = capa.id;
    const pages = [home];
    // menu com 8 itens, incluindo um rótulo longo: o cabeçalho é flex-wrap
    const rotulos = ['Sobre nós', 'Encomendas', 'Onde estamos', 'Horário de funcionamento', 'Contactos', 'Perguntas frequentes', 'Livro de reclamações'];
    for (const r of rotulos) { const pg = Modelo.novaPagina(r); pg.id = 'p-' + Modelo.slug(r); pg.body = 'Conteúdo de ' + r + '.'; pg.status = 'published'; pages.push(pg); }
    site.home = { mode: 'page', page_id: home.id, latest_posts: 3 };
    site.menu = pages.map(x => ({ type: 'page', page_id: x.id })).concat([{ type: 'blog' }]);

    const posts = [];
    const titulos = [
      'Um título de artigo deliberadamente comprido para ver como o tema se porta quando não cabe numa linha só',
      'Pão',
      'Fermentação natural: o guia completo passo a passo',
      'ReceitaDeBriocheComUmNomeSemEspacosNenhunsQueNaoQuebra',
      'A nossa broa de milho',
      'Encomendas de Natal'
    ];
    for (let i = 0; i < titulos.length; i++) {
      const a = Modelo.novoArtigo(titulos[i]); a.id = 'a-' + i;
      a.date = '2026-0' + (i + 1) + '-15T10:00:00Z';
      a.body = 'Corpo do artigo ' + i + '.\n\n' + md;
      a.tags = ['pão', 'receitas', 'fermentação natural', 'uma etiqueta de nome bastante comprido'];
      a.cover_media_id = capa.id; a.status = 'published';
      posts.push(a);
    }

    const dados = { site, pages, posts, media: [capa, logo] };
    // Caminho que não foi gerado é erro NOMEADO, não `null` a rebentar mais
    // à frente dentro de `Gerador.previa` — diz qual faltou e quais existem.
    const pegar = (gg, path) => { const a = gg.arquivos.find(x => x.path === path); if (!a) throw new Error('caminho não gerado: ' + path + ' — gerados: ' + gg.arquivos.map(x => x.path).join(' ')); return a.texto; };
    const uris = { '/img/capa.png': svg(1600, 900, '#8899aa'), '/img/logo.png': svg(1200, 200, '#aa8866') };

    // 12 — TODOS os temas registados, cada um em duas configurações: a padrão
    // (opções vazias) e o EXTREMO que o manifesto dele permite, derivado do
    // próprio manifesto (escolha → a última; medida → o máximo; cor → um
    // rosa forte). É o que faz um tema novo entrar na medição sem tocar aqui.
    const extremoDe = (m) => { const o = {}; for (const n of Object.keys(m.options || {})) { const d = m.options[n]; o[n] = d.tipo === 'escolha' ? d.opcoes[d.opcoes.length - 1][0] : d.tipo === 'medida' ? d.max : d.tipo === 'cor' ? '#c81e5a' : d.padrao; } return o; };
    const saida = { temas: {}, temImgRemota: false, temTabela: false };
    for (const tema of Temas.todos()) {
      const id = tema.manifesto.id, extremo = extremoDe(tema.manifesto);
      const g = await Gerador.gerarSite(Object.assign({}, dados, { site: Object.assign({}, site, { theme: { id: id, version: tema.manifesto.version, options: {} } }) }));
      const g2 = await Gerador.gerarSite(Object.assign({}, dados, { site: Object.assign({}, site, { theme: { id: id, version: tema.manifesto.version, options: extremo } }) }));
      const t = (path) => pegar(g, path), t2 = (path) => pegar(g2, path);
      saida.temas[id] = {
        home: Gerador.previa(t('/index.html'), uris, {}, tema),
        artigo: Gerador.previa(t('/blog/' + Modelo.slug(titulos[0]) + '.html'), uris, {}, tema),
        blog: Gerador.previa(t('/blog/index.html'), uris, {}, tema),
        etiqueta: Gerador.previa(t('/blog/etiqueta/' + Modelo.slug('fermentação natural') + '.html'), uris, {}, tema),
        'home-extremo': Gerador.previa(t2('/index.html'), uris, extremo, tema),
        'artigo-extremo': Gerador.previa(t2('/blog/' + Modelo.slug(titulos[0]) + '.html'), uris, extremo, tema)
      };
      if (id === 'padrao') { saida.temImgRemota = t('/index.html').indexOf('https://terceiro.test/pixel.png') !== -1; saida.temTabela = t('/index.html').indexOf('<table>') !== -1; }
    }
    return saida;
  });

  // --- a medição, numa página por largura ---------------------------------
  // ⚠️ O CONTEXTO É RECICLADO, e não é otimização: é o que faz a suíte acabar.
  // Medido em 2026-09-05, ao passar de 4 para 21 temas: são 6 páginas × 10
  // larguras × 21 temas = **1260 páginas por motor**, e abrir e fechar todas
  // no MESMO contexto levou o Firefox a **9,6 GB de RSS** numa máquina de
  // 15,5 GB — a suíte parou de progredir a meio (não deu erro: ficou a
  // arrastar-se) e foi preciso matá-la. Fechar o contexto de N em N páginas
  // devolve a memória ao sistema. `ctx` (o que a suíte recebe) fica intacto e
  // só serve para a página que gera o lugar.
  // ⚠️ 40 NÃO CHEGOU (segunda medição, 2026-09-05): o Firefox continuava a
  // crescer ~24 MB por página medida (1,9 GB às 71 capturas, 2,4 GB às 92) e
  // ia bater nos ~12 GB ao fim das 1260. Com 8, estabiliza. Abrir um contexto
  // custa muito menos do que a suíte não acabar.
  const POR_CONTEXTO = 8;
  let ctxMedida = null, usadasNoContexto = 0;
  async function contextoDeMedida() {
    if (ctxMedida && usadasNoContexto < POR_CONTEXTO) return ctxMedida;
    if (ctxMedida) await ctxMedida.close();
    ctxMedida = await ctx.browser().newContext({ ignoreHTTPSErrors: true });
    usadasNoContexto = 0;
    return ctxMedida;
  }

  async function medir(html, largura, altura, capturarComo) {
    const c = await contextoDeMedida();
    usadasNoContexto++;
    const pg = await c.newPage();
    // Sem rede, de fato: a prévia já troca toda imagem que não seja local por
    // um marcador data:, mas a página de medição recusa http(s) na mesma —
    // se algum dia escapar um pedido, o teste falha aqui e não o esconde.
    await pg.route(/^https?:/, (r) => r.abort());
    await pg.setViewportSize({ width: largura, height: altura });
    await pg.setContent(html, { waitUntil: 'load' });
    // A galeria usa `loading="lazy"`: o que está abaixo da dobra só carrega
    // quando o leitor rola até lá. Medir antes disso é medir um layout que o
    // leitor nunca vê (achado de 2026-09-05: no Firefox os cartões saíam sem
    // imagem na captura). Rola-se a página inteira, espera-se por TODAS as
    // imagens e volta-se ao topo; imagem que falhe fica contada em `quebradas`.
    await pg.evaluate(async () => {
      const passo = Math.max(200, window.innerHeight - 50);
      for (let y = 0; y <= document.documentElement.scrollHeight; y += passo) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 30)); }
      await Promise.all(Array.from(document.images).map(i => i.complete ? null : new Promise(r => { i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }); })));
      window.scrollTo(0, 0);
    });
    const m = await pg.evaluate(([ALVO_MIN, FONTE_MIN]) => {
      const de = document.documentElement;
      const janela = de.clientWidth;
      const out = { janela: janela, scrollWidth: de.scrollWidth, estouro: Math.max(0, de.scrollWidth - janela), culpados: [], alvos: [], fontes: [], colunaPx: 0, colunaCh: 0,
        imagens: document.images.length, quebradas: Array.from(document.images).filter(i => !i.complete || i.naturalWidth === 0).length };
      const nome = (el) => el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '') + (el.textContent ? ' «' + el.textContent.trim().slice(0, 28) + '»' : '');
      // quem passa da borda: só a FOLHA mais funda de cada ramo, para não
      // listar o body e todos os pais do verdadeiro culpado
      // Um elemento dentro de uma caixa que ROLA (overflow ≠ visible) e que
      // por sua vez cabe na janela não passa da borda: é o caso do `code`
      // dentro do `pre`, que tem overflow:auto — o leitor rola o bloco, não
      // a página. Sem esta guarda o `pre` protegido aparecia como culpado.
      const recortado = (el) => {
        for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
          const ov = getComputedStyle(a).overflowX;
          if (ov !== 'visible' && a.getBoundingClientRect().right <= janela + 1) return true;
        }
        return false;
      };
      const passa = [];
      for (const el of document.body.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (r.right > janela + 1 && !recortado(el)) passa.push(el);
      }
      for (const el of passa) {
        if (passa.some(o => o !== el && el.contains(o))) continue;  // tem filho que também passa
        const r = el.getBoundingClientRect();
        out.culpados.push({ el: nome(el), direita: Math.round(r.right), largura: Math.round(r.width) });
      }
      // imagens distorcidas: proporção desenhada vs. proporção natural (os
      // atributos width/height que o gerador escreve). Tolerância de 2%.
      out.distorcidas = [];
      for (const img of document.querySelectorAll('img[width][height]')) {
        const r = img.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const nat = parseInt(img.getAttribute('width'), 10) / parseInt(img.getAttribute('height'), 10);
        const des = r.width / r.height;
        if (Math.abs(des - nat) / nat > 0.02) out.distorcidas.push({ el: nome(img.parentElement) + ' > img', natural: Math.round(nat * 100) / 100, desenhada: Math.round(des * 100) / 100, w: Math.round(r.width), h: Math.round(r.height) });
      }
      // alvos de toque
      for (const el of document.querySelectorAll('a, button')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (r.width < ALVO_MIN || r.height < ALVO_MIN) out.alvos.push({ el: nome(el), w: Math.round(r.width), h: Math.round(r.height) });
      }
      // texto pequeno de mais (só elementos com texto próprio)
      const vistos = new Set();
      for (const el of document.body.querySelectorAll('*')) {
        const proprio = Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim());
        if (!proprio) continue;
        const px = parseFloat(getComputedStyle(el).fontSize);
        if (px < FONTE_MIN) { const k = el.tagName + px; if (!vistos.has(k)) { vistos.add(k); out.fontes.push({ el: nome(el), px: Math.round(px * 10) / 10 }); } }
      }
      // comprimento da linha de texto: a largura ÚTIL da coluna (o miolo de
      // .principal, sem o padding) dividida pela largura MEDIDA de um
      // caractere médio no tipo de letra do corpo — não uma estimativa de
      // "meio em por letra", que varia com a família e daria 96 onde são 85.
      // A LINHA que o leitor lê: o primeiro parágrafo de texto corrido
      // (não o de data nem o resumo). `getClientRects()[0]` é o primeiro
      // fragmento — num tema com colunas (Jornal) é a largura da COLUNA, que
      // é o que interessa; num tema sem colunas é o próprio parágrafo.
      // Página sem parágrafo corrido (as listagens) fica com colunaCh = 0 e
      // fora da regra dos 45–90: não há linha de leitura para medir.
      const par = Array.from(document.querySelectorAll('.principal p')).find(p => !p.className && p.textContent.trim().length > 40);
      if (par) {
        const r = par.getClientRects()[0];
        out.colunaPx = Math.round(r ? r.width : par.getBoundingClientRect().width);
        const sonda = document.createElement('span');
        sonda.textContent = 'O padeiro acorda antes do sol e amassa a farinha com água, sal e fermento, como o pai lhe ensinou há trinta anos.';
        sonda.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap';
        par.appendChild(sonda);
        out.charPx = Math.round(sonda.getBoundingClientRect().width / sonda.textContent.length * 100) / 100;
        sonda.remove();
        out.colunaCh = Math.round(out.colunaPx / out.charPx);
      }
      return out;
    }, [ALVO_MIN, FONTE_MIN]);
    if (capturarComo) await pg.screenshot({ path: u.captura(capturarComo), fullPage: true });
    await pg.close();
    return m;
  }

  // uma "página" é `<tema>/<página>` — o relatório diz qual tema falhou
  const paginas = [];
  for (const id of Object.keys(sitio.temas)) for (const nomePg of Object.keys(sitio.temas[id])) paginas.push([id + '/' + nomePg, sitio.temas[id][nomePg]]);
  const medidas = [];
  for (const [nomePg, html] of paginas) {
    for (const [w, h, rotulo, telefone] of TELAS) {
      const cap = (CAPTURAR.indexOf(w) !== -1) ? 'responsivo-' + nomePg.replace('/', '-') + '-' + w : null;
      const m = await medir(html, w, h, cap);
      medidas.push({ pagina: nomePg, largura: w, rotulo, telefone, m });
    }
  }
  // As medidas inteiras, por página e largura: os casos abaixo resumem, e a
  // spec de temas precisa dos números todos, não dos 6 primeiros.
  require('fs').writeFileSync(require('path').join(u.res, 'responsivo-medidas-' + u.motor + '.json'), JSON.stringify(medidas, null, 1));

  // --- os casos -----------------------------------------------------------
  const resumo = (lista, f) => lista.slice(0, 6).map(f).join(' | ') + (lista.length > 6 ? ` … +${lista.length - 6}` : '');

  await it('a página nunca rola para o lado, em nenhuma largura', async () => {
    const maus = medidas.filter(x => x.m.estouro > 0);
    if (maus.length) throw new Error(resumo(maus, x => `${x.pagina}@${x.largura} estoura ${x.m.estouro}px (${x.m.culpados.map(c => c.el).slice(0, 2).join(', ') || 'sem folha identificada'})`));
  }, R);

  await it('nenhum elemento passa da borda direita', async () => {
    const maus = medidas.filter(x => x.m.culpados.length);
    if (maus.length) throw new Error(resumo(maus, x => `${x.pagina}@${x.largura}: ${x.m.culpados.map(c => c.el + ' →' + c.direita).slice(0, 2).join(' ; ')}`));
  }, R);

  await it('em celular, todo link tem pelo menos 24x24 px de alvo', async () => {
    const maus = medidas.filter(x => x.telefone && x.m.alvos.length);
    if (maus.length) throw new Error(resumo(maus, x => `${x.pagina}@${x.largura}: ${x.m.alvos.length} alvos pequenos — ${x.m.alvos.map(a => a.el.split(' «')[0] + ' ' + a.w + 'x' + a.h).slice(0, 3).join(', ')}`));
  }, R);

  await it('nenhuma imagem sai distorcida (o logo horizontal em tela estreita)', async () => {
    const maus = medidas.filter(x => x.m.distorcidas.length);
    if (maus.length) throw new Error(resumo(maus, x => `${x.pagina}@${x.largura}: ${x.m.distorcidas.map(d => d.el.split(' «')[0] + ' ' + d.w + 'x' + d.h + ' (natural ' + d.natural + ':1, desenhada ' + d.desenhada + ':1)').slice(0, 2).join(' ; ')}`));
  }, R);

  await it('nenhum texto abaixo de 12 px', async () => {
    const maus = medidas.filter(x => x.m.fontes.length);
    if (maus.length) throw new Error(resumo(maus, x => `${x.pagina}@${x.largura}: ${x.m.fontes.map(f => f.el.split(' «')[0] + ' ' + f.px + 'px').slice(0, 3).join(', ')}`));
  }, R);

  // Decisão do dono (2026-09-05): a regra dos 45–90 vale para a configuração
  // PADRÃO do tema. A "larga" existe de propósito e é escolha de quem publica;
  // o que ela dá fica registado no detalhe, para a spec, sem reprovar.
  await it('a coluna de texto fica entre 45 e 90 caracteres em tela larga (configuração padrão)', async () => {
    const largas = medidas.filter(x => x.largura >= 1000 && x.m.colunaCh > 0);
    const padrao = largas.filter(x => x.pagina.indexOf('-extremo') === -1);
    const maus = padrao.filter(x => x.m.colunaCh < 45 || x.m.colunaCh > 90);
    if (maus.length) throw new Error(resumo(maus, x => `${x.pagina}@${x.largura}: ~${x.m.colunaCh} caracteres (${x.m.colunaPx}px ÷ ${x.m.charPx}px por letra)`));
    const em1280 = largas.filter(x => x.largura === 1280 && x.pagina.endsWith('/artigo'));
    return em1280.map(x => `${x.pagina.split('/')[0]} ~${x.m.colunaCh} caracteres (${x.m.colunaPx}px)`).join('; ') + ' — extremos informativos: ' +
      largas.filter(x => x.largura === 1280 && x.pagina.endsWith('/artigo-extremo')).map(x => `${x.pagina.split('/')[0]} ~${x.m.colunaCh}`).join(', ');
  }, R);

  await it('o conteúdo do dono chega ao HTML com imagem remota e tabela (base da medição)', async () => {
    if (!sitio.temImgRemota) throw new Error('a <img> remota não sobreviveu ao filtro — o pior caso não foi medido');
    if (!sitio.temTabela) throw new Error('a tabela GFM não foi gerada — o pior caso não foi medido');
    const semImagem = medidas.filter(x => x.m.quebradas > 0);
    if (semImagem.length) throw new Error('imagens por carregar na hora de medir: ' + resumo(semImagem, x => `${x.pagina}@${x.largura} ${x.m.quebradas}/${x.m.imagens}`));
    return `${Object.keys(sitio.temas).length} temas (${Object.keys(sitio.temas).join(', ')}), ${medidas.length} medições, todas com as imagens carregadas`;
  }, R);

  // --- o caso que faltava: SEM LOGO e com a MENOR letra ---------------------
  // ⚠️ Achado em 2026-09-05, ao escrever a leva de 17 temas novos: a bancada
  // acima tem SEMPRE um logo (é o pior caso para a distorção, R4), logo o
  // nome do site em TEXTO — que é o que um site novo tem, porque o logo é
  // opcional — nunca era medido. E as duas configurações medidas são a padrão
  // e o EXTREMO, que para o tamanho do texto é a letra MAIOR: a letra pequena
  // também nunca era medida. O Mínimo falhava nas duas coisas ao mesmo tempo
  // (nome do site com 270x19 px), e nenhum caso desta suíte dava por isso.
  //
  // ⚠️ A EXCEÇÃO DA WCAG, que este caso tem de respeitar ou reprova todos os
  // temas incluindo o Padrão: o critério 2.5.8 isenta o alvo "numa frase ou
  // cujo tamanho é limitado pela entrelinha do texto que não é alvo" — um
  // link no meio de um parágrafo. Medido: esses ficam entre 17 e 23 px em
  // TODOS os 21 temas, e está certo assim. O que este caso mede são os alvos
  // que NÃO estão numa frase.
  const semLogo = await p.pg.evaluate(async () => {
    const site = Modelo.sitePadrao('a'.repeat(64), 'npub1teste');
    site.title = 'Padaria da Esquina e Confeitaria';
    const pg1 = Modelo.novaPagina('Início'); pg1.status = 'published';
    pg1.body = 'Texto com um [link no meio](/sobre.html) do parágrafo.\n\n[[botao: Encomende aqui -> /contato]]';
    const a1 = Modelo.novoArtigo('Pão'); a1.id = 'a1'; a1.date = '2026-01-15T00:00:00Z'; a1.status = 'published'; a1.body = 'Corpo.'; a1.tags = ['pão'];
    site.home = { mode: 'page', page_id: pg1.id, latest_posts: 3 };
    site.menu = [{ type: 'page', page_id: pg1.id }, { type: 'blog' }];
    const out = {};
    for (const t of Temas.todos()) {
      // a MENOR de cada escolha e o mínimo de cada medida — o oposto do
      // `extremoDe` lá de cima, que pega na última e no máximo
      const o = {}, M = t.manifesto.options || {};
      for (const n of Object.keys(M)) { const d = M[n]; o[n] = d.tipo === 'escolha' ? d.opcoes[0][0] : d.tipo === 'medida' ? d.min : d.padrao; }
      for (const n of Object.keys(M)) if (M[n].tipo === 'escolha' && M[n].opcoes.some(x => x[0] === 'pequeno')) o[n] = 'pequeno';
      const g = await Gerador.gerarSite({ site: Object.assign({}, site, { theme: { id: t.manifesto.id, version: t.manifesto.version, options: o } }), pages: [pg1], posts: [a1], media: [] });
      out[t.manifesto.id] = Gerador.previa(g.arquivos.find(a => a.path === '/index.html').texto, {}, o, t);
    }
    return out;
  });

  const maus = [];
  for (const id of Object.keys(semLogo)) {
    for (const larg of [320, 390]) {
      const c2 = await contextoDeMedida();
      usadasNoContexto++;
      const pg2 = await c2.newPage();
      await pg2.route(/^https?:/, (r) => r.abort());
      await pg2.setViewportSize({ width: larg, height: 800 });
      await pg2.setContent(semLogo[id], { waitUntil: 'load' });
      const r = await pg2.evaluate((ALVO_MIN) => {
        const out = { alvos: [], estouro: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth) };
        for (const el of document.querySelectorAll('a,button')) {
          const b = el.getBoundingClientRect();
          if (b.width === 0 && b.height === 0) continue;
          if (b.width >= ALVO_MIN && b.height >= ALVO_MIN) continue;
          // exceção "inline" da WCAG 2.5.8: elemento inline dentro de um pai
          // que tem outro texto além dele — um link no meio de uma frase
          const pai = el.parentElement;
          const soDele = pai ? pai.textContent.trim() === el.textContent.trim() : true;
          if (getComputedStyle(el).display === 'inline' && !soDele) continue;
          out.alvos.push((typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : el.tagName.toLowerCase()) +
            ' «' + el.textContent.trim().slice(0, 20) + '» ' + Math.round(b.width) + 'x' + Math.round(b.height));
        }
        return out;
      }, ALVO_MIN);
      await pg2.close();
      if (r.estouro) maus.push(id + '@' + larg + ': a página rola para o lado (' + r.estouro + 'px)');
      if (r.alvos.length) maus.push(id + '@' + larg + ': ' + r.alvos.join(' ; '));
    }
  }
  await it('sem logo e com a letra pequena, todo alvo que não está numa frase tem 24x24 px e nada estoura', async () => {
    if (maus.length) throw new Error(resumo(maus, x => x));
    return Object.keys(semLogo).length + ' temas × 320 e 390 px, opções no mínimo, nome do site em texto';
  }, R);

  if (ctxMedida) await ctxMedida.close();
  await p.pg.close();
  return R;
};
