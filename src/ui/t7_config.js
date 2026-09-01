/* ui/t7_config.js — T7 Configurações (14 T7): a `site` inteira (13 §3) em
   cinco abas, com o técnico escondido em "Avançado" (decisão do usuário,
   03 §3.6). Uma só folha de rascunho em memória e um só "Salvar": mexer aqui
   não grava até o dono mandar, e o aviso de 13 §5.3 diz de frente quando a
   mudança regenera o site inteiro.
   A aba Avançado é a única porta para os relays e servidores (é para cá que
   T2 manda quem clica "Tentar outros relays") e a casa do único gesto
   destrutivo do painel — "Tirar o site do ar" (03 §6; core/despublicar.js),
   com confirmação por digitação do título, nunca por "tem certeza?".
   A chave não passa por aqui: quem assina é Shell.assinar. */
(function () {
  'use strict';
  let ctrl = null;
  let secao = 'site';                 // aba escolhida — por sessão, não persiste
  let avancadoAberto = false;

  function desmontar() { if (ctrl) { ctrl.abort(); ctrl = null; } Miniaturas.limpar(); }
  function texto(m, mapa) { let s = String(m); for (const k of Object.keys(mapa || {})) s = s.split('{' + k + '}').join(String(mapa[k])); return s; }
  function servidorCurto(u) { try { return new URL(u).hostname; } catch (e) { return String(u); } }
  function relayCurto(u) { return String(u).replace(/^wss:\/\//, ''); }
  function clonar(v) { return JSON.parse(JSON.stringify(v)); }

  // Os campos que o tema renderiza: mudar qualquer um deles regenera TODO o
  // HTML (13 §5.3). `profile` e `network` não — só o site.json e os eventos
  // de identidade. A tela diz qual dos três casos é.
  // 24 — `theme` saiu desta lista e ganhou uma pergunta própria: mexer numa
  // COR ou numa medida muda só `/tema/estilo.css`, um arquivo. Dizer "vai
  // subir tudo de novo" seria falso, e a tela promete o diff verdadeiro.
  // O `logo_media_id` entra aqui porque o logo está no cabeçalho de todas as
  // páginas — esse, sim, regenera tudo (38).
  const CAMPOS_TEMA = ['title', 'description', 'language', 'logo_media_id', 'home', 'blog', 'menu', 'donations', 'privacy'];
  function temaId(s) { const t = s && s.theme; return JSON.stringify([t && t.id, t && t.version]); }
  function mudouTema(a, b) { return CAMPOS_TEMA.some(k => JSON.stringify(a[k]) !== JSON.stringify(b[k])) || temaId(a) !== temaId(b); }
  function mudouEstilo(a, b) { return JSON.stringify((a.theme || {}).options || {}) !== JSON.stringify((b.theme || {}).options || {}); }

  async function montar(raiz, params) {
    const h = Shell.h, T = Textos.t7, s = Shell.sessao();
    desmontar();
    const info = Shell.dados();
    if (!info || !info.db || !info.db.estaAberto()) {
      raiz.appendChild(h('section', { id: 't7' }, h('h1', {}, T.titulo), h('p', { class: 'alerta' }, Textos.t3.aindaCarregando),
        h('div', { class: 'acoes' }, h('button', { type: 'button', onclick: function () { Shell.ir('t2'); } }, Textos.t3.voltarACarregar))));
      return;
    }
    const db = info.db;
    let gravado = (await db.get('site', 'site')) || Modelo.sitePadrao(s.pubkey, s.npub);
    let publicado = (await db.get('published', 'current')) || null;
    let pages = await db.getAll('pages');
    let midias = await db.getAll('media');
    const servidoresMidia = Modelo.uniao(gravado.network && gravado.network.servers);   // 48: de onde vêm as miniaturas da rede
    const verificarVersao = (await db.getMeta('verificar_versao')) !== false;
    let naoExportadas = (await db.getMeta('alteracoes_nao_exportadas')) || 0;
    let rascunho = clonar(gravado);
    let salvo = JSON.stringify(gravado);
    Shell.atualizarSite(gravado);

    if (params && params.secao && T.abas.some(a => a[0] === params.secao)) {
      secao = params.secao;
      if (secao === 'avancado') avancadoAberto = true;      // quem pediu "outros relays" já pediu o avançado
    }

    const secaoEl = h('section', { id: 't7' }, h('h1', {}, T.titulo));
    const barraAbas = h('nav', { class: 'abas', id: 't7-abas', 'aria-label': T.titulo });
    const painel = h('div', { class: 'cartao', id: 't7-painel' });
    const pAviso = h('p', { id: 't7-aviso', class: 'apoio', role: 'status' });
    const btnSalvar = h('button', { type: 'button', id: 't7-salvar', onclick: salvar }, T.salvar);
    const barraSalvar = h('div', { class: 'barra-salvar' }, btnSalvar, pAviso);
    secaoEl.appendChild(barraAbas); secaoEl.appendChild(painel); secaoEl.appendChild(barraSalvar);
    raiz.appendChild(secaoEl);

    function sujo() { return JSON.stringify(rascunho) !== salvo; }
    function marcarSujo() { btnSalvar.disabled = !sujo(); }

    async function salvar() {
      if (!sujo()) { pAviso.textContent = T.semAlteracoes; return; }
      btnSalvar.disabled = true; btnSalvar.textContent = T.salvando;
      const antes = JSON.parse(salvo);
      try {
        await db.put('site', rascunho, 'site');
        await Shell.registrarAlteracao(1);
      } catch (e) {
        Shell.erro(e && e.message ? e.message : String(e));
        btnSalvar.textContent = T.salvar; btnSalvar.disabled = false; return;
      }
      salvo = JSON.stringify(rascunho);
      gravado = JSON.parse(salvo);          // o título de agora é o que "Tirar do ar" vai exigir digitado
      naoExportadas = (await db.getMeta('alteracoes_nao_exportadas')) || 0;
      btnSalvar.textContent = T.salvar;
      Shell.atualizarSite(rascunho);
      pAviso.textContent = T.salvo + ' ' + (mudouTema(antes, rascunho) ? T.regenera : (mudouEstilo(antes, rascunho) ? T.soEstilo : T.soMapa));
      pAviso.className = 'apoio';
      marcarSujo();
      const c = await Rede.contagens(db);
      Shell.contadores({ publicar: c.pendentes });
    }

    // --- abas ---------------------------------------------------------------
    function renderAbas() {
      Shell.limpar(barraAbas);
      for (const [nome, rotulo] of T.abas) {
        barraAbas.appendChild(h('button', { type: 'button', class: 'aba' + (nome === secao ? ' atual' : ''), 'data-aba': nome,
          onclick: function () { secao = nome; render(); } }, rotulo));
      }
    }

    function render() {
      renderAbas();
      Shell.limpar(painel);
      if (secao === 'site') painelSite();
      else if (secao === 'doacoes') painelDoacoes();
      else if (secao === 'aparencia') painelAparencia();
      else if (secao === 'privacidade') painelPrivacidade();
      else painelAvancado();
      marcarSujo();
    }

    // pequenos construtores repetidos em todas as abas
    function campoTexto(id, rotulo, valor, aoMudar, apoio, multilinha) {
      const el = multilinha ? h('textarea', { id: id, rows: multilinha }) : h('input', { type: 'text', id: id, value: valor == null ? '' : valor });
      if (multilinha) el.value = valor == null ? '' : valor;
      el.addEventListener('input', function () { aoMudar(el.value); marcarSujo(); });
      return [h('label', { for: id }, rotulo), el, apoio ? h('p', { class: 'apoio' }, apoio) : null];
    }
    function caixa(id, rotulo, marcado, aoMudar, apoio) {
      const el = h('input', { type: 'checkbox', id: id, checked: !!marcado });
      el.addEventListener('change', function () { aoMudar(el.checked); marcarSujo(); });
      return [h('label', { class: 'inline', for: id }, el, ' ', rotulo), apoio ? h('p', { class: 'apoio' }, apoio) : null];
    }

    // --- aba Site -----------------------------------------------------------
    function painelSite() {
      const C = T.site;
      painel.appendChild(h('div', {}, campoTexto('t7-titulo', C.titulo, rascunho.title, v => { rascunho.title = v; }, C.tituloApoio)));
      painel.appendChild(h('div', {}, campoTexto('t7-descricao', C.descricao, rascunho.description, v => { rascunho.description = v; }, C.descricaoApoio, 2)));
      if (!String(rascunho.title || '').trim() || !String(rascunho.description || '').trim()) painel.appendChild(h('p', { class: 'alerta', id: 't7-obrigatorios' }, C.obrigatorios));

      const selIdioma = h('select', { id: 't7-idioma' }, C.idiomas.map(x => h('option', { value: x[0], selected: x[0] === rascunho.language }, x[1])));
      selIdioma.value = rascunho.language || 'pt-BR';
      selIdioma.addEventListener('change', function () { rascunho.language = selIdioma.value; marcarSujo(); });
      painel.appendChild(h('div', {}, h('label', { for: 't7-idioma' }, C.idioma), selIdioma));

      // perfil (kind 0)
      painel.appendChild(h('h3', {}, C.perfil));
      painel.appendChild(h('p', { class: 'apoio' }, C.perfilApoio));
      rascunho.profile = Object.assign({ name: '', about: '', picture_media_id: null }, rascunho.profile || {});
      painel.appendChild(h('div', {}, campoTexto('t7-perfil-nome', C.perfilNome, rascunho.profile.name, v => { rascunho.profile.name = v; })));
      painel.appendChild(h('div', {}, campoTexto('t7-perfil-sobre', C.perfilSobre, rascunho.profile.about, v => { rascunho.profile.about = v; }, null, 3)));
      const imagens = Editor.imagensDe(midias);
      const atual = imagens.find(m => m.id === rascunho.profile.picture_media_id) || null;
      const spanAvatar = h('span', { id: 't7-avatar-atual', class: 'cresce' }, atual ? atual.path : C.avatarNenhuma);
      painel.appendChild(h('div', {},
        h('label', {}, C.avatar),
        h('div', { class: 'linha-capa' }, spanAvatar,
          h('button', { type: 'button', id: 't7-avatar-escolher', class: 'secundario', onclick: escolherAvatar }, C.avatarEscolher)),
        h('p', { class: 'apoio' }, C.avatarApoio)));

      function escolherAvatar() {
        escolherImagem({ titulo: C.avatarModal, semImagens: C.avatarSemImagens, nenhuma: C.avatarNenhuma, enviar: C.avatarEnviar,
          idSemImagens: 't7-avatar-sem-imagens', atualId: rascunho.profile.picture_media_id,
          definir: function (id) { rascunho.profile.picture_media_id = id; } });
      }

      // página inicial
      rascunho.home = Object.assign({ mode: 'blog', page_id: null, latest_posts: 5 }, rascunho.home || {});
      painel.appendChild(h('h3', {}, C.inicial));
      const vivas = pages.filter(p => p.status !== 'removed').sort((a, b) => String(a.title).localeCompare(String(b.title)));
      const selPagina = h('select', { id: 't7-home-pagina', disabled: rascunho.home.mode !== 'page' || !vivas.length },
        vivas.map(p => h('option', { value: p.id, selected: p.id === rascunho.home.page_id }, p.title || p.slug)));
      if (rascunho.home.page_id) selPagina.value = rascunho.home.page_id;
      selPagina.addEventListener('change', function () { rascunho.home.page_id = selPagina.value || null; marcarSujo(); });
      function radioHome(valor, rotulo, id) {
        const r = h('input', { type: 'radio', name: 't7-home', id: id, value: valor, checked: rascunho.home.mode === valor });
        r.addEventListener('change', function () { if (!r.checked) return; rascunho.home.mode = valor; if (valor === 'page' && !rascunho.home.page_id && vivas.length) rascunho.home.page_id = vivas[0].id; render(); marcarSujo(); });
        return h('label', { class: 'inline', for: id }, r, ' ', rotulo);
      }
      painel.appendChild(h('div', {}, radioHome('page', C.inicialPagina, 't7-home-page'), radioHome('blog', C.inicialBlog, 't7-home-blog')));
      painel.appendChild(h('div', {}, h('label', { for: 't7-home-pagina' }, C.inicialQual), selPagina,
        vivas.length ? null : h('p', { class: 'alerta', id: 't7-sem-paginas' }, C.inicialSemPaginas)));
      const inRecentes = h('input', { type: 'number', id: 't7-recentes', min: '0', max: '100', step: '1', value: String(Number.isInteger(rascunho.home.latest_posts) ? rascunho.home.latest_posts : 5) });
      inRecentes.addEventListener('input', function () {
        const n = parseInt(inRecentes.value, 10);
        rascunho.home.latest_posts = Number.isInteger(n) && n >= 0 && n <= 100 ? n : 0;
        marcarSujo();
      });
      painel.appendChild(h('div', {}, h('label', { for: 't7-recentes' }, C.recentes), inRecentes, h('p', { class: 'apoio' }, C.recentesApoio)));

      // blog
      rascunho.blog = Object.assign({ prefix: Modelo.PREFIXO_BLOG, title: 'Blog' }, rascunho.blog || {});
      painel.appendChild(h('h3', {}, C.blog));
      painel.appendChild(h('div', {}, campoTexto('t7-blog-titulo', C.blogTitulo, rascunho.blog.title, v => { rascunho.blog.title = v; })));

      // menu
      painel.appendChild(h('h3', {}, C.menu));
      painel.appendChild(h('p', { class: 'apoio' }, C.menuApoio));
      painel.appendChild(menuEditor());
    }

    function menuEditor() {
      const C = T.site;
      if (!Array.isArray(rascunho.menu)) rascunho.menu = [];
      const porId = new Map(pages.filter(p => p.status !== 'removed').map(p => [p.id, p]));
      const lista = h('ul', { class: 'lista-config', id: 't7-menu' });
      if (!rascunho.menu.length) lista.appendChild(h('li', { class: 'apoio', id: 't7-menu-vazio' }, C.menuVazio));
      rascunho.menu.forEach(function (item, i) {
        let rotulo = '';
        if (item.type === 'blog') rotulo = (rascunho.blog && rascunho.blog.title) || 'Blog';
        else if (item.type === 'page') { const p = porId.get(item.page_id); rotulo = p ? (p.title || p.slug) : C.menuPaginaSumida; }
        else rotulo = item.label + ' ' + C.menuExterno;
        function mover(d) { const j = i + d; if (j < 0 || j >= rascunho.menu.length) return; const t = rascunho.menu[i]; rascunho.menu[i] = rascunho.menu[j]; rascunho.menu[j] = t; render(); marcarSujo(); }
        lista.appendChild(h('li', { 'data-tipo': item.type, 'data-indice': String(i) },
          h('span', { class: 'cresce' }, rotulo),
          h('button', { type: 'button', class: 'secundario', title: C.menuSubirDica, 'aria-label': C.menuSubirDica, disabled: i === 0, onclick: function () { mover(-1); } }, C.menuSubir),
          h('button', { type: 'button', class: 'secundario', title: C.menuDescerDica, 'aria-label': C.menuDescerDica, disabled: i === rascunho.menu.length - 1, onclick: function () { mover(1); } }, C.menuDescer),
          h('button', { type: 'button', class: 'ligacao', onclick: function () { rascunho.menu.splice(i, 1); render(); marcarSujo(); } }, C.menuRemover)));
      });

      // adicionar: páginas do menu ainda fora da lista, o Blog e links externos
      const jaTem = new Set(rascunho.menu.filter(x => x.type === 'page').map(x => x.page_id));
      const candidatas = pages.filter(p => p.status !== 'removed' && p.in_menu !== false && !jaTem.has(p.id));
      const selPagina = h('select', { id: 't7-menu-pagina' }, candidatas.map(p => h('option', { value: p.id }, p.title || p.slug)));
      const addPagina = h('div', { class: 'adicionar' },
        candidatas.length
          ? [selPagina, h('button', { type: 'button', id: 't7-menu-add-pagina', class: 'secundario', onclick: function () { if (!selPagina.value) return; rascunho.menu.push({ type: 'page', page_id: selPagina.value }); render(); marcarSujo(); } }, C.menuAddPagina)]
          : h('span', { class: 'apoio' }, C.menuTodasNoMenu));
      const temBlog = rascunho.menu.some(x => x.type === 'blog');
      const addBlog = temBlog ? null : h('div', { class: 'adicionar' },
        h('button', { type: 'button', id: 't7-menu-add-blog', class: 'secundario', onclick: function () { rascunho.menu.push({ type: 'blog' }); render(); marcarSujo(); } }, C.menuAddBlog));
      const inRotulo = h('input', { type: 'text', id: 't7-menu-rotulo', placeholder: C.menuLinkRotulo, 'aria-label': C.menuLinkRotulo });
      const inUrl = h('input', { type: 'text', id: 't7-menu-url', placeholder: C.menuLinkUrl, 'aria-label': C.menuLinkUrl });
      const pErroLink = h('p', { class: 'erro', id: 't7-menu-erro', hidden: true });
      const addLink = h('div', {},
        h('div', { class: 'adicionar' }, inRotulo, inUrl,
          h('button', { type: 'button', id: 't7-menu-add-link', class: 'secundario', onclick: function () {
            const rotulo = inRotulo.value.trim(), url = inUrl.value.trim();
            let p = null; try { p = new URL(url); } catch (e) { p = null; }
            if (!rotulo || !p || (p.protocol !== 'https:' && p.protocol !== 'http:')) { pErroLink.hidden = false; pErroLink.textContent = C.menuLinkInvalido; return; }
            rascunho.menu.push({ type: 'link', label: rotulo.slice(0, 100), href: url.slice(0, 500) });
            render(); marcarSujo();
          } }, C.menuAddLink)),
        pErroLink);
      return h('div', {}, lista, addPagina, addBlog, addLink);
    }

    // 38 — o mesmo gesto serve dois campos diferentes: o avatar do perfil (kind 0,
    // aba Site) e o logo do cabeçalho (aba Aparência). São imagens distintas de
    // propósito — juntá-las impediria avatar quadrado no Nostr e logo horizontal
    // no site —, mas escolher é o mesmo modal.
    // o: { titulo, semImagens, nenhuma, enviar, idSemImagens, atualId, definir }
    function escolherImagem(o) {
      const imagens = Editor.imagensDe(midias);
      if (!imagens.length) { Shell.modal({ titulo: o.titulo, conteudo: h('p', { class: 'alerta', id: o.idSemImagens }, o.semImagens) }); return; }
      function definir(id) { o.definir(id); Shell.fecharModal(); render(); marcarSujo(); }
      const grade = h('div', { class: 'grade-capas' },
        h('button', { type: 'button', class: 'capa-opcao' + (!o.atualId ? ' selecionada' : ''), onclick: function () { definir(null); } }, o.nenhuma),
        // 48: mídia vinda da rede não tem `bytes` locais — a miniatura tem de
        // baixar, como já faz nas outras três telas (`Miniaturas.elemento`).
        imagens.map(m => h('button', { type: 'button', class: 'capa-opcao' + (o.atualId === m.id ? ' selecionada' : ''), 'data-media-id': m.id, onclick: function () { definir(m.id); } },
          Miniaturas.elemento(m, { servidores: servidoresMidia, classe: '', textos: Textos.t6.mini }), h('span', {}, m.path))));
      Shell.modal({ titulo: o.titulo, conteudo: [grade,
        h('div', { class: 'acoes' }, h('button', { type: 'button', class: 'secundario', onclick: function () { Shell.fecharModal(); Shell.ir('t6', { enviar: true }); } }, o.enviar))] });
    }

    // --- aba Doações --------------------------------------------------------
    function painelDoacoes() {
      const C = T.doacoes;
      rascunho.donations = Object.assign({ lightning_address: '', support_block: false, footer_credit: true }, rascunho.donations || {});
      painel.appendChild(h('div', {}, campoTexto('t7-lightning', C.endereco, rascunho.donations.lightning_address, v => { rascunho.donations.lightning_address = v.trim(); }, C.enderecoApoio)));
      const end = String(rascunho.donations.lightning_address || '').trim();
      if (end && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(end)) painel.appendChild(h('p', { class: 'alerta', id: 't7-lightning-invalido' }, C.enderecoInvalido));
      painel.appendChild(h('div', {}, caixa('t7-bloco-apoio', C.bloco, rascunho.donations.support_block, v => { rascunho.donations.support_block = v; }, C.blocoApoio)));
      painel.appendChild(h('div', {}, caixa('t7-credito', C.credito, rascunho.donations.footer_credit !== false, v => { rascunho.donations.footer_credit = v; }, C.creditoApoio)));
    }

    // --- aba Aparência ------------------------------------------------------
    function painelAparencia() {
      const C = T.aparencia;
      rascunho.theme = Object.assign({ id: 'padrao', version: 1, options: {} }, rascunho.theme || {});
      if (!rascunho.theme.options || typeof rascunho.theme.options !== 'object') rascunho.theme.options = {};
      painel.appendChild(h('p', { id: 't7-tema' }, C.tema + ': ' + (TemaPadrao.manifesto.nome || C.temaAtual)));
      // `theme.version` fica no que estava: é a versão do tema com que o site
      // foi gravado, e hoje ninguém a lê — quem vai passar a lê-la é a troca de
      // tema (pendência 12). Sincronizá-la agora sujaria todos os sites que
      // existem por uma comparação que ninguém faz.

      // --- 38: o logo do cabeçalho ------------------------------------------
      // Campo do SITE (13 §3), não do tema: trocar de tema não pode apagar a
      // marca. O que é opção do tema é a ALTURA, logo abaixo.
      // procurado em `midias` inteira, não em `imagensDe`: um site carregado da
      // rede tem a mídia com `origin: 'network'` e sem bytes locais — mas
      // ainda existe, e o rótulo (nome do arquivo) tem de a mostrar mesmo
      // assim. A miniatura do modal de escolha, logo abaixo, vem da rede.
      const logo = (midias || []).find(m => m && m.id === rascunho.logo_media_id && m.status !== 'removed') || null;
      const spanLogo = h('span', { id: 't7-logo-atual', class: 'cresce' }, logo ? logo.path : C.logoNenhum);
      painel.appendChild(h('div', {},
        h('label', {}, C.logo),
        h('div', { class: 'linha-capa' }, spanLogo,
          h('button', { type: 'button', id: 't7-logo-escolher', class: 'secundario', onclick: function () {
            escolherImagem({ titulo: C.logoModal, semImagens: C.logoSemImagens, nenhuma: C.logoNenhum, enviar: C.logoEnviar,
              idSemImagens: 't7-logo-sem-imagens', atualId: rascunho.logo_media_id,
              definir: function (id) { rascunho.logo_media_id = id; } });
          } }, C.logoEscolher),
          logo ? h('button', { type: 'button', id: 't7-logo-remover', class: 'ligacao', onclick: function () { rascunho.logo_media_id = null; render(); marcarSujo(); } }, C.logoRemover) : null),
        h('p', { class: 'apoio' }, C.logoApoio)));

      // --- 24: as opções que o TEMA declara ---------------------------------
      // Vêm do MANIFESTO, não do core (06 §5.3): o core não conhece nem valida
      // nome de opção nenhum — só sabe desenhar os TIPOS (`escolha`, `cor`,
      // `medida`, texto). Um tema de terceiro que declare outras opções cai
      // aqui sem uma linha nova. Quem valida o VALOR é o tema, ao montar o CSS.
      const opcoes = TemaPadrao.manifesto.options || {};
      const nomes = Object.keys(opcoes);
      if (!nomes.length) painel.appendChild(h('p', { class: 'apoio', id: 't7-tema-sem-opcoes' }, C.semOpcoes));
      else {
        painel.appendChild(h('h3', {}, C.opcoes));
        const div = h('div', { id: 't7-tema-opcoes' });
        for (const nome of nomes) {
          const o = opcoes[nome] || {};
          const id = 't7-opcao-' + nome;
          const atual = rascunho.theme.options[nome] != null ? rascunho.theme.options[nome] : o.padrao;
          let el, ler;
          if (o.tipo === 'escolha' && Array.isArray(o.opcoes)) {
            el = h('select', { id: id }, o.opcoes.map(x => h('option', { value: x[0], selected: x[0] === atual }, x[1])));
            el.value = atual;
            ler = function () { return el.value; };
          } else if (o.tipo === 'medida') {
            // O tipo "medida" nasceu com a altura do logo (38) e é o "medidas"
            // do nome da pendência 24. Guardado como NÚMERO — o tema recusa o
            // que estiver fora de [min, max] e volta ao padrão.
            el = h('input', { type: 'number', id: id, min: String(o.min), max: String(o.max), step: String(o.passo || 1), value: String(atual) });
            ler = function () { const n = parseInt(el.value, 10); return Number.isInteger(n) ? n : o.padrao; };
          } else {
            el = h('input', { type: o.tipo === 'cor' ? 'color' : 'text', id: id, value: atual == null ? '' : String(atual) });
            ler = function () { return el.value; };
          }
          const aoMudar = function () { rascunho.theme.options[nome] = ler(); marcarSujo(); if (nome === 'altura_logo') avisarLogo(); };
          el.addEventListener('input', aoMudar);
          el.addEventListener('change', aoMudar);
          div.appendChild(h('div', {}, h('label', { for: id }, o.rotulo || nome), el,
            o.unidade ? h('span', { class: 'apoio' }, ' ' + o.unidade) : null,
            o.apoio ? h('p', { class: 'apoio' }, o.apoio) : null));
        }
        painel.appendChild(div);
      }

      // O app já mede a imagem no envio (T6), então pode dizer de frente quando
      // o logo escolhido não tem altura para a altura pedida — em tela densa o
      // navegador mostra o dobro dos pontos, e uma imagem curta fica esticada.
      const pAvisoLogo = h('p', { class: 'alerta', id: 't7-logo-baixo', hidden: true });
      painel.appendChild(pAvisoLogo);
      function avisarLogo() {
        const alt = logo && Number.isInteger(logo.height) ? logo.height : null;
        const o = opcoes.altura_logo || {};
        const bruta = rascunho.theme.options.altura_logo;
        const pedida = Number.isInteger(bruta) ? bruta : o.padrao;
        const baixa = alt != null && Number.isInteger(pedida) && alt < pedida * 2;
        pAvisoLogo.hidden = !baixa;
        if (baixa) pAvisoLogo.textContent = texto(C.logoBaixo, { altura: alt, pedida: pedida, dobro: pedida * 2 });
      }
      avisarLogo();
      painel.appendChild(h('div', { class: 'acoes' }, h('button', { type: 'button', id: 't7-previa', class: 'secundario', onclick: previa }, C.previa)));
      painel.appendChild(h('p', { class: 'apoio', id: 't7-temas-outros' }, C.outros));

      // Pré-visualização isolada (02 G.2, 14 §0.8): iframe sem
      // allow-same-origin, com o CSS embutido e as imagens locais em data:.
      async function previa() {
        // A capa do site como o rascunho a produziria — vale para os dois modos
        // de Home (página fixa ou lista de artigos): é sempre o /index.html.
        const dados = { site: rascunho, pages: pages, posts: await db.getAll('posts'), media: midias };
        let html = null;
        try {
          const gerado = await Gerador.gerarSite(dados);
          const arq = gerado.arquivos.find(a => a.path === Modelo.caminhoDe('home'));
          html = arq ? arq.texto : null;
        } catch (e) { html = null; }
        if (!html) { Shell.modal({ titulo: C.previaTitulo, conteudo: h('p', { class: 'apoio' }, C.previaVazia) }); return; }
        const iframe = h('iframe', { id: 'previa-completa', sandbox: 'allow-scripts', title: C.previaTitulo });
        iframe.srcdoc = Gerador.previa(html, await Editor.dataUrisDe(midias), Gerador.opcoesDe(rascunho));
        Shell.modal({ titulo: C.previaTitulo, conteudo: iframe, largo: true });
      }
    }

    // --- aba Privacidade ----------------------------------------------------
    function painelPrivacidade() {
      const C = T.privacidade;
      rascunho.privacy = Object.assign({ show_publish_time: false }, rascunho.privacy || {});
      painel.appendChild(h('div', {}, caixa('t7-hora', C.hora, rascunho.privacy.show_publish_time, v => { rascunho.privacy.show_publish_time = v; }, C.horaApoio)));
      painel.appendChild(h('p', { class: 'alerta', id: 't7-lembrete-privacidade' }, C.lembrete));
    }

    // --- aba Avançado -------------------------------------------------------
    function painelAvancado() {
      const C = T.avancado;
      painel.appendChild(h('p', { class: 'alerta', id: 't7-avancado-aviso' }, C.aviso));
      if (!avancadoAberto) {
        painel.appendChild(h('div', { class: 'acoes' },
          h('button', { type: 'button', id: 't7-avancado-mostrar', onclick: function () { avancadoAberto = true; render(); } }, C.mostrar)));
        return;
      }
      rascunho.network = Object.assign({ relays: [], servers: [], capabilities: {} }, rascunho.network || {});
      painel.appendChild(blocoRelays());
      painel.appendChild(blocoServidores());
      painel.appendChild(blocoVersao());
      painel.appendChild(h('p', { class: 'apoio', id: 't7-fixos' }, C.fixos));
      if (publicado && publicado.manifest_event && !(publicado.takedown_at && !Object.keys(publicado.paths || {}).length)) painel.appendChild(blocoTirarDoAr());
    }

    function estadoDoRelay(url) {
      const hs = (publicado && publicado.health) || {};
      const grupos = [['atual', hs.relays_with_manifest], ['antigo', hs.relays_outdated], ['mais_novo', hs.relays_newer], ['sem', hs.relays_missing], ['nao_respondeu', hs.relays_unreachable]];
      for (const [estado, lista] of grupos) if ((lista || []).indexOf(url) !== -1) return estado;
      return 'desconhecido';
    }

    function blocoRelays() {
      const C = T.avancado;
      const lista = h('ul', { class: 'lista-config', id: 't7-relays' });
      const pErro = h('p', { class: 'erro', id: 't7-relay-erro', hidden: true });
      const testes = {};
      function renderLista() {
        Shell.limpar(lista);
        rascunho.network.relays.forEach(function (url, i) {
          lista.appendChild(h('li', { 'data-relay': url },
            h('code', { class: 'cresce' }, relayCurto(url)),
            h('span', { class: 'apoio estado-relay' }, testes[url] ? (C.testeEstados[testes[url]] || testes[url]) : C.estados[estadoDoRelay(url)]),
            h('button', { type: 'button', class: 'ligacao', onclick: function () {
              if (rascunho.network.relays.length <= 1) { pErro.hidden = false; pErro.textContent = C.ultimoRelay; return; }
              rascunho.network.relays.splice(i, 1); pErro.hidden = true; renderLista(); marcarSujo();
            } }, C.remover)));
        });
      }
      renderLista();
      const inNovo = h('input', { type: 'text', id: 't7-relay-novo', placeholder: C.novoRelay, 'aria-label': C.relays });
      const btnTestar = h('button', { type: 'button', id: 't7-relay-testar', class: 'secundario', onclick: testar }, C.testar);
      async function testar() {
        btnTestar.disabled = true; btnTestar.textContent = C.testando;
        ctrl = new AbortController();
        const meu = ctrl;
        try {
          const rs = await Relay.sondarEscrita(rascunho.network.relays.slice(), { sinal: meu.signal, aoRelay: function (r) {
            testes[r.url] = r.estado === 'aceito' ? 'aceita' : (r.estado === 'recusado' ? 'recusa' : 'mudo');
            if (!meu.signal.aborted) renderLista();
          } });
          if (meu.signal.aborted) return;
          for (const r of rs) testes[r.url] = r.estado === 'aceito' ? 'aceita' : (r.estado === 'recusado' ? 'recusa' : 'mudo');
          renderLista();
        } catch (e) { if (!meu.signal.aborted) Shell.erro(e && e.message ? e.message : String(e)); }
        finally { if (ctrl === meu) ctrl = null; btnTestar.disabled = false; btnTestar.textContent = C.testar; }
      }
      return h('div', {}, h('h3', {}, C.relays), h('p', { class: 'apoio' }, C.relaysApoio), lista, pErro,
        h('div', { class: 'adicionar' }, inNovo,
          h('button', { type: 'button', id: 't7-relay-add', class: 'secundario', onclick: function () {
            const u = Modelo.normalizarUrl(inNovo.value);
            if (!Relay.urlValida(u)) { pErro.hidden = false; pErro.textContent = C.relayInvalido; return; }
            if (rascunho.network.relays.indexOf(u) !== -1) { pErro.hidden = false; pErro.textContent = C.repetido; return; }
            rascunho.network.relays.push(u); inNovo.value = ''; pErro.hidden = true; renderLista(); marcarSujo();
          } }, C.adicionar),
          btnTestar,
          h('button', { type: 'button', id: 't7-relay-padrao', class: 'secundario', onclick: function () { rascunho.network.relays = Modelo.RELAYS_PADRAO.slice(); pErro.hidden = true; renderLista(); marcarSujo(); } }, C.restaurar)),
        h('p', { class: 'apoio' }, C.testeApoio));
    }

    function blocoServidores() {
      const C = T.avancado;
      const lista = h('ul', { class: 'lista-config', id: 't7-servidores' });
      const pErro = h('p', { class: 'erro', id: 't7-servidor-erro', hidden: true });
      function detalheDe(url) {
        if (Modelo.SERVIDORES_PADRAO.indexOf(url) !== -1) return C.servidorPadrao;
        const cap = (rascunho.network.capabilities || {})[url];
        if (!cap || !cap.checked_at) return C.servidorSemDados;
        const recusa = (cap.refuses || []).map(c => (Textos.t8.motivos && Textos.t8.motivos[c]) || c);
        return texto(C.servidorVerificado, { d: Modelo.formatarData(cap.checked_at) }) + (recusa.length ? ' · ' + texto(C.servidorRecusa, { lista: recusa.join(', ') }) : '');
      }
      function renderLista() {
        Shell.limpar(lista);
        rascunho.network.servers.forEach(function (url, i) {
          lista.appendChild(h('li', { 'data-servidor': url },
            h('code', { class: 'cresce' }, servidorCurto(url)),
            h('span', { class: 'apoio' }, detalheDe(url)),
            h('button', { type: 'button', class: 'ligacao', onclick: function () {
              if (rascunho.network.servers.length <= 1) { pErro.hidden = false; pErro.textContent = C.ultimoServidor; return; }
              rascunho.network.servers.splice(i, 1); pErro.hidden = true; renderLista(); marcarSujo();
            } }, C.remover)));
        });
      }
      renderLista();
      const inNovo = h('input', { type: 'text', id: 't7-servidor-novo', placeholder: C.novoServidor, 'aria-label': C.servidores });
      // 03 §6: servidor fora da lista padrão entra só à mão E só depois do
      // aviso. O app não tem como conferir antes de subir se aquele servidor
      // deixa apagar — e dizê-lo é parte do aviso.
      function adicionar() {
        const u = Modelo.normalizarUrl(inNovo.value);
        if (!Blossom.urlValida(u)) { pErro.hidden = false; pErro.textContent = C.servidorInvalido; return; }
        if (rascunho.network.servers.indexOf(u) !== -1) { pErro.hidden = false; pErro.textContent = C.repetido; return; }
        pErro.hidden = true;
        if (Modelo.SERVIDORES_PADRAO.indexOf(u) !== -1) return confirmar(u);
        Shell.modal({ titulo: C.servidores, conteudo: [
          h('p', { class: 'erro', id: 't7-aviso-servidor' }, C.avisoServidor),
          h('p', { class: 'apoio' }, C.avisoServidorApoio),
          h('p', {}, h('code', {}, u)),
          h('div', { class: 'acoes' },
            h('button', { type: 'button', id: 't7-aviso-servidor-ok', onclick: function () { Shell.fecharModal(); confirmar(u); } }, C.avisoServidorEntendi),
            h('button', { type: 'button', class: 'secundario', onclick: function () { Shell.fecharModal(); } }, C.avisoServidorCancelar))] });
      }
      function confirmar(u) { rascunho.network.servers.push(u); inNovo.value = ''; renderLista(); marcarSujo(); }
      return h('div', {}, h('h3', {}, C.servidores), h('p', { class: 'apoio' }, C.servidoresApoio), lista, pErro,
        h('div', { class: 'adicionar' }, inNovo,
          h('button', { type: 'button', id: 't7-servidor-add', class: 'secundario', onclick: adicionar }, C.adicionar),
          h('button', { type: 'button', id: 't7-servidor-padrao', class: 'secundario', onclick: function () { rascunho.network.servers = Modelo.SERVIDORES_PADRAO.slice(); pErro.hidden = true; renderLista(); marcarSujo(); } }, C.restaurar)));
    }

    // 02 G.1.8: a checagem de versão é desligável. É preferência do app nesta
    // máquina, não conteúdo do site — mora no `meta`, não na `site`.
    function blocoVersao() {
      const C = T.avancado;
      const el = h('input', { type: 'checkbox', id: 't7-versao', checked: verificarVersao });
      el.addEventListener('change', function () { db.setMeta('verificar_versao', el.checked).catch(function () {}); });
      return h('div', {}, h('label', { class: 'inline', for: 't7-versao' }, el, ' ', C.versao), h('p', { class: 'apoio' }, C.versaoApoio));
    }

    // --- "Tirar o site do ar" (03 §6; core/despublicar.js) -------------------
    function blocoTirarDoAr() {
      const C = T.tirarDoAr;
      const bloco = h('div', { class: 'perigo', id: 't7-tirar-do-ar' });
      const pProgresso = h('p', { id: 't7-tirar-progresso', class: 'apoio', role: 'status', hidden: true });
      const medidor = h('progress', { id: 't7-tirar-barra', hidden: true });
      const pErro = h('p', { class: 'erro', id: 't7-tirar-erro', role: 'alert', hidden: true });
      const divPlacar = h('div', { id: 't7-tirar-placar', hidden: true });

      function renderBloco() {
        Shell.limpar(bloco);
        bloco.appendChild(h('h3', {}, C.titulo));
        bloco.appendChild(h('p', {}, C.texto));
        bloco.appendChild(h('p', {}, h('strong', {}, C.naoApaga)));
        bloco.appendChild(h('p', {}, C.naoPerde));
        const herdados = midias.filter(m => !m.bytes).length;
        if (herdados) bloco.appendChild(h('p', { class: 'alerta', id: 't7-tirar-herdados' }, texto(C.herdados, { n: herdados })));
        // 02 G.1.9: backup antes de um gesto irreversível — oferecido, com o número
        if (naoExportadas > 0) {
          bloco.appendChild(h('p', { class: 'alerta', id: 't7-tirar-backup' }, texto(C.backup, { n: naoExportadas })));
          bloco.appendChild(h('div', { class: 'acoes' }, h('button', { type: 'button', id: 't7-tirar-backup-ir', class: 'secundario', onclick: function () { Shell.ir('t9'); } }, C.backupBotao)));
        }

        const alvo = String(gravado.title || '').trim() || C.palavraSemTitulo;
        const rotulo = String(gravado.title || '').trim() ? texto(C.confirmeRotulo, { t: alvo }) : texto(C.confirmeRotuloSemTitulo, { t: alvo });
        const inConfirma = h('input', { type: 'text', id: 't7-tirar-confirma', autocomplete: 'off', 'aria-label': rotulo });
        const btn = h('button', { type: 'button', id: 't7-tirar-botao', class: 'perigoso', disabled: true, onclick: executar }, C.botao);
        inConfirma.addEventListener('input', function () { btn.disabled = inConfirma.value.trim() !== alvo; });
        bloco.appendChild(h('div', { class: 'confirmacao' }, h('label', { for: 't7-tirar-confirma' }, rotulo), inConfirma,
          h('div', { class: 'acoes' }, btn)));
        bloco.appendChild(medidor); bloco.appendChild(pProgresso); bloco.appendChild(pErro); bloco.appendChild(divPlacar);
      }

      function progresso(p) {
        pProgresso.hidden = false;
        if (p.passo === 'relays' && typeof p.total === 'number' && p.total > 0) {
          medidor.hidden = false; medidor.setAttribute('max', String(p.total)); medidor.setAttribute('value', String(p.feitos || 0));
          pProgresso.textContent = (p.feitos || 0) === 0 ? C.passos.relays : texto(C.passos.relaysConta, { f: p.feitos, t: p.total, a: p.aceitos || 0 });
        } else if (p.passo === 'apagar') {
          medidor.hidden = false; medidor.setAttribute('max', String(p.total)); medidor.setAttribute('value', String(p.feitos));
          pProgresso.textContent = texto(C.passos.apagar, { f: p.feitos, t: p.total });
        } else { medidor.hidden = true; medidor.removeAttribute('value'); pProgresso.textContent = C.passos[p.passo] || ''; }
      }

      async function executar() {
        const btn = document.getElementById('t7-tirar-botao');
        if (btn) { btn.disabled = true; btn.textContent = C.trabalhando; }
        pErro.hidden = true; divPlacar.hidden = true;
        const dados = { site: gravado, pages: await db.getAll('pages'), posts: await db.getAll('posts'), media: await db.getAll('media') };
        const plano = Despublicar.planear({ dados: dados, published: publicado });
        ctrl = new AbortController();
        const meu = ctrl;
        let res = null;
        try {
          res = await Despublicar.executar({ plano: plano, site: gravado, assinar: Shell.assinar, relays: plano.relays, servidores: plano.servidores,
            sinal: meu.signal, progresso: progresso });
        } catch (e) {
          pErro.hidden = false; pErro.textContent = e && e.message ? e.message : String(e);
          if (btn) { btn.textContent = C.botao; btn.disabled = false; }
          return;
        } finally { if (ctrl === meu) ctrl = null; medidor.hidden = true; pProgresso.hidden = true; }
        if (meu.signal.aborted) return;

        if (res.desfecho !== 'fora_do_ar') {
          pErro.hidden = false;
          pErro.textContent = res.desfecho === 'sem_assinatura' ? C.semAssinatura : C.semRelay;
          if (btn) { btn.textContent = C.botao; btn.disabled = false; }
          return;
        }

        const foto = Despublicar.fotografia(res, publicado);
        await Despublicar.aplicar(db, { resultado: res, dados: dados, published: foto });
        await db.incrementar('alteracoes_nao_exportadas', 1);
        naoExportadas = (await db.getMeta('alteracoes_nao_exportadas')) || 0;
        publicado = foto;
        midias = await db.getAll('media');
        pages = await db.getAll('pages');

        Shell.limpar(bloco);
        bloco.appendChild(h('h3', { id: 't7-tirar-feito' }, C.feito));
        const p = res.placar;
        bloco.appendChild(h('p', {}, texto(C.placarRelays, { n: p.com, m: p.total })));
        if (!res.remocoes.length) bloco.appendChild(h('p', {}, C.placarNenhum));
        else bloco.appendChild(h('ul', { id: 't7-tirar-placar-servidores' }, res.porServidor.map(x =>
          h('li', {}, texto(C.placarServidor, { s: servidorCurto(x.servidor), a: x.apagados, r: x.recusados, c: x.por_conferir, t: res.remocoes.length })))));
        bloco.appendChild(h('p', { class: 'apoio' }, C.demora));
        bloco.appendChild(h('p', { class: 'apoio' }, C.lembrete));
        bloco.appendChild(h('p', {}, C.publicarDeNovo));
        bloco.appendChild(h('div', { class: 'acoes' }, h('button', { type: 'button', id: 't7-tirar-publicar', class: 'secundario', onclick: function () { Shell.ir('t8'); } }, C.irPublicar)));

        const c = await Rede.contagens(db);
        Shell.contadores({ publicar: c.pendentes, naoExportadas: (await db.getMeta('alteracoes_nao_exportadas')) || 0 });
        Shell.atualizarBarra();
      }

      renderBloco();
      return bloco;
    }

    render();
    Shell.atualizarBarra();
  }

  Shell.registrar('t7', { montar: montar, desmontar: desmontar });
})();
