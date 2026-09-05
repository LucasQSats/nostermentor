/* core/temas.js — o REGISTO de temas (12; TEMAS.md §3 e §11). É a única
   porta entre o core e os temas: cada arquivo `src/tema/<id>/tema.js`
   regista-se ao carregar (o core carrega antes dos temas — 15 §2), e o
   gerador escolhe pelo `site.theme.id` (13 §3). Id desconhecido cai no
   Padrão — um site cujo tema não vem com esta versão do app continua a
   publicar, com o tema que existe, e a aba Aparência diz isso de frente.
   `resolver` é o validador genérico de opções que os temas usam (TEMAS.md §6):
   compara cada valor com o manifesto e descarta o que não bate. Continua a
   ser o TEMA que o chama e que o exporta — o core não conhece nome nenhum. */
const Temas = (function () {
  'use strict';
  const lista = [];
  const RE_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  const RE_COR = /^#[0-9a-fA-F]{6}$/;

  function registar(tema) {
    const m = tema && tema.manifesto;
    if (!m || typeof m.id !== 'string' || !RE_ID.test(m.id)) throw new Error('tema sem id válido');
    if (!tema.templates || typeof tema.css !== 'function' || typeof tema.resolver !== 'function') throw new Error('tema incompleto: ' + m.id);
    if (porId(m.id)) return;
    lista.push(tema);
  }
  function porId(id) { for (const t of lista) if (t.manifesto.id === id) return t; return null; }
  function padrao() { return porId('padrao') || lista[0] || null; }
  // Padrão primeiro; os outros por id (ordem estável, sem locale).
  function todos() { return lista.slice().sort((a, b) => (a.manifesto.id === 'padrao' ? -1 : b.manifesto.id === 'padrao' ? 1 : a.manifesto.id < b.manifesto.id ? -1 : a.manifesto.id > b.manifesto.id ? 1 : 0)); }
  function idDe(site) { const t = site && site.theme; return t && typeof t.id === 'string' ? t.id : 'padrao'; }
  function de(site) { return porId(idDe(site)) || padrao(); }
  function conhecido(site) { return !!porId(idDe(site)); }

  // valor seguro de UMA opção, pelo manifesto (TEMAS.md §6)
  function valor(o, bruto) {
    if (!o) return null;
    if (o.tipo === 'escolha') return o.opcoes.some(x => x[0] === bruto) ? bruto : o.padrao;
    if (o.tipo === 'cor') return (typeof bruto === 'string' && RE_COR.test(bruto)) ? bruto.toLowerCase() : o.padrao;
    if (o.tipo === 'medida') {
      const n = typeof bruto === 'number' ? bruto : parseInt(bruto, 10);
      return (Number.isInteger(n) && n >= o.min && n <= o.max) ? n : o.padrao;
    }
    return o.padrao;
  }
  // → { nome: valor } com TODAS as opções do manifesto resolvidas
  function resolver(options, opcoes) {
    const o = opcoes && typeof opcoes === 'object' ? opcoes : {};
    const saida = {};
    for (const nome of Object.keys(options || {})) saida[nome] = valor(options[nome], o[nome]);
    return saida;
  }

  return Object.freeze({ registar, porId, padrao, todos, idDe, de, conhecido, resolver });
})();
