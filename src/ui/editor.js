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
  // 45 — nos modais o dono escolhe pelo NOME ("controle-2.mp4"), não pelo
  // caminho inteiro: o prefixo é igual em todos e só rouba espaço ao nome.
  // O caminho completo continua acessível, no `title` de cada cartão.
  function nomeDe(path) { const s = String(path || ''); const i = s.lastIndexOf('/'); return i === -1 ? s : s.slice(i + 1); }
  // 32(c) — a miniatura de uma capa é `media` como qualquer outra (tem de o
  // ser: sobe, tem sha256 e sai do ar como as outras), mas NÃO é conteúdo que
  // se escolha. Fica de fora dos seletores; na biblioteca (T6) continua à
  // vista, porque lá o dono está a ver o que está publicado, não a escolher.
  function idsDeMiniatura(media) {
    const s = new Set();
    for (const m of media || []) if (m && m.thumb_media_id) s.add(m.thumb_media_id);
    return s;
  }
  function imagensDe(media) {
    const minis = idsDeMiniatura(media);
    return (media || []).filter(r => r && r.status !== 'removed' && /^image\//.test(r.mime || '') && r.origin !== 'network' && !minis.has(r.id));
  }
  function extDeMime(mime) { for (const k of Object.keys(Modelo.MIME)) if (Modelo.MIME[k] === mime) return k; return 'bin'; }
  function semExtensao(path) { const n = String(path || '').replace(/^.*\//, ''); const i = n.lastIndexOf('.'); return i > 0 ? n.slice(0, i) : n; }
  function kb(n) { return Math.max(1, Math.round(n / 1024)) + ' KB'; }
  // 39 — o botão "Imagem" com um mp4 gerava `<img src="…mp4">`, que não mostra
  // NADA. Vídeo tem de ter caminho próprio; foi o que a medição da varredura
  // de 2026-08-31 apanhou.
  function videosDe(media) { return (media || []).filter(r => r && r.status !== 'removed' && /^video\//.test(r.mime || '') && r.origin !== 'network'); }

  // "Ver como ficará" (14 T4a): a página inteira com o tema, isolada (usado por T4/T5 também)
  async function verComoFicara(db, reg, tipo) {
    const dados = { site: (await db.get('site', 'site')) || Modelo.sitePadrao(Shell.sessao().pubkey, Shell.sessao().npub), pages: await db.getAll('pages'), posts: await db.getAll('posts'), media: await db.getAll('media') };
    const lista = tipo === 'page' ? dados.pages : dados.posts;
    const i = lista.findIndex(r => r.id === reg.id);
    if (i === -1) lista.push(reg); else lista[i] = reg;
    const html = Gerador.previa(Gerador.htmlDe(dados, reg, tipo), await dataUrisDe(dados.media), Gerador.opcoesDe(dados.site), Temas.de(dados.site));
    const iframe = Shell.h('iframe', { id: 'previa-completa', sandbox: 'allow-scripts', title: Textos.editor.verComoFicara.titulo });
    iframe.srcdoc = html;
    Shell.modal({ titulo: Textos.editor.verComoFicara.titulo, conteudo: iframe, largo: true });
  }

  function desmontar() {
    if (!E) return;
    const e = E; E = null;
    clearInterval(e.timerAuto); clearTimeout(e.timerPrevia);
    window.removeEventListener('beforeunload', e.aoSair);
    Miniaturas.limpar();                         // 32(a): revoga os blob:, o cache de bytes fica
    if (e.sujo && !e.removido) salvar(e, { silencioso: true, motivo: 'sair' });   // não perder o que foi digitado (14 T-12)
  }

  // o: { tipo: 'page' | 'post', id?, novo?, voltar }
  async function montar(raiz, o) {
    desmontar();
    const h = Shell.h, T = Textos.editor, C = T.campos, TM = Textos.t6.mini, tipo = o.tipo, store = tipo === 'page' ? 'pages' : 'posts';
    const TL = tipo === 'page' ? Textos.t4 : Textos.t5;
    const dados = Shell.dados();
    if (!dados || !dados.db || !dados.db.estaAberto()) { Shell.ir('t3'); return; }
    const db = dados.db, s = Shell.sessao();
    let reg = null;
    if (o.id) { reg = await db.get(store, o.id); if (!reg) { Shell.erro(T.erros.naoEncontrado); o.voltar(); return; } }
    else reg = tipo === 'page' ? Modelo.novaPagina('') : Modelo.novoArtigo('');
    const site = (await db.get('site', 'site')) || Modelo.sitePadrao(s.pubkey, s.npub);
    const servidoresMidia = Modelo.uniao(site.network && site.network.servers);   // 32(a)/36: de onde vêm as miniaturas da rede
    const media = await db.getAll('media');
    const imagens = imagensDe(media);
    const videos = videosDe(media);
    // 30 — a prévia lateral desenha a galeria com os artigos REAIS. Sem isto o
    // marcador aparecia vazio ali e cheio em "Ver como ficará", que é a pior
    // combinação possível: o dono deixaria de confiar na prévia.
    const paginasTodas = await db.getAll('pages');
    const artigosTodos = await db.getAll('posts');
    let ctxPrevia = Gerador.contexto({ site: site, pages: paginasTodas, posts: artigosTodos, media: media });
    function refazerContexto() { ctxPrevia = Gerador.contexto({ site: site, pages: paginasTodas, posts: artigosTodos, media: media }); }
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
    } else cbMenu = h('input', { type: 'checkbox', id: 'ed-menu', checked: reg.in_menu !== false, disabled: removido });
    // 35 — capa nos dois tipos, com o mesmo modal. Na página o texto de apoio
    // avisa que o tema padrão não a mostra: sem isso pareceria avariado.
    spanCapaAtual = h('span', { id: 'ed-capa-atual' }, rotuloCapa());
    const pMini = h('p', { id: 'ed-mini', class: 'apoio', hidden: true, 'aria-live': 'polite' });
    capaBloco = h('div', { class: 'linha-capa' }, spanCapaAtual, ' ',
      h('button', { type: 'button', id: 'ed-capa-escolher', class: 'secundario', disabled: removido, onclick: function () { escolherCapa(); } }, C.capaEscolher),
      pMini);

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
      } else c.in_menu = cbMenu.checked;
      c.cover_media_id = capaId;
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
        const escolhida = id ? imagens.find(x => x.id === id) : null;
        if (escolhida) garantirMiniatura(escolhida).catch(function () {});
      }
      const estC = Colecao.novoEstado();
      const caixaC = h('div', {});
      function pintarCapas(o) {
        Shell.limpar(caixaC);
        caixaC.appendChild(Colecao.barra(imagens, estC, { aoMudar: pintarCapas, idBusca: 'capa-busca' }));
        const filtradas = Colecao.filtrar(imagens, estC);
        const grade = h('div', { class: 'grade-capas' },
          // "(nenhuma)" só na 1.ª página: é a opção de LIMPAR a capa, não um
          // arquivo, e repeti-la em cada página confundiria a contagem.
          estC.pagina === 1 ? h('button', { type: 'button', class: 'capa-opcao' + (!capaId ? ' selecionada' : ''), onclick: function () { definir(null); } }, M.semCapa) : null,
          Colecao.fatia(filtradas, estC).map(m => h('button', { type: 'button', class: 'capa-opcao' + (capaId === m.id ? ' selecionada' : ''), 'data-media-id': m.id, title: m.path, onclick: function () { definir(m.id); } },
            // 32(a): sem bytes locais (máquina nova, mídia da rede) isto era um
            // botão só com o caminho — impossível escolher entre controle2 e 3.
            Miniaturas.elemento(m, { servidores: servidoresMidia, classe: '', textos: TM }),
            h('span', {}, nomeDe(m.path)))));
        caixaC.appendChild(filtradas.length ? grade : h('p', { class: 'apoio', id: 'capa-sem-resultado' }, Textos.t6.colecao.semResultado));
        caixaC.appendChild(Colecao.paginacao(filtradas.length, estC, { aoMudar: pintarCapas }));
        caixaC.appendChild(h('div', { class: 'acoes' }, h('button', { type: 'button', class: 'secundario', onclick: function () { Shell.fecharModal(); Shell.ir('t6', { enviar: true }); } }, M.enviarNova)));
        if (o && o.focoBusca) { const c = document.getElementById('capa-busca'); if (c) { c.focus(); try { c.setSelectionRange(c.value.length, c.value.length); } catch (e) {} } }
      }
      pintarCapas();
      Shell.modal({ titulo: M.titulo, conteudo: caixaC, largo: true });
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
      // 36 — este modal mostrava SÓ os nomes: com `controle`, `controle2`…
      // `controle5` era impossível escolher. O comentário de `escolherCapa`
      // já dizia "mesmo padrão de inserirImagem" — a semelhança que ficou por
      // fazer quando a capa ganhou miniaturas em 2026-08-26. Agora é a mesma
      // grade e o mesmo CSS, com os DOIS botões preservados.
      // 44/45 — busca e páginas também aqui: com centenas de imagens o modal
      // abria 300 `blob:` de uma vez, e é a memória que isso custa (a medição
      // está em `test/telas/escala.test.js`).
      const est = Colecao.novoEstado();
      const caixa = h('div', {});
      function pintar(o) {
        Shell.limpar(caixa);
        caixa.appendChild(Colecao.barra(imagens, est, { aoMudar: pintar, idBusca: 'img-busca' }));
        const filtradas = Colecao.filtrar(imagens, est);
        if (!filtradas.length) caixa.appendChild(h('p', { class: 'apoio', id: 'img-sem-resultado' }, Textos.t6.colecao.semResultado));
        else caixa.appendChild(h('div', { class: 'grade-capas grade-inserir' }, Colecao.fatia(filtradas, est).map(m => h('div', { class: 'capa-opcao inserir-opcao', 'data-path': m.path, title: m.path },
          Miniaturas.elemento(m, { servidores: servidoresMidia, classe: '', textos: TM }),
          h('span', {}, nomeDe(m.path)),
          m.alt ? h('span', { class: 'apoio' }, m.alt) : null,
          h('div', { class: 'acoes' },
            h('button', { type: 'button', class: 'secundario escolher-imagem', 'data-path': m.path, onclick: function () { Shell.fecharModal(); envolver(marcacaoDe(m), '', ''); } }, M.inserir),
            h('button', { type: 'button', class: 'secundario com-link', 'data-path': m.path, onclick: function () { formLink(m); } }, M.comLink)))))); 
        caixa.appendChild(Colecao.paginacao(filtradas.length, est, { aoMudar: pintar }));
        if (o && o.focoBusca) { const c = document.getElementById('img-busca'); if (c) { c.focus(); try { c.setSelectionRange(c.value.length, c.value.length); } catch (e) {} } }
      }
      pintar();
      Shell.modal({ titulo: M.titulo, conteudo: caixa, largo: true });
    }
    // 39 — `<video src poster controls preload="none">` com link de reserva
    // sobrevive inteiro ao DOMPurify (`video` não está em FORBID_TAGS) e o
    // site publicado continua SEM UM ÚNICO SCRIPT: `controls` é o player
    // nativo do navegador. `preload="none"` por decisão do dono — o vídeo só
    // baixa se o leitor der play, o que pelo Tor é a diferença entre abrir a
    // página e esperar minutos por ela.
    function inserirVideo() {
      const V = T.video;
      if (!videos.length) { Shell.modal({ titulo: V.titulo, conteudo: h('p', { class: 'alerta', id: 'sem-videos' }, V.nenhum) }); return; }
      function marcacaoDe(m, posterPath) {
        const alt = String(m.alt || m.path).replace(/"/g, '');
        return '<video src="' + m.path + '"' + (posterPath ? ' poster="' + posterPath + '"' : '') +
          ' controls preload="none"><a href="' + m.path + '">' + alt + '</a></video>';
      }
      // A capa (`poster`) é o que o leitor vê antes de dar play: sem ela o
      // vídeo é um retângulo preto. Vem da biblioteca de imagens, como a capa
      // de um artigo.
      function escolherPoster(m) {
        if (!imagens.length) { Shell.fecharModal(); envolver(marcacaoDe(m, null), '', ''); return; }
        const grade = h('div', { class: 'grade-capas grade-inserir' },
          h('div', { class: 'capa-opcao inserir-opcao' }, h('span', {}, V.semCapa),
            h('div', { class: 'acoes' }, h('button', { type: 'button', class: 'secundario poster-nenhum', onclick: function () { Shell.fecharModal(); envolver(marcacaoDe(m, null), '', ''); } }, V.usar))),
          imagens.map(im => h('div', { class: 'capa-opcao inserir-opcao', 'data-path': im.path, title: im.path },
            Miniaturas.elemento(im, { servidores: servidoresMidia, classe: '', textos: TM }),
            h('span', {}, nomeDe(im.path)),
            h('div', { class: 'acoes' }, h('button', { type: 'button', class: 'secundario poster-usar', 'data-path': im.path, onclick: function () { Shell.fecharModal(); envolver(marcacaoDe(m, im.path), '', ''); } }, V.usar)))));
        Shell.modal({ titulo: V.capaTitulo, conteudo: grade, largo: true });
      }
      // 44 — pagina como os outros: aqui cada cartão manda EXTRAIR um quadro,
      // que é mais caro do que desenhar uma miniatura já pronta.
      const estV = Colecao.novoEstado();
      const caixaV = h('div', {});
      function pintarVideos(o) {
        Shell.limpar(caixaV);
        caixaV.appendChild(Colecao.barra(videos, estV, { aoMudar: pintarVideos, idBusca: 'video-busca' }));
        const filtrados = Colecao.filtrar(videos, estV);
        if (!filtrados.length) caixaV.appendChild(h('p', { class: 'apoio', id: 'video-sem-resultado' }, Textos.t6.colecao.semResultado));
        else caixaV.appendChild(h('div', { class: 'grade-capas grade-inserir' }, Colecao.fatia(filtrados, estV).map(m => h('div', { class: 'capa-opcao inserir-opcao', 'data-path': m.path, title: m.path },
          Miniaturas.elementoVideo(m, { servidores: servidoresMidia, classe: '', textos: TM }),
          h('span', {}, nomeDe(m.path)),
          h('div', { class: 'acoes' },
            h('button', { type: 'button', class: 'secundario escolher-video', 'data-path': m.path, onclick: function () { escolherPoster(m); } }, V.inserir))))));
        caixaV.appendChild(Colecao.paginacao(filtrados.length, estV, { aoMudar: pintarVideos }));
        // Os números são os MEDIDOS na bancada Tails de 2026-08-28 (`05` §2.2),
        // não estimativas: dizer só o que se sabe.
        caixaV.appendChild(h('p', { class: 'apoio', id: 'video-limites' }, V.limites));
        if (o && o.focoBusca) { const c = document.getElementById('video-busca'); if (c) { c.focus(); try { c.setSelectionRange(c.value.length, c.value.length); } catch (e) {} } }
      }
      pintarVideos();
      Shell.modal({ titulo: V.titulo, conteudo: caixaV, largo: true });
    }

    // 30 — um marcador só vale SOZINHO na linha (é assim que o gerador o
    // reconhece). Inserir no meio de um parágrafo daria o texto cru na página
    // publicada, e o dono nunca perceberia porquê. Daí esta função, e não o
    // `envolver` das outras ferramentas: ela empurra o marcador para uma linha
    // própria, com linha em branco de cada lado (o que o Markdown pede para
    // ele ser um parágrafo dele mesmo).
    function inserirBloco(marcador) {
      const ta = taCorpo, v = ta.value;
      const pos = ta.selectionEnd;
      const p = v.indexOf('\n', pos);
      const fim = p === -1 ? v.length : p;
      const antes = v.slice(0, fim), depois = v.slice(fim);
      const prefixo = (antes === '' || /\n[ \t]*\n$/.test(antes)) ? '' : (/\n$/.test(antes) ? '\n' : '\n\n');
      const sufixo = (depois === '' || /^\n[ \t]*\n/.test(depois)) ? '' : (/^\n/.test(depois) ? '\n' : '\n\n');
      ta.setRangeText(prefixo + marcador + sufixo, fim, fim, 'preserve');
      const p0 = fim + prefixo.length;
      ta.setSelectionRange(p0, p0 + marcador.length);
      ta.focus(); ta.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // 37 — o CTA. O endereço passa pelo MESMO juiz que o gerador usa
    // (`Gerador.hrefSeguro`): recusar aqui e aceitar lá, ou o contrário, seria
    // duas regras a divergir com o tempo.
    function inserirBotao() {
      const B = T.botao;
      const inTexto = h('input', { type: 'text', id: 'botao-texto', placeholder: B.rotuloPlaceholder, autocomplete: 'off' });
      const inDestino = h('input', { type: 'text', id: 'botao-destino', placeholder: B.destinoPlaceholder, autocomplete: 'off', spellcheck: 'false' });
      const pErro = h('p', { class: 'erro', id: 'botao-erro', role: 'alert', hidden: true });
      function confirmar() {
        // `]]` e `->` no rótulo partiriam o próprio marcador: trocar por algo
        // parecido é melhor que recusar o que ele escreveu.
        const rotulo = inTexto.value.trim().replace(/\]\]/g, ']').replace(/\[\[/g, '[').replace(/->/g, '→');
        const destino = inDestino.value.trim();
        if (!rotulo) { pErro.hidden = false; pErro.textContent = B.semTexto; return; }
        if (!Gerador.hrefSeguro(destino)) { pErro.hidden = false; pErro.textContent = B.invalido; return; }
        Shell.fecharModal();
        inserirBloco('[[botao: ' + rotulo + ' -> ' + destino + ']]');
      }
      Shell.modal({ titulo: B.titulo, conteudo: h('div', {},
        h('label', { for: 'botao-texto' }, B.rotulo), inTexto,
        h('label', { for: 'botao-destino' }, B.destino), inDestino,
        h('p', { class: 'apoio' }, B.apoio), pErro,
        h('div', { class: 'acoes' },
          h('button', { type: 'button', id: 'botao-confirmar', onclick: confirmar }, B.inserir),
          h('button', { type: 'button', class: 'secundario', id: 'botao-cancelar', onclick: function () { Shell.fecharModal(); } }, B.cancelar))) });
      inTexto.focus();
    }

    // 30 — a galeria de artigos. As etiquetas oferecidas são as que EXISTEM
    // (Modelo.etiquetasDe, o mesmo agrupamento por slug que gera as páginas):
    // oferecer uma etiqueta que ninguém usa daria uma galeria vazia.
    function inserirArtigos() {
      const A = T.artigos;
      const ets = Modelo.etiquetasDe(artigosTodos);
      const vivos = artigosTodos.filter(x => x && x.status !== 'removed');
      const inN = h('input', { type: 'number', id: 'artigos-n', min: '1', max: '50', step: '1', value: '6' });
      const cbCapa = h('input', { type: 'checkbox', id: 'artigos-capa', checked: true });
      const cbResumo = h('input', { type: 'checkbox', id: 'artigos-resumo' });
      const selEt = h('select', { id: 'artigos-etiqueta' },
        h('option', { value: '' }, A.etiquetaTodas),
        ets.map(x => h('option', { value: x.slug }, x.nome)));
      const semCapa = vivos.length > 0 && !vivos.some(x => x.cover_media_id);
      function confirmar() {
        const n = Math.min(50, Math.max(1, parseInt(inN.value, 10) || 6));
        const partes = [String(n), cbCapa.checked ? 'com-capa' : 'sem-capa'];
        if (cbResumo.checked) partes.push('com-resumo');
        if (selEt.value) partes.push('etiqueta=' + selEt.value);
        Shell.fecharModal();
        inserirBloco('[[artigos: ' + partes.join(', ') + ']]');
      }
      Shell.modal({ titulo: A.titulo, conteudo: h('div', {},
        h('label', { for: 'artigos-n' }, A.quantos), inN,
        h('label', { class: 'inline', for: 'artigos-capa' }, cbCapa, A.capa),
        h('label', { class: 'inline', for: 'artigos-resumo' }, cbResumo, A.resumo),
        ets.length ? [h('label', { for: 'artigos-etiqueta' }, A.etiqueta), selEt] : null,
        semCapa ? h('p', { class: 'alerta', id: 'artigos-sem-capa' }, A.semCapaAviso) : null,
        h('p', { class: 'apoio' }, A.apoio),
        h('div', { class: 'acoes' },
          h('button', { type: 'button', id: 'artigos-confirmar', onclick: confirmar }, A.inserir),
          h('button', { type: 'button', class: 'secundario', id: 'artigos-cancelar', onclick: function () { Shell.fecharModal(); } }, A.cancelar))) });
      inN.focus();
    }

    // 51 — o HTML colado. O que este botão resolve NÃO é "deixar colar HTML":
    // isso já funcionava (o Markdown aceita HTML inline e o DOMPurify limpa-o).
    // É as duas coisas que falhavam em silêncio, medidas em 2026-09-04:
    // a formatação, que partia o bloco de três maneiras, e o filtro, que
    // apagava sem dizer. O juiz é `Gerador.limparHtmlColado` — o MESMO
    // sanitizador da geração, para não haver duas regras a divergir.
    // A conferência corre enquanto ele escreve, para o aviso chegar ANTES de
    // inserir; e o que entra no texto é o já limpo (decisão do usuário): o que
    // se vê no editor tem de ser o que o leitor vê.
    function inserirHtml() {
      const H = T.html;
      const inFonte = h('textarea', { id: 'html-fonte', rows: '14', spellcheck: 'false', autocomplete: 'off', placeholder: H.placeholder });
      const divAviso = h('div', { id: 'html-aviso' });
      const btnOk = h('button', { type: 'button', id: 'html-confirmar', disabled: true, onclick: confirmar }, H.inserir);
      let ultimo = null, prazo = null;
      function conferir() {
        const r = Gerador.limparHtmlColado(inFonte.value);
        ultimo = r;
        divAviso.textContent = '';
        if (!inFonte.value.trim()) { btnOk.disabled = true; return; }
        btnOk.disabled = r.vazio;
        // ⚠️ Quando NADA sobra, a lista de motivos é ainda mais necessária, não
        // menos: quem cola um <iframe> do YouTube receberia só "não sobrou
        // nada" e ficaria sem saber o quê nem porquê. (Achado na bancada,
        // 2026-09-04 — a primeira coisa que ela apanhou.)
        if (r.vazio) divAviso.appendChild(h('p', { class: 'erro', id: 'html-nada' }, H.tudoRemovido));
        if (r.removidos.length) {
          // Um item por GRUPO de explicação, com as tags daquele grupo juntas
          // e na ordem em que apareceram — ver `Gerador.grupoRemovido`.
          const porGrupo = new Map();
          for (const x of r.removidos) {
            const g = Gerador.grupoRemovido(x);
            if (!porGrupo.has(g)) porGrupo.set(g, []);
            porGrupo.get(g).push(x.tipo === 'atributo' ? x.nome + '=' : '<' + x.nome + '>');
          }
          divAviso.appendChild(h('p', { class: 'alerta', id: 'html-removidos' }, H.removidosTitulo));
          divAviso.appendChild(h('ul', { class: 'lista-copias', id: 'html-removidos-lista' },
            Array.from(porGrupo.keys()).map(g => h('li', {}, h('code', {}, porGrupo.get(g).join(' ')), ' — ' + (H.motivos[g] || H.motivos.outro)))));
        }
        if (r.perdeuEmPre) divAviso.appendChild(h('p', { class: 'alerta', id: 'html-pre' }, H.linhaEmPre));
      }
      function confirmar() {
        if (prazo) { clearTimeout(prazo); prazo = null; }
        conferir();
        if (!ultimo || ultimo.vazio) return;
        Shell.fecharModal();
        inserirBloco(ultimo.html);
      }
      inFonte.addEventListener('input', function () {
        // Mesma espera da pré-visualização: sanitizar a cada tecla num bloco
        // grande é trabalho jogado fora.
        if (prazo) clearTimeout(prazo);
        prazo = setTimeout(function () { prazo = null; conferir(); }, PREVIA_MS);
      });
      Shell.modal({ titulo: H.titulo, largo: true, conteudo: h('div', { class: 'html-modal' },
        h('label', { for: 'html-fonte' }, H.rotulo), inFonte,
        h('p', { class: 'apoio' }, H.apoio),
        h('p', { class: 'apoio' }, H.passa),
        divAviso,
        h('div', { class: 'acoes' },
          btnOk,
          h('button', { type: 'button', class: 'secundario', id: 'html-cancelar', onclick: function () { Shell.fecharModal(); } }, H.cancelar))) });
      inFonte.focus();
    }

    // 32(c) — a miniatura GUARDADA da capa. Nasce aqui porque é aqui que a
    // imagem passa a ser capa, e a galeria (30) não pode servir a foto inteira
    // a quem lê por Tor: 7 MB por cartão. Regras que a governam:
    //  - só quando compensa (`Miniaturas.valeAPena`): imagem já pequena não
    //    ganha cópia — seria um arquivo a mais pelo Tor para poupar nada;
    //  - os bytes podem não estar aqui (site recarregado da rede): baixa-se,
    //    e SEM o teto de 1 MiB de 32(a), porque aqui foi o dono que clicou;
    //  - falhar é aceitável e não bloqueia: a galeria cai na original;
    //  - a original NÃO muda de estado — os bytes dela são os mesmos. O que
    //    muda é o `site.json`, que passa a descrever a ligação.
    // Duas escolhas seguidas da MESMA imagem gerariam duas miniaturas — a
    // primeira ficaria órfã e, pior, já contada para publicar. Um arquivo a
    // mais na rede por um clique repetido é lixo que não se apaga sozinho.
    const miniEmCurso = new Set();
    async function garantirMiniatura(m) {
      const TMini = T.mini;
      if (!m || removido || !Miniaturas.valeAPena(m)) return;
      if (m.thumb_media_id && media.some(x => x.id === m.thumb_media_id && x.status !== 'removed')) return;
      if (miniEmCurso.has(m.id)) return;
      miniEmCurso.add(m.id);
      try { await criarMiniatura(m, TMini); } finally { miniEmCurso.delete(m.id); }
    }
    async function criarMiniatura(m, TMini) {
      pMini.hidden = false; pMini.className = 'apoio';
      pMini.textContent = m.bytes ? TMini.preparando : TMini.baixando;
      let brutos = null;
      try {
        const blob = m.bytes || await Miniaturas.obter(m, servidoresMidia);
        if (blob) brutos = new Uint8Array(await blob.arrayBuffer());
      } catch (x) { brutos = null; }
      const r = brutos ? await Miniaturas.gerar(brutos, m.mime) : null;
      if (!r) { pMini.className = 'alerta'; pMini.textContent = TMini.naoDeu; return; }
      const usados = new Set(media.filter(x => x.status !== 'removed').map(x => x.path));
      const base = semExtensao(m.path) + '-mini', ext = extDeMime(r.mime);
      let caminho = Modelo.caminhoDe('img', base + '.' + ext);
      for (let i = 2; usados.has(caminho); i++) caminho = Modelo.caminhoDe('img', base + '-' + i + '.' + ext);
      const sha = await Blossom.sha256Hex(r.bytes);
      const t = Modelo.agora();
      const mini = { id: Modelo.novoId(), path: caminho, mime: r.mime, size: r.bytes.length, sha256: sha,
        width: r.width, height: r.height, alt: m.alt || '', caption: '',
        bytes: new Blob([r.bytes], { type: r.mime }), status: 'draft', servers: [], removal: null,
        metadata: { stripped: true, removed_segments: [], warning: null }, origin: 'upload',
        created_at: t, updated_at: t, previous_status: null };
      const original = Object.assign({}, m, { thumb_media_id: mini.id, updated_at: t });
      await db.escrever([{ op: 'put', store: 'media', valor: mini }, { op: 'put', store: 'media', valor: original }]);
      media.push(mini);
      const im = media.findIndex(x => x.id === m.id); if (im !== -1) media[im] = original;
      const ii = imagens.findIndex(x => x.id === m.id); if (ii !== -1) imagens[ii] = original;
      await Shell.registrarAlteracao(1);
      try { const c = await Rede.contagens(db); Shell.contadores({ publicar: c.pendentes }); } catch (x) {}
      refazerContexto();
      dataUrisDe(media).then(function (u) { if (E === e) { e.dataUris = u; renderPrevia(); } });
      pMini.className = 'apoio';
      pMini.textContent = texto(TMini.feita, { t: kb(r.bytes.length) });
    }

    const M = T.modelos;
    const acoes = {
      negrito: () => envolver('**', '**', M.negrito), italico: () => envolver('*', '*', M.italico), titulo: () => prefixarLinhas('## ', M.titulo),
      link: () => envolver('[', '](https://)', M.link), imagem: inserirImagem, video: inserirVideo, lista: () => prefixarLinhas('- ', M.lista), citacao: () => prefixarLinhas('> ', M.citacao),
      codigo: () => { const sel = taCorpo.value.slice(taCorpo.selectionStart, taCorpo.selectionEnd); if (sel.indexOf('\n') !== -1) envolver('```\n', '\n```', sel); else envolver('`', '`', M.codigo); },
      botao: inserirBotao, artigos: inserirArtigos, html: inserirHtml
    };
    const ferramentas = h('div', { class: 'ferramentas', role: 'toolbar', 'aria-label': C.conteudo }, Object.keys(T.ferramentas).map(k =>
      h('button', { type: 'button', class: 'secundario ferramenta', 'data-acao': k, title: T.ferramentas[k], disabled: removido, onclick: function () { acoes[k](); } }, T.ferramentas[k])));

    // --- pré-visualização --------------------------------------------------------
    const iframe = h('iframe', { id: 'ed-previa', sandbox: 'allow-scripts', title: T.previa.rotulo });
    e.iframe = iframe;
    function renderPrevia() { const c = coletar(); iframe.srcdoc = Gerador.previaCorpo(c.title, c.body, e.dataUris, Gerador.opcoesDe(site), ctxPrevia, Temas.de(site)); }
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
      ] : [
        h('label', { class: 'inline', for: 'ed-menu' }, cbMenu, C.menu),
        h('div', {}, h('label', {}, C.capa), capaBloco, h('p', { class: 'apoio', id: 'ed-capa-apoio' }, C.capaApoioPagina))
      ],
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
