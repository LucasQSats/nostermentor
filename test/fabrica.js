// test/fabrica.js — chaves geradas por execução (P-8) e eventos ASSINADOS
// para os testes contra o servidor falso: manifest 15128 com as tags de
// 05 §1, kinds 0/10002/10063 (05 §3) e o site.json (13 §6.1). Usa o
// nostr-tools do scratchpad (devDependency), nunca o bundle do produto.
const { finalizeEvent, generateSecretKey, getPublicKey } = require('nostr-tools/pure');
const nip19 = require('nostr-tools/nip19');
const crypto = require('crypto');

function chave() {
  const sk = generateSecretKey(), pubkey = getPublicKey(sk);
  return { sk, pubkey, nsec: nip19.nsecEncode(sk), npub: nip19.npubEncode(pubkey) };
}
function sha256(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }
function agora() { return Math.floor(Date.now() / 1000); }

// { paths: {'/x.html': sha…}, servers, relays, title, description, created_at, client, skDe? }
function manifest(ch, o) {
  o = o || {};
  const tags = [];
  for (const p of Object.keys(o.paths || {})) tags.push(['path', p, o.paths[p]]);
  for (const s of o.servers || []) tags.push(['server', s]);
  for (const r of o.relays || []) tags.push(['relay', r]);
  tags.push(['client', o.client || 'nostermentor-teste']);
  if (o.title) tags.push(['title', o.title]);
  if (o.description) tags.push(['description', o.description]);
  return finalizeEvent({ kind: 15128, created_at: o.created_at || agora(), tags, content: '' }, o.skDe || ch.sk);
}
function perfil(ch, o) { return finalizeEvent({ kind: 0, created_at: (o && o.created_at) || agora(), tags: [], content: JSON.stringify({ name: (o && o.name) || 'Site de teste', about: (o && o.about) || 'sobre' }) }, ch.sk); }
// Cada relay é uma URL ou [URL, marcador] — `read`/`write` da NIP-65.
function relayList(ch, relays, o) {
  return finalizeEvent({ kind: 10002, created_at: (o && o.created_at) || agora(),
    tags: relays.map(r => Array.isArray(r) ? ['r'].concat(r) : ['r', r]), content: '' }, ch.sk);
}
function serverList(ch, servers) { return finalizeEvent({ kind: 10063, created_at: agora(), tags: servers.map(s => ['server', s]), content: '' }, ch.sk); }
function efemero(ch) { return finalizeEvent({ kind: 20169, created_at: agora(), tags: [], content: 'sonda' }, ch.sk); }

// --- mensagens privadas (NIP-17), desde 2026-09-12 -------------------------
// Montadas À MÃO, sem `nip17.wrapEvent`, por duas razões: (1) precisamos
// controlar a data do RUMOR e a do ENVELOPE em separado — é assim que se prova
// que a lista ordena pela do rumor; (2) precisamos forjar um selo com autor
// diferente do miolo, que a biblioteca nunca produziria.
const nip44 = require('nostr-tools/nip44');
const { getEventHash } = require('nostr-tools/pure');

function rumor(ch, o) {
  o = o || {};
  const r = { pubkey: ch.pubkey, created_at: o.created_at || agora(), kind: o.kind == null ? 14 : o.kind,
    tags: o.tags || [['p', o.para]], content: o.content == null ? 'olá' : o.content };
  r.id = getEventHash(r);
  return r;
}
function selo(rumorObj, skAutor, paraPubkey, o) {
  o = o || {};
  return finalizeEvent({ kind: 13, created_at: o.created_at || agora(),
    content: nip44.encrypt(JSON.stringify(rumorObj), nip44.getConversationKey(skAutor, paraPubkey)), tags: [] }, skAutor);
}
// `expiration` e a data do envelope entram aqui: reassinar um envelope PRONTO
// não funciona (a cifra deriva da chave que o assina — armadilha 2 da Etapa 0).
function envelope(seloObj, paraPubkey, o) {
  o = o || {};
  const sk = o.sk || generateSecretKey();          // a chave descartável do 1059
  const tags = [['p', paraPubkey]];
  if (o.expiration) tags.push(['expiration', String(o.expiration)]);
  return finalizeEvent({ kind: o.kind || 1059, created_at: o.created_at || agora(),
    content: nip44.encrypt(JSON.stringify(seloObj), nip44.getConversationKey(sk, paraPubkey)), tags: tags }, sk);
}
// A volta inteira, de quem escreve para quem recebe.
// o: { content, kind, created_at (do RUMOR), envelopeEm (data do 1059),
//      expiration, seloDe (chave que SELA — trocá-la forja o selo) }
function mensagem(deCh, paraPubkey, o) {
  o = o || {};
  const r = rumor(deCh, { para: paraPubkey, content: o.content, kind: o.kind, created_at: o.created_at, tags: o.tags });
  const sl = selo(r, (o.seloDe && o.seloDe.sk) || deCh.sk, paraPubkey, { created_at: o.seloEm });
  return { rumor: r, selo: sl, envelope: envelope(sl, paraPubkey, { created_at: o.envelopeEm, expiration: o.expiration, kind: o.envelopeKind }) };
}
function caixaDeEntrada(ch, relays, o) {
  o = o || {};
  return finalizeEvent({ kind: 10050, created_at: o.created_at || agora(), tags: (relays || []).map(r => ['relay', r]), content: '' }, ch.sk);
}
function mensagemAntiga(deCh, paraPubkey) {   // kind 4: o painel só CONTA
  return finalizeEvent({ kind: 4, created_at: agora(), tags: [['p', paraPubkey]], content: 'xx?iv=yy' }, deCh.sk);
}

// site.json v1 de exemplo: 2 páginas, 3 artigos, 1 mídia — ids fixos para
// que dois manifests "da mesma origem" partilhem ids (mesclagem por id).
function siteExemplo(ch, o) {
  o = o || {};
  const dados = {
    format: 'nostermentor-site', version: o.version || 1,
    site: Object.assign({ title: 'Site de Teste', description: 'Descrição de teste (' + ch.npub.slice(5, 13) + ')', language: 'pt-BR', home: { mode: 'page', page_id: 'p-home', latest_posts: 3 },
      menu: [{ type: 'page', page_id: 'p-home' }, { type: 'page', page_id: 'p-sobre' }, { type: 'blog' }], donations: { lightning_address: 'x@y.z', support_block: true, footer_credit: true },
      privacy: { show_publish_time: false }, network: { relays: o.relays || [], servers: o.servers || [] } }, o.site || {}),
    pages: [
      { id: 'p-home', slug: 'inicio', aliases: [], title: o.tituloHome || 'Início', description: '', body: '# Olá', body_format: 'markdown', in_menu: true },
      { id: 'p-sobre', slug: 'sobre', aliases: ['quem-somos'], title: 'Sobre', description: 'sobre nós', body: 'texto', body_format: 'markdown', in_menu: true }
    ],
    posts: [
      { id: 'a-1', slug: 'primeiro', aliases: [], title: 'Primeiro artigo', description: '', body: 'um', body_format: 'markdown', date: '2026-08-01T00:00:00Z', excerpt: 'e1', tags: ['Nostr'], cover_media_id: 'm-1' },
      { id: 'a-2', slug: 'segundo', aliases: [], title: 'Segundo artigo', description: '', body: 'dois', body_format: 'markdown', date: '2026-08-10T00:00:00Z', excerpt: '', tags: [], cover_media_id: null },
      { id: 'a-3', slug: 'terceiro', aliases: [], title: 'Terceiro artigo', description: '', body: 'três', body_format: 'markdown', date: '2026-08-20T00:00:00Z', excerpt: '', tags: [], cover_media_id: null }
    ],
    media: [{ id: 'm-1', path: '/img/capa.png', mime: 'image/png', size: 4, sha256: o.shaCapa || sha256('png!'), width: 1, height: 1, alt: 'capa', caption: '' }],
    theme: { id: 'padrao', version: 1, options: {} }
  };
  if (o.mutar) o.mutar(dados);
  const texto = JSON.stringify(dados);
  const bytes = Buffer.from(texto, 'utf8');
  return { dados, texto, bytes, sha256: sha256(bytes) };
}

// Caminhos que o gerador produziria para o siteExemplo (13 §5.1) + site.json
function pathsDoExemplo(sj, shaHtml) {
  const h = shaHtml || sha256('<html>');
  return { '/index.html': h, '/inicio.html': h, '/sobre.html': h, '/quem-somos.html': h, '/blog/index.html': h, '/blog/primeiro.html': h, '/blog/segundo.html': h, '/blog/terceiro.html': h,
    '/img/capa.png': sj.dados.media[0].sha256, '/tema/estilo.css': sha256('css'), '/nostermentor/site.json': sj.sha256 };
}

module.exports = { rumor, selo, envelope, mensagem, caixaDeEntrada, mensagemAntiga, chave, sha256, agora, manifest, perfil, relayList, serverList, efemero, siteExemplo, pathsDoExemplo };
