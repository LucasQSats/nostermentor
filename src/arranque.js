/* arranque.js — o ÚLTIMO script do HTML. Confere que tudo carregou, deixa as
   telas que ainda não existem como "ainda não implementado" (stub do Shell)
   e inverte o canário (14 T0): esconde o aviso, mostra T1. */
(function () {
  'use strict';
  const exigidos = {
    NT: function () { return NT; }, DOMPurify: function () { return DOMPurify; },
    marked: function () { return marked; }, Mustache: function () { return Mustache; },
    Textos: function () { return Textos; }, Chave: function () { return Chave; }, Modelo: function () { return Modelo; },
    Relay: function () { return Relay; }, Blossom: function () { return Blossom; }, Db: function () { return Db; },
    SiteJson: function () { return SiteJson; }, Saude: function () { return Saude; }, Rede: function () { return Rede; },
    TemaPadrao: function () { return TemaPadrao; }, Gerador: function () { return Gerador; }, Backup: function () { return Backup; },
    Limpeza: function () { return Limpeza; }, Shell: function () { return Shell; }, Listas: function () { return Listas; }, Editor: function () { return Editor; }
  };
  const faltam = Object.keys(exigidos).filter(function (n) {
    try { return typeof exigidos[n]() === 'undefined'; } catch (e) { return true; }
  });
  if (faltam.length) { window.__falhaDeArranque('faltam ' + faltam.join(', ')); return; }
  if (typeof indexedDB === 'undefined' || !window.crypto || !crypto.subtle || typeof WebSocket === 'undefined') {
    window.__falhaDeArranque('este navegador não tem IndexedDB, crypto.subtle ou WebSocket');
    return;
  }

  // Inverte o canário e SÓ DEPOIS monta T1: o foco inicial só pega com o
  // painel visível. Se a montagem lançar, __arrancou ainda é false e o
  // onerror de base.html devolve o aviso à tela.
  document.getElementById('semjs').style.display = 'none';
  document.getElementById('app').style.display = '';
  Shell.ir('t1');
  window.__arrancou = true;
})();
