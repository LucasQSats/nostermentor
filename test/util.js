// test/util.js — apoio comum às suítes: página com coletores de erro,
// varredura por nsec (02 §B.3 / 15 §5) e um `it` que nunca derruba a suíte.
const fs = require('fs');

const RE_NSEC = /nsec1[023456789acdefghjklmnpqrstuvwxyz]{58}/;

async function novaPagina(ctx) {
  const pg = await ctx.newPage();
  const consoleErros = [], consoleTudo = [], erros = [];
  pg.on('console', (m) => {
    consoleTudo.push(m.type() + ': ' + m.text().slice(0, 300));
    if (m.type() === 'error') consoleErros.push(m.text().slice(0, 300));
  });
  pg.on('pageerror', (e) => erros.push(String(e).slice(0, 300)));
  return { pg, consoleErros, consoleTudo, erros };
}

async function abrir(ctx, url) {
  const p = await novaPagina(ctx);
  await p.pg.goto(url);
  await p.pg.waitForFunction(() => window.__arrancou === true, null, { timeout: 30000 });
  return p;
}

// Varre tudo o que o aceite 3 de 15 M1 exige: localStorage, sessionStorage,
// IndexedDB (nomes), DOM (outerHTML e valores de input), URL e título.
// `nsec` = a chave concreta usada no caso; além dela, procura QUALQUER nsec.
async function varrer(pg, nsec) {
  return pg.evaluate(async ([nsec, reFonte]) => {
    const re = new RegExp(reFonte);
    const achados = [];
    const html = document.documentElement.outerHTML;
    if (nsec && html.includes(nsec)) achados.push('DOM: a nsec do caso está no outerHTML');
    if (re.test(html)) achados.push('DOM: há uma nsec (qualquer) no outerHTML');
    for (const i of document.querySelectorAll('input,textarea')) {
      const v = i.value || '';
      if ((nsec && v.includes(nsec)) || re.test(v)) achados.push('input.value #' + (i.id || i.name || '?'));
    }
    if ((nsec && location.href.includes(nsec)) || re.test(location.href)) achados.push('URL');
    if ((nsec && document.title.includes(nsec)) || re.test(document.title)) achados.push('título');
    for (const [nome, st] of [['localStorage', window.localStorage], ['sessionStorage', window.sessionStorage]]) {
      try {
        for (let k = 0; k < st.length; k++) {
          const key = st.key(k), val = st.getItem(key) || '';
          if ((nsec && (val.includes(nsec) || key.includes(nsec))) || re.test(val) || re.test(key)) achados.push(nome + ': ' + key);
        }
      } catch (e) { achados.push(nome + ' inacessível: ' + e.message); }
    }
    let bancos = [];
    try { bancos = (await indexedDB.databases()).map(d => d.name); } catch (e) { bancos = ['indexedDB.databases() indisponível: ' + e.message]; }
    if (bancos.some(n => n && (n.includes(nsec) || re.test(n)))) achados.push('IndexedDB: nome de banco');
    let cookie = '';
    try { cookie = document.cookie; } catch (e) {}
    if (cookie && ((nsec && cookie.includes(nsec)) || re.test(cookie))) achados.push('cookie');
    return { achados, bancos, comprimentoHtml: html.length };
  }, [nsec || '', RE_NSEC.source]);
}

function nsecDeTeste() {
  const p = process.env.NOSTERMENTOR_NSEC_TESTE_ARQUIVO;
  if (!p || !fs.existsSync(p)) return null;
  const linha = fs.readFileSync(p, 'utf8').split(/\r?\n/).map(s => s.trim()).find(s => /^nsec1/.test(s));
  return linha || null;
}

function coletor() {
  const R = [];
  const it = async (nome, fn) => {
    try { const d = await fn(); R.push({ nome, ok: true, detalhe: d == null ? '' : String(d) }); }
    catch (e) { R.push({ nome, ok: false, detalhe: String(e && e.message || e).slice(0, 400) }); }
  };
  const pulado = (nome, motivo) => R.push({ nome, ok: null, detalhe: 'PULADO: ' + motivo });
  return { R, it, pulado };
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'asserção falhou'); }

module.exports = { novaPagina, abrir, varrer, nsecDeTeste, coletor, assert, RE_NSEC };
