// ui/colecao.js — filtrar, buscar e paginar uma lista de mídia. Nasceu de três
// pedidos que eram o mesmo problema: a biblioteca sem paginação nem filtros
// (43/44), e os modais do editor a desenhar tudo de uma vez.
//
// A medição que decidiu o desenho (2026-08-31, `test/telas/escala.test.js`):
// com 300 arquivos a tela desenha em ~130 ms — VELOCIDADE não é o problema —,
// mas abre **300 `blob:` ao mesmo tempo**, e cada um segura os bytes inteiros
// na memória. Com fotos de câmera são gigabytes, e no Tails a biblioteca já
// vive na RAM da sessão (P38 de `08`). Paginar não é conforto: é o que faz o
// painel caber na máquina.
const Colecao = (function () {
  'use strict';

  const POR_PAGINA = 24;          // o mesmo do painel do WordPress
  function texto(m, mapa) { let s = String(m); for (const k of Object.keys(mapa || {})) s = s.split('{' + k + '}').join(String(mapa[k])); return s; }

  // Os grupos que o dono reconhece, não os que o MIME define. "Documentos"
  // junta PDF e texto porque para quem publica é a mesma gaveta.
  function tipoDe(mime) {
    const m = String(mime || '');
    if (m.indexOf('image/') === 0) return 'imagem';
    if (m.indexOf('video/') === 0) return 'video';
    if (m.indexOf('audio/') === 0) return 'audio';
    if (m === 'application/pdf' || m.indexOf('text/') === 0) return 'documento';
    return 'outro';
  }

  function combina(m, busca) {
    if (!busca) return true;
    const q = busca.trim().toLowerCase();
    if (!q) return true;
    return String(m.path || '').toLowerCase().indexOf(q) !== -1
      || String(m.alt || '').toLowerCase().indexOf(q) !== -1
      || String(m.caption || '').toLowerCase().indexOf(q) !== -1;
  }

  function filtrar(lista, o) {
    o = o || {};
    return (lista || []).filter(m => (!o.tipo || o.tipo === 'todos' || tipoDe(m.mime) === o.tipo) && combina(m, o.busca));
  }

  function contagens(lista) {
    const c = { todos: (lista || []).length };
    for (const m of lista || []) { const t = tipoDe(m.mime); c[t] = (c[t] || 0) + 1; }
    return c;
  }

  // A barra de filtros + busca. `o.aoMudar(estado)` recebe { tipo, busca }.
  // Só aparecem os tipos que EXISTEM: uma biblioteca só de imagens não precisa
  // de um botão "Vídeos (0)" para o dono aprender a ignorar.
  function barra(lista, estado, o) {
    const h = Shell.h, T = Textos.t6.colecao;
    const c = contagens(lista);
    const chips = h('div', { class: 'chips' });
    const ordem = ['todos', 'imagem', 'video', 'audio', 'documento', 'outro'];
    for (const t of ordem) {
      // O tipo ESCOLHIDO fica sempre à vista, mesmo que tenha ficado a zero
      // (o dono apagou o último vídeo): sem o chip, ele ficava numa lista
      // vazia sem forma de voltar.
      if (t !== 'todos' && !c[t] && estado.tipo !== t) continue;
      chips.appendChild(h('button', {
        type: 'button', class: 'chip' + (estado.tipo === t ? ' atual' : ''), 'data-tipo': t,
        onclick: function () { estado.tipo = t; estado.pagina = 1; o.aoMudar(); }
      }, T.tipos[t] + ' (' + (c[t] || 0) + ')'));
    }
    const campo = h('input', { type: 'search', class: 'busca', id: o.idBusca || null, placeholder: T.buscar, value: estado.busca || '' });
    // `input` e não `change`: filtrar enquanto se escreve é o que torna a busca
    // útil numa lista grande, e aqui não custa rede nenhuma.
    campo.addEventListener('input', function () { estado.busca = campo.value; estado.pagina = 1; o.aoMudar({ focoBusca: true }); });
    return h('div', { class: 'barra-colecao' }, chips, campo);
  }

  function paginas(total, porPagina) { return Math.max(1, Math.ceil(total / (porPagina || POR_PAGINA))); }

  function fatia(lista, estado, porPagina) {
    const n = porPagina || POR_PAGINA;
    const ult = paginas(lista.length, n);
    if (!estado.pagina || estado.pagina > ult) estado.pagina = ult >= 1 ? Math.min(estado.pagina || 1, ult) : 1;
    const i = (estado.pagina - 1) * n;
    return lista.slice(i, i + n);
  }

  // Páginas numeradas, com reticências quando são muitas: 1 … 4 [5] 6 … 13.
  // Sempre a primeira e a última, para o dono nunca ficar preso no meio.
  function numeros(atual, ultima) {
    const s = new Set([1, ultima, atual, atual - 1, atual + 1]);
    const lista = Array.from(s).filter(n => n >= 1 && n <= ultima).sort((a, b) => a - b);
    const saida = [];
    let anterior = 0;
    for (const n of lista) { if (anterior && n - anterior > 1) saida.push(null); saida.push(n); anterior = n; }
    return saida;
  }

  function paginacao(total, estado, o) {
    const h = Shell.h, T = Textos.t6.colecao;
    const n = (o && o.porPagina) || POR_PAGINA;
    const ultima = paginas(total, n);
    const primeiro = total === 0 ? 0 : (estado.pagina - 1) * n + 1;
    const derradeiro = Math.min(estado.pagina * n, total);
    const conta = h('span', { class: 'apoio conta' }, total === 0 ? T.nenhum : texto(T.intervalo, { a: primeiro, b: derradeiro, t: total }));
    if (ultima <= 1) return h('div', { class: 'paginacao' }, conta);
    const ir = (p) => { estado.pagina = p; o.aoMudar(); };
    const botoes = [h('button', { type: 'button', class: 'ligacao pag-antes', disabled: estado.pagina <= 1, onclick: function () { ir(estado.pagina - 1); } }, '‹')];
    for (const p of numeros(estado.pagina, ultima)) {
      if (p === null) { botoes.push(h('span', { class: 'apoio' }, '…')); continue; }
      botoes.push(h('button', { type: 'button', class: 'ligacao pag-num' + (p === estado.pagina ? ' atual' : ''), 'data-pagina': String(p), onclick: function () { ir(p); } }, String(p)));
    }
    botoes.push(h('button', { type: 'button', class: 'ligacao pag-depois', disabled: estado.pagina >= ultima, onclick: function () { ir(estado.pagina + 1); } }, '›'));
    return h('div', { class: 'paginacao' }, conta, h('div', { class: 'pags' }, botoes));
  }

  function novoEstado() { return { tipo: 'todos', busca: '', pagina: 1 }; }

  return Object.freeze({ POR_PAGINA, tipoDe, filtrar, contagens, barra, paginacao, fatia, paginas, novoEstado });
})();
