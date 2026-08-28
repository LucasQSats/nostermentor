/* ui/editor.js — T4a/T5a, o editor de página e artigo (14 T4a/T5a; decisão
   do usuário em 03 §3.2): caixa de texto com botões que inserem Markdown +
   pré-visualização ao lado, num <iframe sandbox="allow-scripts" srcdoc>
   SEM allow-same-origin (02 G.2.2; E4: imagens locais chegam lá por data:
   URI). Um só editor para os dois tipos (14 T-1). "Salvar" grava no
   IndexedDB e sobe o contador de não exportadas; gravação automática a
   cada 30 s e ao sair do campo (14 T-12), sempre com a legenda "Salvo neste
   navegador. Não é backup." (14 §0.4). Slug derivado do título e editável
   só até a primeira publicação; depois "Renomear caminho…" gera aliases
   (13 §4.0). beforeunload com alteração não salva (E5). */
const Editor = (function () {
  'use strict';
  const AUTOSAVE_MS = 30000, PREVIA_MS = 300;
  const RE_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  let E = null;

  function texto(m, mapa) { let s = m; for (const k of Object.keys(mapa || {})) s = s.split('{' + k + '}').join(String(mapa[k])); return s; }
  function horaAgora() { return Modelo.agora().slice(11, 16); }
  function lerBlob(blob) {
    return new Promise(function (resolve, reject) { const r = new FileReader(); r.onload = function () { resolve(String(r.result)); }; r.onerror = function () { reject(r.error); }; r.readAsDataURL(blob); });
  }
  // { "/img/x.webp": "data:image/webp;base64,…" } para a mídia com bytes locais (E4)
  async function dataUrisDe(media) {
    const m = {};
    for (const r of media || []) {
      if (!r || !r.bytes || r.status === 'removed' || !/^image\//.test(r.mime || '')) continue;
      try { m[r.path] = await lerBlob(r.bytes); } catch (e) {}
    }
    return m;
  }
  function imagensDe(media) { return (media || []).filter(r => r && r.status !== 'removed' && /^image\//.test(r.mime || '') && r.origin !== 'network'); }

  // "Ver como ficará" (14 T4a): a página inteira com o tema, isolada (usado por T4/T5 também)
  async function verComoFicara(db, reg, tipo) {
    const dados = { site: (await db.get('site', 'site')) || Modelo.sitePadrao(Shell.sessao().pubkey, Shell.sessao().npub), pages: await db.getAll('pages'), posts: await db.getAll('posts'), media: await db.getAll('media') };
    const lista = tipo === 'page' ? dados.pages : dados.posts;
    const i = lista.findIndex(r => r.id === reg.id);
    if (i === -1) lista.push(reg); else lista[i] = reg;
    const html = Gerador.previa(Gerador.htmlDe(dados, reg, tipo), await dataUrisDe(dados.media));
    const iframe = Shell.h('iframe', { id: 'previa-completa', sandbox: 'allow-scripts', title: Textos.editor.verComoFicara.titulo });
    iframe.srcdoc = html;
    Shell.modal({ titulo: Textos.editor.verComoFicara.titulo, conteudo: iframe, largo: true });
  }

  function desmontar() {
    if (!E) return;
    const e = E; E = null;
    clearInterval(e.timerAuto); clearTimeout(e.timerPrevia);
    window.removeEventListener('beforeunload', e.aoSair);
    if (e.sujo && !e.removido) salvar(e, { silencioso: true, motivo: 'sair' });   // não perder o que foi digitado (14 T-12)
  }

  // o: { tipo: 'page' | 'post', id?, novo?, voltar }
  async function montar(raiz, o) {
    desmontar();
    const h = Shell.h, T = Textos.editor, C = T.campos, tipo = o.tipo, store = tipo === 'page' ? 'pages' : 'posts';
    const TL = tipo === 'page' ? Textos.t4 : Textos.t5;
    const dados = Shell.dados();
    if (!dados || !dados.db || !dados.db.estaAberto()) { Shell.ir('t3'); return; }
    const db = dados.db, s = Shell.sessao();
    let reg = null;
    if (o.id) { reg = await db.get(store, o.id); if (!reg) { Shell.erro(T.erros.naoEncontrado); o.voltar(); return; } }
    else reg = tipo === 'page' ? Modelo.novaPagina('') : Modelo.novoArtigo('');
    const site = (await db.get('site', 'site')) || Modelo.sitePadrao(s.pubkey, s.npub);
    const media = await db.getAll('media');
    const imagens = imagensDe(media);
    const novo = !o.id;
    const removido = reg.status === 'removed';
    const travado = !novo && reg.status !== 'draft';   // 13 §4.0: slug imutável após a primeira publicação
    const ehInicio = tipo === 'page' && site.home && site.home.mode === 'page' && site.home.page_id === reg.id;

    const e = E = { db: db, store: store, tipo: tipo, reg: reg, novo: novo, removido: removido, sujo: false, salvando: false, pendente: null, slugAuto: novo || (reg.status === 'draft' && reg.slug === Modelo.slug(reg.title)), renomeando: false, dataUris: {}, voltar: o.voltar };

    // --- campos ---------------------------------------------------------------
    const inTitulo = h('input', { type: 'text', id: 'ed-titulo', value: reg.title || '', autocomplete: 'off', disabled: removido });
    const inSlug = h('input', { type: 'text', id: 'ed-slug', value: reg.slug || '', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', disabled: removido || travado });
    const btnRenomear = h('button', { type: 'button', id: 'ed-renomear', class: 'ligacao', hidden: !travado || removido, onclick: function () { e.renomeando = true; inSlug.disabled = false; btnRenomear.hidden = true; explicaRenomear.hidden = false; inSlug.focus(); } }, C.renomear);
    const explicaRenomear = h('p', { id: 'ed-renomear-explica', class: 'apoio', hidden: true }, C.renomearExplica);
    const prefixo = tipo === 'page' ? '/' : Modelo.PREFIXO_BLOG + '/';

    // M5: "Endereços antigos" — a lista dos aliases que "Renomear caminho…"
    // já gera (13 §4.0), com um jeito de matar o redirect quando o dono
    // quiser (13 §4.3: sem isto o endereço morto ficaria "herdado" para
    // sempre, sem botão de apagar — ver 11, 2026-08-27).
    const divAliases = h('div', { id: 'ed-aliases' });
    function renderAliases() {
      const CA = T.aliases;
      Shell.limpar(divAliases);
      const lista = (e.reg.aliases || []).slice().sort();
      if (!lista.length) { divAliases.hidden = true; return; }
      divAliases.hidden = false;
      divAliases.appendChild(h('p', {}, CA.titulo + ':'));
      divAliases.appendChild(h('ul', { id: 'ed-aliases-lista' }, lista.map(function (a) {
        return h('li', {}, h('code', {}, prefixo + a + '.html'), ' ',
          h('button', { type: 'button', class: 'ligacao', 'data-alias': a, onclick: function () { removerAlias(a); } }, CA.remover));
      })));
      divAliases.appendChild(h('p', { class: 'apoio' }, CA.apoio));
    }
    // O redirect morto é tratado como mídia "removida" pelo mesmo caminho
    // (13 §4.3) — reaproveita 100% da ordem de segurança que já apaga
    // arquivos: sai do mapa e o app tenta o DELETE nos servidores (§14 T8).
    // `origin: 'upload'` (não 'network') é o que faz T2 deixar a lápide em
    // paz — herdado de verdade seria ressuscitado pela reconciliação.
    async function removerAlias(aliasSlug) {
      const CA = T.aliases, path = Modelo.caminhoDe(tipo, aliasSlug);
      Shell.modal({ titulo: texto(CA.modalTitulo, { p: path }), conteudo: [
        h('p', {}, CA.modalTirar), h('p', {}, CA.modalApagar),
        h('p', { class: 'alerta' }, texto(CA.modalAviso, { p: path })),
        h('div', { class: 'acoes' },
          h('button', { type: 'button', id: 'ed-alias-remover', onclick: async function () {
            const publicado = await db.get('published', 'current');
            const sha = publicado && publicado.paths && publicado.paths[path];
            const ops = [];
            const novoReg = Object.assign({}, e.reg, { aliases: (e.reg.aliases || []).filter(function (a) { return a !== aliasSlug; }), updated_at: Modelo.agora() });
            ops.push({ op: 'put', store: store, valor: novoReg });
            if (sha) {
              const servers = (publicado.servers && publicado.servers[sha]) || [];
              const lapide = { id: Modelo.novoId(), path: path, mime: Modelo.mimePorCaminho(path), size: null, sha256: sha, width: null, height: null,
                alt: '', caption: '', bytes: null, status: 'published', servers: servers.slice(),
                removal: null, metadata: { stripped: null, removed_segments: [], warning: null }, origin: 'upload',
                created_at: Modelo.agora(), updated_at: Modelo.agora(), previous_status: null };
              ops.push({ op: 'put', store: 'media', valor: Modelo.transicao(lapide, 'remover').registro });
            }
            await db.escrever(ops);
            e.reg = novoReg;
            Shell.fecharModal();
            await Shell.registrarAlteracao(1);
            renderAliases();
          } }, CA.confirmar),
          h('button', { type: 'button', class: 'secundario', onclick: function () { Shell.fecharModal(); } }, CA.cancelar))
      ] });
    }
    const inDescricao = h('input', { type: 'text', id: 'ed-descricao', value: reg.description || '', disabled: removido });
    const taCorpo = h('textarea', { id: 'ed-corpo', rows: 14, spellcheck: 'true', disabled: removido });
    taCorpo.value = reg.body || '';
    let inData = null, inResumo = null, inEtiquetas = null, capaBloco = null, spanCapaAtual = null, cbMenu = null;
    let capaId = reg.cover_media_id || null;
    function rotuloCapa() { const m = imagens.find(x => x.id === capaId); return m ? m.path : C.capaNenhuma; }
    if (tipo === 'post') {
      inData = h('input', { type: 'date', id: 'ed-data', value: Modelo.formatarData(reg.date), disabled: removido });   // E7: ler só .value
      inResumo = h('textarea', { id: 'ed-resumo', rows: 2, disabled: removido }); inResumo.value = reg.excerpt || '';
      inEtiquetas = h('input', { type: 'text', id: 'ed-etiquetas', value: (reg.tags || []).join(', '), disabled: removido });
      spanCapaAtual = h('span', { id: 'ed-capa-atual' }, rotuloCapa());
      capaBloco = h('div', { class: 'linha-capa' }, spanCapaAtual, ' ',
        h('button', { type: 'button', id: 'ed-capa-escolher', class: 'secundario', disabled: removido, onclick: function () { escolherCapa(); } }, C.capaEscolher));
    } else cbMenu = h('input', { type: 'checkbox', id: 'ed-menu', checked: reg.in_menu !== false, disabled: removido });

    function coletar() {
      const c = { title: inTitulo.value.trim(), slug: inSlug.value.trim().toLowerCase(), description: inDescricao.value.trim(), body: taCorpo.value };
      if (tipo === 'post') {
        // E7: só `.value`. O dia é o que se edita; ao mudar o dia a hora vai
        // a meia-noite UTC (a hora de criação não deve viajar com um dia
        // escolhido à mão — 03 §1.1); dia igual mantém a hora que havia.
        const diaAtual = Modelo.formatarData(reg.date);
        const dia = /^\d{4}-\d{2}-\d{2}$/.test(inData.value) ? inData.value : (diaAtual || Modelo.formatarData(Modelo.agora()));
        const hora = dia === diaAtual && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(reg.date || '') ? reg.date.slice(10) : 'T00:00:00Z';
        c.date = dia + hora;
        c.excerpt = inResumo.value.trim();
        c.tags = Array.from(new Set(inEtiquetas.value.split(',').map(t => t.trim().toLowerCase()).filter(Boolean))).slice(0, 50);
        c.cover_media_id = capaId;
      } else c.in_menu = cbMenu.checked;
      return c;
    }
    // 19(a): modal com miniaturas da biblioteca (mesmo padrão de inserirImagem);
    // "Enviar nova" leva a T6 — sair do editor já salva o rascunho (desmontar()).
    function escolherCapa() {
      const M = T.capaModal;
      if (!imagens.length) { Shell.modal({ titulo: M.titulo, conteudo: h('p', { class: 'alerta', id: 'capa-sem-imagens' }, M.nenhuma) }); return; }
      function definir(id) {
        capaId = id; spanCapaAtual.textContent = rotuloCapa(); Shell.fecharModal();
        e.sujo = JSON.stringify(coletar()) !== e.instantaneo;
        salvar(e, { silencioso: true, motivo: 'auto' });
      }
      const grade = h('div', { class: 'grade-capas' },
        h('button', { type: 'button', class: 'capa-opcao' + (!capaId ? ' selecionada' : ''), onclick: function () { definir(null); } }, M.semCapa),
        imagens.map(m => h('button', { type: 'button', class: 'capa-opcao' + (capaId === m.id ? ' selecionada' : ''), 'data-media-id': m.id, onclick: function () { definir(m.id); } },
          m.bytes ? h('img', { src: URL.createObjectURL(m.bytes), alt: m.alt || '' }) : null,
          h('span', {}, m.path))));
      const rodape = h('div', { class: 'acoes' }, h('button', { type: 'button', class: 'secundario', onclick: function () { Shell.fecharModal(); Shell.ir('t6', { enviar: true }); } }, M.enviarNova));
      Shell.modal({ titulo: M.titulo, conteudo: [grade, rodape] });
    }
    e.instantaneo = JSON.stringify(coletar());

    async function validar(c) {
      if (!c.title) return T.erros.tituloObrigatorio;
      if (!c.slug || !RE_SLUG.test(c.slug) || c.slug.length > 120) return T.erros.caminhoInvalido;
      if (Modelo.RESERVADOS.indexOf(c.slug) !== -1) return T.erros.caminhoReservado;
      const outros = (await db.getAll(store)).filter(r => r.id !== e.reg.id);
      if (outros.some(r => r.slug === c.slug || (r.aliases || []).indexOf(c.slug) !== -1)) return T.erros.caminhoEmUso;
      return null;
    }

    // --- lateral ----------------------------------------------------------------
    const spanEstado = h('span', { id: 'ed-estado', class: 'estado ' + reg.status }, TL.estados[reg.status]);
    const pUltima = h('p', { id: 'ed-ultima', class: 'apoio' }, novo ? T.lateral.nuncaSalvo : texto(T.lateral.ultima, { d: Modelo.formatarData(reg.updated_at) }));
    const btnSalvar = h('button', { type: 'button', id: 'ed-salvar', disabled: removido, onclick: function () { salvar(e, { silencioso: false, motivo: 'botao' }); } }, T.lateral.salvar);
    const pStatus = h('p', { id: 'ed-status', class: 'apoio', 'aria-live': 'polite' });
    const pErro = h('p', { id: 'ed-erro', class: 'erro', role: 'alert', hidden: true });
    const acoesEstado = h('div', { id: 'ed-acoes-estado' });
    e.el = { inTitulo, inSlug, inDescricao, taCorpo, inData, inResumo, inEtiquetas, cbMenu, spanEstado, pUltima, btnSalvar, pStatus, pErro, acoesEstado };
    e.coletar = coletar; e.validar = validar; e.TL = TL;

    function renderAcoesEstado() {
      Shell.limpar(acoesEstado);
      const r = e.reg, L = Textos.listas.acoes;
      if (e.novo) return;
      const confirmar = (acao, aviso, rotulo) => function () {
        Shell.limpar(acoesEstado);
        acoesEstado.appendChild(h('div', { class: 'confirmacao', id: 'ed-confirmacao' }, h('p', { class: 'alerta' }, aviso),
          h('button', { type: 'button', id: 'ed-confirmar', onclick: async function () {
            try { const t = await Listas.aplicar(db, store, e.reg, acao); if (t.apagar) { e.sujo = false; e.removido = true; o.voltar(); return; } e.reg = t.registro; e.removido = e.reg.status === 'removed'; Shell.ir(tipo === 'page' ? 't4' : 't5', { editar: e.reg.id }); }
            catch (x) { Shell.erro(x && x.message ? x.message : String(x)); }
          } }, rotulo),
          h('button', { type: 'button', class: 'secundario', id: 'ed-cancelar-acao', onclick: renderAcoesEstado }, L.cancelar)));
      };
      if (r.status === 'published' || r.status === 'modified') acoesEstado.appendChild(h('button', { type: 'button', class: 'ligacao', id: 'ed-remover', onclick: confirmar('remover', TL.removerAviso, L.remover) }, L.remover));
      if (r.status === 'draft') acoesEstado.appendChild(h('button', { type: 'button', class: 'ligacao', id: 'ed-excluir', onclick: confirmar('excluir', TL.excluirAviso, L.excluir) }, L.excluir));
      if (r.status === 'removed') acoesEstado.appendChild(h('button', { type: 'button', class: 'ligacao', id: 'ed-desfazer', onclick: async function () {
        try { const t = await Listas.aplicar(db, store, e.reg, 'desfazer_remocao'); Shell.ir(tipo === 'page' ? 't4' : 't5', { editar: t.registro.id }); } catch (x) { Shell.erro(x.message); }
      } }, L.desfazer));
    }
    e.renderAcoesEstado = renderAcoesEstado;

    // --- ferramentas (inserem Markdown na seleção) ---------------------------------
    function envolver(antes, depois, modelo) {
      const ta = taCorpo, ini = ta.selectionStart, fim = ta.selectionEnd;
      const sel = ta.value.slice(ini, fim) || modelo;
      ta.setRangeText(antes + sel + depois, ini, fim, 'preserve');
      ta.setSelectionRange(ini + antes.length, ini + antes.length + sel.length);
      ta.focus(); ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
    function prefixarLinhas(prefixo, modelo) {
      const ta = taCorpo, v = ta.value;
      let ini = ta.selectionStart, fim = ta.selectionEnd;
      ini = v.lastIndexOf('\n', ini - 1) + 1;
      if (fim < v.length && v.charAt(fim) !== '\n') { const p = v.indexOf('\n', fim); fim = p === -1 ? v.length : p; }
      const trecho = v.slice(ini, fim) || modelo;
      const novoTexto = trecho.split('\n').map(l => prefixo + l).join('\n');
      ta.setRangeText(novoTexto, ini, fim, 'preserve');
      ta.setSelectionRange(ini, ini + novoTexto.length);
      ta.focus(); ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
    function inserirImagem() {
      const M = T.imagem;
      if (!imagens.length) { Shell.modal({ titulo: M.titulo, conteudo: h('p', { class: 'alerta', id: 'sem-imagens' }, M.nenhuma) }); return; }
      function marcacaoDe(m) { return '![' + (m.alt || '').replace(/[\[\]]/g, '') + '](' + m.path + ')'; }
      // 19(b): "[![alt](img)](url)" já é Markdown válido hoje (renderizado e
      // sanitizado como qualquer link/imagem) — este formulário só poupa o
      // dono de escrever a sintaxe à mão.
      function formLink(m) {
        const inUrl = h('input', { type: 'text', id: 'img-link-url', placeholder: M.linkPlaceholder });
        Shell.modal({ titulo: M.linkTitulo, conteudo: h('div', {}, h('label', {}, M.linkTitulo), inUrl,
          h('div', { class: 'acoes' },
            h('button', { type: 'button', id: 'img-link-confirmar', onclick: function () { const url = inUrl.value.trim() || 'https://'; Shell.fecharModal(); envolver('[' + marcacaoDe(m) + '](' + url + ')', '', ''); } }, M.linkConfirmar),
            h('button', { type: 'button', class: 'secundario', id: 'img-link-cancelar', onclick: function () { Shell.fecharModal(); } }, M.linkCancelar))) });
      }
      const lista = h('ul', { class: 'lista-imagens' }, imagens.map(m => h('li', {}, h('code', {}, m.path), ' ', h('span', { class: 'apoio' }, m.alt || ''), ' ',
        h('button', { type: 'button', class: 'secundario escolher-imagem', 'data-path': m.path, onclick: function () { Shell.fecharModal(); envolver(marcacaoDe(m), '', ''); } }, M.inserir), ' ',
        h('button', { type: 'button', class: 'secundario com-link', 'data-path': m.path, onclick: function () { formLink(m); } }, M.comLink))));
      Shell.modal({ titulo: M.titulo, conteudo: lista });
    }
    const M = T.modelos;
    const acoes = {
      negrito: () => envolver('**', '**', M.negrito), italico: () => envolver('*', '*', M.italico), titulo: () => prefixarLinhas('## ', M.titulo),
      link: () => envolver('[', '](https://)', M.link), imagem: inserirImagem, lista: () => prefixarLinhas('- ', M.lista), citacao: () => prefixarLinhas('> ', M.citacao),
      codigo: () => { const sel = taCorpo.value.slice(taCorpo.selectionStart, taCorpo.selectionEnd); if (sel.indexOf('\n') !== -1) envolver('```\n', '\n```', sel); else envolver('`', '`', M.codigo); }
    };
    const ferramentas = h('div', { class: 'ferramentas', role: 'toolbar', 'aria-label': C.conteudo }, Object.keys(T.ferramentas).map(k =>
      h('button', { type: 'button', class: 'secundario ferramenta', 'data-acao': k, title: T.ferramentas[k], disabled: removido, onclick: function () { acoes[k](); } }, T.ferramentas[k])));

    // --- pré-visualização --------------------------------------------------------
    const iframe = h('iframe', { id: 'ed-previa', sandbox: 'allow-scripts', title: T.previa.rotulo });
    e.iframe = iframe;
    function renderPrevia() { const c = coletar(); iframe.srcdoc = Gerador.previaCorpo(c.title, c.body, e.dataUris); }
    e.renderPrevia = renderPrevia;
    dataUrisDe(media).then(function (m) { if (E === e) { e.dataUris = m; renderPrevia(); } });

    // --- montagem ----------------------------------------------------------------
    const campos = h('div', { class: 'editor-campos' },
      h('label', { for: 'ed-titulo' }, C.titulo), inTitulo,
      h('div', { class: 'linha-caminho' }, h('label', { for: 'ed-slug' }, C.caminho), h('span', { class: 'caminho' }, h('code', {}, prefixo), inSlug, h('code', {}, '.html')), btnRenomear),
      explicaRenomear,
      divAliases,
      ehInicio ? h('p', { class: 'apoio', id: 'ed-eh-inicio' }, C.ehInicio) : null,
      h('label', { for: 'ed-descricao' }, C.descricao), inDescricao, h('p', { class: 'apoio' }, C.descricaoApoio),
      tipo === 'post' ? [
        h('div', { class: 'duas-colunas-campos' },
          h('div', {}, h('label', { for: 'ed-data' }, C.data), inData, h('p', { class: 'apoio' }, C.dataApoio)),
          h('div', {}, h('label', {}, C.capa), capaBloco, h('p', { class: 'apoio' }, C.capaApoio))),
        h('label', { for: 'ed-resumo' }, C.resumo), inResumo, h('p', { class: 'apoio' }, C.resumoApoio),
        h('label', { for: 'ed-etiquetas' }, C.etiquetas), inEtiquetas, h('p', { class: 'apoio' }, C.etiquetasApoio)
      ] : h('label', { class: 'inline', for: 'ed-menu' }, cbMenu, C.menu),
      h('label', { for: 'ed-corpo' }, C.conteudo), ferramentas, taCorpo, h('p', { class: 'apoio' }, C.conteudoApoio));
    // 19(d): só faz sentido depois de já ter ido ao ar ao menos uma vez.
    const jaPublicado = !novo && (reg.status === 'published' || reg.status === 'modified');
    const gateway = Modelo.GATEWAYS.find(g => g.principal);
    const linkVerOnline = jaPublicado ? h('a', { id: 'ed-ver-online', class: 'ligacao', href: Modelo.urlDoSite(s.npub, gateway.host) + Listas.caminhoDe(tipo, reg, site).replace(/^\//, ''), target: '_blank', rel: 'noopener noreferrer' }, Textos.listas.verOnline) : null;
    const lateral = h('aside', { class: 'editor-lateral' },
      h('p', {}, T.lateral.estado + ': ', spanEstado), pUltima,
      btnSalvar, h('p', { class: 'apoio', id: 'ed-legenda' }, Textos.fixos.salvoNaoBackup), pStatus, pErro,
      h('button', { type: 'button', id: 'ed-publicar', class: 'secundario', onclick: function () { Shell.ir('t8'); } }, T.lateral.publicar),
      h('button', { type: 'button', id: 'ed-ver', class: 'secundario', onclick: async function () { const c = coletar(); await verComoFicara(db, Object.assign({}, e.reg, c), tipo); } }, T.lateral.ver),
      linkVerOnline ? h('p', {}, linkVerOnline) : null,
      acoesEstado);
    const titulo = novo ? (tipo === 'page' ? T.titulos.novaPagina : T.titulos.novoArtigo) : (tipo === 'page' ? T.titulos.editarPagina : T.titulos.editarArtigo);
    raiz.appendChild(h('section', { id: 'editor', class: 'editor', 'data-tipo': tipo },
      h('div', { class: 'editor-cabeca' }, h('h1', {}, titulo), h('button', { type: 'button', id: 'ed-voltar', class: 'ligacao', onclick: function () { o.voltar(); } }, TL.voltar)),
      removido ? h('p', { class: 'alerta', id: 'ed-removido' }, T.erros.removido) : null,
      h('div', { class: 'editor-grade' }, campos, h('div', { class: 'editor-previa' }, h('h2', { class: 'apoio' }, T.previa.titulo), iframe), lateral)));
    renderAcoesEstado();
    renderAliases();
    renderPrevia();

    // --- eventos -------------------------------------------------------------------
    function aoDigitar(ev) {
      if (ev && ev.target === inTitulo && e.slugAuto) inSlug.value = Modelo.slug(inTitulo.value);
      if (ev && ev.target === inSlug) e.slugAuto = false;
      e.sujo = JSON.stringify(coletar()) !== e.instantaneo;
      if (!ev || ev.target === taCorpo || ev.target === inTitulo) { clearTimeout(e.timerPrevia); e.timerPrevia = setTimeout(renderPrevia, PREVIA_MS); }
    }
    campos.addEventListener('input', aoDigitar);
    campos.addEventListener('change', aoDigitar);
    campos.addEventListener('focusout', function () { if (e.sujo) salvar(e, { silencioso: true, motivo: 'blur' }); });
    e.timerAuto = setInterval(function () { if (e.sujo) salvar(e, { silencioso: true, motivo: 'auto' }); }, AUTOSAVE_MS);
    e.aoSair = function (ev) { if (e.sujo) { ev.preventDefault(); ev.returnValue = T.sair; return T.sair; } };
    window.addEventListener('beforeunload', e.aoSair);
    if (novo) inTitulo.focus();
  }

  // Grava (13 §4.4 'editar'); silencioso = gravação automática (não mostra
  // erro de validação). Nada a salvar → só confirma no status, sem regravar
  // (o contador de não exportadas conta gravações reais). Pedido durante uma
  // gravação em curso fica pendente com as SUAS opções e corre no fim.
  async function salvar(e, o) {
    if (e.removido) return false;
    const el = e.el, L = Textos.editor.lateral;
    if (!e.sujo && !e.novo) { if (el && !o.silencioso) el.pStatus.textContent = texto(L.salvo, { h: horaAgora() }); return true; }
    if (e.salvando) { e.pendente = o; return false; }
    e.salvando = true;
    try {
      const c = e.coletar();
      const erro = await e.validar(c);
      if (erro) { if (!o.silencioso && el) { el.pErro.textContent = erro; el.pErro.hidden = false; } return false; }
      if (el) { el.pErro.hidden = true; el.pErro.textContent = ''; if (o.motivo === 'botao') el.pStatus.textContent = L.salvando; }
      const t = Modelo.transicao(e.reg, 'editar');
      if (!t) return false;
      const novoReg = Object.assign(t.registro, c);
      if (!e.novo && e.reg.status !== 'draft' && novoReg.slug !== e.reg.slug) {
        novoReg.aliases = Array.from(new Set((e.reg.aliases || []).concat([e.reg.slug]))).filter(a => a !== novoReg.slug);
      }
      try {
        await e.db.put(e.store, novoReg);
        await Shell.registrarAlteracao(1);
      } catch (x) {
        if (el) { el.pErro.textContent = x && x.message ? x.message : String(x); el.pErro.hidden = false; }
        return false;
      }
      e.reg = novoReg; e.novo = false; e.instantaneo = JSON.stringify(c); e.sujo = JSON.stringify(e.coletar()) !== e.instantaneo;
      if (el && E === e) {
        el.spanEstado.textContent = e.TL.estados[novoReg.status]; el.spanEstado.className = 'estado ' + novoReg.status;
        el.pUltima.textContent = texto(L.ultima, { d: Modelo.formatarData(novoReg.updated_at) });
        el.pStatus.textContent = texto(o.motivo === 'botao' ? L.salvo : L.salvoAuto, { h: horaAgora() });
        if (novoReg.status !== 'draft') { el.inSlug.disabled = !e.renomeando; if (!e.renomeando) { const b = document.getElementById('ed-renomear'); if (b) b.hidden = false; } }
        e.renderAcoesEstado();
      }
      return true;
    } finally {
      e.salvando = false;
      if (e.pendente) { const o2 = e.pendente; e.pendente = null; salvar(e, o2); }
    }
  }

  return Object.freeze({ AUTOSAVE_MS, PREVIA_MS, montar, desmontar, verComoFicara, dataUrisDe, imagensDe, estaMontado: function () { return E !== null; } });
})();
