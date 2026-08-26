/* ui/t4_paginas.js — T4 Páginas (14 T4): a lista de Listas com tipo 'page';
   {novo} / {editar: id} abrem o Editor dentro da mesma tela. */
Shell.registrar('t4', {
  montar: function (raiz, params) { Listas.montar(raiz, { tipo: 'page', params: params }); },
  desmontar: function () { Listas.desmontar(); }
});
