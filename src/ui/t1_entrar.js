/* ui/t1_entrar.js — T1 Entrar (14 T1). Recebe a chave por sessão, sem a
   guardar: colada, lida de um arquivo escolhido pelo seletor, ou gerada
   aqui ("Não tenho chave"). Depois de "Entrar" nada da chave fica no DOM:
   campos limpos, texto da chave nova apagado, blob do download revogado. */
Shell.registrar('t1', { montar: function (raiz) {
  'use strict';
  const h = Shell.h, T = Textos.t1;
  let nova = null;      // chave gerada, viva só até Entrar/Cancelar
  let urlBlob = null;
  let baixou = false;

  // --- Colar a chave -------------------------------------------------------
  const inputNsec = h('input', { type: 'password', id: 'nsec', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-describedby': 'aviso-fixo' });
  const btnOlho = h('button', { type: 'button', id: 'olho', class: 'secundario', 'aria-label': T.colar.mostrar, title: T.colar.mostrar, onclick: function () {
    const mostrar = inputNsec.type === 'password';
    inputNsec.type = mostrar ? 'text' : 'password';
    btnOlho.setAttribute('aria-label', mostrar ? T.colar.esconder : T.colar.mostrar);
    btnOlho.title = mostrar ? T.colar.esconder : T.colar.mostrar;
  } }, '👁');
  const erroColar = h('p', { id: 'erro-colar', class: 'erro', role: 'alert', hidden: true });
  const status = h('p', { id: 'status-entrada', class: 'apoio', 'aria-live': 'polite' });

  function mostrarErro(no, msg) { no.textContent = msg; no.hidden = false; }
  function esconderErro(no) { no.textContent = ''; no.hidden = true; }

  function entrarCom(resultado) {
    // limpa tudo que possa conter a chave ANTES de sair desta tela
    inputNsec.value = '';
    inputArquivo.value = '';
    limparNova();
    status.textContent = T.entrandoComo + Chave.abreviar(resultado.npub);
    Shell.entrar(resultado);
  }

  const formColar = h('form', { id: 'f-colar', class: 'cartao', onsubmit: function (ev) {
    ev.preventDefault();
    esconderErro(erroColar);
    const r = Chave.validarNsec(inputNsec.value);
    if (!r.ok) { mostrarErro(erroColar, r.motivo); inputNsec.focus(); return; }
    entrarCom(r);
  } },
    h('h2', {}, T.colar.titulo),
    h('label', { for: 'nsec' }, T.colar.rotulo),
    h('div', { class: 'linha' }, inputNsec, btnOlho),
    erroColar,
    h('div', { class: 'acoes' }, h('button', { type: 'submit', id: 'entrar-colar' }, T.colar.entrar)));

  // --- Escolher o arquivo --------------------------------------------------
  const erroArquivo = h('p', { id: 'erro-arquivo', class: 'erro', role: 'alert', hidden: true });
  const inputArquivo = h('input', { type: 'file', id: 'arquivo-chave', onchange: function () {
    esconderErro(erroArquivo);
    const f = inputArquivo.files && inputArquivo.files[0];
    if (!f) return;
    f.text().then(function (txt) {
      inputArquivo.value = '';              // não guardar nome, caminho nem conteúdo
      const linha = Chave.extrairDeTexto(txt);
      if (!linha) { mostrarErro(erroArquivo, T.arquivo.semChave); return; }
      const r = Chave.validarNsec(linha);
      if (!r.ok) { mostrarErro(erroArquivo, r.motivo); return; }
      entrarCom(r);
    }).catch(function () {
      inputArquivo.value = '';
      mostrarErro(erroArquivo, T.arquivo.erroLeitura);
    });
  } });
  const cartaoArquivo = h('div', { class: 'cartao', id: 'c-arquivo' },
    h('h2', {}, T.arquivo.titulo),
    h('label', { for: 'arquivo-chave' }, T.arquivo.rotulo),
    inputArquivo,
    h('p', { class: 'apoio' }, T.arquivo.apoio),
    erroArquivo);

  // --- Ajuda do Tails (T11 §Tails, embutida aqui até o T11 existir) --------
  const ajudaTails = h('div', { id: 'ajuda-tails', class: 'cartao', hidden: true },
    h('h2', {}, T.tails.titulo),
    T.tails.paragrafos.map(function (p) { return h('p', {}, p); }));

  // --- Não tenho chave -----------------------------------------------------
  const nsecNova = h('code', { id: 'nsec-nova', class: 'chave' });
  const npubNova = h('code', { id: 'npub-nova', class: 'chave' });
  const linkBaixar = h('a', { id: 'baixar-chave', onclick: function () { baixou = true; habilitarEntrar(); } });
  const cbCopiei = h('input', { type: 'checkbox', id: 'copiei', onchange: habilitarEntrar });
  const btnEntrarNova = h('button', { type: 'button', id: 'entrar-nova', disabled: true, onclick: function () {
    if (!nova) return;
    const ch = nova;
    nova = null;
    entrarCom({ ok: true, sk: ch.sk, pubkey: ch.pubkey, npub: ch.npub });
  } }, T.gerar.entrar);
  const dicaEntrar = h('p', { id: 'dica-entrar', class: 'apoio' }, T.gerar.antesDeEntrar);
  const blocoGerar = h('div', { id: 'gerar', class: 'cartao', hidden: true },
    h('h2', {}, T.gerar.titulo),
    h('p', { class: 'alerta' }, T.gerar.alerta),
    h('p', {}, T.gerar.rotuloNsec), nsecNova,
    h('p', {}, T.gerar.rotuloNpub), npubNova,
    h('p', {}, linkBaixar),
    h('label', { class: 'inline', for: 'copiei' }, cbCopiei, T.gerar.copiei),
    dicaEntrar,
    h('div', { class: 'acoes' }, btnEntrarNova,
      h('button', { type: 'button', id: 'cancelar-nova', class: 'secundario', onclick: function () { if (nova) Chave.apagar(nova.sk); nova = null; limparNova(); } }, T.gerar.cancelar)));

  function habilitarEntrar() {
    const pode = baixou || cbCopiei.checked;
    btnEntrarNova.disabled = !pode;
    dicaEntrar.hidden = pode;
  }

  function limparNova() {
    nsecNova.textContent = '';
    npubNova.textContent = '';
    if (urlBlob) { try { URL.revokeObjectURL(urlBlob); } catch (e) {} urlBlob = null; }
    linkBaixar.removeAttribute('href');
    linkBaixar.removeAttribute('download');
    linkBaixar.textContent = '';
    cbCopiei.checked = false;
    baixou = false;
    btnEntrarNova.disabled = true;
    dicaEntrar.hidden = false;
    blocoGerar.hidden = true;
  }

  function gerarNova() {
    limparNova();
    if (nova) Chave.apagar(nova.sk);
    nova = Chave.gerar();
    nsecNova.textContent = nova.nsec;
    npubNova.textContent = nova.npub;
    const nome = Chave.nomeArquivoChave(nova.npub);
    urlBlob = URL.createObjectURL(new Blob([Chave.arquivoDaChave(nova)], { type: 'text/plain' }));
    linkBaixar.setAttribute('href', urlBlob);
    linkBaixar.setAttribute('download', nome);
    linkBaixar.textContent = T.gerar.baixar + nome;
    blocoGerar.hidden = false;
    ajudaTails.hidden = true;
    blocoGerar.scrollIntoView({ block: 'nearest' });
  }

  // --- Montagem ------------------------------------------------------------
  raiz.appendChild(h('section', { id: 't1' },
    h('h1', {}, T.titulo),
    h('div', { class: 'duas-colunas' }, formColar, cartaoArquivo),
    h('p', { id: 'aviso-fixo', class: 'alerta' }, T.avisoFixo),
    status,
    h('p', { class: 'acoes' },
      h('button', { type: 'button', id: 'link-tails', class: 'ligacao', onclick: function () { ajudaTails.hidden = !ajudaTails.hidden; } }, T.linkTails),
      ' · ',
      h('button', { type: 'button', id: 'btn-gerar', class: 'ligacao', onclick: gerarNova }, T.naoTenhoChave)),
    ajudaTails,
    blocoGerar));
  inputNsec.focus();
} });
