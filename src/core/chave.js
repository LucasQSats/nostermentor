/* core/chave.js — nsec ↔ pubkey/npub, gerar chave, assinar. Sem DOM.
   Depende só de NT (nostr-tools 2.25.0 inline: `pure` + `nip19`).
   Fonte consultada em 2026-08-26 (lib/types/nip19.d.ts, pure.d.ts e teste
   em Node): `nip19.decode()` LANÇA em qualquer entrada inválida (TypeError
   ou Error) e devolve `{type, data}` — `data` é Uint8Array(32) para 'nsec'
   e hex para 'npub'; bech32 aceita maiúsculas. `generateSecretKey()` →
   Uint8Array(32); `getPublicKey(sk)` → hex; `finalizeEvent(modelo, sk)`.
   Regras: 02 §B — a chave vive só em memória; este módulo nunca grava,
   nunca loga e nunca põe a nsec em nenhum objeto que vá ao DOM. */
const Chave = (function () {
  'use strict';

  // charset bech32 (BIP-173): sem 1, b, i, o
  const RE_NSEC = /^nsec1[023456789acdefghjklmnpqrstuvwxyz]{58}$/i;

  function validarNsec(texto) {
    const s = String(texto == null ? '' : texto).trim();
    if (!s) return { ok: false, motivo: Textos.t1.erroNaoNsec };
    let dec;
    try { dec = NT.nip19.decode(s); } catch (e) { return { ok: false, motivo: Textos.t1.erroNaoNsec }; }
    if (!dec || dec.type !== 'nsec' || !(dec.data instanceof Uint8Array) || dec.data.length !== 32) {
      return { ok: false, motivo: Textos.t1.erroNaoNsec };
    }
    const sk = dec.data;
    const pubkey = NT.getPublicKey(sk);
    return { ok: true, sk: sk, pubkey: pubkey, npub: NT.nip19.npubEncode(pubkey) };
  }

  // Primeira linha (aparada) que comece por nsec1; devolve só o primeiro
  // token da linha (14 T1: "procura a primeira linha que comece por nsec1").
  function extrairDeTexto(conteudo) {
    const linhas = String(conteudo == null ? '' : conteudo).split(/\r\n|\r|\n/);
    for (let i = 0; i < linhas.length; i++) {
      const l = linhas[i].trim();
      if (/^nsec1/i.test(l)) return l.split(/\s+/)[0];
    }
    return null;
  }

  function gerar() {
    const sk = NT.generateSecretKey();
    const pubkey = NT.getPublicKey(sk);
    return { sk: sk, pubkey: pubkey, npub: NT.nip19.npubEncode(pubkey), nsec: NT.nip19.nsecEncode(sk) };
  }

  // Decisão técnica (M1): "npub8" = os 8 caracteres DEPOIS do prefixo
  // `npub1` — os 5 primeiros são iguais em toda chave e não distinguem nada.
  // Vale para `chave-<npub8>.txt` (14 T1) e para o nome do backup (13 §7.1).
  function npub8(npub) { return String(npub).slice(5, 13); }

  // "npub1abcd…wxyz" (14 §2)
  function abreviar(npub) { const s = String(npub); return s.slice(0, 9) + '…' + s.slice(-4); }

  function nomeArquivoChave(npub) { return 'chave-' + npub8(npub) + '.txt'; }

  // Conteúdo do arquivo entregue por <a download>: a nsec na PRIMEIRA linha
  // (é o que `extrairDeTexto` procura), a npub na segunda, e o aviso.
  function arquivoDaChave(ch) {
    return [
      ch.nsec,
      ch.npub,
      '',
      'Chave do seu site no Nostermentor.',
      'A primeira linha é a chave privada (nsec): quem a tem é o dono do site; não existe recuperação.',
      'A segunda linha é o endereço público do site (npub).',
      'Guarde este arquivo no KeePassXC ou no Persistent Storage e escolha-o na tela de entrada.',
      ''
    ].join('\n');
  }

  function assinar(modelo, sk) { return NT.finalizeEvent(modelo, sk); }
  // Evento vindo da rede é DADO (02 G.0): reconstrói-se um objeto novo só com
  // os 7 campos do NIP-01 antes de verificar. Motivo medido em 2026-08-26:
  // o nostr-tools guarda o resultado da verificação numa propriedade-símbolo
  // do próprio objeto, e `Object.assign`/spread COPIAM esse símbolo — um
  // clone adulterado de um evento já verificado passaria como válido.
  function verificar(evento) {
    if (!evento || typeof evento !== 'object') return false;
    const limpo = {
      id: evento.id, pubkey: evento.pubkey, created_at: evento.created_at,
      kind: evento.kind, tags: evento.tags, content: evento.content, sig: evento.sig
    };
    try { return NT.verifyEvent(limpo) === true; } catch (e) { return false; }
  }

  // Higiene: zera os bytes da chave quando ela deixa de ser necessária.
  function apagar(sk) { if (sk && typeof sk.fill === 'function') sk.fill(0); }

  return Object.freeze({
    RE_NSEC: RE_NSEC,
    validarNsec: validarNsec,
    extrairDeTexto: extrairDeTexto,
    gerar: gerar,
    npub8: npub8,
    abreviar: abreviar,
    nomeArquivoChave: nomeArquivoChave,
    arquivoDaChave: arquivoDaChave,
    assinar: assinar,
    verificar: verificar,
    apagar: apagar
  });
})();
