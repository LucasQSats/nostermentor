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

  // --- a memória de opções por tema (decisão dele, 2026-09-05) --------------
  // Trocar de tema zera `site.theme.options` — as opções são do tema, não do
  // site (TEMAS.md §3). Isso fazia perder os ajustes só por espiar outro tema.
  // Passa a haver uma GAVETA: ao sair de um tema guarda-se o que ele tinha; ao
  // voltar, devolve-se.
  //
  // ⚠️ Onde vive, e porquê: em `site.theme_memory`, que é campo LOCAL do
  // registo `site` — **nunca sai no `site.json` publicado** (13 §5.2 lista o
  // que a rede recebe, e isto não está lá). Guardar na rede os ajustes de
  // temas que o dono NÃO usa seria publicar dado inútil e alargar a superfície
  // à toa. Vai no BACKUP (decisão dele: "no backup, junto com o site"), que é
  // o que faz a memória sobreviver ao Tails desligar e viajar para outra
  // máquina.
  const MAX_TEMAS_LEMBRADOS = 20;

  // → { <id do tema>: { <opção>: valor } }, já pela lista branca
  function memoriaDe(site) {
    const m = site && site.theme_memory;
    if (!m || typeof m !== 'object') return {};
    const saida = {};
    for (const id of Object.keys(m).sort().slice(0, MAX_TEMAS_LEMBRADOS)) {
      if (!RE_ID.test(id)) continue;
      const o = SiteJson.lerOpcoesTema(m[id]);
      if (Object.keys(o).length) saida[id] = o;
    }
    return saida;
  }

  // A troca de tema, num sítio só: guarda o que o tema que sai tinha, devolve
  // o que o tema que entra tinha da última vez. Devolve o `theme` novo e a
  // gaveta nova — quem grava é a tela.
  // ⚠️ Guarda-se pelo id do tema que ESTÁ no `site`, mesmo que este app não o
  // conheça: um dia o tema volta a existir e os ajustes ainda lá estão.
  function trocar(site, tema) {
    const antigo = idDe(site);
    const novo = tema.manifesto.id;
    const memoria = memoriaDe(site);
    if (antigo !== novo) {
      const opcoes = SiteJson.lerOpcoesTema(site && site.theme && site.theme.options);
      if (Object.keys(opcoes).length) memoria[antigo] = opcoes;
      else delete memoria[antigo];
    }
    // Ficar no mesmo tema não mexe em nada — nem na versão gravada, que é a do
    // tema com que o site foi publicado.
    if (antigo === novo) return { theme: site.theme, theme_memory: memoria, lembrou: false };
    const guardadas = memoria[novo] || {};
    delete memoria[novo];              // saiu da gaveta: está em uso outra vez
    return { theme: { id: novo, version: tema.manifesto.version, options: guardadas },
      theme_memory: memoria, lembrou: Object.keys(guardadas).length > 0 };
  }

  return Object.freeze({ registar, porId, padrao, todos, idDe, de, conhecido, resolver, memoriaDe, trocar, MAX_TEMAS_LEMBRADOS });
})();
