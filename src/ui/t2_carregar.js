/* ui/t2_carregar.js — T2 Carregando da rede (14 T2): lista de passos que se
   preenche ao vivo, Cancelar sempre visível (volta a T1 = Trancar), e os
   desfechos T2b (dois textos distintos — G.1.6), T2c (arquivos herdados)
   e o aviso de publicação concorrente. O trabalho é de Rede.reconstruir;
   esta tela só mostra e decide para onde ir. */
(function () {
  'use strict';
  let ctrl = null;

  function desmontar() { if (ctrl) { ctrl.abort(); ctrl = null; } }

  function texto(modelo, mapa) { let s = modelo; for (const k of Object.keys(mapa || {})) s = s.split('{' + k + '}').join(String(mapa[k])); return s; }

  async function montar(raiz, params) {
    const h = Shell.h, T = Textos.t2, s = Shell.sessao();
    desmontar();
    ctrl = new AbortController();
    const meu = ctrl;

    const passos = {};
    const ol = h('ol', { id: 'passos', class: 'passos' });
    for (const k of ['relays', 'site', 'site_json', 'juntar', 'saude']) {
      const li = h('li', { id: 'passo-' + k, class: 'passo pendente' }, h('span', { class: 'texto' }, T.passos[k]), ' ', h('span', { class: 'estado' }), h('span', { class: 'apoio detalhe' }));
      passos[k] = li; ol.appendChild(li);
    }
    function marcar(k, classe, estado, detalhe) {
      const li = passos[k]; li.className = 'passo ' + classe;
      li.querySelector('.estado').textContent = estado == null ? '' : String(estado);
      li.querySelector('.detalhe').textContent = detalhe == null ? '' : String(detalhe);
    }
    const desfecho = h('div', { id: 'desfecho', hidden: true });
    const btnCancelar = h('button', { type: 'button', id: 'cancelar-t2', class: 'secundario', onclick: function () { desmontar(); Shell.trancar(); } }, T.cancelar);
    raiz.appendChild(h('section', { id: 't2' },
      h('h1', {}, T.titulo),
      h('p', { class: 'apoio' }, T.entrouComo, h('code', { id: 'npub-completo' }, s.npub)),
      h('p', { class: 'apoio' }, Textos.fixos.tor),
      ol, desfecho,
      h('div', { class: 'acoes', id: 'acoes-t2' }, btnCancelar)));

    function mostrar(no) { Shell.limpar(desfecho); desfecho.appendChild(no); desfecho.hidden = false; btnCancelar.hidden = true; }
    function falhou(msg) { mostrar(h('div', { id: 'erro-t2' }, h('p', { class: 'erro', role: 'alert' }, texto(T.erro, { e: msg })),
      h('div', { class: 'acoes' }, h('button', { type: 'button', id: 'tentar-de-novo', onclick: function () { Shell.ir('t2'); } }, T.tentarDeNovo)))); }

    // banco da identidade (13 §2)
    let dados = Shell.dados();
    if (!dados || !dados.db || !dados.db.estaAberto()) {
      let db;
      try { db = await Db.abrir(s.pubkey); } catch (e) { if (!meu.signal.aborted) falhou(e && e.message ? e.message : String(e)); return; }
      if (meu.signal.aborted) { db.fechar(); return; }
      dados = { db: db, ultimaCarga: null };
      Shell.definirDados(dados);
    }

    function progresso(p) {
      if (meu.signal.aborted) return;
      if (p.passo === 'relays') marcar('relays', 'andando', texto(T.relaysResponderam, { n: p.respondidos, m: p.total }));
      else if (p.passo === 'relays_fim') marcar('relays', p.respondidos ? 'feito' : 'falhou', texto(T.relaysResponderam, { n: p.respondidos, m: p.total }), p.naoResponderam.length ? texto(T.naoResponderam, { lista: p.naoResponderam.join(', ') }) : '');
      else if (p.passo === 'site') marcar('site', p.encontrado ? 'feito' : 'falhou', p.encontrado ? texto(T.siteEncontrado, { n: p.relays }) : T.siteNaoEncontrado);
      else if (p.passo === 'site_json') { if (p.estado === 'baixando') marcar('site_json', 'andando', ''); else marcar('site_json', p.estado === 'ok' ? 'feito' : (p.estado === 'ausente' || p.estado === 'local' ? 'pulado' : 'falhou'), T.siteJson[p.estado] || p.estado); }
      else if (p.passo === 'juntar') marcar('juntar', 'feito', texto(T.rascunhosPreservados, { n: p.rascunhos }));
      else if (p.passo === 'saude') marcar('saude', 'feito', T.pronto);
    }

    let r;
    try {
      r = await Rede.reconstruir({ db: dados.db, pubkey: s.pubkey, npub: s.npub, sinal: meu.signal, progresso: progresso });
    } catch (e) {
      if (meu.signal.aborted) return;
      falhou(e && e.message ? e.message : String(e));
      return;
    }
    if (meu.signal.aborted || !r || r.desfecho === 'cancelado') return;
    ctrl = null;
    dados.ultimaCarga = r;

    async function irParaInicio(resumo) {
      Shell.atualizarSite(r.site || (await dados.db.get('site', 'site')));
      Shell.ir('t3', { resumo: resumo });
    }
    async function criarEIr(tela) {
      const site = await Rede.criarSiteNovo(dados.db, s.pubkey, s.npub);
      Shell.atualizarSite(site);
      Shell.ir(tela);
    }

    if (r.desfecho === 'carregado' || r.desfecho === 'herdado') {
      if (r.concorrente) Shell.faixa(T.concorrente);
      if (r.resumo.sobrescritos.length) Shell.faixa(texto(T.sobrescritos, { lista: r.resumo.sobrescritos.join(', ') }));
      if (r.desfecho === 'carregado') { await irParaInicio(texto(T.resumo, { p: r.resumo.pages, a: r.resumo.posts, m: r.resumo.media, d: r.resumo.ultimaPublicacao })); return; }
      // T2c — site publicado por outra ferramenta
      marcar('juntar', 'pulado', T.pulado); 
      mostrar(h('div', { id: 't2c', class: 'cartao' },
        h('p', {}, texto(T.herdado, { n: r.resumo.herdados })),
        h('p', { class: 'apoio' }, T.herdadoApoio),
        h('div', { class: 'acoes' }, h('button', { type: 'button', id: 'ir-inicio', onclick: function () { irParaInicio(texto(T.resumoHerdado, { n: r.resumo.herdados, d: r.resumo.ultimaPublicacao })); } }, T.irParaInicio))));
      return;
    }
    for (const k of ['site_json', 'juntar', 'saude']) marcar(k, 'pulado', T.pulado);
    if (r.desfecho === 'sem_site') {
      mostrar(h('div', { id: 't2b-sem-site', class: 'cartao' },
        h('p', {}, T.semSite),
        h('div', { class: 'acoes' },
          h('button', { type: 'button', id: 'comecar-site', onclick: function () { criarEIr('t7'); } }, T.comecarSite),
          h('button', { type: 'button', id: 'importar-backup', class: 'secundario', onclick: function () { Shell.ir('t9'); } }, T.importarBackup),
          h('button', { type: 'button', id: 'outros-relays', class: 'secundario', onclick: function () { Shell.ir('t7', { secao: 'avancado' }); } }, T.tentarOutrosRelays))));
      return;
    }
    if (r.desfecho === 'sem_rede') {
      marcar('site', 'pulado', T.pulado);
      mostrar(h('div', { id: 't2b-sem-rede', class: 'cartao' },
        h('p', {}, T.semRede),
        h('div', { class: 'acoes' },
          h('button', { type: 'button', id: 'tentar-de-novo', onclick: function () { Shell.ir('t2'); } }, T.tentarDeNovo),
          h('button', { type: 'button', id: 'continuar-sem-rede', class: 'secundario', onclick: function () { if (r.siteLocal) irParaInicio(null); else criarEIr('t3'); } }, T.continuarSemRede),
          h('button', { type: 'button', id: 'importar-backup', class: 'secundario', onclick: function () { Shell.ir('t9'); } }, T.importarBackup))));
      return;
    }
    falhou(r.desfecho);
  }

  Shell.registrar('t2', { montar: montar, desmontar: desmontar });
})();
