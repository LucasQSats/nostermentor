/* ui/t11_ajuda.js — T11 Ajuda e Sobre (14 T11): o LEIA-ME dentro do painel,
   para quem nunca abriu o .txt. Seis seções em abas, como T6 e T7: como
   abrir (Tails primeiro, porque é o caso mais restrito), a chave, as três
   cópias, "remover não é apagar", apoiar e sobre.
   É a única tela que não lê nem escreve no banco: texto fixo + a versão do
   app + os endereços do projeto (Textos.projeto). Por isso funciona também
   antes de T2 acabar — quem clica "Ajuda" com o site a carregar não leva
   uma tela vazia. */
(function () {
  'use strict';
  let secao = 'abrir';                 // aba escolhida — por sessão, não persiste

  function montar(raiz, params) {
    const h = Shell.h, T = Textos.t11, P = Textos.projeto;
    if (params && params.secao && T.abas.some(a => a[0] === params.secao)) secao = params.secao;

    const barraAbas = h('nav', { class: 'abas', id: 't11-abas', 'aria-label': T.titulo });
    const painel = h('div', { class: 'cartao', id: 't11-painel' });
    raiz.appendChild(h('section', { id: 't11' }, h('h1', {}, T.titulo), barraAbas, painel));

    function renderAbas() {
      Shell.limpar(barraAbas);
      for (const [nome, rotulo] of T.abas) {
        barraAbas.appendChild(h('button', { type: 'button', class: 'aba' + (nome === secao ? ' atual' : ''), 'data-aba': nome,
          onclick: function () { secao = nome; render(); } }, rotulo));
      }
    }
    const paragrafos = (lista) => lista.map(t => h('p', {}, t));
    const passos = (lista) => h('ol', { class: 'passos-ajuda' }, lista.map(t => h('li', {}, t)));

    function painelAbrir() {
      const A = T.abrir;
      painel.appendChild(h('h2', {}, A.titulo));
      painel.appendChild(h('p', {}, A.intro));
      painel.appendChild(h('h3', {}, A.tails));
      painel.appendChild(passos(A.tailsPassos));
      painel.appendChild(h('h3', {}, A.outros));
      painel.appendChild(passos(A.outrosPassos));
      painel.appendChild(h('p', { class: 'apoio' }, A.fecho));
    }
    function painelChave() {
      painel.appendChild(h('h2', {}, T.chave.titulo));
      for (const p of paragrafos(T.chave.paragrafos)) painel.appendChild(p);
    }
    function painelCopias() {
      const C = T.copias;
      painel.appendChild(h('h2', {}, C.titulo));
      painel.appendChild(h('p', {}, C.intro));
      painel.appendChild(h('ul', { class: 'lista-copias' }, C.itens.map(function (par) {
        return h('li', {}, h('strong', {}, par[0]), ' — ' + par[1]);
      })));
      painel.appendChild(h('p', { class: 'destaque' }, C.regra));
    }
    function painelRemover() {
      painel.appendChild(h('h2', {}, T.remover.titulo));
      for (const p of paragrafos(T.remover.paragrafos)) painel.appendChild(p);
    }
    // 30/37/40/32(c) — o que o dono precisa de saber sobre os blocos: a regra
    // da linha própria (a que mais dá erro), o que cada código faz, o que as
    // etiquetas custam quando mudam, e por que existe um "-mini" na biblioteca.
    function painelBlocos() {
      const B = T.blocos;
      painel.appendChild(h('h2', {}, B.titulo));
      painel.appendChild(h('p', {}, B.intro));
      painel.appendChild(h('p', { class: 'destaque' }, B.regra));
      painel.appendChild(h('ul', { class: 'lista-copias', id: 't11-blocos-exemplos' }, B.exemplos.map(function (par) {
        return h('li', {}, h('code', {}, par[0]), ' — ' + par[1]);
      })));
      painel.appendChild(h('h3', {}, B.etiquetasTitulo));
      for (const t of B.etiquetas) painel.appendChild(h('p', {}, t));
      painel.appendChild(h('h3', {}, B.custoTitulo));
      painel.appendChild(h('p', {}, B.custo));
      painel.appendChild(h('h3', {}, B.miniaturaTitulo));
      painel.appendChild(h('p', {}, B.miniatura));
      // 51 — o botão HTML mora na mesma barra e tem a mesma natureza: código
      // que o dono escreve e o app trata. Explicar aqui, ao lado dos outros.
      painel.appendChild(h('h3', {}, B.htmlTitulo));
      for (const t of B.html) painel.appendChild(h('p', {}, t));
    }
    // A1 de 03 §3.5. Enquanto os endereços do projeto não existirem, a tela
    // diz isso — em vez de mostrar um placeholder que parece endereço.
    function painelApoio() {
      const A = T.apoio;
      painel.appendChild(h('h2', {}, A.titulo));
      painel.appendChild(h('p', { id: 't11-lightning' }, P.lightning
        ? [A.lightningRotulo, ' ', h('code', {}, P.lightning)]
        : h('span', { class: 'apoio' }, A.semLightning)));
      painel.appendChild(h('p', { id: 't11-site-projeto' }, P.site
        ? [A.siteRotulo, ' ', h('a', { href: P.site, target: '_blank', rel: 'noopener noreferrer' }, P.site)]
        : h('span', { class: 'apoio' }, A.semSite)));
      for (const p of paragrafos(A.paragrafos)) painel.appendChild(p);
      // O contato do projeto vem depois de "conte o que quebrou": é por ali
      // que se conta. Endereço de fora, em aba nova, como o do repositório.
      if (P.contato) painel.appendChild(h('p', { id: 't11-contato' }, A.contatoRotulo + ' ',
        h('a', { href: P.contato, target: '_blank', rel: 'noopener noreferrer' }, A.contatoNome)));
    }
    function painelSobre() {
      const S = T.sobre;
      painel.appendChild(h('h2', {}, S.titulo));
      painel.appendChild(h('p', { id: 't11-versao' }, S.versaoRotulo + ' ', h('code', {}, window.APP_VERSION)));
      painel.appendChild(h('p', {}, S.licencaRotulo + ' ' + P.licenca));
      painel.appendChild(h('p', {}, S.codigoRotulo + ' ',
        h('a', { id: 't11-codigo', href: P.repositorio, target: '_blank', rel: 'noopener noreferrer' }, P.repositorio)));
      painel.appendChild(h('h3', {}, S.bibliotecasTitulo));
      painel.appendChild(h('ul', { id: 't11-bibliotecas' }, S.bibliotecas.map(function (b) {
        return h('li', {}, h('strong', {}, b[0]), ' ' + b[1] + ' (' + b[2] + ') — ' + b[3]);
      })));
      painel.appendChild(h('p', { class: 'apoio' }, S.bibliotecasApoio));
      painel.appendChild(h('p', { class: 'apoio' }, S.privacidade));
    }

    function render() {
      renderAbas();
      Shell.limpar(painel);
      if (secao === 'abrir') painelAbrir();
      else if (secao === 'chave') painelChave();
      else if (secao === 'copias') painelCopias();
      else if (secao === 'remover') painelRemover();
      else if (secao === 'blocos') painelBlocos();
      else if (secao === 'apoio') painelApoio();
      else painelSobre();
    }
    render();
  }

  Shell.registrar('t11', { montar: montar });
})();
