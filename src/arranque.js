/* arranque.js — o ÚLTIMO script do HTML. Confere que tudo carregou, regista
   as telas que ainda não existem como "ainda não implementado" (15 M1) e
   inverte o canário (14 T0): esconde o aviso, mostra T1. */
(function () {
  'use strict';
  const exigidos = {
    NT: function () { return NT; }, DOMPurify: function () { return DOMPurify; },
    marked: function () { return marked; }, Mustache: function () { return Mustache; },
    Textos: function () { return Textos; }, Chave: function () { return Chave; }, Shell: function () { return Shell; }
  };
  const faltam = Object.keys(exigidos).filter(function (n) {
    try { return typeof exigidos[n]() === 'undefined'; } catch (e) { return true; }
  });
  if (faltam.length) { window.__falhaDeArranque('faltam ' + faltam.join(', ')); return; }

  // T2 em M1: só diz quem entrou e que a leitura da rede vem no M2.
  Shell.registrar('t2', { montar: function (raiz) {
    const h = Shell.h, s = Shell.sessao();
    raiz.appendChild(h('section', { id: 't2' },
      h('h1', {}, Textos.t2.titulo),
      h('p', { class: 'alerta' }, Textos.t2.naoImplementado),
      h('p', {}, Textos.t2.entrouComo, h('code', { id: 'npub-completo' }, s.npub))));
  } });

  // Inverte o canário e SÓ DEPOIS monta T1: o foco inicial só pega com o
  // painel visível. Se a montagem lançar, __arrancou ainda é false e o
  // onerror de base.html devolve o aviso à tela.
  document.getElementById('semjs').style.display = 'none';
  document.getElementById('app').style.display = '';
  Shell.ir('t1');
  window.__arrancou = true;
})();
