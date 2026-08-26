// test/util.js — apoio comum às suítes: página com coletores de erro,
// varredura por nsec (02 §B.3 / 15 §5), um `it` que nunca derruba a suíte
// e, desde M2, helpers de sessão/banco/T2.
const fs = require('fs');

const RE_NSEC = /nsec1[023456789acdefghjklmnpqrstuvwxyz]{58}/;

async function novaPagina(ctx) {
  const pg = await ctx.newPage();
  const consoleErros = [], consoleTudo = [], consoleRede = [], erros = [];
  // O navegador regista falha de conexão WebSocket/fetch como erro de
  // console ("can't establish a connection", "net::ERR_…", "handshake");
  // não é exceção do app (isso seria pageerror) e é inevitável ao testar
  // relays mortos. Fica em `consoleRede`, fora de `consoleErros`.
  const RE_REDE = /WebSocket|establish a connection|connection to wss?:|was interrupted|net::ERR_|handshake|NetworkError|Failed to fetch|NS_ERROR|Cross-Origin Request Blocked|CORS policy|Failed to load resource/i;
  pg.on('console', (m) => {
    consoleTudo.push(m.type() + ': ' + m.text().slice(0, 300));
    if (m.type() === 'error') (RE_REDE.test(m.text()) ? consoleRede : consoleErros).push(m.text().slice(0, 300));
  });
  pg.on('pageerror', (e) => erros.push(String(e).slice(0, 300)));
  return { pg, consoleErros, consoleTudo, consoleRede, erros };
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
    if (bancos.some(n => n && ((nsec && n.includes(nsec)) || re.test(n)))) achados.push('IndexedDB: nome de banco');
    // desde M2: o CONTEÚDO de todo banco nostermentor/* também é varrido
    for (const n of bancos) {
      if (!n || !n.startsWith('nostermentor/')) continue;
      try {
        const db = await new Promise((res, rej) => { const r = indexedDB.open(n); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
        for (const store of Array.from(db.objectStoreNames)) {
          const tudo = await new Promise((res, rej) => { const r = db.transaction(store, 'readonly').objectStore(store).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
          const txt = JSON.stringify(tudo, (k, v) => (v instanceof Blob ? '<blob>' : v));
          if ((nsec && txt.includes(nsec)) || re.test(txt)) achados.push('IndexedDB ' + n + '/' + store);
        }
        db.close();
      } catch (e) { achados.push('IndexedDB ' + n + ' ilegível: ' + e.message); }
    }
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
    const t0 = Date.now();
    try { const d = await fn(); R.push({ nome, ok: true, detalhe: d == null ? '' : String(d), ms: Date.now() - t0 }); }
    catch (e) { R.push({ nome, ok: false, detalhe: String(e && e.message || e).slice(0, 500), ms: Date.now() - t0 }); }
  };
  const pulado = (nome, motivo) => R.push({ nome, ok: null, detalhe: 'PULADO: ' + motivo });
  return { R, it, pulado };
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'asserção falhou'); }

// --- M2 -----------------------------------------------------------------
async function entrarCom(pg, nsec) {
  await pg.fill('#nsec', nsec);
  await pg.click('#entrar-colar');
  await pg.waitForSelector('#moldura', { timeout: 10000 });
}

// Semeia o banco da identidade com relays/servidores (como T7 §Avançado
// fará): é o que aponta o app para o servidor falso sem gancho de teste no
// código do produto.
async function semearSite(pg, ch, cfg) {
  return pg.evaluate(async ([pubkey, npub, cfg]) => {
    const db = await Db.abrir(pubkey);
    const site = Modelo.sitePadrao(pubkey, npub);
    site.network.relays = cfg.relays; site.network.servers = cfg.servers;
    if (cfg.title) site.title = cfg.title;
    await db.put('site', site, 'site');
    if (cfg.extra) for (const op of cfg.extra) await db.escrever([op]);
    db.fechar();
    return db.nome;
  }, [ch.pubkey, ch.npub, cfg]);
}

// Espera T2 chegar a um desfecho: T3 montada, ou o bloco #desfecho visível.
async function esperarT2(pg, timeoutMs) {
  await pg.waitForFunction(() => {
    if (document.getElementById('t3')) return true;
    const d = document.getElementById('desfecho');
    return !!(d && !d.hidden);
  }, null, { timeout: timeoutMs || 60000 });
  return pg.evaluate(() => ({
    tela: Shell.telaAtual(),
    desfecho: (() => { const d = document.getElementById('desfecho'); return d && !d.hidden ? (d.firstElementChild && d.firstElementChild.id) : null; })(),
    passos: Array.from(document.querySelectorAll('#passos li')).map(li => ({ id: li.id, classe: li.className, estado: li.querySelector('.estado').textContent, detalhe: li.querySelector('.detalhe').textContent })),
    faixa: (() => { const f = document.getElementById('faixa'); return f && !f.hidden ? f.textContent : ''; })()
  }));
}

// Lê o banco de uma identidade (fora do app) — devolve dados planos.
async function lerBanco(pg, pubkey) {
  return pg.evaluate(async (pubkey) => {
    const db = await Db.abrir(pubkey);
    const r = { nome: db.nome, site: await db.get('site', 'site'), published: await db.get('published', 'current'),
      pages: await db.getAll('pages'), posts: await db.getAll('posts'), media: await db.getAll('media'), meta: await db.getAll('meta') };
    db.fechar();
    return JSON.parse(JSON.stringify(r, (k, v) => (v instanceof Blob ? '<blob>' : v)));
  }, pubkey);
}

module.exports = { novaPagina, abrir, varrer, nsecDeTeste, coletor, assert, RE_NSEC, entrarCom, semearSite, esperarT2, lerBanco };
