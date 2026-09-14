/* core/db.js — IndexedDB `nostermentor/<pubkey-hex>` (13 §2): um banco por
   identidade, versão de schema inteira com migrações encadeadas v(n)→v(n+1),
   e a regra anti-downgrade (o app nunca abre banco de versão maior que a
   sua — 13 §7.4). É CACHE de sessão, não banco (D17): nada aqui conta como
   salvo. A nsec nunca entra em nenhum store. Sem DOM. */
const Db = (function () {
  'use strict';

  const PREFIXO = 'nostermentor/';
  const STORES = Object.freeze(['site', 'pages', 'posts', 'media', 'published', 'meta', 'messages', 'peers']);

  // v0 → v1 (13 §2). `site` e `published` são singletons com chave fora do
  // registro ("site" / "current"); os demais usam `id` (ou `key` no meta).
  const MIGRACOES = {
    1: function (db) {
      db.createObjectStore('site');
      const pages = db.createObjectStore('pages', { keyPath: 'id' });
      pages.createIndex('slug', 'slug', { unique: true });
      const posts = db.createObjectStore('posts', { keyPath: 'id' });
      posts.createIndex('slug', 'slug', { unique: true });
      posts.createIndex('date', 'date');
      const media = db.createObjectStore('media', { keyPath: 'id' });
      media.createIndex('path', 'path', { unique: true });
      media.createIndex('sha256', 'sha256');
      db.createObjectStore('published');
      db.createObjectStore('meta', { keyPath: 'key' });
    },
    // v1 → v2 (2026-09-12, Contatos): as mensagens privadas.
    // Ele escolheu guardá-las "sem arquivo extra": ficam aqui e NÃO viajam no
    // backup do site (é o arquivo que ele compartilha, e conversa de outra pessoa
    // não viaja nele — 13 §7). Consequência dita na tela: num Tails o banco
    // morre com a sessão e tudo recomeça; num Windows ou Linux fica.
    // ⚠️ Nenhum campo `lido`: o lido/não lido foi tirado por ele em 2026-09-12,
    // depois de ver que no Tails esse estado morre e passaria a mentir.
    2: function (db) {
      // chave = o id do RUMOR, recalculado por Mensagens.idDoRumor — o que vem
      // no rumor não é assinado e serviria para sobrescrever a mensagem alheia
      const messages = db.createObjectStore('messages', { keyPath: 'id' });
      messages.createIndex('peer', 'peer');
      messages.createIndex('created_at', 'created_at');   // a data do rumor, sempre
      // uma linha por pessoa: apelido, arquivado e bloqueado são LOCAIS
      db.createObjectStore('peers', { keyPath: 'pubkey' });
    }
  };

  function nome(pubkey) { return PREFIXO + pubkey; }

  function pedido(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('falha no IndexedDB')); };
    });
  }

  function erroAbrir(e) {
    const err = new Error(Textos.db.erro.replace('{e}', e && e.message ? e.message : String(e && e.name || e)));
    err.causa = e;
    return err;
  }

  function handle(db, nomeBanco, criado) {
    let aberto = true;
    function tx(stores, modo) { return db.transaction(stores, modo); }
    function get(store, chave) { return pedido(tx(store, 'readonly').objectStore(store).get(chave)); }
    function getAll(store) { return pedido(tx(store, 'readonly').objectStore(store).getAll()); }
    function count(store) { return pedido(tx(store, 'readonly').objectStore(store).count()); }
    function porIndice(store, indice, valor) { return pedido(tx(store, 'readonly').objectStore(store).index(indice).getAll(valor)); }

    // Várias operações numa transação só: ou entra tudo, ou nada.
    // ops: [{ op: 'put', store, valor, chave? } | { op: 'del', store, chave } | { op: 'clear', store }]
    function escrever(ops) {
      return new Promise(function (resolve, reject) {
        const stores = Array.from(new Set(ops.map(o => o.store)));
        if (!stores.length) return resolve(0);
        let t;
        try { t = tx(stores, 'readwrite'); } catch (e) { return reject(e); }
        t.oncomplete = function () { resolve(ops.length); };
        t.onerror = function () { reject(t.error || new Error('falha ao gravar')); };
        t.onabort = function () { reject(t.error || new Error('gravação abortada')); };
        try {
          for (const o of ops) {
            const s = t.objectStore(o.store);
            if (o.op === 'put') { if (o.chave !== undefined) s.put(o.valor, o.chave); else s.put(o.valor); }
            else if (o.op === 'del') s.delete(o.chave);
            else if (o.op === 'clear') s.clear();
            else throw new Error('operação desconhecida: ' + o.op);
          }
        } catch (e) { try { t.abort(); } catch (e2) {} reject(e); }
      });
    }
    function put(store, valor, chave) { return escrever([{ op: 'put', store: store, valor: valor, chave: chave }]); }
    function del(store, chave) { return escrever([{ op: 'del', store: store, chave: chave }]); }
    function getMeta(key) { return get('meta', key).then(r => (r ? r.value : undefined)); }
    // Soma n (padrão 1) a um contador do meta numa transação só (14 §2: "N não exportadas")
    function incrementar(key, n) {
      return new Promise(function (resolve, reject) {
        let t;
        try { t = tx('meta', 'readwrite'); } catch (e) { return reject(e); }
        const s = t.objectStore('meta');
        let valor = 0;
        const g = s.get(key);
        g.onsuccess = function () { valor = (g.result && typeof g.result.value === 'number' ? g.result.value : 0) + (typeof n === 'number' ? n : 1); s.put({ key: key, value: valor }); };
        t.oncomplete = function () { resolve(valor); };
        t.onerror = function () { reject(t.error || new Error('falha ao gravar')); };
        t.onabort = function () { reject(t.error || new Error('gravação abortada')); };
      });
    }
    function setMeta(key, value) { return put('meta', { key: key, value: value }); }
    function limparTudo() { return escrever(STORES.map(s => ({ op: 'clear', store: s }))); }
    // 61 — o que "substituir pelo backup" pode apagar: tudo o que o backup traz.
    // ⚠️ As MENSAGENS ficam de fora, e é decisão: elas não viajam no backup
    // (13 §2.1), logo não há nada no arquivo para as substituir — apagá-las
    // seria perder conversas de outras pessoas sem nada que as reponha, e em silêncio.
    // Quem quer apagar tudo mesmo usa `limparTudo`.
    function limparConteudo() { return escrever(STORES.filter(s => s !== 'messages' && s !== 'peers').map(s => ({ op: 'clear', store: s }))); }
    function fechar() { if (aberto) { aberto = false; try { db.close(); } catch (e) {} } }

    return Object.freeze({ nome: nomeBanco, criado: criado, get, getAll, count, porIndice, escrever, put, del, getMeta, setMeta, incrementar, limparTudo, limparConteudo, fechar, estaAberto: () => aberto });
  }

  function abrir(pubkey) {
    if (typeof pubkey !== 'string' || !/^[0-9a-f]{64}$/.test(pubkey)) return Promise.reject(new Error('pubkey inválida'));
    const nomeBanco = nome(pubkey), versao = Modelo.SCHEMA_VERSION;
    return new Promise(function (resolve, reject) {
      let req;
      try { req = indexedDB.open(nomeBanco, versao); } catch (e) { return reject(erroAbrir(e)); }
      let criado = false;
      req.onupgradeneeded = function (ev) {
        criado = ev.oldVersion === 0;
        for (let v = ev.oldVersion + 1; v <= versao; v++) {
          if (!MIGRACOES[v]) throw new Error('sem migração para a versão ' + v);
          MIGRACOES[v](req.result, req.transaction);
        }
      };
      req.onerror = function () {
        const e = req.error;
        if (e && e.name === 'VersionError') { const err = new Error(Textos.db.maisNovo); err.codigo = 'mais_novo'; return reject(err); }
        reject(erroAbrir(e));
      };
      req.onsuccess = function () {
        const db = req.result;
        db.onversionchange = function () { try { db.close(); } catch (e) {} };
        const h = handle(db, nomeBanco, criado);
        h.escrever([
          { op: 'put', store: 'meta', valor: { key: 'schema_version', value: versao } },
          { op: 'put', store: 'meta', valor: { key: 'app_version', value: window.APP_VERSION } }
        ]).then(function () { resolve(h); }, reject);
      };
    });
  }

  function apagar(pubkey) {
    return new Promise(function (resolve, reject) {
      const req = indexedDB.deleteDatabase(nome(pubkey));
      req.onsuccess = function () { resolve(true); };
      req.onerror = function () { reject(req.error); };
      req.onblocked = function () { /* alguém segura o banco; o onsuccess vem quando soltar */ };
    });
  }

  return Object.freeze({ PREFIXO, STORES, nome, abrir, apagar });
})();
