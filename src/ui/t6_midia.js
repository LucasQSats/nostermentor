/* ui/t6_midia.js — T6 Mídia e T6a Enviar (14 T6, T6a, T6b). No M4 entra o
   essencial para publicar com imagens: escolher arquivos pelo seletor (o
   portal do Tails alcança o Persistent e o pendrive — 07 §3.0.1), confirmar
   o nome que o arquivo terá no site (o nome original NÃO é guardado, 13
   §4.3), limpar os metadados por padrão (D15; JPEG/PNG/WebP por
   core/limpeza.js), ver o veredicto do pré-flight BUD-06 por servidor
   ANTES de decidir (05 §2.1 — é aqui que ele mora, decisão de 06 §4) e
   guardar na biblioteca como rascunho. Nada sobe nesta tela: subir é ato
   de T8. Remover diz a verdade de 03 §6 antes do clique (T6b).
   O relato de remoção por servidor, "Reconferir" e a aba de herdados são M5. */
(function () {
  'use strict';
  let ctrl = null;
  const pendentes = [];             // arquivos escolhidos, ainda não guardados

  function desmontar() { if (ctrl) { ctrl.abort(); ctrl = null; } pendentes.length = 0; }
  function texto(m, mapa) { let s = String(m); for (const k of Object.keys(mapa || {})) s = s.split('{' + k + '}').join(String(mapa[k])); return s; }
  function bytesTexto(n) {
    if (n == null) return '';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
    return (n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0).replace('.', ',') + ' MB';
  }
  function servidorCurto(u) { try { return new URL(u).hostname; } catch (e) { return String(u); } }
  function ehImagem(mime) { return String(mime || '').indexOf('image/') === 0; }
  function extensaoDe(nome, mime) {
    const m = /\.([A-Za-z0-9]+)$/.exec(String(nome || ''));
    const e = m ? m[1].toLowerCase() : null;
    if (e && Modelo.MIME[e]) return e;
    for (const k of Object.keys(Modelo.MIME)) if (Modelo.MIME[k] === mime) return k;
    return 'bin';
  }
  function caminhoDe(slug, ext, mime) {
    const arquivo = slug + '.' + ext;
    return ehImagem(mime) ? Modelo.caminhoDe('img', arquivo) : Modelo.caminhoDe('media', arquivo);
  }

  async function montar(raiz, params) {
    const h = Shell.h, T = Textos.t6, TA = Textos.t6a, s = Shell.sessao();
    desmontar();
    const info = Shell.dados();
    if (!info || !info.db || !info.db.estaAberto()) {
      raiz.appendChild(h('section', { id: 't6' }, h('h1', {}, T.titulo), h('p', { class: 'alerta' }, Textos.t3.aindaCarregando),
        h('div', { class: 'acoes' }, h('button', { type: 'button', onclick: function () { Shell.ir('t2'); } }, Textos.t3.voltarACarregar))));
      return;
    }
    const db = info.db;
    const site = (await db.get('site', 'site')) || Modelo.sitePadrao(s.pubkey, s.npub);
    const servidores = Modelo.uniao(site.network && site.network.servers);
    let midias = await db.getAll('media');

    const secao = h('section', { id: 't6' }, h('h1', {}, T.titulo));
    const divEnviar = h('div', { id: 't6a', class: 'cartao' });
    const divLista = h('div', { id: 't6-lista', class: 'cartao' });
    secao.appendChild(divEnviar); secao.appendChild(divLista);
    raiz.appendChild(secao);

    // --- T6a: escolher e preparar ----------------------------------------
    const entrada = h('input', { type: 'file', id: 't6a-arquivos', multiple: true });
    const listaPendentes = h('div', { id: 't6a-pendentes' });
    const btnAdicionar = h('button', { type: 'button', id: 't6a-adicionar', disabled: true, onclick: adicionar }, TA.adicionar);
    const pAviso = h('p', { id: 't6a-aviso', class: 'apoio', hidden: true });
    entrada.addEventListener('change', function () { escolher(Array.prototype.slice.call(entrada.files || [])); });

    Shell.limpar(divEnviar);
    divEnviar.appendChild(h('h2', {}, TA.titulo));
    divEnviar.appendChild(h('p', { class: 'apoio' }, TA.apoio));
    divEnviar.appendChild(entrada);
    divEnviar.appendChild(listaPendentes);
    divEnviar.appendChild(h('div', { class: 'acoes' }, btnAdicionar));
    divEnviar.appendChild(pAviso);

    async function escolher(arquivos) {
      for (const f of arquivos) {
        let brutos;
        try { brutos = new Uint8Array(await f.arrayBuffer()); } catch (e) { Shell.erro(TA.erroLeitura); continue; }
        const mime = f.type || Modelo.mimePorCaminho(f.name) || 'application/octet-stream';
        const ext = extensaoDe(f.name, mime);
        const item = {
          id: Modelo.novoId(), brutos: brutos, mime: mime, ext: ext,
          slug: Modelo.slug(String(f.name).replace(/\.[A-Za-z0-9]+$/, '')) || 'arquivo',
          alt: '', caption: '', limpar: Limpeza.limpaEsteTipo(mime),
          bytes: null, sha256: null, metadata: { stripped: null, removed_segments: [], warning: null }, preflight: []
        };
        pendentes.push(item);
        await preparar(item);
      }
      entrada.value = '';
      renderPendentes();
    }

    // Limpeza (quando marcada) → hash → pré-flight por servidor
    async function preparar(item) {
      let bytes = item.brutos;
      item.metadata = { stripped: false, removed_segments: [], warning: Limpeza.limpaEsteTipo(item.mime) ? null : TA.semLimpeza };
      if (item.limpar && Limpeza.limpaEsteTipo(item.mime)) {
        try {
          const r = Limpeza.limpar(item.brutos);
          bytes = r.bytes;
          item.metadata = { stripped: true, removed_segments: r.removidos || [], warning: null };
        } catch (e) {
          item.metadata = { stripped: false, removed_segments: [], warning: TA.semLimpeza };
        }
      }
      item.bytes = bytes;
      item.sha256 = await Blossom.sha256Hex(bytes);
      item.preflight = servidores.map(sv => ({ servidor: sv, estado: 'verificando' }));
      renderPendentes();
      if (!servidores.length) return;
      ctrl = ctrl || new AbortController();
      const rs = await Blossom.preflightEmTodos(servidores, { sha: item.sha256, tamanho: bytes.length, mime: item.mime, assinar: Shell.assinar, sinal: ctrl.signal });
      item.preflight = rs;
      await guardarCapacidades(rs);
      renderPendentes();
    }

    // 13 §3: cache do pré-flight com a data
    async function guardarCapacidades(rs) {
      const cap = Object.assign({}, (site.network && site.network.capabilities) || {});
      for (const r of rs) {
        const antes = cap[r.servidor] || { checked_at: null, max_bytes: null, refuses: [] };
        const refuses = Array.isArray(antes.refuses) ? antes.refuses.slice() : [];
        if (r.estado === 'recusa' && r.codigo === 'tipo_nao_aceito' && refuses.indexOf(r.detalhe || r.codigo) === -1) refuses.push(r.codigo);
        cap[r.servidor] = { checked_at: r.checked_at, max_bytes: antes.max_bytes, refuses: refuses };
      }
      site.network = Object.assign({}, site.network, { capabilities: cap });
      try { await db.put('site', site, 'site'); } catch (e) {}
    }

    function estadoPre(r) {
      if (r.estado === 'verificando') return TA.preflight.verificando;
      if (r.estado === 'aceita') return TA.preflight.aceita;
      if (r.estado === 'recusa') return TA.preflight.recusa + ': ' + ((Textos.t8.motivos && Textos.t8.motivos[r.codigo]) || r.codigo) + (r.detalhe ? ' (' + r.detalhe + ')' : '');
      return TA.preflight.indeterminado;
    }
    function podeEntrar(item) {
      if (!servidores.length) return false;
      return item.preflight.some(r => r.estado !== 'recusa');       // "não consegui verificar" NÃO conta como recusa
    }

    function renderPendentes() {
      Shell.limpar(listaPendentes);
      for (const item of pendentes) {
        const caminho = caminhoDe(item.slug, item.ext, item.mime);
        const campoSlug = h('input', { type: 'text', class: 't6a-slug', value: item.slug, 'data-id': item.id });
        campoSlug.addEventListener('input', function () { item.slug = Modelo.slug(campoSlug.value); pCaminho.textContent = texto(TA.caminhoFinal, { p: caminhoDe(item.slug, item.ext, item.mime) }); });
        const pCaminho = h('p', { class: 'apoio caminho-final' }, texto(TA.caminhoFinal, { p: caminho }));
        const campoAlt = h('input', { type: 'text', class: 't6a-alt', value: item.alt });
        campoAlt.addEventListener('input', function () { item.alt = campoAlt.value; });
        const campoLegenda = h('input', { type: 'text', class: 't6a-legenda', value: item.caption });
        campoLegenda.addEventListener('input', function () { item.caption = campoLegenda.value; });
        const caixaLimpar = h('input', { type: 'checkbox', class: 't6a-limpar', checked: item.limpar });
        caixaLimpar.addEventListener('change', async function () { item.limpar = caixaLimpar.checked; await preparar(item); });
        const semLimpeza = !Limpeza.limpaEsteTipo(item.mime);
        const ok = podeEntrar(item);
        listaPendentes.appendChild(h('div', { class: 'pendente' + (ok ? '' : ' bloqueado'), 'data-slug': item.slug },
          h('p', {}, h('strong', {}, bytesTexto(item.bytes ? item.bytes.length : 0)), ' ', h('code', {}, item.mime)),
          h('label', {}, TA.nomeNoSite, campoSlug), h('span', { class: 'apoio' }, TA.nomeApoio), pCaminho,
          ehImagem(item.mime) ? h('label', {}, TA.alt, campoAlt) : null,
          ehImagem(item.mime) ? h('span', { class: 'apoio' }, TA.altApoio) : null,
          h('label', {}, TA.legenda, campoLegenda),
          semLimpeza ? h('p', { class: 'alerta' }, item.mime === 'image/svg+xml' ? TA.svg : TA.semLimpeza)
            : h('p', {}, h('label', {}, caixaLimpar, ' ', TA.limpar), item.limpar ? null : h('span', { class: 'alerta' }, ' ' + TA.limparAviso)),
          h('p', { class: 'apoio' }, TA.paraOnde + ': ',
            item.preflight.length ? item.preflight.map(r => h('span', { class: 'pre ' + r.estado }, servidorCurto(r.servidor) + ' — ' + estadoPre(r) + '  ')) : '—'),
          ok ? null : h('p', { class: 'erro' }, TA.nenhumServidor)));
      }
      btnAdicionar.disabled = pendentes.length === 0 || !pendentes.some(podeEntrar);
    }

    async function adicionar() {
      btnAdicionar.disabled = true;
      const ops = [];
      let n = 0;
      const caminhosUsados = new Set(midias.filter(m => m.status !== 'removed').map(m => m.path));
      for (const item of pendentes) {
        if (!podeEntrar(item)) continue;
        const caminho = caminhoDe(item.slug, item.ext, item.mime);
        if (caminhosUsados.has(caminho)) { Shell.erro(TA.repetido + ' (' + caminho + ')'); continue; }
        caminhosUsados.add(caminho);
        const agora = Modelo.agora();
        ops.push({ op: 'put', store: 'media', valor: {
          id: item.id, path: caminho, mime: item.mime, size: item.bytes.length, sha256: item.sha256,
          width: null, height: null, alt: item.alt, caption: item.caption,
          bytes: new Blob([item.bytes], { type: item.mime }), status: 'draft', servers: [], removal: null,
          metadata: item.metadata, origin: 'upload', created_at: agora, updated_at: agora, previous_status: null } });
        n++;
      }
      if (ops.length) await db.escrever(ops);
      pendentes.length = 0;
      renderPendentes();
      pAviso.hidden = false; pAviso.textContent = texto(TA.adicionadas, { n: n });
      for (let i = 0; i < n; i++) await Shell.registrarAlteracao(1);
      midias = await db.getAll('media');
      renderLista();
      const c = await Rede.contagens(db);
      Shell.contadores({ publicar: c.pendentes });
    }

    // --- T6: a biblioteca -------------------------------------------------
    async function remover(m) {
      const usada = (await db.getAll('pages')).concat(await db.getAll('posts')).filter(r => String(r.body || '').indexOf(m.path) !== -1);
      const TB = Textos.t6b;
      const modal = Shell.modal({ titulo: texto(TB.titulo, { p: m.path }), conteudo: [
        h('p', {}, TB.tirar), h('p', {}, TB.apagar),
        h('p', { class: usada.length ? 'alerta' : 'apoio' }, texto(TB.usadaEm, { n: usada.length })),
        h('div', { class: 'acoes' },
          h('button', { type: 'button', id: 't6b-remover', onclick: async function () {
            const t = Modelo.transicao(m, 'remover');
            if (t && t.registro) await db.put('media', t.registro);
            else if (m.status === 'draft') await db.del('media', m.id);
            Shell.fecharModal();
            midias = await db.getAll('media');
            renderLista();
            await Shell.registrarAlteracao(1);
            const c = await Rede.contagens(db);
            Shell.contadores({ publicar: c.pendentes });
          } }, TB.remover),
          h('button', { type: 'button', class: 'secundario', onclick: function () { Shell.fecharModal(); } }, TB.cancelar))] });
      return modal;
    }

    function renderLista() {
      Shell.limpar(divLista);
      divLista.appendChild(h('h2', {}, T.titulo));
      const vivas = midias.slice().sort((a, b) => String(a.path).localeCompare(String(b.path)));
      if (!vivas.length) { divLista.appendChild(h('p', { class: 'apoio', id: 't6-vazio' }, T.vazio)); return; }
      const naoPublicadas = vivas.filter(m => m.status !== 'published').length;
      if (naoPublicadas) divLista.appendChild(h('p', { class: 'destaque', id: 't6-pendentes' }, texto(T.naoPublicadas, { n: naoPublicadas })));
      const tabela = h('table', { class: 'lista', id: 't6-tabela' },
        h('thead', {}, h('tr', {}, h('th', {}, T.coluna.caminho), h('th', {}, T.coluna.tamanho), h('th', {}, T.coluna.estado), h('th', {}, T.coluna.acoes))));
      const corpo = h('tbody', {});
      for (const m of vivas) {
        const estado = m.origin === 'network' ? T.herdado : (m.status === 'draft' ? T.soLocal : (Textos.status[m.status] || m.status));
        corpo.appendChild(h('tr', { 'data-path': m.path, class: m.status === 'removed' ? 'removida' : '' },
          h('td', {}, h('code', {}, m.path)),
          h('td', {}, bytesTexto(m.size)),
          h('td', {}, estado),
          h('td', {},
            m.status === 'removed'
              ? h('button', { type: 'button', class: 'ligacao', onclick: async function () { const t = Modelo.transicao(m, 'desfazer_remocao'); if (t && t.registro) { await db.put('media', t.registro); midias = await db.getAll('media'); renderLista(); } } }, T.desfazer)
              : h('button', { type: 'button', class: 'ligacao', onclick: function () { remover(m); } }, T.remover),
            ' ',
            h('button', { type: 'button', class: 'ligacao copiar', onclick: function (ev) {
              const marcacao = ehImagem(m.mime) ? '![' + (m.alt || '') + '](' + m.path + ')' : '[' + (m.caption || m.path) + '](' + m.path + ')';
              try { navigator.clipboard.writeText(marcacao); } catch (e) {}
              ev.target.textContent = T.copiado;
            } }, T.copiarMarcacao))));
      }
      tabela.appendChild(corpo);
      divLista.appendChild(tabela);
    }

    renderLista();
    renderPendentes();
    if (params && params.enviar) entrada.focus();
    Shell.atualizarBarra();
  }

  Shell.registrar('t6', { montar: montar, desmontar: desmontar });
})();
