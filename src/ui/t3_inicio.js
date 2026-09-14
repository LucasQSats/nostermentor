/* ui/t3_inicio.js — T3 Início (14 T3; 03 §3.6 "resumo do site"): saúde da
   publicação (13 §5.5), alterações não publicadas, backup, atalhos,
   endereços do site com QR, últimos artigos e o cartão "Apoie".
   A lista de endereços saiu dos atalhos e virou cartão próprio: os atalhos
   dizem o que FAZER agora, os endereços dizem como DAR o site a outra
   pessoa — e um QR ao lado de um botão de ação não se lê.
   Desde o M4 o cartão de saúde verifica E
   republica: reenvia o manifest já assinado aos relays que não o têm, sem
   pedir a chave. Desde o M5 o reenvio mostra placar RELAY POR RELAY e fica
   travado quando a rede está à frente deste navegador (guarda de 13 §5.5), e
   "Ver o site" diz quando o endereço ainda não mostra nada.
   Datas em AAAA-MM-DD UTC. */
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
    // 61 — a DATA da última mensagem, não a contagem (escolha dele, 2026-09-12):
    // um número que encolhe sozinho quando o relay descarta assusta sem motivo.
    const msgs = await db.getAll('messages');
    let ultimaMensagem = 0;
    for (const m of msgs) if (m && m.created_at > ultimaMensagem) ultimaMensagem = m.created_at;
    const naoExportadas = (await db.getMeta('alteracoes_nao_exportadas')) || 0;
    Shell.atualizarSite(site);
    Shell.contadores({ publicar: c.pendentes, naoExportadas: naoExportadas });

    // 1. saúde
    const cartaoSaude = h('div', { class: 'cartao', id: 'cartao-saude' });
    let ultimoReenvio = null;      // resultados por relay do último "Republicar" (14 T3: "resultado em placar na hora")
    function renderSaude() {
      Shell.limpar(cartaoSaude);
      cartaoSaude.appendChild(h('h2', {}, T.saude.titulo));
      if (!published || !published.manifest_event) {
        cartaoSaude.appendChild(h('p', { id: 'saude-nao-publicado' }, T.saude.naoPublicado));
        cartaoSaude.appendChild(h('div', { class: 'acoes' }, h('button', { type: 'button', onclick: function () { Shell.ir('t8'); } }, T.saude.publicar)));
        return;
      }
      // Site tirado do ar (T7 → Avançado): o mapa publicado está VAZIO. Dizer
      // "está em N relays" seria verdade sobre o evento e mentira sobre o site.
      const foraDoAr = !!published.takedown_at && Object.keys(published.paths || {}).length === 0;
      if (foraDoAr) {
        cartaoSaude.appendChild(h('p', { id: 'saude-fora-do-ar', class: 'alerta' }, texto(T.saude.foraDoAr, { d: Modelo.formatarData(published.takedown_at) })));
        cartaoSaude.appendChild(h('p', { class: 'apoio' }, T.saude.foraDoArApoio));
        cartaoSaude.appendChild(h('div', { class: 'acoes' }, h('button', { type: 'button', id: 'saude-publicar', onclick: function () { Shell.ir('t8'); } }, T.saude.publicar)));
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
      acoes.appendChild(h('button', { type: 'button', id: 'verificar-saude', class: 'secundario', onclick: verificar }, T.saude.verificar));
      // Guarda de 13 §5.5: com um relay à FRENTE do que este navegador tem,
      // reenviar o manifest daqui mandaria o site para trás. O botão fica à
      // vista e desligado — escondê-lo seria esconder o problema — com o
      // caminho de saída ao lado.
      const travado = n.mais_novo > 0;
      if (travado || n.antigo + n.sem > 0) {
        acoes.appendChild(h('button', { type: 'button', id: 'republicar', disabled: travado, onclick: travado ? null : republicar }, T.saude.republicar));
        if (travado) acoes.appendChild(h('button', { type: 'button', id: 'recarregar-rede', class: 'secundario', onclick: function () { Shell.ir('t2'); } }, T.saude.recarregar));
        else acoes.appendChild(h('span', { class: 'apoio' }, T.saude.republicarApoio));
      }
      cartaoSaude.appendChild(acoes);
      if (travado) cartaoSaude.appendChild(h('p', { class: 'alerta', id: 'republicar-travado' }, T.saude.republicarTravado));
      // O placar do reenvio, relay por relay — a mesma honestidade que T6 dá
      // aos servidores: quem aceitou, quem recusou (e por quê), quem calou.
      if (ultimoReenvio && ultimoReenvio.length) {
        cartaoSaude.appendChild(h('p', { class: 'apoio', id: 'reenvio-titulo' }, T.saude.reenvioTitulo));
        cartaoSaude.appendChild(h('ul', { id: 'reenvio-placar', class: 'lista-relays' }, ultimoReenvio.map(function (r) {
          const classe = r.estado === 'aceito' ? 'atual' : (r.estado === 'recusado' ? 'sem' : 'nao_respondeu');
          const nome = (Textos.t8.relayEstados && Textos.t8.relayEstados[r.estado]) || r.estado;
          return h('li', { class: 'relay ' + classe, 'data-reenvio': r.estado }, h('code', {}, r.url), ' ',
            h('span', { class: 'apoio' }, nome + (r.mensagem ? ': ' + r.mensagem : '')));
        })));
      }
      if (travado) Shell.faixa(T.saude.maisNovoAviso, null, { rotulo: T.saude.recarregar, fn: function () { Shell.ir('t2'); } });
    }
    // 13 §5.5: reenvia o evento JÁ ASSINADO aos relays que não o têm — um
    // clique, sem pedir a chave (é para isto que published.manifest_event
    // existe). Só aos que estão sem ou com versão antiga.
    async function republicar() {
      const btn = document.getElementById('republicar');
      if (btn) { btn.disabled = true; btn.textContent = T.saude.republicando; }
      const hs = published.health || {};
      const alvos = Modelo.uniao(hs.relays_missing, hs.relays_outdated, hs.relays_unreachable);
      ctrl = new AbortController();
      const meu = ctrl;
      try {
        const r = await Publicar.republicar({ published: published, relays: alvos, sinal: meu.signal });
        if (meu.signal.aborted) return;
        // A guarda do motor tem a última palavra: se a rede está à frente,
        // nada foi reenviado — a tela diz por quê e mostra a saída.
        if (r.desfecho === 'concorrente') {
          ultimoReenvio = null;
          renderSaude();
          Shell.faixa(T.saude.maisNovoAviso, 'erro', { rotulo: T.saude.recarregar, fn: function () { Shell.ir('t2'); } });
          return;
        }
        ultimoReenvio = (r.resultados[0] && r.resultados[0].resultados) || [];
        if (r.desfecho === 'republicado') Shell.faixa(texto(T.saude.republicadoOk, { n: r.placar.com, m: r.placar.total }));
        else Shell.faixa(T.saude.republicadoFalhou, 'erro');
        await verificar();
      } catch (e) {
        if (!meu.signal.aborted) Shell.erro(e && e.message ? e.message : String(e));
        renderSaude();
      } finally { if (ctrl === meu) ctrl = null; }
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
      // 31 — a configuração conta como pendência, mas não é registro: com ela
      // sozinha, "0 artigos, 0 páginas, 0 mídias" seria pior que não dizer nada.
      cartaoAlt.appendChild(h('p', { class: 'destaque', id: 'alteracoes-resumo' }, c.registros > 0
        ? texto(T.alteracoes.resumo, { a: Modelo.pendentes(c.posts), p: Modelo.pendentes(c.pages), m: Modelo.pendentes(c.media) })
        : T.alteracoes.soConfig));
      if (c.registros > 0) {
        cartaoAlt.appendChild(h('p', { class: 'apoio' }, texto(T.alteracoes.detalhe, { n: c.novos, a: c.alterados, r: c.aRemover })));
        if (c.configPendente) cartaoAlt.appendChild(h('p', { class: 'apoio', id: 'alteracoes-config' }, T.alteracoes.configuracoes));
      }
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
    const principal = Modelo.GATEWAYS.find(g => g.principal);
    // Honestidade de status: o endereço existe sempre, o site nem sempre.
    const semPublicacao = !published || !published.manifest_event;
    const foraDoAr = !semPublicacao && !!published.takedown_at && Object.keys(published.paths || {}).length === 0;
    const avisoSite = semPublicacao ? T.atalhos.naoPublicado : (foraDoAr ? T.atalhos.foraDoAr : null);
    const cartaoAtalhos = h('div', { class: 'cartao', id: 'cartao-atalhos' }, h('h2', {}, T.atalhos.titulo),
      h('div', { class: 'acoes' },
        h('button', { type: 'button', class: 'secundario', onclick: function () { Shell.ir('t5', { novo: true }); } }, T.atalhos.novoArtigo),
        h('button', { type: 'button', class: 'secundario', onclick: function () { Shell.ir('t4', { novo: true }); } }, T.atalhos.novaPagina),
        h('button', { type: 'button', class: 'secundario', onclick: function () { Shell.ir('t6', { enviar: true }); } }, T.atalhos.enviarMidia)),
      h('p', {}, h('a', { id: 'ver-site', href: Modelo.urlDoSite(s.npub, principal.host), target: '_blank', rel: 'noopener noreferrer' }, T.atalhos.verSite),
        avisoSite ? h('span', { class: 'apoio', id: 'ver-site-aviso' }, ' — ' + avisoSite) : null));

    // 5. endereços do site, com QR (14 T3 cartão 5). Cartão PRÓPRIO e não uma
    // linha dos atalhos: os atalhos são "o que fazer agora", isto é "como dar
    // o endereço a outra pessoa" — e um QR ao lado de um botão de ação não é
    // legível. O aviso de "ainda não publicado" repete-se aqui de propósito:
    // quem chega para divulgar tem de saber que o endereço ainda não mostra
    // nada, sem ter de olhar o cartão de cima.
    const E = T.enderecos;
    const cartaoEnderecos = h('div', { class: 'cartao', id: 'cartao-enderecos' }, h('h2', {}, E.titulo), h('p', { class: 'apoio' }, E.apoio));
    if (semPublicacao || foraDoAr) cartaoEnderecos.appendChild(h('p', { class: 'alerta', id: 'enderecos-aviso' }, semPublicacao ? E.naoPublicado : E.foraDoAr));
    cartaoEnderecos.appendChild(h('ul', { class: 'lista-enderecos' }, Modelo.GATEWAYS.map(function (g) {
      const url = Modelo.urlDoSite(s.npub, g.host);
      const pAviso = h('p', { class: 'apoio endereco-aviso', hidden: true });
      // O QR é desenhado aqui, nó a nó. Se a biblioteca faltar (nunca deve
      // faltar — a montagem confere o sha256), o endereço continua legível:
      // o cartão perde o código, não a informação.
      let qr = null;
      try { qr = Qr.elemento(url, { classe: 'qr', rotulo: texto(E.qrRotulo, { u: url }) }); }
      catch (e) { qr = null; }
      const linkBaixar = h('a', { class: 'ligacao baixar-qr', href: '#', download: 'qrcode-' + g.host + '-' + Chave.npub8(s.npub) + '.png' }, E.baixarQr);
      // O PNG só é gerado quando pedido, e o blob é solto assim que o
      // navegador o pega: um objeto por gateway ficaria vivo à toa.
      linkBaixar.addEventListener('click', async function (ev) {
        if (linkBaixar.dataset.pronto === '1') { delete linkBaixar.dataset.pronto; return; }
        ev.preventDefault();
        const blob = await Qr.png(url);
        if (!blob) { pAviso.textContent = E.qrFalhou; pAviso.hidden = false; return; }
        const u = URL.createObjectURL(blob);
        linkBaixar.href = u;
        linkBaixar.dataset.pronto = '1';
        linkBaixar.click();
        setTimeout(function () { try { URL.revokeObjectURL(u); } catch (e2) {} linkBaixar.href = '#'; }, 30000);
      });
      const btCopiar = h('button', { type: 'button', class: 'ligacao copiar-endereco', onclick: async function () {
        let ok = false;
        try { await navigator.clipboard.writeText(url); ok = true; } catch (e) { ok = false; }
        pAviso.textContent = ok ? E.copiado : E.copiarFalhou;
        pAviso.hidden = false;
      } }, E.copiar);
      return h('li', { class: 'endereco' },
        qr,
        h('div', { class: 'endereco-texto' },
          h('p', { class: 'endereco-url' },
            h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, g.host),
            g.principal ? h('span', { class: 'apoio' }, ' (' + E.principal + ')') : null,
            g.lento ? h('span', { class: 'apoio' }, ' (' + T.atalhos.lento + ')') : null),
          h('code', { class: 'endereco-completo' }, url),
          h('p', { class: 'acoes-endereco' }, btCopiar, ' ', linkBaixar),
          pAviso));
    })));

    // 6. últimos artigos
    const cartaoUltimos = h('div', { class: 'cartao', id: 'cartao-ultimos' }, h('h2', {}, T.ultimos.titulo));
    if (!posts.length) cartaoUltimos.appendChild(h('p', { class: 'apoio' }, T.ultimos.nenhum));
    else cartaoUltimos.appendChild(h('ul', { class: 'lista-artigos' }, posts.map(p => h('li', {}, h('span', { class: 'data' }, Modelo.formatarData(p.date)), ' ', p.title, ' ', h('span', { class: 'apoio' }, '(' + (Textos.status[p.status] || p.status) + ')'), ' ',
      h('button', { type: 'button', class: 'ligacao', onclick: function () { Shell.ir('t5', { editar: p.id }); } }, T.ultimos.editar)))));

    // 6b. mensagens (61). A BARRA SUPERIOR NÃO MUDA: ela é do publicar e do
    // backup, e um terceiro contador ali estraga a leitura dos dois que existem.
    const M = T.mensagens;
    const cartaoMensagens = h('div', { class: 'cartao', id: 'cartao-mensagens' }, h('h2', {}, M.titulo));
    if (!(site.messages && site.messages.enabled)) cartaoMensagens.appendChild(h('p', { class: 'apoio', id: 'mensagens-resumo' }, M.desligado));
    else if (ultimaMensagem > 0) cartaoMensagens.appendChild(h('p', { id: 'mensagens-resumo' }, texto(M.ultima, { d: Modelo.formatarData(Modelo.dataDeUnix(ultimaMensagem)) })));
    else cartaoMensagens.appendChild(h('p', { class: 'apoio', id: 'mensagens-resumo' }, M.nenhuma));
    cartaoMensagens.appendChild(h('div', { class: 'acoes' }, h('button', { type: 'button', class: 'secundario', onclick: function () { Shell.ir('t13'); } }, M.abrir)));

    // 7. apoie (T-16)
    const cartaoApoie = apoioFechado ? null : h('div', { class: 'cartao apoie', id: 'cartao-apoie' }, h('h2', {}, T.apoie.titulo), h('p', {}, T.apoie.texto),
      h('div', { class: 'acoes' }, h('button', { type: 'button', class: 'secundario', onclick: function () { Shell.ir('t11', { secao: 'apoio' }); } }, T.apoie.botao),
        h('button', { type: 'button', class: 'ligacao', id: 'fechar-apoie', onclick: function () { apoioFechado = true; cartaoApoie.remove(); } }, T.apoie.fechar)));

    raiz.appendChild(h('section', { id: 't3' },
      h('h1', {}, T.titulo),
      params && params.resumo ? h('p', { id: 'resumo-carga', class: 'alerta' }, params.resumo) : null,
      h('div', { class: 'cartoes' }, cartaoSaude, cartaoAlt, cartaoBackup, cartaoAtalhos, cartaoEnderecos, cartaoUltimos, cartaoMensagens, cartaoApoie)));
  }

  Shell.registrar('t3', { montar: montar, desmontar: desmontar });
})();
