/* ui/listas.js — o que T4 (Páginas) e T5 (Artigos) têm em comum (14 T4/T5;
   14 T-1: um só editor, uma só lista): tabela com os quatro estados de
   13 §4.4 sempre visíveis, filtros, busca por título, ações por linha com
   confirmação INLINE (nunca window.confirm — testável e igual em todo
   navegador), e a transição de estado gravada no banco com o contador de
   "não exportadas" a subir (13 §1). Quando a tela recebe {novo} ou
   {editar}, entrega a raiz ao Editor sem sair de T4/T5 (o menu continua
   marcado). */
const Listas = (function () {
  'use strict';
  let atual = null;   // { raiz, tipo, params } da lista montada, ou null

  function texto(m, mapa) { let s = m; for (const k of Object.keys(mapa || {})) s = s.split('{' + k + '}').join(String(mapa[k])); return s; }
  function storeDe(tipo) { return tipo === 'page' ? 'pages' : 'posts'; }
  function caminhoDe(tipo, reg, site) {
    if (tipo === 'page' && site && site.home && site.home.mode === 'page' && site.home.page_id === reg.id) return Modelo.caminhoDe('home');
    return Modelo.caminhoDe(tipo, reg.slug);
  }

  // Transição de 13 §4.4 gravada: put ou del + contador. → { registro } | { apagar: true }
  async function aplicar(db, store, reg, acao) {
    const t = Modelo.transicao(reg, acao);
    if (!t) throw new Error('transição inválida: ' + reg.status + ' → ' + acao);
    if (t.apagar) await db.del(store, reg.id); else await db.put(store, t.registro);
    await Shell.registrarAlteracao(1);
    return t;
  }

  async function definirInicio(db, pageId) {
    const site = (await db.get('site', 'site')) || null;
    if (!site) return null;
    site.home = Object.assign({}, site.home || {}, { mode: 'page', page_id: pageId });
    if (!Number.isInteger(site.home.latest_posts)) site.home.latest_posts = 5;
    if (!Array.isArray(site.menu)) site.menu = [];
    if (!site.menu.some(m => m && m.type === 'page' && m.page_id === pageId)) site.menu.unshift({ type: 'page', page_id: pageId });
    await db.put('site', site, 'site');
    await Shell.registrarAlteracao(1);
    return site;
  }

  function montar(raiz, cfg) {
    const params = cfg.params || {};
    const voltar = function () { Shell.ir(cfg.tipo === 'page' ? 't4' : 't5'); };
    if (params.novo) { atual = null; Editor.montar(raiz, { tipo: cfg.tipo, novo: true, voltar: voltar }); return; }
    if (params.editar) { atual = null; Editor.montar(raiz, { tipo: cfg.tipo, id: params.editar, voltar: voltar }); return; }
    atual = { raiz: raiz, tipo: cfg.tipo };
    montarLista(raiz, cfg.tipo).catch(function (e) { Shell.erro(e && e.message ? e.message : String(e)); });
  }
  function desmontar() { atual = null; Editor.desmontar(); }

  async function montarLista(raiz, tipo) {
    const h = Shell.h, T = tipo === 'page' ? Textos.t4 : Textos.t5, L = Textos.listas, store = storeDe(tipo), tela = tipo === 'page' ? 't4' : 't5';
    const dados = Shell.dados();
    if (!dados || !dados.db || !dados.db.estaAberto()) {
      raiz.appendChild(h('section', { id: tela }, h('h1', {}, T.titulo), h('p', { class: 'alerta' }, Textos.t3.aindaCarregando),
        h('div', { class: 'acoes' }, h('button', { type: 'button', onclick: function () { Shell.ir('t2'); } }, Textos.t3.voltarACarregar))));
      return;
    }
    const db = dados.db;
    const npub = Shell.sessao().npub, gateway = Modelo.GATEWAYS.find(g => g.principal);
    let site = (await db.get('site', 'site')) || null;
    let regs = [];
    let filtro = 'todos', busca = '';
    let confirmando = null;   // { id, acao }

    async function recarregar() {
      regs = await db.getAll(store);
      if (tipo === 'page') regs.sort((a, b) => String(a.title).localeCompare(String(b.title), 'pt-BR') || String(a.slug).localeCompare(String(b.slug)));
      else regs.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(a.slug).localeCompare(String(b.slug)));
      site = (await db.get('site', 'site')) || site;
    }

    const btnNovo = h('button', { type: 'button', id: 'novo-registro', onclick: function () { Shell.ir(tela, { novo: true }); } }, tipo === 'page' ? T.nova : T.novo);
    const filtros = h('div', { class: 'filtros', role: 'group' });
    const inputBusca = h('input', { type: 'search', id: 'busca', placeholder: L.busca, 'aria-label': L.buscaRotulo, oninput: function () { busca = inputBusca.value.trim().toLowerCase(); render(); } });
    const tabela = h('table', { class: 'lista', id: 'lista-' + store });
    const vazio = h('p', { id: 'lista-vazia', class: 'apoio', hidden: true });

    function renderFiltros() {
      Shell.limpar(filtros);
      const c = Modelo.contarPorStatus(regs);
      for (const [k, rotulo] of T.filtros) {
        const n = k === 'todos' ? c.total : c[k];
        filtros.appendChild(h('button', { type: 'button', class: 'filtro' + (filtro === k ? ' atual' : ''), 'data-filtro': k, 'aria-pressed': filtro === k ? 'true' : 'false', onclick: function () { filtro = k; confirmando = null; render(); } }, rotulo + ' (' + n + ')'));
      }
    }

    function celulaAcoes(reg) {
      const td = h('td', { class: 'acoes-linha' });
      const ehInicio = tipo === 'page' && site && site.home && site.home.mode === 'page' && site.home.page_id === reg.id;
      if (confirmando && confirmando.id === reg.id) {
        const acao = confirmando.acao;
        const aviso = acao === 'remover' ? T.removerAviso : acao === 'excluir' ? T.excluirAviso : T.inicioAviso;
        td.appendChild(h('div', { class: 'confirmacao', id: 'confirmacao-' + reg.id },
          h('p', { class: 'alerta' }, aviso),
          h('button', { type: 'button', class: 'acao-confirmar', onclick: async function () {
            try {
              if (acao === 'inicio') await definirInicio(db, reg.id);
              else await aplicar(db, store, reg, acao);
            } catch (e) { Shell.erro(e && e.message ? e.message : String(e)); }
            confirmando = null; await recarregar(); render();
          } }, acao === 'remover' ? L.acoes.remover : acao === 'excluir' ? L.acoes.excluir : L.acoes.inicio),
          h('button', { type: 'button', class: 'secundario acao-cancelar', onclick: function () { confirmando = null; render(); } }, L.acoes.cancelar)));
        return td;
      }
      td.appendChild(h('button', { type: 'button', class: 'ligacao acao-editar', onclick: function () { Shell.ir(tela, { editar: reg.id }); } }, L.acoes.editar));
      td.appendChild(h('button', { type: 'button', class: 'ligacao acao-ver', onclick: function () { Editor.verComoFicara(db, reg, tipo); } }, L.acoes.ver));
      if (reg.status === 'published' || reg.status === 'modified') td.appendChild(h('button', { type: 'button', class: 'ligacao acao-remover', onclick: function () { confirmando = { id: reg.id, acao: 'remover' }; render(); } }, L.acoes.remover));
      if (reg.status === 'removed') td.appendChild(h('button', { type: 'button', class: 'ligacao acao-desfazer', onclick: async function () { try { await aplicar(db, store, reg, 'desfazer_remocao'); } catch (e) { Shell.erro(e.message); } await recarregar(); render(); } }, L.acoes.desfazer));
      if (reg.status === 'draft') td.appendChild(h('button', { type: 'button', class: 'ligacao acao-excluir', onclick: function () { confirmando = { id: reg.id, acao: 'excluir' }; render(); } }, L.acoes.excluir));
      if (tipo === 'page' && !ehInicio && reg.status !== 'removed') td.appendChild(h('button', { type: 'button', class: 'ligacao acao-inicio', onclick: function () { confirmando = { id: reg.id, acao: 'inicio' }; render(); } }, L.acoes.inicio));
      return td;
    }

    function linha(reg) {
      const ehInicio = tipo === 'page' && site && site.home && site.home.mode === 'page' && site.home.page_id === reg.id;
      const jaPublicado = reg.status === 'published' || reg.status === 'modified';
      const tds = [
        h('td', { class: 'titulo' }, h('button', { type: 'button', class: 'ligacao acao-editar', onclick: function () { Shell.ir(tela, { editar: reg.id }); } }, reg.title || '(sem título)'), ehInicio ? h('span', { class: 'selo' }, ' ' + T.selo) : null),
        h('td', {}, h('code', {}, caminhoDe(tipo, reg, site)), jaPublicado ? [' ', h('a', { class: 'ligacao acao-ver-online', href: Modelo.urlDoSite(npub, gateway.host) + caminhoDe(tipo, reg, site).replace(/^\//, ''), target: '_blank', rel: 'noopener noreferrer' }, L.verOnline)] : null)
      ];
      if (tipo === 'post') tds.push(h('td', { class: 'data' }, Modelo.formatarData(reg.date) || L.semData), h('td', { class: 'etiquetas' }, (reg.tags || []).join(', ')));
      tds.push(h('td', {}, h('span', { class: 'estado ' + reg.status, title: T.estadosDica[reg.status] || '' }, T.estados[reg.status] || reg.status)));
      if (tipo === 'page') tds.push(h('td', { class: 'menu-col' }, reg.in_menu ? L.menuSim : L.menuNao));
      tds.push(h('td', { class: 'data' }, Modelo.formatarData(reg.updated_at)), celulaAcoes(reg));
      return h('tr', { 'data-id': reg.id, 'data-status': reg.status, class: reg.status === 'removed' ? 'removida' : '' }, tds);
    }

    function render() {
      renderFiltros();
      Shell.limpar(tabela);
      const C = T.colunas;
      const cab = [C.titulo, C.caminho];
      if (tipo === 'post') cab.push(C.data, C.etiquetas);
      cab.push(C.estado);
      if (tipo === 'page') cab.push(C.menu);
      cab.push(C.atualizada, C.acoes);
      tabela.appendChild(h('thead', {}, h('tr', {}, cab.map(c => h('th', { scope: 'col' }, c)))));
      const visiveis = regs.filter(r => (filtro === 'todos' || r.status === filtro) && (!busca || String(r.title || '').toLowerCase().indexOf(busca) !== -1));
      tabela.appendChild(h('tbody', {}, visiveis.map(linha)));
      vazio.textContent = regs.length ? T.vazioFiltro : T.vazio;
      vazio.hidden = visiveis.length > 0;
      tabela.hidden = visiveis.length === 0;
    }

    await recarregar();
    raiz.appendChild(h('section', { id: tela, class: 'lista-tela' },
      h('div', { class: 'cabeca-lista' }, h('h1', {}, T.titulo), btnNovo),
      h('div', { class: 'barra-lista' }, filtros, inputBusca),
      tabela, vazio));
    render();
    Shell.atualizarBarra();
  }

  return Object.freeze({ montar, desmontar, aplicar, definirInicio, caminhoDe, storeDe });
})();
