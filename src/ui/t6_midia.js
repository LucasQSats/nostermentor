/* ui/t6_midia.js — T6 Mídia, T6a Enviar e T6b Remover (14 T6, T6a, T6b).
   O M4 entregou o essencial para publicar com imagens; o M5 completa a tela
   com o que o produto promete em 03 §6 e 13 §4.3:
     - a biblioteca com miniatura, dimensões, ESTADO, **onde está** ("em N
       servidores" ou "só neste navegador ⚠", 13 §7.2) e o que se sabe dos
       metadados de cada arquivo;
     - a aba **Arquivos herdados** — o que outra ferramenta publicou nesta
       chave e o app preserva em toda publicação (14 T2c/T-7), incluindo o
       aviso de colisão que bloqueia T8 (T-7b);
     - o **relato de remoção por servidor** e o **"Reconferir"**: o DELETE
       pode ser recusado (P14) ou aceito e ignorado por minutos ou horas
       (P13), então a única prova de que o arquivo sumiu é perguntar de novo
       mais tarde — `Blossom.conferirEmTodos` (BUD-01 `HEAD /<sha256>`);
     - em T6a, os avisos de tamanho de 05 §2.2 (20 MiB / 100 MB) e o uso do
       cache `network.capabilities` para não sondar de novo o que já se sabe
       — cada HEAD poupado é uma conexão Tor poupada.
   Nada sobe nesta tela: subir é ato de T8. Remover diz a verdade antes do
   clique (T6b); excluir só existe para o que nunca foi publicado. */
(function () {
  'use strict';
  let ctrl = null;
  let aba = 'biblioteca';           // por sessão, não persiste
  const pendentes = [];             // arquivos escolhidos, ainda não guardados
  const urlsAbertas = [];           // blob: das miniaturas — revogadas ao sair

  const DIA_MS = 24 * 60 * 60 * 1000;
  const AVISO_20 = 20 * 1024 * 1024;
  const AVISO_100 = 100 * 1000 * 1000;

  function desmontar() {
    if (ctrl) { ctrl.abort(); ctrl = null; }
    pendentes.length = 0;
    for (const u of urlsAbertas) { try { URL.revokeObjectURL(u); } catch (e) {} }
    urlsAbertas.length = 0;
  }
  function texto(m, mapa) { let s = String(m); for (const k of Object.keys(mapa || {})) s = s.split('{' + k + '}').join(String(mapa[k])); return s; }
  function bytesTexto(n) {
    if (n == null) return '';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
    return (n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0).replace('.', ',') + ' MB';
  }
  function servidorCurto(u) { try { return new URL(u).hostname; } catch (e) { return String(u); } }
  function listaCurta(us) { return (us || []).map(servidorCurto).join(', '); }
  function ehImagem(mime) { return String(mime || '').indexOf('image/') === 0; }
  function tipoBase(mime) { return String(mime || '').split(';')[0].trim().toLowerCase(); }
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
  // Largura e altura da imagem, para a lista dizer o que o dono está a
  // publicar. Falha em silêncio (SVG e motores sem createImageBitmap): a
  // dimensão é informação, nunca condição para o arquivo entrar.
  async function dimensoesDe(bytes, mime) {
    if (!ehImagem(mime) || typeof createImageBitmap !== 'function') return { width: null, height: null };
    try {
      const bmp = await createImageBitmap(new Blob([bytes], { type: mime }));
      const d = { width: bmp.width, height: bmp.height };
      if (typeof bmp.close === 'function') bmp.close();
      return d;
    } catch (e) { return { width: null, height: null }; }
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
    let pages = await db.getAll('pages');
    let posts = await db.getAll('posts');
    let relatos = await lerRelatos();

    if (params && params.aba && (params.aba === 'herdados' || params.aba === 'biblioteca')) aba = params.aba;
    if (aba === 'herdados' && !midias.some(ehHerdado)) aba = 'biblioteca';

    const secao = h('section', { id: 't6' }, h('h1', {}, T.titulo));
    const barraAbas = h('nav', { class: 'abas', id: 't6-abas', 'aria-label': T.titulo, hidden: true });
    const divEnviar = h('div', { id: 't6a', class: 'cartao' });
    const divLista = h('div', { id: 't6-lista', class: 'cartao' });
    const divRelato = h('div', { id: 't6-relato', class: 'cartao' });
    secao.appendChild(barraAbas); secao.appendChild(divEnviar); secao.appendChild(divLista); secao.appendChild(divRelato);
    raiz.appendChild(secao);

    function ehHerdado(m) { return !!m && m.origin === 'network'; }

    // Os relatos de remoção JÁ PUBLICADA (13 §4.3): o registro de `media`
    // sai do banco na publicação, e o placar por servidor sobrevive em
    // `meta['removal/<sha256>']`. É o que este bloco mostra.
    async function lerRelatos() {
      let metas = [];
      try { metas = await db.getAll('meta'); } catch (e) { return []; }
      return (metas || []).filter(x => x && typeof x.key === 'string' && x.key.indexOf('removal/') === 0)
        .map(x => ({ chave: x.key, sha256: x.key.slice(8), valor: x.value || {} }))
        .sort((a, b) => String(a.valor.path || '').localeCompare(String(b.valor.path || '')));
    }

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
          bytes: null, sha256: null, width: null, height: null,
          metadata: { stripped: null, removed_segments: [], warning: null }, preflight: []
        };
        pendentes.push(item);
        await preparar(item);
      }
      entrada.value = '';
      renderPendentes();
    }

    // O que o cache do pré-flight (13 §3 `network.capabilities`) já sabe
    // deste tipo neste servidor. Uma recusa por tipo não caduca por si; a
    // data existe para não carregar para sempre um "não" de um servidor que
    // mudou de política — 24 h, a mesma janela de T-3 (14 §14).
    function doCache(servidor, mime, tamanho) {
      const cap = (site.network && site.network.capabilities) || {};
      const c = cap[servidor];
      if (!c || !c.checked_at) return null;
      const idade = Date.now() - Date.parse(c.checked_at);
      if (!(idade >= 0 && idade < DIA_MS)) return null;
      const base = { servidor: servidor, estado: 'recusa', status: 0, ms: 0, detalhe: TA.jaVerificado, checked_at: c.checked_at, cache: true };
      if (Array.isArray(c.refuses) && c.refuses.indexOf(tipoBase(mime)) !== -1) return Object.assign({}, base, { codigo: 'tipo_nao_aceito' });
      if (typeof c.max_bytes === 'number' && c.max_bytes > 0 && tamanho > c.max_bytes) return Object.assign({}, base, { codigo: 'grande_demais' });
      return null;
    }

    // Limpeza (quando marcada) → hash → dimensões → pré-flight por servidor
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
      const d = await dimensoesDe(bytes, item.mime);
      item.width = d.width; item.height = d.height;
      item.preflight = servidores.map(sv => ({ servidor: sv, estado: 'verificando' }));
      renderPendentes();
      if (!servidores.length) return;
      // o que o cache já responde não vai à rede (uma conexão Tor a menos)
      const sabidos = [], perguntar = [];
      for (const sv of servidores) {
        const c = doCache(sv, item.mime, bytes.length);
        if (c) sabidos.push(c); else perguntar.push(sv);
      }
      item.preflight = sabidos.concat(perguntar.map(sv => ({ servidor: sv, estado: 'verificando' })));
      renderPendentes();
      if (!perguntar.length) return;
      ctrl = ctrl || new AbortController();
      const rs = await Blossom.preflightEmTodos(perguntar, { sha: item.sha256, tamanho: bytes.length, mime: item.mime, assinar: Shell.assinar, sinal: ctrl.signal });
      item.preflight = sabidos.concat(rs);
      await guardarCapacidades(rs, item.mime);
      renderPendentes();
    }

    // 13 §3: cache do pré-flight com a data. `refuses` guarda o TIPO recusado
    // (não o código do motivo, como no M4): é o que permite poupar o HEAD da
    // próxima vez que o dono escolher um arquivo do mesmo tipo.
    async function guardarCapacidades(rs, mime) {
      const cap = Object.assign({}, (site.network && site.network.capabilities) || {});
      for (const r of rs) {
        const antes = cap[r.servidor] || { checked_at: null, max_bytes: null, refuses: [] };
        const refuses = Array.isArray(antes.refuses) ? antes.refuses.slice() : [];
        const tipo = tipoBase(mime);
        if (r.estado === 'recusa' && r.codigo === 'tipo_nao_aceito' && tipo && refuses.indexOf(tipo) === -1) refuses.push(tipo);
        if (r.estado === 'aceita') { const i = refuses.indexOf(tipo); if (i !== -1) refuses.splice(i, 1); }
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
    function avisoTamanho(n) {
      if (n > AVISO_100) return TA.grande100;
      if (n > AVISO_20) return TA.grande20;
      return null;
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
        const tam = item.bytes ? item.bytes.length : 0;
        const aviso = avisoTamanho(tam);
        listaPendentes.appendChild(h('div', { class: 'pendente' + (ok ? '' : ' bloqueado'), 'data-slug': item.slug },
          h('p', {}, h('strong', {}, bytesTexto(tam)), ' ', h('code', {}, item.mime),
            item.width ? h('span', { class: 'apoio' }, '  ' + texto(TA.dimensoes, { l: item.width, a: item.height })) : null),
          aviso ? h('p', { class: 'alerta t6a-grande' }, aviso) : null,
          h('label', {}, TA.nomeNoSite, campoSlug), h('span', { class: 'apoio' }, TA.nomeApoio), pCaminho,
          ehImagem(item.mime) ? h('label', {}, TA.alt, campoAlt) : null,
          ehImagem(item.mime) ? h('span', { class: 'apoio' }, TA.altApoio) : null,
          h('label', {}, TA.legenda, campoLegenda),
          semLimpeza ? h('p', { class: 'alerta' }, item.mime === 'image/svg+xml' ? TA.svg : TA.semLimpeza)
            : h('p', {}, h('label', {}, caixaLimpar, ' ', TA.limpar), item.limpar ? null : h('span', { class: 'alerta' }, ' ' + TA.limparAviso)),
          h('p', { class: 'apoio' }, TA.paraOnde + ': ',
            item.preflight.length ? item.preflight.map(r => h('span', { class: 'pre ' + r.estado + (r.cache ? ' cache' : '') }, servidorCurto(r.servidor) + ' — ' + estadoPre(r) + '  ')) : '—'),
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
          width: item.width, height: item.height, alt: item.alt, caption: item.caption,
          bytes: new Blob([item.bytes], { type: item.mime }), status: 'draft', servers: [], removal: null,
          metadata: item.metadata, origin: 'upload', created_at: agora, updated_at: agora, previous_status: null } });
        n++;
      }
      if (ops.length) await db.escrever(ops);
      pendentes.length = 0;
      renderPendentes();
      pAviso.hidden = false; pAviso.textContent = texto(TA.adicionadas, { n: n });
      for (let i = 0; i < n; i++) await Shell.registrarAlteracao(1);
      await recarregar();
      const c = await Rede.contagens(db);
      Shell.contadores({ publicar: c.pendentes });
    }

    async function recarregar() {
      midias = await db.getAll('media');
      pages = await db.getAll('pages');
      posts = await db.getAll('posts');
      relatos = await lerRelatos();
      render();
    }

    // --- T6b: remover, excluir, desfazer ----------------------------------
    // Lê do banco na hora, não do que a tela carregou ao montar: o dono pode
    // ter mexido no artigo noutra aba, e esta contagem é o que ele usa para
    // decidir. Uma leitura do IndexedDB ao abrir o modal não custa nada.
    async function usadaEm(m) {
      const ps = await db.getAll('pages'), po = await db.getAll('posts');
      const noCorpo = r => String(r.body || '').indexOf(m.path) !== -1;
      const comoCapa = r => r.cover_media_id === m.id;
      return ps.filter(noCorpo).concat(po.filter(r => noCorpo(r) || comoCapa(r)));
    }

    async function remover(m) {
      const usada = await usadaEm(m);
      const TB = Textos.t6b;
      return Shell.modal({ titulo: texto(TB.titulo, { p: m.path }), conteudo: [
        h('p', {}, TB.tirar), h('p', {}, TB.apagar),
        h('p', { class: usada.length ? 'alerta' : 'apoio' }, texto(TB.usadaEm, { n: usada.length })),
        h('div', { class: 'acoes' },
          h('button', { type: 'button', id: 't6b-remover', onclick: async function () {
            const t = Modelo.transicao(m, 'remover');
            if (t && t.registro) await db.put('media', t.registro);
            Shell.fecharModal();
            await Shell.registrarAlteracao(1);
            await recarregar();
            const c = await Rede.contagens(db);
            Shell.contadores({ publicar: c.pendentes });
          } }, TB.remover),
          h('button', { type: 'button', class: 'secundario', onclick: function () { Shell.fecharModal(); } }, TB.cancelar))] });
    }

    // Só para o que nunca esteve na rede (13 §4.4): apaga na hora, sem
    // publicação — e sem promessa nenhuma sobre servidores.
    async function excluir(m) {
      const usada = await usadaEm(m);
      const jaEsteveNaRede = (m.servers || []).length > 0 || !!m.removal;
      return Shell.modal({ titulo: texto(T.excluirTitulo, { p: m.path }), conteudo: [
        h('p', { class: 'alerta' }, T.excluirTexto),
        jaEsteveNaRede ? h('p', { class: 'apoio' }, T.excluirJaEsteve) : null,
        h('p', { class: usada.length ? 'alerta' : 'apoio' }, texto(Textos.t6b.usadaEm, { n: usada.length })),
        h('div', { class: 'acoes' },
          h('button', { type: 'button', id: 't6-excluir-ok', class: 'perigoso', onclick: async function () {
            await db.del('media', m.id);
            Shell.fecharModal();
            await recarregar();
            const c = await Rede.contagens(db);
            Shell.contadores({ publicar: c.pendentes });
          } }, T.excluir),
          h('button', { type: 'button', class: 'secundario', onclick: function () { Shell.fecharModal(); } }, T.cancelar))] });
    }

    function editarDescricao(m) {
      const campoAlt = h('input', { type: 'text', id: 't6-edit-alt', value: m.alt || '' });
      const campoLegenda = h('input', { type: 'text', id: 't6-edit-legenda', value: m.caption || '' });
      return Shell.modal({ titulo: texto(T.editarTitulo, { p: m.path }), conteudo: [
        ehImagem(m.mime) ? h('label', { for: 't6-edit-alt' }, Textos.t6a.alt) : null,
        ehImagem(m.mime) ? campoAlt : null,
        ehImagem(m.mime) ? h('p', { class: 'apoio' }, Textos.t6a.altApoio) : null,
        h('label', { for: 't6-edit-legenda' }, Textos.t6a.legenda), campoLegenda,
        h('div', { class: 'acoes' },
          h('button', { type: 'button', id: 't6-edit-salvar', onclick: async function () {
            const novo = Object.assign({}, m, { alt: campoAlt.value, caption: campoLegenda.value, updated_at: Modelo.agora() });
            // mudar a descrição não muda o arquivo: o hash é o mesmo e nada
            // sobe de novo — mas o site.json publicado leva o alt (13 §6.1),
            // então isto é, sim, uma alteração por publicar.
            if (novo.status === 'published') { const t = Modelo.transicao(novo, 'editar'); if (t && t.registro) Object.assign(novo, t.registro); }
            await db.put('media', novo);
            Shell.fecharModal();
            await Shell.registrarAlteracao(1);
            await recarregar();
          } }, T.salvar),
          h('button', { type: 'button', class: 'secundario', onclick: function () { Shell.fecharModal(); } }, T.cancelar))] });
    }

    // --- o relato de remoção e o "Reconferir" ------------------------------

    // 05 §2.2 / P13 / P14: o placar do dia da remoção é o que o servidor
    // RESPONDEU; isto é o que ele FAZ agora. Um HEAD por servidor, sem auth.
    async function reconferir(alvo, botao) {
      const rem = alvo.rem || {};
      const lista = Modelo.uniao(rem.deleted_from, rem.refused_by, rem.unverified, servidores);
      if (!lista.length) return;
      botao.disabled = true; botao.textContent = T.reconferindo;
      ctrl = ctrl || new AbortController();
      const r = await Blossom.conferirEmTodos(lista, alvo.sha256, { sinal: ctrl.signal });
      const recheck = { checked_at: r.checked_at, gone: r.deleted_from, still_there: r.refused_by, unknown: r.unverified };
      const novo = Object.assign({}, rem, { recheck: recheck });
      if (alvo.chave) await db.put('meta', { key: alvo.chave, value: novo });
      else if (alvo.midia) await db.put('media', Object.assign({}, alvo.midia, { removal: novo }));
      await recarregar();
    }

    function linhaRelato(alvo) {
      const rem = alvo.rem || {}, rc = rem.recheck || null;
      const btn = h('button', { type: 'button', class: 'ligacao t6-reconferir', 'data-sha': alvo.sha256 }, T.reconferir);
      btn.addEventListener('click', function () { reconferir(alvo, btn); });
      const partes = [];
      if ((rem.deleted_from || []).length) partes.push(h('span', { class: 'ok' }, texto(T.relatoApagado, { s: listaCurta(rem.deleted_from) })));
      if ((rem.refused_by || []).length) partes.push(h('span', { class: 'alerta-inline' }, texto(T.relatoRecusou, { s: listaCurta(rem.refused_by) })));
      if ((rem.unverified || []).length) partes.push(h('span', { class: 'alerta-inline' }, texto(T.relatoPorConferir, { s: listaCurta(rem.unverified) })));
      const linhas = [];
      for (let i = 0; i < partes.length; i++) linhas.push(h('li', {}, partes[i]));
      const conferido = [];
      if (rc) {
        if ((rc.gone || []).length) conferido.push(h('li', { class: 'ok' }, texto(T.relatoSumiu, { s: listaCurta(rc.gone) })));
        if ((rc.still_there || []).length) conferido.push(h('li', { class: 'alerta-inline' }, texto(T.relatoAindaLa, { s: listaCurta(rc.still_there) })));
        if ((rc.unknown || []).length) conferido.push(h('li', {}, texto(T.relatoIndeterminado, { s: listaCurta(rc.unknown) })));
        conferido.push(h('li', { class: 'apoio' }, texto(T.relatoQuando, { d: Modelo.formatarDataHora ? Modelo.formatarDataHora(rc.checked_at) : rc.checked_at })));
      }
      return h('div', { class: 't6-relato-item', 'data-path': alvo.path || '' },
        h('p', {}, h('code', {}, alvo.path || alvo.sha256.slice(0, 12)), ' ', btn),
        h('ul', { class: 'relato' }, linhas),
        conferido.length ? h('ul', { class: 'relato reconferido' }, conferido) : null);
    }

    function renderRelato() {
      Shell.limpar(divRelato);
      const alvos = relatos.map(r => ({ chave: r.chave, sha256: r.sha256, path: r.valor.path, rem: r.valor }));
      for (const m of midias) if (m.removal && (m.removal.deleted_from || m.removal.refused_by || m.removal.unverified)) alvos.push({ midia: m, sha256: m.sha256, path: m.path, rem: m.removal });
      divRelato.hidden = alvos.length === 0;
      if (!alvos.length) return;
      divRelato.appendChild(h('h2', {}, T.relatoTitulo));
      divRelato.appendChild(h('p', { class: 'apoio' }, T.relatoApoio));
      for (const a of alvos) divRelato.appendChild(linhaRelato(a));
    }

    // --- a biblioteca -----------------------------------------------------
    function miniatura(m) {
      if (!ehImagem(m.mime) || !m.bytes) return h('span', { class: 'sem-mini', title: T.semMiniatura }, Modelo.extensao(m.path) || '?');
      let url;
      try { url = URL.createObjectURL(m.bytes); } catch (e) { return h('span', { class: 'sem-mini' }, Modelo.extensao(m.path) || '?'); }
      urlsAbertas.push(url);
      return h('img', { class: 'mini', src: url, alt: m.alt || '', loading: 'lazy' });
    }
    function ondeEsta(m) {
      const n = (m.servers || []).length;
      if (n) return h('span', { class: 'onde', title: (m.servers || []).join(' ') }, texto(T.emServidores, { n: n }));
      return h('span', { class: 'onde so-aqui alerta-inline' }, T.soAqui);
    }
    function metadadosDe(m) {
      const md = m.metadata || {};
      if (md.warning) return h('span', { class: 'alerta-inline' }, md.warning);
      if (md.stripped === true) return h('span', { class: 'ok' }, T.metadados.limpos);
      if (md.stripped === false) return h('span', { class: 'alerta-inline' }, T.metadados.mantidos);
      return h('span', { class: 'apoio' }, T.metadados.desconhecido);
    }
    function acoesDe(m) {
      const acoes = [];
      if (m.status === 'removed') {
        acoes.push(h('button', { type: 'button', class: 'ligacao', onclick: async function () {
          const t = Modelo.transicao(m, 'desfazer_remocao');
          if (t && t.registro) { await db.put('media', t.registro); await recarregar(); }
        } }, T.desfazer));
      } else {
        acoes.push(h('button', { type: 'button', class: 'ligacao t6-editar', onclick: function () { editarDescricao(m); } }, T.editar));
        acoes.push(' ');
        acoes.push(h('button', { type: 'button', class: 'ligacao copiar-caminho', onclick: function (ev) {
          try { navigator.clipboard.writeText(m.path); } catch (e) {}
          ev.target.textContent = T.copiado;
        } }, T.copiarCaminho));
        acoes.push(' ');
        acoes.push(h('button', { type: 'button', class: 'ligacao copiar', onclick: function (ev) {
          const marcacao = ehImagem(m.mime) ? '![' + (m.alt || '') + '](' + m.path + ')' : '[' + (m.caption || m.path) + '](' + m.path + ')';
          try { navigator.clipboard.writeText(marcacao); } catch (e) {}
          ev.target.textContent = T.copiado;
        } }, T.copiarMarcacao));
        acoes.push(' ');
        acoes.push(m.status === 'draft'
          ? h('button', { type: 'button', class: 'ligacao t6-excluir', onclick: function () { excluir(m); } }, T.excluir)
          : h('button', { type: 'button', class: 'ligacao t6-remover', onclick: function () { remover(m); } }, T.remover));
      }
      return acoes;
    }

    function linhaDe(m, doApp) {
      const estado = ehHerdado(m) ? T.herdado : (m.status === 'draft' ? T.soLocal : (Textos.status[m.status] || m.status));
      const colide = doApp && doApp.has(m.path);
      return h('tr', { 'data-path': m.path, class: (m.status === 'removed' ? 'removida' : '') + (colide ? ' colide' : '') },
        h('td', { class: 'col-mini' }, miniatura(m)),
        h('td', {}, h('code', {}, m.path),
          m.width ? h('p', { class: 'apoio' }, texto(T.dimensoes, { l: m.width, a: m.height })) : null,
          colide ? h('p', { class: 'erro' }, T.herdadosColisao) : null),
        h('td', {}, bytesTexto(m.size)),
        h('td', {}, h('span', { class: 'estado ' + (m.status || '') }, estado)),
        h('td', {}, ondeEsta(m), h('br'), metadadosDe(m)),
        h('td', {}, acoesDe(m)));
    }

    function tabela(lista, doApp) {
      const t = h('table', { class: 'lista', id: 't6-tabela' },
        h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', {}, T.coluna.caminho), h('th', {}, T.coluna.tamanho),
          h('th', {}, T.coluna.estado), h('th', {}, T.coluna.ondeEsta), h('th', {}, T.coluna.acoes))));
      const corpo = h('tbody', {});
      for (const m of lista) corpo.appendChild(linhaDe(m, doApp));
      t.appendChild(corpo);
      return t;
    }

    function renderLista() {
      Shell.limpar(divLista);
      for (const u of urlsAbertas.splice(0)) { try { URL.revokeObjectURL(u); } catch (e) {} }
      const ordenar = (a, b) => String(a.path).localeCompare(String(b.path));
      const proprias = midias.filter(m => !ehHerdado(m)).sort(ordenar);
      const herdadas = midias.filter(ehHerdado).sort(ordenar);
      if (aba === 'herdados') {
        divLista.appendChild(h('h2', {}, T.abas[1][1]));
        divLista.appendChild(h('p', { class: 'apoio' }, T.herdadosApoio));
        if (!herdadas.length) { divLista.appendChild(h('p', { class: 'apoio', id: 't6-herdados-vazio' }, T.herdadosVazio)); return; }
        const doApp = Publicar.caminhosDoApp({ pages: pages, posts: posts });
        divLista.appendChild(tabela(herdadas, doApp));
        return;
      }
      divLista.appendChild(h('h2', {}, T.titulo));
      if (!proprias.length) { divLista.appendChild(h('p', { class: 'apoio', id: 't6-vazio' }, T.vazio)); return; }
      const naoPublicadas = proprias.filter(m => m.status !== 'published').length;
      if (naoPublicadas) divLista.appendChild(h('p', { class: 'destaque', id: 't6-pendentes' }, texto(T.naoPublicadas, { n: naoPublicadas })));
      divLista.appendChild(tabela(proprias, null));
    }

    function renderAbas() {
      Shell.limpar(barraAbas);
      const temHerdados = midias.some(ehHerdado);
      barraAbas.hidden = !temHerdados;
      if (!temHerdados) { if (aba === 'herdados') aba = 'biblioteca'; return; }
      for (const [nome, rotulo] of T.abas) {
        barraAbas.appendChild(h('button', { type: 'button', class: 'aba' + (nome === aba ? ' atual' : ''), 'data-aba': nome,
          onclick: function () { aba = nome; render(); } }, rotulo));
      }
    }

    function render() {
      renderAbas();
      divEnviar.hidden = aba !== 'biblioteca';
      renderLista();
      renderRelato();
    }

    render();
    renderPendentes();
    if (params && params.enviar) entrada.focus();
    Shell.atualizarBarra();
  }

  Shell.registrar('t6', { montar: montar, desmontar: desmontar });
})();
