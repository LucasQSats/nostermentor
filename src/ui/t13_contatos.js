/* ui/t13_contatos.js — T13 Contatos (14 T13): as mensagens privadas que
   chegam ao site (NIP-17) e, na aba ao lado, o que o site diz ao leitor sobre
   como falar com o dono.

   Nasceu do pedido dele em 2026-09-12: uma página "Contatos" onde o dono lê e
   responde as mensagens mandadas pelo Nostr, e onde informa formas de contato.
   As duas metades estão construídas: a aba "Mensagens" (Etapa 1) e a aba
   "Onde me encontrar" com os oito campos, a prévia e o interruptor da caixa
   de entrada (Etapa 2). O bloco `[[contatos]]` que leva isto ao site publicado
   é do `core/gerador.js`; os canais e o que é endereço válido, do
   `core/contatos.js` — esta tela não monta um link nenhum.

   Desde 2026-09-14 (depois do E-C3, o primeiro teste com um aplicativo de
   verdade): a aba "Mensagens" VERIFICA SOZINHA ao abrir e ESCUTA enquanto está
   aberta (14 T13 decisão 26, pedido dele); e o interruptor da caixa de entrada
   grava ao marcar, porque do jeito antigo ninguém conseguia ligá-la (P51 do 08).

   O que esta tela NÃO tem, e é decisão dele (2026-09-12): lido/não lido. Ele
   tirou o recurso depois de ver o preço — no Tails esse estado morre com a
   sessão e passaria a mentir — e preferiu não o ter a tê-lo enganando. No
   lugar dele ficam a ordem por data e o relógio da última verificação.

   Regras que esta tela cumpre e que não são negociáveis:
   · mensagem é TEXTO de estranho: entra por `textContent`, nunca `innerHTML`
     (02 G.0). O construtor `Shell.h` já faz nó de texto de toda string;
   · nenhuma imagem de perfil de terceiro é buscada — aparece o nome em
     texto e a npub. Buscar o avatar entregaria o IP do dono ao servidor de um
     desconhecido, e a CSP já o proíbe;
   · a data que se mostra e por que se ordena é a do RUMOR, nunca a do
     envelope (a spec manda aleatorizar essa até dois dias no passado);
   · identificar-se a um relay (NIP-42) só acontece com chave na sessão e só
     nos relays da caixa de entrada — nunca nos de publicação;
   · a escuta ao vivo existe SÓ com a aba Mensagens aberta: sair dela, ir a
     outra tela ou trancar abortam o `ctrl`, e a conexão fecha junto. A T3 não
     se conecta a nada. */
(function () {
  'use strict';
  let ctrl = null;
  let aba = 'mensagens';
  let estadoFiltro = 'ativas', busca = '', ordemAntigasPrimeiro = false;
  let abertaCom = null;               // pubkey da conversa aberta, ou null (lista)
  let ultimaVerificacao = null;       // ISO da última busca desta sessão
  let ultimoRelatorio = null;         // o que a última busca disse dos relays

  function desmontar() { if (ctrl) { ctrl.abort(); ctrl = null; } }
  function texto(m, mapa) { let s = String(m); for (const k of Object.keys(mapa || {})) s = s.split('{' + k + '}').join(String(mapa[k])); return s; }
  function hora(iso) { const s = String(iso || ''); return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) ? s.slice(11, 16) : ''; }
  function dataDe(unix) { return Modelo.formatarData(Modelo.dataDeUnix(unix)); }
  function dataHoraDe(unix) { return Modelo.formatarDataHora(Modelo.dataDeUnix(unix)); }

  async function montar(raiz, params) {
    const h = Shell.h, T = Textos.t13;
    desmontar();
    ctrl = new AbortController();
    const info = Shell.dados();
    if (!info || !info.db || !info.db.estaAberto()) {
      raiz.appendChild(h('section', { id: 't13' }, h('h1', {}, T.titulo), h('p', { class: 'alerta' }, Textos.t3.aindaCarregando),
        h('div', { class: 'acoes' }, h('button', { type: 'button', onclick: function () { Shell.ir('t2'); } }, Textos.t3.voltarACarregar))));
      return;
    }
    const db = info.db, s = Shell.sessao();
    if (params && params.aba) aba = params.aba === 'onde' ? 'onde' : 'mensagens';
    const site = (await db.get('site', 'site')) || Modelo.sitePadrao(s.pubkey, s.npub);
    Shell.atualizarSite(site);

    const secao = h('section', { id: 't13' }, h('h1', {}, T.titulo));
    const abas = h('div', { class: 'abas', role: 'tablist' },
      botaoAba('mensagens', T.abas.mensagens), botaoAba('onde', T.abas.onde));
    const painel = h('div', { id: 't13-painel' });
    secao.appendChild(abas);
    secao.appendChild(painel);
    raiz.appendChild(secao);

    function botaoAba(nome, rotulo) {
      return h('button', { type: 'button', class: 'aba' + (aba === nome ? ' atual' : ''), role: 'tab', id: 'aba-' + nome,
        'aria-selected': aba === nome ? 'true' : 'false',
        onclick: function () { aba = nome; abertaCom = null; Shell.ir('t13', { aba: nome }); } }, rotulo);
    }

    if (aba === 'onde') await montarOnde(painel, db, site, params);
    else await montarMensagens(painel, db, site, s);
  }

  // ==== aba "Mensagens" ====================================================

  async function montarMensagens(painel, db, site, sessao) {
    const h = Shell.h, T = Textos.t13.mensagens;
    const ligado = !!(site.messages && site.messages.enabled);
    const relaysCaixa = Modelo.uniao(site.messages && site.messages.relays);
    // O `ctrl` DESTA montagem. Tudo o que é assíncrono confere esse controle
    // antes de mexer na tela: sair da aba o aborta, e a resposta que chega
    // depois não pinta nada.
    const meuCtrl = ctrl;

    painel.appendChild(h('p', { class: 'apoio' }, T.apoio));

    if (!ligado) {
      painel.appendChild(h('p', { class: 'alerta', id: 'mensagens-desligado' }, T.desligado));
      painel.appendChild(h('div', { class: 'acoes' },
        // 14 T13 decisão 29: leva ao interruptor À VISTA e com foco (D6)
        h('button', { type: 'button', id: 'ir-ligar', onclick: function () { aba = 'onde'; Shell.ir('t13', { aba: 'onde', foco: 'receber' }); } }, T.ligarAgora)));
    }

    // O relógio que substitui o contador de não lidas. Fica no topo, à vista:
    // escondido, deixaria de servir para o que existe (risco 1 do plano).
    const cabeca = h('div', { class: 'cartao', id: 'cartao-verificacao' });
    // "Escrever para alguém" (2026-09-25) tem um lugar só dele, entre o cartão
    // e a lista: nem a verificação nem a mensagem que chega ao vivo o
    // redesenham, e o que o dono está digitando fica onde está.
    const nova = h('div', { id: 'nova-conversa' });
    const lista = h('div', { id: 'lista-conversas' });
    painel.appendChild(cabeca);
    painel.appendChild(nova);
    painel.appendChild(lista);

    let conversas = [];
    // O placar do último envio, guardado FORA do desenho. Sem isto ele era
    // escrito no cartão e apagado meio segundo depois, quando a conversa se
    // redesenhava com a resposta recém-guardada: o dono enviava, via a
    // confirmação piscar e sumir, e ficava sem saber se tinha ido. Medido pela
    // suíte da T13 em 2026-09-12.
    let ultimoEnvio = null;         // { peer, classe, texto }
    // Ao vivo (2026-09-14). O que já passou por esta aba não é aberto de novo:
    // a verificação e a escuta usam o mesmo conjunto de envelopes vistos.
    const envelopesVistos = new Set();
    let resumoEscuta = null;        // o último resumo da escuta; null antes de ela começar
    let estadoEscutaEl = null;      // o parágrafo do estado, guardado: pode não estar na tela ainda
    let filaAoVivo = Promise.resolve();
    // 14 T13 decisão 27 — o rascunho da resposta vive FORA do desenho, por
    // conversa: uma mensagem que chega redesenha a lista, e o `textarea` passa
    // a ser outro. Sem isto, o que o dono estava escrevendo sumia.
    const rascunhos = new Map();
    let enviandoPara = null;        // pubkey da conversa com envio em andamento
    // Escrever para alguém: o que foi digitado vive fora do desenho, como os
    // rascunhos das respostas.
    let escrevendo = false, enviandoNova = false;
    const novaRascunho = { endereco: '', texto: '' };
    let novaDesfecho = null;        // { classe, texto } do último aviso do cartão

    async function carregarDoBanco() {
      const msgs = await db.getAll('messages');
      const pessoas = await db.getAll('peers');
      conversas = Mensagens.agrupar(msgs, pessoas);
    }

    function renderCabeca() {
      Shell.limpar(cabeca);
      cabeca.appendChild(h('p', { id: 'verificacao-quando', class: ultimaVerificacao ? '' : 'apoio' },
        ultimaVerificacao ? texto(T.verificadoEm, { h: hora(ultimaVerificacao) }) : T.nuncaVerificado));
      cabeca.appendChild(h('p', { class: 'apoio' }, T.retencao));
      const acoes = h('div', { class: 'acoes' },
        h('button', { type: 'button', id: 'verificar-mensagens', disabled: !ligado || !relaysCaixa.length, onclick: verificar }, T.verificar));
      cabeca.appendChild(acoes);
      estadoEscutaEl = null;
      if (ligado && relaysCaixa.length) {
        estadoEscutaEl = h('p', { id: 'escuta-estado', role: 'status' });
        cabeca.appendChild(estadoEscutaEl);
        cabeca.appendChild(h('p', { class: 'apoio', id: 'aviso-escuta' }, T.avisoEscuta));
        renderEstadoEscuta();
      }
      if (ultimoRelatorio) {
        const r = ultimoRelatorio;
        if (r.invalidas > 0) cabeca.appendChild(h('p', { class: 'alerta', id: 'mensagens-invalidas' }, texto(T.invalidas, { n: r.invalidas })));
        if (r.antigas > 0) cabeca.appendChild(h('p', { class: 'apoio', id: 'mensagens-antigas' }, texto(T.antigas, { n: r.antigas })));
        const semAuth = (r.porRelay || []).filter(x => x.auth === 'exigida' || x.auth === 'recusado' || x.auth === 'falhou').length;
        if (semAuth > 0) cabeca.appendChild(h('p', { class: 'alerta', id: 'mensagens-sem-auth' }, texto(T.relaysSemAuth, { n: semAuth })));
        const mudos = (r.porRelay || []).filter(x => x.estado !== 'ok').length;
        if (mudos > 0) cabeca.appendChild(h('p', { class: 'apoio', id: 'mensagens-mudos' }, texto(T.relaysMudos, { n: mudos })));
      }
      // O aviso do Tails: dito sempre que o banco não é de confiança para durar.
      // O painel não sabe em que sistema roda; o que ele sabe é o que promete,
      // e o honesto é dizer a condição, não adivinhar o sistema.
      cabeca.appendChild(h('p', { class: 'apoio', id: 'aviso-tails' }, T.avisoTails));
    }

    // O estado da escuta, à vista (14 T13 decisão 26). Só troca o texto do
    // parágrafo: redesenhar o cartão a cada mudança tiraria o foco de quem está
    // no botão de verificar.
    function renderEstadoEscuta() {
      const p = estadoEscutaEl;
      if (!p) return;
      const r = resumoEscuta;
      const estado = r ? r.estado : 'ligando';
      const E = T.escuta;
      p.setAttribute('data-estado', estado);
      p.className = estado === 'recebendo' ? 'ok' : (estado === 'ligando' ? 'apoio' : 'alerta');
      if (estado === 'recebendo') p.textContent = texto(E.recebendo, { n: r.recebendo, m: r.total });
      else if (estado === 'sem_conexao') p.textContent = E.semConexao;
      else if (estado === 'recusou') p.textContent = E.recusou;
      else p.textContent = E.ligando;
    }

    async function verificar() {
      const btn = document.getElementById('verificar-mensagens');
      if (btn) { btn.disabled = true; btn.textContent = T.verificando; }
      const meu = ctrl;
      try {
        const r = await Mensagens.buscar({
          relays: relaysCaixa, pubkey: sessao.pubkey, sinal: meu.signal,
          assinarAuth: Shell.assinarAuth, abrirEnvelopes: Shell.abrirEnvelopes
        });
        if (meu.signal.aborted) return;
        for (const id of r.idsEnvelopes || []) envelopesVistos.add(id);
        // Formato antigo: só se conta, nunca se decifra (o módulo `nip04` não
        // entra no app). Sem isto, quem escreve de um aplicativo velho
        // desaparece em silêncio — o defeito que este produto não pode ter.
        let antigas = 0;
        try { antigas = await Mensagens.contarAntigas({ relays: relaysCaixa, pubkey: sessao.pubkey, sinal: meu.signal, assinarAuth: Shell.assinarAuth }); }
        catch (e) { antigas = 0; }
        r.antigas = antigas;
        if (meu.signal.aborted) return;
        ultimaVerificacao = r.quando;
        ultimoRelatorio = r;
        await guardar(r.mensagens);
        await carregarDoBanco();
        renderCabeca();
        redesenharPreservando();
      } catch (e) {
        if (!meu.signal.aborted) Shell.erro(e && e.message ? e.message : String(e));
      } finally {
        const b = document.getElementById('verificar-mensagens');
        if (b) { b.disabled = false; b.textContent = T.verificar; }
      }
    }

    // Guarda o que chegou. ⚠️ Não conta como "alteração não exportada": mensagem
    // que chega não é alteração do site, não entra no backup e não acende o
    // contador de Publicar (14 T13 decisão 10).
    async function guardar(mensagens) {
      if (!mensagens || !mensagens.length) return;
      const ops = [];
      const conhecidas = new Set((await db.getAll('messages')).map(m => m.id));
      const pessoas = new Map((await db.getAll('peers')).map(p => [p.pubkey, p]));
      for (const m of mensagens) {
        if (!conhecidas.has(m.id)) ops.push({ op: 'put', store: 'messages', valor: m });
        if (!pessoas.has(m.peer)) {
          const novo = { pubkey: m.peer, npub: Mensagens.npubDe(m.peer), apelido: '', nome: '', arquivado: false, bloqueado: false, visto_em: Modelo.agora() };
          pessoas.set(m.peer, novo);
          ops.push({ op: 'put', store: 'peers', valor: novo });
        }
      }
      if (ops.length) await db.escrever(ops);
    }

    // --- ao vivo (14 T13 decisão 26) --------------------------------------
    // Começa depois da primeira verificação e vive enquanto esta aba viver. O
    // sinal é o do `ctrl` da tela: `Shell.ir` e `trancar` chamam `desmontar`,
    // que o aborta, e a escuta fecha junto — a conexão nunca sobrevive a quem a
    // pediu.
    function iniciarEscuta() {
      if (meuCtrl.signal.aborted || resumoEscuta || !ligado || !relaysCaixa.length) return;
      resumoEscuta = { estado: 'ligando', recebendo: 0, total: relaysCaixa.length, porRelay: [] };
      renderEstadoEscuta();
      Mensagens.escutar({
        relays: relaysCaixa, pubkey: sessao.pubkey, assinarAuth: Shell.assinarAuth, sinal: meuCtrl.signal,
        jaVistos: envelopesVistos,
        aoEstado: function (r) { if (meuCtrl.signal.aborted) return; resumoEscuta = r; renderEstadoEscuta(); },
        // Um de cada vez: duas mensagens que chegam juntas não disputam o banco.
        aoEnvelope: function (env) { filaAoVivo = filaAoVivo.then(function () { return receberAoVivo(env); }).catch(function () {}); }
      });
    }

    async function receberAoVivo(env) {
      if (meuCtrl.signal.aborted) return;
      const aberto = await Shell.abrirEnvelopes([env]);
      if (meuCtrl.signal.aborted) return;
      if (aberto.invalidas > 0) {
        const antes = ultimoRelatorio || { porRelay: [], invalidas: 0 };
        ultimoRelatorio = Object.assign({}, antes, { invalidas: (antes.invalidas || 0) + aberto.invalidas });
        renderCabeca();
      }
      if (!aberto.mensagens.length) return;
      await guardar(aberto.mensagens);
      if (meuCtrl.signal.aborted) return;
      await carregarDoBanco();
      redesenharPreservando();
    }

    // Redesenha a lista (ou a conversa aberta) sem tirar de quem está digitando
    // o lugar onde estava: o foco e a seleção voltam para o campo com o mesmo
    // id. O TEXTO do rascunho volta por `rascunhos`; o da busca, por `busca`.
    function redesenharPreservando() {
      const ativo = document.activeElement;
      const id = ativo && ativo.id && lista.contains(ativo) ? ativo.id : null;
      const sel = id && typeof ativo.selectionStart === 'number' ? [ativo.selectionStart, ativo.selectionEnd] : null;
      renderLista();
      if (!id) return;
      const n = document.getElementById(id);
      if (!n) return;
      try { n.focus({ preventScroll: true }); } catch (e) {}
      if (sel && typeof n.setSelectionRange === 'function') { try { n.setSelectionRange(sel[0], sel[1]); } catch (e) {} }
    }

    function renderLista() {
      Shell.limpar(lista);
      // Dentro de uma conversa a ação é responder: o "Escrever para alguém"
      // some, para não empilhar dois botões em cima do "Voltar à lista". O que
      // estava digitado nele fica guardado e volta com a lista.
      nova.hidden = !!abertaCom;
      if (abertaCom) return renderConversa();
      if (!conversas.length) { lista.appendChild(h('p', { class: 'apoio', id: 'sem-conversas' }, T.nenhuma)); return; }

      const barra = h('div', { class: 'filtros', id: 'filtros-conversas' });
      for (const [chave, rotulo] of [['ativas', T.filtros.ativas], ['arquivadas', T.filtros.arquivadas], ['bloqueadas', T.filtros.bloqueadas], ['todas', T.filtros.todas]]) {
        barra.appendChild(h('button', { type: 'button', class: 'filtro' + (estadoFiltro === chave ? ' atual' : ''), 'data-filtro': chave,
          onclick: function () { estadoFiltro = chave; renderLista(); } }, rotulo));
      }
      const campoBusca = h('input', { type: 'search', id: 'busca-conversas', value: busca, placeholder: T.busca, 'aria-label': T.busca });
      campoBusca.addEventListener('input', function () { busca = campoBusca.value; redesenharPreservando(); });
      barra.appendChild(campoBusca);
      barra.appendChild(h('button', { type: 'button', class: 'ligacao', id: 'trocar-ordem',
        onclick: function () { ordemAntigasPrimeiro = !ordemAntigasPrimeiro; renderLista(); } },
        ordemAntigasPrimeiro ? T.ordem.antigas : T.ordem.recentes));
      lista.appendChild(barra);

      let visiveis = Mensagens.filtrar(conversas, { estado: estadoFiltro, busca: busca });
      if (ordemAntigasPrimeiro) visiveis = visiveis.slice().reverse();
      if (!visiveis.length) { lista.appendChild(h('p', { class: 'apoio', id: 'sem-conversas-filtro' }, T.nenhumaNoFiltro)); return; }

      lista.appendChild(h('ul', { class: 'lista-conversas' }, visiveis.map(function (c) {
        return h('li', { class: 'conversa', 'data-npub': c.npub },
          h('p', { class: 'conversa-nome' },
            h('strong', {}, Mensagens.nomeDe(c)), ' ',
            h('span', { class: 'data' }, dataDe(c.ultima)), ' ',
            h('span', { class: 'apoio' }, c.quantas === 1 ? T.umaSo : texto(T.quantas, { n: c.quantas })),
            c.arquivado ? h('span', { class: 'selo arquivada' }, T.selos.arquivada) : null,
            c.bloqueado ? h('span', { class: 'selo bloqueada' }, T.selos.bloqueada) : null,
            c.grupo ? h('span', { class: 'selo grupo' }, T.selos.grupo) : null),
          h('p', { class: 'conversa-previa apoio' }, c.previa),
          h('p', { class: 'acoes' },
            h('button', { type: 'button', class: 'ligacao abrir-conversa', onclick: function () { abertaCom = c.pubkey; renderLista(); } }, T.acoes.abrir),
            ' ', h('button', { type: 'button', class: 'ligacao', onclick: function () { darApelido(c); } }, T.acoes.apelido),
            ' ', h('button', { type: 'button', class: 'ligacao', onclick: function () { alternar(c, 'arquivado'); } }, c.arquivado ? T.acoes.desarquivar : T.acoes.arquivar),
            ' ', h('button', { type: 'button', class: 'ligacao', onclick: function () { alternar(c, 'bloqueado'); } }, c.bloqueado ? T.acoes.desbloquear : T.acoes.bloquear),
            ' ', h('button', { type: 'button', class: 'ligacao copiar-npub', onclick: function () { copiar(c.npub); } }, T.acoes.copiar)));
      })));
    }

    async function copiar(valor) {
      let ok = false;
      try { await navigator.clipboard.writeText(valor); ok = true; } catch (e) { ok = false; }
      Shell.faixa(ok ? T.copiado : T.copiarFalhou, ok ? null : 'erro');
    }

    // Apelido, arquivar e bloquear são estado LOCAL — e a tela já disse que no
    // Tails eles recomeçam. Aqui só se grava; nada disto vai à rede.
    async function gravarPessoa(pubkey, mudanca) {
      const atual = (await db.get('peers', pubkey)) || { pubkey: pubkey, npub: Mensagens.npubDe(pubkey), apelido: '', nome: '', arquivado: false, bloqueado: false };
      await db.put('peers', Object.assign({}, atual, mudanca, { visto_em: Modelo.agora() }));
      await carregarDoBanco();
      renderLista();
    }
    async function alternar(c, campo) {
      if (campo === 'bloqueado' && !c.bloqueado) Shell.faixa(T.bloquearAviso);
      else if (campo === 'arquivado' && !c.arquivado) Shell.faixa(T.arquivarAviso);
      else Shell.limparFaixa();
      const m = {}; m[campo] = !c[campo];
      await gravarPessoa(c.pubkey, m);
    }
    function darApelido(c) {
      const atual = c.apelido || '';
      const novo = window.prompt(T.apelidoPergunta + '\n' + T.apelidoRemover, atual);
      if (novo === null) return;
      gravarPessoa(c.pubkey, { apelido: String(novo).trim().slice(0, 60) });
    }

    function renderConversa() {
      const c = conversas.find(x => x.pubkey === abertaCom);
      if (!c) { abertaCom = null; return renderLista(); }
      lista.appendChild(h('div', { class: 'acoes' },
        h('button', { type: 'button', class: 'secundario', id: 'voltar-lista', onclick: function () { abertaCom = null; renderLista(); } }, T.acoes.voltar)));
      lista.appendChild(h('h2', {}, Mensagens.nomeDe(c)));
      lista.appendChild(h('p', { class: 'apoio' }, h('code', {}, c.npub)));
      if (c.grupo) lista.appendChild(h('p', { class: 'alerta', id: 'conversa-grupo' }, T.grupoAviso));

      lista.appendChild(h('ul', { class: 'mensagens', id: 'mensagens-da-conversa' }, c.mensagens.map(function (m) {
        const corpo = m.apagada ? h('p', { class: 'apoio apagada' }, T.apagadaPeloAutor)
          : (m.kind === Mensagens.KIND_ARQUIVO ? h('p', { class: 'apoio' }, T.comArquivo)
            // ⚠️ `Shell.h` insere string como NÓ DE TEXTO: uma tag dentro da
            // mensagem aparece escrita, nunca interpretada.
            : h('p', { class: 'corpo' }, m.content));
        return h('li', { class: 'mensagem' + (m.minha ? ' minha' : ''), 'data-kind': String(m.kind), 'data-id': m.id },
          h('p', { class: 'apoio' }, (m.minha ? T.minha : Mensagens.nomeDe(c)) + ' · ' + dataHoraDe(m.created_at)),
          m.assunto ? h('p', { class: 'assunto' }, m.assunto) : null,
          corpo,
          m.reacoes && m.reacoes.length ? h('p', { class: 'apoio reacoes' }, texto(T.reacoes, { r: m.reacoes.join(' ') })) : null,
          m.expira_em ? h('p', { class: 'apoio' }, texto(T.expiraEm, { d: dataDe(m.expira_em) })) : null);
      })));

      if (c.bloqueado) return;
      const campo = h('textarea', { id: 'resposta', rows: '4', 'aria-label': Textos.t13.mensagens.responder });
      campo.value = rascunhos.get(c.pubkey) || '';
      campo.addEventListener('input', function () { rascunhos.set(c.pubkey, campo.value); });
      const aviso = h('p', { class: 'apoio', id: 'resposta-aviso' }, T.respondeComoSite);
      const mostra = ultimoEnvio && ultimoEnvio.peer === c.pubkey;
      const desfecho = h('p', { id: 'resposta-desfecho', hidden: !mostra, class: mostra ? ultimoEnvio.classe : '' }, mostra ? ultimoEnvio.texto : null);
      const enviando = enviandoPara === c.pubkey;
      const btn = h('button', { type: 'button', id: 'enviar-resposta', disabled: enviando, onclick: function () { responder(c, campo, desfecho, btn); } }, enviando ? T.enviando : T.responder);
      lista.appendChild(h('div', { class: 'cartao', id: 'cartao-resposta' }, h('h3', {}, T.responder), campo, aviso, h('div', { class: 'acoes' }, btn), desfecho));
    }

    async function responder(c, campo, desfecho, btn) {
      const conteudo = String(campo.value || '');
      // O que tem de SOBREVIVER ao redesenho vai por `ultimoEnvio`. ⚠️ Com a
      // escuta ao vivo, o redesenho pode acontecer NO MEIO do envio (chegou uma
      // mensagem): o parágrafo é procurado pelo id a cada vez, porque o que foi
      // capturado no clique pode já não estar na tela.
      const dizer = (classe, msg) => {
        ultimoEnvio = { peer: c.pubkey, classe: classe, texto: msg };
        const d = document.getElementById('resposta-desfecho') || desfecho;
        d.hidden = false; d.className = classe; d.textContent = msg;
      };
      if (!conteudo.trim()) return dizer('erro', T.vazia);
      if (conteudo.length > Mensagens.MAX_TEXTO) return dizer('erro', T.longa);
      enviandoPara = c.pubkey;
      btn.disabled = true; btn.textContent = T.enviando;
      const meu = ctrl;
      try {
        if (await entregar(c.pubkey, conteudo, dizer, function () { rascunhos.delete(c.pubkey); })) renderLista();
      } catch (e) {
        if (!meu.signal.aborted) dizer('erro', e && e.message ? e.message : String(e));
      } finally {
        enviandoPara = null;
        const b = document.getElementById('enviar-resposta');
        if (b) { b.disabled = false; b.textContent = T.responder; }
      }
    }

    // O caminho de um envio, o mesmo para responder e para começar a conversa
    // com quem ainda não escreveu: achar a caixa DELA, embrulhar, enviar e
    // guardar a cópia. `dizer(classe, texto)` mostra o andamento onde quem chamou quiser;
    // `aoIr()` roda logo que se sabe que foi, antes de guardar.
    // → true se chegou a pelo menos um relay da caixa dela.
    async function entregar(pubkey, conteudo, dizer, aoIr) {
      const meu = ctrl;
      dizer('apoio', T.caixaDele);
      // A spec manda NÃO tentar quando não se acha onde a pessoa recebe. Quem
      // nunca escreveu para o site pode não estar nos nossos relays: a `caixaDe`
      // procura também nos relays dela.
      const caixa = await Mensagens.caixaDe({ pubkey: pubkey, relays: Modelo.uniao(relaysCaixa, site.network && site.network.relays), sinal: meu.signal, assinarAuth: Shell.assinarAuth });
      if (meu.signal.aborted) return false;
      if (!caixa.achou) { dizer('alerta', T.semCaixa); return false; }
      const pacote = await Shell.embrulhar(conteudo, pubkey);
      const r = await Mensagens.enviar({
        paraEle: pacote.paraEle, paraMim: pacote.paraMim,
        relaysDela: caixa.relays, relaysMeus: relaysCaixa,
        sinal: meu.signal, assinarAuth: Shell.assinarAuth });
      if (meu.signal.aborted) return false;
      if (!r.ok) { dizer('erro', T.naoEnviada); return false; }
      dizer('', texto(T.enviada, { n: r.placarDela.com, m: r.placarDela.total })
        + (r.placarMinha && !r.placarMinha.ok ? ' ' + T.copiaFalhou : ''));
      if (typeof aoIr === 'function') aoIr();
      // A cópia que ficou na rede é a mesma que se guarda aqui: o id é o do
      // rumor, o mesmo que voltará da próxima verificação — logo não duplica.
      await guardar([Mensagens.registroDaMensagem(pacote.rumor, null, Shell.sessao().pubkey)]);
      await carregarDoBanco();
      return true;
    }

    // --- escrever para alguém (2026-09-25) ------------------------------------
    // Começar uma conversa, não só responder. Só com as mensagens ligadas: sem
    // a caixa de entrada do site publicada, a pessoa não teria onde responder.
    const podeEscrever = ligado && relaysCaixa.length > 0;

    function renderNova() {
      Shell.limpar(nova);
      if (!escrevendo) {
        nova.appendChild(h('div', { class: 'acoes' },
          h('button', { type: 'button', id: 'escrever-para-alguem', disabled: !podeEscrever, onclick: function () {
            escrevendo = true; novaDesfecho = null; renderNova();
            const e = document.getElementById('nova-endereco');
            if (e) { try { e.focus(); } catch (x) {} }
          } }, T.escrever)));
        if (!podeEscrever) nova.appendChild(h('p', { class: 'apoio', id: 'escrever-desligado' }, T.escreverDesligado));
        return;
      }
      const endereco = h('input', { type: 'text', id: 'nova-endereco', value: novaRascunho.endereco, placeholder: 'npub1…',
        autocomplete: 'off', spellcheck: 'false' });
      // O erro aparece enquanto ele digita, mas não com o campo vazio.
      const erro = h('p', { class: 'erro', id: 'nova-endereco-erro', hidden: true }, T.enderecoInvalido);
      function conferir() {
        novaRascunho.endereco = endereco.value;
        erro.hidden = !String(endereco.value).trim() || !!Mensagens.pubkeyDoEndereco(endereco.value);
      }
      endereco.addEventListener('input', conferir);
      const campo = h('textarea', { id: 'nova-mensagem', rows: '4' });
      campo.value = novaRascunho.texto;
      campo.addEventListener('input', function () { novaRascunho.texto = campo.value; });
      const desfecho = h('p', { id: 'nova-desfecho', hidden: !novaDesfecho, class: novaDesfecho ? novaDesfecho.classe : '' },
        novaDesfecho ? novaDesfecho.texto : null);
      nova.appendChild(h('div', { class: 'cartao', id: 'cartao-nova' },
        h('h2', {}, T.escrever),
        h('p', { class: 'apoio' }, T.escreverApoio),
        h('label', { for: 'nova-endereco' }, T.enderecoRotulo), endereco, erro,
        h('label', { for: 'nova-mensagem' }, T.mensagemRotulo), campo,
        h('p', { class: 'apoio' }, T.escreveComoSite),
        h('p', { class: 'apoio', id: 'nova-aviso-relays' }, T.escreverRelaysDela),
        h('div', { class: 'acoes' },
          h('button', { type: 'button', id: 'enviar-nova', disabled: enviandoNova, onclick: escreverNova }, enviandoNova ? T.enviando : T.enviar), ' ',
          // Cancelar descarta o que foi digitado: é o que o nome promete.
          h('button', { type: 'button', class: 'secundario', id: 'cancelar-nova', disabled: enviandoNova, onclick: function () {
            escrevendo = false; novaDesfecho = null; novaRascunho.endereco = ''; novaRascunho.texto = ''; renderNova();
          } }, T.cancelar)),
        desfecho));
      conferir();
    }

    async function escreverNova() {
      // ⚠️ A trava vem ANTES de qualquer espera: entre o clique e o botão
      // travado há uma consulta ao banco, e um duplo clique mandaria duas vezes.
      if (enviandoNova) return;
      enviandoNova = true;
      const dizer = (classe, msg) => {
        novaDesfecho = { classe: classe, texto: msg };
        const d = document.getElementById('nova-desfecho');
        if (d) { d.hidden = false; d.className = classe; d.textContent = msg; }
      };
      const meu = ctrl;
      let travou = false;             // o cartão só é redesenhado se chegou a enviar
      try {
        const pubkey = Mensagens.pubkeyDoEndereco(novaRascunho.endereco);
        const conteudo = String(novaRascunho.texto || '');
        if (!pubkey) return dizer('erro', T.enderecoInvalido);
        if (pubkey === sessao.pubkey) return dizer('erro', T.enderecoProprio);
        // A conversa bloqueada não tem caixa de resposta; começar outra por aqui
        // seria a porta dos fundos para o mesmo lugar.
        const pessoa = await db.get('peers', pubkey);
        if (pessoa && pessoa.bloqueado) return dizer('erro', T.enderecoBloqueado);
        if (!conteudo.trim()) return dizer('erro', T.vazia);
        if (conteudo.length > Mensagens.MAX_TEXTO) return dizer('erro', T.longa);
        travou = true;
        novaDesfecho = null;
        renderNova();                 // botões travados, "Enviando…"
        if (!(await entregar(pubkey, conteudo, dizer, function () { novaRascunho.endereco = ''; novaRascunho.texto = ''; }))) return;
        if (meu.signal.aborted) return;
        // Foi: o cartão fecha e a conversa abre, com o placar do envio no mesmo
        // parágrafo da resposta — que sobrevive ao redesenho (`ultimoEnvio`).
        ultimoEnvio = { peer: pubkey, classe: novaDesfecho.classe, texto: novaDesfecho.texto };
        escrevendo = false; novaDesfecho = null;
        abertaCom = pubkey;
        renderLista();
      } catch (e) {
        if (!meu.signal.aborted) dizer('erro', e && e.message ? e.message : String(e));
      } finally {
        enviandoNova = false;
        // Recusado antes da rede, o cartão fica como está — e o foco, onde estava.
        if (travou && !meu.signal.aborted) renderNova();
      }
    }

    await carregarDoBanco();
    renderCabeca();
    renderNova();
    renderLista();
    // 14 T13 decisão 26 — ao abrir, verifica sozinha; terminada a verificação,
    // escuta. Não se espera por isto: a tela já está desenhada com o que o banco
    // tinha, e a verificação chega quando chegar.
    if (ligado && relaysCaixa.length) verificar().then(iniciarEscuta);
  }

  // ==== aba "Onde me encontrar" ============================================
  // Etapa 2 (2026-09-12): os oito campos de contato, a prévia do bloco e o
  // aviso de privacidade de cada canal, mais o interruptor da caixa de entrada
  // que já vinha da Etapa 1. Quem conhece os canais é `core/contatos.js` — esta
  // tela não sabe montar um link nenhum, de propósito (plano §3.4 item 2).

  async function montarOnde(painel, db, site, params) {
    const h = Shell.h, T = Textos.t13.onde;
    painel.appendChild(h('p', { class: 'apoio' }, T.apoio));

    // --- os oito campos ---------------------------------------------------
    // A lista de trabalho é uma cópia: nada é gravado antes de ele salvar.
    // `kind` e `value` crus, como ele escreveu — a normalização só acontece ao
    // gravar e ao desenhar a prévia, para o campo não fugir debaixo do
    // dedo enquanto digita.
    let itens = (Array.isArray(site.contacts) ? site.contacts : []).map(c => ({ kind: c.kind, value: c.value, label: c.label || '' }));
    const cartaoCampos = h('div', { class: 'cartao', id: 'cartao-contatos' });
    const desfechoCampos = h('p', { id: 'contatos-desfecho', hidden: true });
    const previa = h('iframe', { id: 'contatos-previa', sandbox: 'allow-scripts', title: T.previaTitulo });

    // O bloco sai com os contatos preenchidos OU com o convite das mensagens
    // ligadas (14 T13 decisão 31): a prévia segue a mesma conta do gerador.
    function temBloco(limpos) { return limpos.length > 0 || !!Contatos.npubDoConvite(site); }

    function renderPrevia() {
      // 02 G.2.2: a prévia roda num iframe de origem opaca — `sandbox` SEM
      // `allow-same-origin`. É o mesmo isolamento da T12, e a razão é a mesma:
      // o que se desenha ali é HTML de tema, e o painel segura a nsec.
      const limpos = Contatos.normalizarLista(itens);
      const paraPrevia = Object.assign({}, site, { contacts: limpos });
      const ctx = Gerador.contexto({ site: paraPrevia, pages: [], posts: [], media: [] });
      // ⚠️ Título VAZIO, e o `<h1>` oco removido em seguida: `previaCorpo` desenha
      // uma página, com o título do conteúdo em cima. Com o título do cartão ali
      // dentro, o dono via "Como fica no site" duas vezes — uma no painel e
      // outra dentro da prévia, como se fosse parte do bloco. Visto na captura.
      previa.srcdoc = Gerador.previaCorpo('', temBloco(limpos) ? '[[contatos]]' : '', null,
        Gerador.opcoesDe(site), ctx, Temas.de(site)).replace('<h1></h1>\n', '');
    }

    function linha(item, i) {
      const tipo = Contatos.tipoDe(item.kind);
      const sel = h('select', { class: 'contato-canal', 'data-i': String(i), 'aria-label': T.canal },
        Contatos.tipos().map(t => h('option', { value: t.kind, selected: t.kind === item.kind ? 'selected' : null }, t.rotulo)));
      sel.value = item.kind;
      sel.addEventListener('change', function () { itens[i] = { kind: sel.value, value: '', label: '' }; render(); });

      const valor = h('input', { type: 'text', class: 'contato-valor', 'data-i': String(i), value: item.value || '',
        placeholder: (T.exemplos && T.exemplos[item.kind]) || '', 'aria-label': T.valor, autocomplete: 'off', spellcheck: 'false' });
      const erro = h('p', { class: 'erro contato-erro', hidden: true }, T.invalido);
      function conferir() {
        itens[i].value = valor.value;
        const vazio = !String(valor.value).trim();
        erro.hidden = vazio || Contatos.valido(itens[i]);
        renderPrevia();
      }
      valor.addEventListener('input', conferir);

      const campos = [h('label', { class: 'contato-linha' }, sel, valor)];
      // O rótulo só existe no "outro link": nos canais conhecidos o nome é do
      // canal, e deixá-lo livre daria um "WhatsApp" apontando para outra coisa.
      if (tipo && tipo.pedeRotulo) {
        const rot = h('input', { type: 'text', class: 'contato-rotulo', 'data-i': String(i), value: item.label || '',
          placeholder: T.rotulo, 'aria-label': T.rotulo, autocomplete: 'off' });
        rot.addEventListener('input', function () { itens[i].label = rot.value; renderPrevia(); });
        campos.push(rot);
        campos.push(h('p', { class: 'apoio' }, T.rotuloApoio));
      }
      // O endereço Nostr deste site, num clique: é o dado que ele tem à mão e
      // que mais dá erro escrito à mão.
      if (item.kind === 'nostr') {
        const meu = (Shell.sessao() || {}).npub;
        if (meu) campos.push(h('p', { class: 'acoes' }, h('button', { type: 'button', class: 'ligacao usar-minha-npub',
          onclick: function () { itens[i].value = meu; render(); } }, T.usarMinhaNpub)));
      }
      campos.push(erro);
      if (tipo && T.avisos[tipo.kind]) campos.push(h('p', { class: 'apoio contato-aviso' }, T.avisos[tipo.kind]));

      return h('li', { class: 'contato-item', 'data-kind': item.kind }, campos,
        h('p', { class: 'acoes' },
          h('button', { type: 'button', class: 'ligacao contato-subir', disabled: i === 0, onclick: function () { mover(i, -1); } }, T.subir),
          ' ', h('button', { type: 'button', class: 'ligacao contato-descer', disabled: i === itens.length - 1, onclick: function () { mover(i, 1); } }, T.descer),
          ' ', h('button', { type: 'button', class: 'ligacao contato-remover', onclick: function () { itens.splice(i, 1); render(); } }, T.remover)));
    }
    // A ordem é do dono e é visível no site — por isso ela viaja no dado, e não
    // se reordena nada sozinho (13 §5.2: os bytes publicados têm de ser
    // deterministas, e "determinista" aqui quer dizer "a ordem que ele deixou").
    function mover(i, d) {
      const j = i + d;
      if (j < 0 || j >= itens.length) return;
      const x = itens[i]; itens[i] = itens[j]; itens[j] = x;
      render();
    }

    function render() {
      Shell.limpar(cartaoCampos);
      cartaoCampos.appendChild(h('h2', {}, T.camposTitulo));
      cartaoCampos.appendChild(h('p', { class: 'apoio' }, T.camposApoio));
      if (!itens.length) cartaoCampos.appendChild(h('p', { class: 'apoio', id: 'sem-contatos' }, T.semNadaAinda));
      else cartaoCampos.appendChild(h('ul', { class: 'lista-contatos-edicao', id: 'lista-contatos' }, itens.map(linha)));
      cartaoCampos.appendChild(h('div', { class: 'acoes' },
        h('button', { type: 'button', id: 'acrescentar-contato', onclick: function () {
          const usados = new Set(itens.map(x => x.kind));
          // Oferece o primeiro canal que ele ainda não usou; esgotados, o
          // "outro link", que é o único que faz sentido repetir.
          const livre = Contatos.tipos().find(t => !usados.has(t.kind));
          itens.push({ kind: livre ? livre.kind : 'link', value: '', label: '' });
          render();
        } }, T.acrescentar)));
      cartaoCampos.appendChild(h('h3', {}, T.previaTitulo));
      if (!temBloco(Contatos.normalizarLista(itens))) cartaoCampos.appendChild(h('p', { class: 'apoio', id: 'previa-vazia' }, T.previaVazia));
      // ⚠️ O `srcdoc` é trocado ANTES de o iframe voltar para a tela. Na ordem
      // inversa (recolocar e só depois trocar), o navegador ficava com a carga
      // que a recolocação começou — o `srcdoc` novo estava lá e o iframe mostrava
      // o documento antigo. Foi assim que ligar as mensagens não mostrava o
      // convite na prévia (visto na captura, 2026-09-14).
      renderPrevia();
      cartaoCampos.appendChild(previa);
      cartaoCampos.appendChild(h('p', { class: 'apoio', id: 'como-usar-contatos' }, T.comoUsar));
      cartaoCampos.appendChild(h('div', { class: 'acoes' },
        h('button', { type: 'button', id: 'salvar-contatos', onclick: salvarContatos }, T.salvarCampos)));
      cartaoCampos.appendChild(desfechoCampos);
    }

    async function salvarContatos() {
      const limpos = Contatos.normalizarLista(itens);
      const atual = (await db.get('site', 'site')) || Modelo.sitePadrao(Shell.sessao().pubkey, Shell.sessao().npub);
      const novo = Object.assign({}, atual, { contacts: limpos });
      await db.put('site', novo, 'site');
      site = novo;
      Shell.atualizarSite(novo);
      // Isto SIM muda o site publicado (sai no site.json e no bloco das
      // páginas que o usem), ao contrário das mensagens que chegam.
      await Shell.registrarAlteracao(1);
      await Shell.atualizarBarra();
      try { const c = await Rede.contagens(db); Shell.contadores({ publicar: c.pendentes }); } catch (e) { /* o contador é conforto, não contrato */ }
      // O que não passou na validação não foi gravado — dizer isso é obrigatório,
      // senão ele sai da tela convencido de que publicou um endereço que não
      // existe. `itens` passa a ser o que ficou, para a tela não mentir também.
      const perdidos = itens.filter(x => String(x.value || '').trim()).length - limpos.length;
      itens = limpos.map(c => ({ kind: c.kind, value: c.value, label: c.label || '' }));
      render();
      desfechoCampos.hidden = false;
      desfechoCampos.className = perdidos > 0 ? 'alerta' : '';
      desfechoCampos.textContent = perdidos > 0 ? texto(T.naoSalvos, { n: perdidos }) : T.camposSalvos;
    }

    render();
    painel.appendChild(cartaoCampos);

    // --- a caixa de entrada (Etapa 1; refeita em 2026-09-14) ----------------
    // ⚠️ O E-C3 mostrou que NINGUÉM conseguia ligar as mensagens (P51 do 08): o
    // rótulo dizia o estado ("Desligado") e não mudava ao marcar; havia dois
    // Salvar, e o "Salvar contatos" não gravava isto; sair da aba desmarcava
    // sem aviso; e o "Salvo neste navegador" já estava à vista antes de qualquer
    // clique. Agora o rótulo diz a AÇÃO, o estado muda na hora e marcar GRAVA
    // (14 T13 decisão 28). A suíte antiga passava porque clicava no Salvar certo
    // sabendo o id — por isso os casos novos afirmam o que a pessoa LÊ.

    const messages = Object.assign({ enabled: false, relays: Modelo.RELAYS_CAIXA_PADRAO.slice() }, site.messages || {});
    let ligado = messages.enabled === true;
    const relays = Modelo.uniao(messages.relays).slice(0, Modelo.MAX_RELAYS_CAIXA);

    const cartao = h('div', { class: 'cartao', id: 'cartao-receber' });
    const desfecho = h('p', { id: 'receber-desfecho', hidden: true });
    // ⚠️ Guardado, e não procurado pelo id: na primeira vez que o cartão é
    // desenhado ele ainda não está na tela, e a linha do estado ficava VAZIA até
    // o primeiro clique. Pego pelo caso novo da suíte na primeira rodada.
    const estadoCaixa = h('p', { id: 'receber-estado', role: 'status' });
    let gravando = Promise.resolve();

    function renderEstadoCaixa() {
      estadoCaixa.setAttribute('data-ligado', ligado ? 'sim' : 'nao');
      estadoCaixa.className = ligado ? 'ok' : 'apoio';
      estadoCaixa.textContent = ligado ? T.estadoLigado : T.estadoDesligado;
    }

    function renderCaixa() {
      Shell.limpar(cartao);
      cartao.appendChild(h('h2', {}, T.receberTitulo));
      cartao.appendChild(h('p', { class: 'apoio' }, T.receberApoio));
      const caixa = h('input', { type: 'checkbox', id: 'receber-mensagens' });
      caixa.checked = ligado;
      caixa.addEventListener('change', function () { alternarCaixa(caixa.checked); });
      cartao.appendChild(h('p', { class: 'interruptor' }, h('label', { for: 'receber-mensagens' }, caixa, ' ', T.receberRotulo)));
      cartao.appendChild(estadoCaixa);
      cartao.appendChild(desfecho);

      cartao.appendChild(h('h3', {}, T.relaysTitulo));
      cartao.appendChild(h('p', { class: 'apoio' }, T.relaysApoio));
      if (!relays.length) cartao.appendChild(h('p', { class: 'alerta', id: 'sem-relays-caixa' }, T.semRelays));
      else cartao.appendChild(h('ul', { class: 'lista-relays', id: 'relays-caixa' }, relays.map(function (u) {
        return h('li', { class: 'relay' }, h('code', {}, u), T.tipos[u] ? h('span', { class: 'apoio' }, ' — ' + T.tipos[u]) : null);
      })));
      cartao.appendChild(h('div', { class: 'acoes' },
        h('button', { type: 'button', class: 'secundario', onclick: function () { Shell.ir('t7', { secao: 'avancado' }); } }, T.irAvancado)));
      renderEstadoCaixa();
    }

    function alternarCaixa(novo) {
      ligado = novo;
      renderEstadoCaixa();
      desfecho.hidden = true;
      // Desligar não apaga o que já foi dito: a tela diz a verdade, como no
      // "tirar do ar" (03 §6). E só avisa quando há uma caixa publicada — sem
      // ela não há nada a retirar da rede, e a faixa mentiria.
      if (ligado) Shell.limparFaixa();
      else db.get('published', 'current').then(function (pub) {
        const ev = pub && pub.metadata_events && pub.metadata_events.kind10050;
        if (!ligado && Mensagens.relaysDaCaixa(ev).length) Shell.faixa(T.desligarAviso);
      }).catch(function () { /* a faixa é conforto, não contrato */ });
      // Em fila: marcar e desmarcar depressa grava na ordem em que aconteceu.
      gravando = gravando.then(salvarCaixa).catch(function (e) { Shell.erro(e && e.message ? e.message : String(e)); });
    }

    async function salvarCaixa() {
      const atual = (await db.get('site', 'site')) || Modelo.sitePadrao(Shell.sessao().pubkey, Shell.sessao().npub);
      const novo = Object.assign({}, atual, { messages: { enabled: ligado, relays: relays.slice() } });
      await db.put('site', novo, 'site');
      site = novo;
      // Conta como alteração por exportar (é configuração do site), e o
      // contador de Publicar acorda porque o 10050 passa a ter de ir à rede
      // (`Publicar.configPendente`, D9) — mas NUNCA por causa de mensagens que
      // chegam.
      await Shell.registrarAlteracao(1);
      await Shell.atualizarBarra();
      // O bloco [[contatos]] muda com isto (o convite, decisão 31): a prévia
      // também tem de mudar.
      render();
      desfecho.hidden = false;
      desfecho.className = '';
      desfecho.textContent = T.salvo;
    }

    renderCaixa();
    painel.appendChild(cartao);

    // 14 T13 decisão 29 — quem veio de "Ligar as mensagens" chega ao interruptor
    // À VISTA e com o foco nele. Antes caía no topo da aba, com o interruptor
    // 941 px abaixo numa janela de 800 (P51 do 08, D6).
    if (params && params.foco === 'receber') {
      try { cartao.scrollIntoView({ block: 'start' }); } catch (e) {}
      const cb = document.getElementById('receber-mensagens');
      if (cb) { try { cb.focus({ preventScroll: true }); } catch (e) {} }
    }
  }

  Shell.registrar('t13', { montar: montar, desmontar: desmontar });
})();
