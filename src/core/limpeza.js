/* core/limpeza.js — higiene de metadados (13 §4.5, D15 de 04): remove
   EXIF/XMP/IPTC/COM e afins de JPEG, PNG e WebP SEM reencodar — só descarta
   segmentos/chunks; os dados de imagem e o perfil ICC ficam byte a byte
   iguais. É o protótipo validado em E2 (2026-08-25: exiftool 13–20 → 0 tags,
   ICC e pixel idênticos, saída Firefox == Chrome == Node), promovido a
   módulo sem alteração de lógica. Entrada: Uint8Array. Saída: { bytes,
   formato, removidos, mantidos, avisos }. Lança Error se o arquivo não for
   parseável — o chamador (T6a, M4) cai no fallback ou avisa. Sem DOM. */
const Limpeza = (function () {
  'use strict';
  const ASCII = (u8, i, n) => String.fromCharCode.apply(null, u8.subarray(i, i + n));
  /* ---------- JPEG ------------------------------------------------------ */
  // Segmentos removidos: APP1 (EXIF e XMP, inclusive XMP estendido), APP13
  // (Photoshop IRB / IPTC), COM. APP2 só fica se for ICC_PROFILE (o outro uso
  // comum de APP2 é o MPF, um índice de imagens extras que apontaria para o
  // trailer removido). Tudo depois do EOI (trailer) é descartado — é ali que
  // vivem "motion photos" e trailers de fabricante.
  function limparJPEG(u8) {
    if (u8.length < 4 || u8[0] !== 0xFF || u8[1] !== 0xD8) throw new Error('JPEG: sem SOI');
    const partes = [u8.subarray(0, 2)], removidos = [], mantidos = ['SOI'], avisos = [];
    let p = 2;
    while (p < u8.length) {
      if (u8[p] !== 0xFF) throw new Error('JPEG: marcador esperado em ' + p);
      while (u8[p] === 0xFF) p++;            // padding de 0xFF é permitido
      const m = u8[p]; p++;
      if (m === 0xD9) { partes.push(new Uint8Array([0xFF, 0xD9])); mantidos.push('EOI'); if (p < u8.length) { removidos.push('trailer após EOI (' + (u8.length - p) + ' B)'); } p = u8.length; break; }
      if (m === 0xDA) {                       // SOS: daqui até o fim vai tudo verbatim (dados entropia + eventuais DHT/SOS de progressivo + EOI)
        const resto = u8.subarray(p - 2);
        // procurar o EOI final para cortar trailer: último 0xFFD9
        let fim = resto.length;
        for (let i = resto.length - 2; i >= 0; i--) { if (resto[i] === 0xFF && resto[i + 1] === 0xD9) { fim = i + 2; break; } }
        if (fim < resto.length) removidos.push('trailer após EOI (' + (resto.length - fim) + ' B)');
        partes.push(resto.subarray(0, fim)); mantidos.push('SOS…EOI (dados de imagem, ' + fim + ' B)');
        p = u8.length; break;
      }
      if (m >= 0xD0 && m <= 0xD7 || m === 0x01) { partes.push(new Uint8Array([0xFF, m])); mantidos.push('RST/TEM'); continue; }
      if (p + 2 > u8.length) throw new Error('JPEG: segmento truncado');
      const len = (u8[p] << 8) | u8[p + 1];
      if (len < 2 || p + len > u8.length) throw new Error('JPEG: comprimento inválido em ' + p);
      const seg = u8.subarray(p - 2, p + len);
      const nome = 'APP' + (m - 0xE0);
      let id = '';
      if (m >= 0xE0 && m <= 0xEF) { let e = p + 2; while (e < p + len && u8[e] !== 0) e++; id = ASCII(u8, p + 2, Math.min(e - (p + 2), 30)); }
      let manter;
      if (m === 0xE1) manter = false;                                          // EXIF / XMP
      else if (m === 0xED) manter = false;                                     // IPTC / Photoshop
      else if (m === 0xFE) manter = false;                                     // COM
      else if (m === 0xE2) manter = id === 'ICC_PROFILE';                      // ICC fica; MPF e outros não
      else manter = true;                                                      // APP0 JFIF, DQT, SOF, DHT, DRI…
      const rot = (m >= 0xE0 && m <= 0xEF ? nome : m === 0xFE ? 'COM' : 'M' + m.toString(16).toUpperCase()) + (id ? '(' + id + ')' : '') + ' ' + seg.length + ' B';
      if (manter) { partes.push(seg); mantidos.push(rot); } else removidos.push(rot);
      p += len;
    }
    return { formato: 'jpeg', bytes: concat(partes), removidos, mantidos, avisos };
  }

  /* ---------- PNG ------------------------------------------------------- */
  const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];
  const PNG_REMOVER = new Set(['tEXt', 'iTXt', 'zTXt', 'eXIf', 'tIME']);
  function limparPNG(u8) {
    for (let i = 0; i < 8; i++) if (u8[i] !== PNG_SIG[i]) throw new Error('PNG: assinatura inválida');
    const partes = [u8.subarray(0, 8)], removidos = [], mantidos = [], avisos = [];
    let p = 8;
    while (p + 8 <= u8.length) {
      const len = ((u8[p] << 24) | (u8[p + 1] << 16) | (u8[p + 2] << 8) | u8[p + 3]) >>> 0;
      const tipo = ASCII(u8, p + 4, 4);
      const total = 12 + len;
      if (p + total > u8.length) throw new Error('PNG: chunk ' + tipo + ' truncado');
      const chunk = u8.subarray(p, p + total);
      if (PNG_REMOVER.has(tipo)) removidos.push(tipo + ' ' + total + ' B');
      else { partes.push(chunk); mantidos.push(tipo + ' ' + total + ' B'); }
      p += total;
      if (tipo === 'IEND') { if (p < u8.length) removidos.push('trailer após IEND (' + (u8.length - p) + ' B)'); break; }
    }
    return { formato: 'png', bytes: concat(partes), removidos, mantidos, avisos };
  }

  /* ---------- WebP (RIFF) ----------------------------------------------- */
  function limparWebP(u8) {
    if (ASCII(u8, 0, 4) !== 'RIFF' || ASCII(u8, 8, 4) !== 'WEBP') throw new Error('WebP: não é RIFF/WEBP');
    const removidos = [], mantidos = [], avisos = [], chunks = [];
    let p = 12;
    const riffFim = Math.min(u8.length, 8 + le32(u8, 4));
    while (p + 8 <= riffFim) {
      const fourcc = ASCII(u8, p, 4), len = le32(u8, p + 4), pad = len & 1;
      if (p + 8 + len > u8.length) throw new Error('WebP: chunk ' + fourcc + ' truncado');
      const chunk = u8.slice(p, p + 8 + len + pad);     // slice: cópia (vamos editar VP8X)
      if (fourcc === 'EXIF' || fourcc === 'XMP ') removidos.push(fourcc.trim() + ' ' + chunk.length + ' B');
      else { chunks.push({ fourcc, chunk }); mantidos.push(fourcc.trim() + ' ' + chunk.length + ' B'); }
      p += 8 + len + pad;
    }
    if (p < u8.length) removidos.push('trailer após RIFF (' + (u8.length - p) + ' B)');
    const vp8x = chunks.find(c => c.fourcc === 'VP8X');
    if (vp8x) {
      const flags = vp8x.chunk[8];
      const novo = flags & ~(0x08 | 0x04);              // E (EXIF) = 0x08, X (XMP) = 0x04
      if (novo !== flags) { vp8x.chunk[8] = novo; avisos.push('VP8X flags ' + flags.toString(2).padStart(8, '0') + ' → ' + novo.toString(2).padStart(8, '0')); }
    } else if (removidos.length) avisos.push('EXIF/XMP sem VP8X (arquivo fora da spec) — removidos mesmo assim');
    const corpo = concat(chunks.map(c => c.chunk));
    const out = new Uint8Array(12 + corpo.length);
    out.set(u8.subarray(0, 4)); setLe32(out, 4, 4 + corpo.length); out.set(u8.subarray(8, 12), 8); out.set(corpo, 12);
    return { formato: 'webp', bytes: out, removidos, mantidos, avisos };
  }

  /* ---------- utilitários ------------------------------------------------ */
  function le32(u8, i) { return (u8[i] | (u8[i + 1] << 8) | (u8[i + 2] << 16) | (u8[i + 3] << 24)) >>> 0; }
  function setLe32(u8, i, v) { u8[i] = v & 255; u8[i + 1] = (v >>> 8) & 255; u8[i + 2] = (v >>> 16) & 255; u8[i + 3] = (v >>> 24) & 255; }
  function concat(partes) { let n = 0; for (const p of partes) n += p.length; const out = new Uint8Array(n); let o = 0; for (const p of partes) { out.set(p, o); o += p.length; } return out; }
  function detectar(u8) {
    if (u8[0] === 0xFF && u8[1] === 0xD8) return 'jpeg';
    if (u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4E && u8[3] === 0x47) return 'png';
    if (ASCII(u8, 0, 4) === 'RIFF' && ASCII(u8, 8, 4) === 'WEBP') return 'webp';
    return null;
  }
  function limpar(u8) {
    const f = detectar(u8);
    if (f === 'jpeg') return limparJPEG(u8);
    if (f === 'png') return limparPNG(u8);
    if (f === 'webp') return limparWebP(u8);
    throw new Error('formato não suportado pela limpeza (só JPEG/PNG/WebP)');
  }
  const TIPOS = Object.freeze({ jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' });
  function limpaEsteTipo(mime) { return mime === 'image/jpeg' || mime === 'image/png' || mime === 'image/webp'; }
  return Object.freeze({ TIPOS, limpaEsteTipo, limpar, detectar, limparJPEG, limparPNG, limparWebP });
})();
