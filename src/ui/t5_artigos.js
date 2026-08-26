/* ui/t5_artigos.js — T5 Artigos (14 T5): a lista de Listas com tipo 'post'
   (coluna Data e Etiquetas, ordem por data decrescente); {novo} / {editar}
   abrem o Editor dentro da mesma tela. */
Shell.registrar('t5', {
  montar: function (raiz, params) { Listas.montar(raiz, { tipo: 'post', params: params }); },
  desmontar: function () { Listas.desmontar(); }
});
