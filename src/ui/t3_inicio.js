/* ui/t3_inicio.js — T3 Início (14 T3; 03 §3.6 "resumo do site"): saúde da
   publicação (13 §5.5), alterações não publicadas, backup, atalhos, últimos
   artigos e o cartão "Apoie". Neste marco (M2) o cartão de saúde verifica;
   "Republicar" fica visível e desligado até o M4. Datas em AAAA-MM-DD UTC. */
(function () {
  'use strict';
  let apoioFechado = false;      // T-16: por sessão, não persiste
  let ctrl = null;

  function desmontar() { if (ctrl) { ctrl.abort(); ctrl = null; } }
  function texto(modelo, mapa) { let s = modelo; for (const k of Object.keys(mapa || {})) s = s.split('{' + k + '}').join(String(mapa[k])); return s; }

  async function montar(raiz, params) {
    const h = Shell.h, T = Textos.t3, s = Shell.sessao();
    desmontar();
    const dados = Shell.dados();
    if (!dados || !dados.db || !dados.db.estaAberto()) {
      raiz.appendChild(h('section', { id: 't3' }, h('h1', {}, T.titulo), h('p', { class: 'alerta' }, T.aindaCarregando),
        h('div', { class: 'acoes' }, h('button', { type: 'button', onclick: function () { Shell.ir('t2'); } }, T.voltarACarregar))));
      return;
    }
    const db = dados.db;
    const site = (await db.get('site', 'site')) || Modelo.sitePadrao(s.pubkey, s.npub);
    let published = (await db.get('published', 'current')) || null;
    const c = await Rede.contagens(db);
    const posts = (await db.getAll('posts')).sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 5);
    const ultimoBackup = await db.getMeta('last_export_at');
    const naoExportadas = (await db.getMeta('alteracoes_nao_exportadas')) || 0;
    Shell.atualizarSite(site);
    Shell.contadores({ publicar: c.pendentes, naoExportadas: naoExportadas });

    // 1. saúde
    const cartaoSaude = h('div', { class: 'cartao', id: 'cartao-saude' });
    function renderSaude() {
      Shell.limpar(cartaoSaude);
      cartaoSaude.appendChild(h('h2', {}, T.saude.titulo));
      if (!published || !published.manifest_event) {
        cartaoSaude.appendChild(h('p', { id: 'saude-nao-publicado' }, T.saude.naoPublicado));
        cartaoSaude.appendChild(h('div', { class: 'acoes' }, h('button', { type: 'button', onclick: function () { Shell.ir('t8'); } }, T.saude.publicar)));
        return;
      }
      const hs = published.health || {}, n = Saude.contagemDe(hs);
      cartaoSaude.appendChild(h('p', { id: 'saude-resumo', class: 'destaque' }, texto(T.saude.emRelays, { n: n.atual, m: n.total })));
      const ul = h('ul', { id: 'lista-relays', class: 'lista-relays' });
      const grupos = [['atual', hs.relays_with_manifest], ['antigo', hs.relays_outdated], ['mais_novo', hs.relays_newer], ['sem', hs.relays_missing], ['nao_respondeu', hs.relays_unreachable]];
      for (const [estado, lista] of grupos) for (const url of (lista || [])) ul.appendChild(h('li', { class: 'relay ' + estado, 'data-estado': estado }, h('code', {}, url), ' ', h('span', { class: 'apoio' }, T.saude.estados[estado])));
      cartaoSaude.appendChild(ul);
      cartaoSaude.appendChild(h('p', { class: 'apoio', id: 'saude-quando' }, texto(T.saude.verificadoEm, { d: Modelo.formatarDataHora(hs.checked_at) })));
      const acoes = h('div', { class: 'acoes' });
      const btnVerificar = h('button', { type: 'button', id: 'verificar-saude', class: 'secundario', onclick: verificar }, T.saude.verificar);
      acoes.appendChild(btnVerificar);
      if (n.antigo + n.sem > 0) { acoes.appendChild(h('button', { type: 'button', id: 'republicar', disabled: true, title: T.saude.republicarM4 }, T.saude.republicar)); acoes.appendChild(h('span', { class: 'apoio' }, T.saude.republicarM4)); }
      cartaoSaude.appendChild(acoes);
      if (n.mais_novo > 0) Shell.faixa(T.saude.maisNovoAviso, null, { rotulo: T.saude.recarregar, fn: function () { Shell.ir('t2'); } });
    }
    async function verificar() {
      const btn = document.getElementById('verificar-saude');
      if (btn) { btn.disabled = true; btn.textContent = T.saude.verificando; }
      ctrl = new AbortController();
      const meu = ctrl;
      try {
        const v = await Saude.verificar({ relays: site.network.relays, pubkey: s.pubkey, referencia: published.manifest_event, sinal: meu.signal });
        if (meu.signal.aborted) return;
        published = Object.assign({}, published, { health: v.health, relays: v.classificacao.por_relay });
        await db.put('published', published, 'current');
        renderSaude();
      } catch (e) {
        if (!meu.signal.aborted) Shell.erro(e && e.message ? e.message : String(e));
        renderSaude();
      } finally { if (ctrl === meu) ctrl = null; }
    }
    renderSaude();

    // 2. alterações não publicadas
    const cartaoAlt = h('div', { class: 'cartao', id: 'cartao-alteracoes' }, h('h2', {}, T.alteracoes.titulo));
    if (c.pendentes > 0) {
      cartaoAlt.appendChild(h('p', { class: 'destaque', id: 'alteracoes-resumo' }, texto(T.alteracoes.resumo, { a: Modelo.pendentes(c.posts), p: Modelo.pendentes(c.pages), m: Modelo.pendentes(c.media) })));
      cartaoAlt.appendChild(h('p', { class: 'apoio' }, texto(T.alteracoes.detalhe, { n: c.novos, a: c.alterados, r: c.aRemover })));
      cartaoAlt.appendChild(h('div', { class: 'acoes' }, h('button', { type: 'button', onclick: function () { Shell.ir('t8'); } }, T.alteracoes.publicar)));
    } else cartaoAlt.appendChild(h('p', { id: 'alteracoes-resumo' }, T.alteracoes.nada));
    if (c.herdados > 0) cartaoAlt.appendChild(h('p', { class: 'apoio', id: 'herdados-resumo' }, texto(T.herdados, { n: c.herdados })));

    // 3. backup
    const cartaoBackup = h('div', { class: 'cartao', id: 'cartao-backup' }, h('h2', {}, T.backup.titulo));
    const soLocal = c.pendentes + c.midiaSoLocal;
    if (naoExportadas > 0) cartaoBackup.appendChild(h('p', { class: 'destaque erro', id: 'backup-resumo' }, ultimoBackup ? texto(T.backup.pendentes, { n: naoExportadas, d: Modelo.formatarData(ultimoBackup) }) : texto(T.backup.pendentesSemData, { n: naoExportadas })));
    else if (ultimoBackup) cartaoBackup.appendChild(h('p', { id: 'backup-resumo' }, texto(T.backup.emDia, { d: Modelo.formatarData(ultimoBackup) })));
    else if (soLocal > 0) cartaoBackup.appendChild(h('p', { class: 'alerta', id: 'backup-resumo' }, T.backup.nunca));
    else cartaoBackup.appendChild(h('p', { id: 'backup-resumo' }, T.backup.nada));
    if (c.midiaSoLocal > 0) cartaoBackup.appendChild(h('p', { class: 'apoio' }, texto(T.backup.midiaLocal, { n: c.midiaSoLocal })));
    cartaoBackup.appendChild(h('div', { class: 'acoes' }, h('button', { type: 'button', class: 'secundario', onclick: function () { Shell.ir('t9'); } }, T.backup.exportar)));

    // 4. atalhos
    const outros = Modelo.GATEWAYS.filter(g => !g.principal).map(function (g) {
      return h('span', {}, ' ', h('a', { href: Modelo.urlDoSite(s.npub, g.host), target: '_blank', rel: 'noopener noreferrer' }, g.host), g.lento ? h('span', { class: 'apoio' }, ' (' + T.atalhos.lento + ')') : null);
    });
    const principal = Modelo.GATEWAYS.find(g => g.principal);
    const cartaoAtalhos = h('div', { class: 'cartao', id: 'cartao-atalhos' }, h('h2', {}, T.atalhos.titulo),
      h('div', { class: 'acoes' },
        h('button', { type: 'button', class: 'secundario', onclick: function () { Shell.ir('t5', { novo: true }); } }, T.atalhos.novoArtigo),
        h('button', { type: 'button', class: 'secundario', onclick: function () { Shell.ir('t4', { novo: true }); } }, T.atalhos.novaPagina),
        h('button', { type: 'button', class: 'secundario', onclick: function () { Shell.ir('t6', { enviar: true }); } }, T.atalhos.enviarMidia)),
      h('p', {}, h('a', { id: 'ver-site', href: Modelo.urlDoSite(s.npub, principal.host), target: '_blank', rel: 'noopener noreferrer' }, T.atalhos.verSite),
        h('span', { class: 'apoio' }, ' — ' + T.atalhos.outros), outros));

    // 5. últimos artigos
    const cartaoUltimos = h('div', { class: 'cartao', id: 'cartao-ultimos' }, h('h2', {}, T.ultimos.titulo));
    if (!posts.length) cartaoUltimos.appendChild(h('p', { class: 'apoio' }, T.ultimos.nenhum));
    else cartaoUltimos.appendChild(h('ul', { class: 'lista-artigos' }, posts.map(p => h('li', {}, h('span', { class: 'data' }, Modelo.formatarData(p.date)), ' ', p.title, ' ', h('span', { class: 'apoio' }, '(' + (Textos.status[p.status] || p.status) + ')'), ' ',
      h('button', { type: 'button', class: 'ligacao', onclick: function () { Shell.ir('t5', { editar: p.id }); } }, T.ultimos.editar)))));

    // 6. apoie (T-16)
    const cartaoApoie = apoioFechado ? null : h('div', { class: 'cartao apoie', id: 'cartao-apoie' }, h('h2', {}, T.apoie.titulo), h('p', {}, T.apoie.texto),
      h('div', { class: 'acoes' }, h('button', { type: 'button', class: 'secundario', onclick: function () { Shell.ir('t11', { secao: 'apoio' }); } }, T.apoie.botao),
        h('button', { type: 'button', class: 'ligacao', id: 'fechar-apoie', onclick: function () { apoioFechado = true; cartaoApoie.remove(); } }, T.apoie.fechar)));

    raiz.appendChild(h('section', { id: 't3' },
      h('h1', {}, T.titulo),
      params && params.resumo ? h('p', { id: 'resumo-carga', class: 'alerta' }, params.resumo) : null,
      h('div', { class: 'cartoes' }, cartaoSaude, cartaoAlt, cartaoBackup, cartaoAtalhos, cartaoUltimos, cartaoApoie)));
  }

  Shell.registrar('t3', { montar: montar, desmontar: desmontar });
})();
