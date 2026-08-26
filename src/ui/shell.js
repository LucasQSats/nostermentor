/* ui/shell.js — a moldura (14 §2), a navegação (uma tela por vez, num único
   HTML — 14 §0.12) e a SESSÃO: a chave vive só dentro deste fecho, em
   memória (02 §B.1, 14 §0.3). Nunca vai a `window`, ao DOM, à URL, ao
   título nem a qualquer armazenamento. Quem precisa assinar chama
   `Shell.assinar(modelo)`; ninguém recebe a `sk`.
   Desde M2: `Shell.dados()` guarda o que a sessão carregou (o banco aberto,
   a última carga da rede); "Trancar" fecha o banco e esquece tudo. */
const Shell = (function () {
  'use strict';

  let sessao = null;                 // { sk: Uint8Array, pubkey: hex, npub }
  let dados = null;                  // { db, ultimaCarga } — só enquanto há sessão
  const telas = Object.create(null); // nome → { montar(raiz, params), desmontar?() }
  let telaAtual = null;
  const contadores = { publicar: 0, naoExportadas: 0 };

  const el = (id) => document.getElementById(id);

  function limpar(no) { while (no.firstChild) no.removeChild(no.firstChild); }

  // Construtor de DOM sem innerHTML: texto vira nó de texto, sempre.
  function h(tag, attrs) {
    const n = document.createElement(tag);
    if (attrs) {
      for (const k of Object.keys(attrs)) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') n.className = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') n.addEventListener(k.slice(2), v);
        else if (v === true) n.setAttribute(k, '');
        else n.setAttribute(k, String(v));
      }
    }
    const filhos = Array.prototype.slice.call(arguments, 2);
    (function anexa(lista) {
      for (const f of lista) {
        if (f == null || f === false) continue;
        if (Array.isArray(f)) { anexa(f); continue; }
        n.appendChild(typeof f === 'string' ? document.createTextNode(f) : f);
      }
    })(filhos);
    return n;
  }

  function registrar(nome, def) { telas[nome] = def; }
  function temSessao() { return sessao !== null; }
  function sessaoPublica() { return sessao ? { pubkey: sessao.pubkey, npub: sessao.npub } : null; }
  function assinar(modelo) {
    if (!sessao) throw new Error('sem sessão: não há chave para assinar');
    return Chave.assinar(modelo, sessao.sk);
  }
  function obterDados() { return dados; }
  function definirDados(d) { if (!sessao) throw new Error('sem sessão'); dados = d; }

  function nomeDaTela(nome) { return (Textos.moldura.nomes && Textos.moldura.nomes[nome]) || nome; }

  function montarStub(raiz, params) {
    raiz.appendChild(h('section', { id: params.nome, class: 'stub' },
      h('h1', {}, nomeDaTela(params.nome)),
      h('p', { class: 'alerta' }, (Textos.stub.porTela && Textos.stub.porTela[params.nome]) || Textos.stub.texto)));
  }

  // Desde M3: os contadores da barra lidos do banco (14 §2) — "Publicar (N)"
  // = registros com status ≠ published; "Backup: N não exportadas" =
  // meta.alteracoes_nao_exportadas (13 §1).
  async function atualizarBarra() {
    const d = dados;
    if (!d || !d.db || !d.db.estaAberto()) return;
    try {
      const c = await Rede.contagens(d.db);
      const n = await d.db.getMeta('alteracoes_nao_exportadas');
      if (d === dados) atualizarContadores({ publicar: c.pendentes, naoExportadas: typeof n === 'number' ? n : 0 });
    } catch (e) {}
  }
  // Toda gravação no banco passa por aqui: sobe o contador e redesenha a barra.
  async function registrarAlteracao(n) {
    const d = dados;
    if (!d || !d.db || !d.db.estaAberto()) return;
    await d.db.incrementar('alteracoes_nao_exportadas', typeof n === 'number' ? n : 1);
    await atualizarBarra();
  }

  // Modal simples (editor: imagem da biblioteca, "ver como ficará"). Sem
  // innerHTML; fecha por botão, Esc ou clique no fundo. → { fechar }
  function modal(o) {
    fecharModal();
    const corpo = h('div', { id: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': o.titulo || '', class: o.largo ? 'largo' : '' },
      h('div', { class: 'modal-cabeca' }, h('h2', {}, o.titulo || ''), h('button', { type: 'button', id: 'modal-fechar', class: 'secundario', onclick: fecharModal }, Textos.fixos.fechar)),
      h('div', { class: 'modal-corpo' }, o.conteudo));
    const fundo = h('div', { id: 'modal-fundo', onclick: function (ev) { if (ev.target === fundo) fecharModal(); } }, corpo);
    function aoTeclar(ev) { if (ev.key === 'Escape') fecharModal(); }
    document.addEventListener('keydown', aoTeclar);
    fundo.__aoTeclar = aoTeclar;
    document.body.appendChild(fundo);
    const b = el('modal-fechar'); if (b) b.focus();
    return { fechar: fecharModal };
  }
  function fecharModal() {
    const f = el('modal-fundo');
    if (!f) return;
    if (f.__aoTeclar) document.removeEventListener('keydown', f.__aoTeclar);
    f.remove();
  }

  function marcarMenu(nome) {
    const menu = el('menu');
    if (!menu) return;
    const itens = menu.querySelectorAll('.item');
    for (const it of itens) it.classList.toggle('atual', it.getAttribute('data-tela') === nome);
  }

  function atualizarContadores(novos) {
    if (novos) {
      if (typeof novos.publicar === 'number') contadores.publicar = novos.publicar;
      if (typeof novos.naoExportadas === 'number') contadores.naoExportadas = novos.naoExportadas;
    }
    const bp = el('btn-publicar'), bb = el('btn-backup');
    if (bp) {
      const n = contadores.publicar;
      bp.textContent = n > 0 ? Textos.moldura.publicar + ' (' + n + ')' : Textos.moldura.nadaAPublicar;
      bp.disabled = n === 0;
      bp.className = 'contador ' + (n > 0 ? 'pendente' : 'nada');
    }
    if (bb) {
      const n = contadores.naoExportadas;
      bb.textContent = n > 0 ? Textos.moldura.backupPendente.replace('{n}', String(n)) : Textos.moldura.backupEmDia;
      bb.className = 'contador ' + (n > 0 ? 'pendente' : 'ok');
    }
  }

  // Barra: nome do site (14 §2) — nunca a chave, nunca o título da janela (T-18)
  function atualizarSite(site) {
    const n = el('nome-site');
    if (n) n.textContent = (site && site.title) ? site.title : Textos.moldura.siteSemNome;
  }

  function faixa(msg, tipo, acao) {
    const f = el('faixa');
    if (!f) return;
    limpar(f);
    f.appendChild(document.createTextNode(String(msg)));
    if (acao && acao.rotulo && typeof acao.fn === 'function') { f.appendChild(document.createTextNode(' ')); f.appendChild(h('button', { type: 'button', class: 'ligacao', onclick: acao.fn }, acao.rotulo)); }
    f.className = tipo === 'erro' ? 'erro' : '';
    f.hidden = false;
  }
  function limparFaixa() { const f = el('faixa'); if (f) { limpar(f); f.hidden = true; f.className = ''; } }
  function erro(msg) { faixa(String(msg), 'erro'); }

  function montarMoldura() {
    const app = el('app');
    limpar(app);
    const menu = h('nav', { id: 'menu', 'aria-label': 'Menu principal' },
      Textos.moldura.menu.map(function (par) {
        return h('button', { type: 'button', class: 'item', 'data-tela': par[0], onclick: function () { ir(par[0]); } }, par[1]);
      }));
    const barra = h('header', { id: 'barra' },
      h('span', { class: 'site', id: 'nome-site' }, Textos.moldura.siteSemNome),
      h('code', { id: 'npub-abrev', title: sessao.npub }, Chave.abreviar(sessao.npub)),
      h('span', { class: 'espaco' }),
      h('button', { type: 'button', id: 'btn-publicar', class: 'contador nada', disabled: true, onclick: function () { ir('t8'); } }, Textos.moldura.nadaAPublicar),
      h('button', { type: 'button', id: 'btn-backup', class: 'contador ok', onclick: function () { ir('t9'); } }, Textos.moldura.backupEmDia),
      h('button', { type: 'button', id: 'btn-trancar', class: 'secundario', title: Textos.moldura.trancarDica, onclick: trancar }, Textos.moldura.trancar));
    const faixaEl = h('div', { id: 'faixa', hidden: true, role: 'status' });
    const conteudo = h('main', { id: 'conteudo' });
    const rodape = h('footer', { id: 'rodape' },
      h('span', { id: 'versao' }, Textos.app.nome + ' ' + window.APP_VERSION),
      h('button', { type: 'button', class: 'ligacao', onclick: function () { ir('t11', { secao: 'apoio' }); } }, Textos.moldura.rodapeApoio));
    app.appendChild(h('div', { id: 'moldura' }, barra, faixaEl, menu, conteudo, rodape));
    atualizarContadores();
  }

  function desmontarMoldura() { const app = el('app'); if (app) limpar(app); }

  function desmontarAtual() {
    const def = telaAtual && telas[telaAtual];
    if (def && typeof def.desmontar === 'function') { try { def.desmontar(); } catch (e) {} }
  }

  function ir(nome, params) {
    if (!sessao && nome !== 't1') nome = 't1';
    if (sessao && nome === 't1') { trancar(); return; }
    desmontarAtual();
    fecharModal();
    const def = telas[nome] || { montar: montarStub };
    let raiz;
    if (sessao) {
      if (!el('moldura')) montarMoldura();
      raiz = el('conteudo');
    } else {
      desmontarMoldura();
      raiz = el('app');
    }
    limpar(raiz);
    telaAtual = nome;
    document.title = Textos.app.nome;
    marcarMenu(nome);
    def.montar(raiz, Object.assign({ nome: nome }, params || {}));
  }

  function entrar(chave) {
    if (!chave || !(chave.sk instanceof Uint8Array) || !chave.pubkey || !chave.npub) throw new Error('chave inválida');
    sessao = { sk: chave.sk, pubkey: chave.pubkey, npub: chave.npub };
    dados = null;
    montarMoldura();
    ir('t2');
  }

  function trancar() {
    desmontarAtual();
    telaAtual = null;
    if (dados && dados.db) { try { dados.db.fechar(); } catch (e) {} }
    dados = null;
    if (sessao) Chave.apagar(sessao.sk);
    sessao = null;
    desmontarMoldura();
    ir('t1');
  }

  return Object.freeze({
    h: h, limpar: limpar,
    registrar: registrar, ir: ir, telaAtual: function () { return telaAtual; },
    entrar: entrar, trancar: trancar, temSessao: temSessao, sessao: sessaoPublica, assinar: assinar,
    dados: obterDados, definirDados: definirDados, atualizarSite: atualizarSite,
    faixa: faixa, limparFaixa: limparFaixa, erro: erro, contadores: atualizarContadores,
    atualizarBarra: atualizarBarra, registrarAlteracao: registrarAlteracao, modal: modal, fecharModal: fecharModal
  });
})();
