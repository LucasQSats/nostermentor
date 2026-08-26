// test/core/limpeza.test.js — core/limpeza.js (13 §4.5, D15) dentro da
// página: as 6 fixtures do E2 (2026-08-25) têm de sair BYTE A BYTE iguais às
// saídas que o exiftool/Pillow aprovaram naquele dia (test/fixtures/limpeza/
// esperado/). Assim o módulo promovido prova que não mudou de comportamento.
const fs = require('fs'), path = require('path');
const crypto = require('crypto');
const { abrir, coletor, assert } = require('../util.js');

module.exports = async function (ctx, u) {
  const { R, it } = coletor();
  const dir = path.join(__dirname, '..', 'fixtures', 'limpeza');
  const nomes = ['exif.jpg', 'exif-progressive.jpg', 'exif.png', 'exif.webp', 'exif-lossless.webp', 'limpo.png'];
  const entrada = {}, esperado = {};
  for (const n of nomes) {
    entrada[n] = fs.readFileSync(path.join(dir, n)).toString('base64');
    esperado[n] = crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, 'esperado', 'limpo-' + n))).digest('hex');
  }
  const p = await abrir(ctx, u.url);
  const r = await p.pg.evaluate(async (entrada) => {
    const b64 = (s) => { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
    const out = {};
    for (const n of Object.keys(entrada)) {
      const u8 = b64(entrada[n]);
      const t0 = performance.now();
      const r = Limpeza.limpar(u8);
      out[n] = { formato: r.formato, sha: await Gerador.sha256Hex(r.bytes), bytes: r.bytes.length, antes: u8.length, removidos: r.removidos, avisos: r.avisos, ms: Math.round(performance.now() - t0), detectado: Limpeza.detectar(u8) };
    }
    try { Limpeza.limpar(new TextEncoder().encode('%PDF-1.4 nada')); out.pdf = 'limpou (ERRADO)'; } catch (e) { out.pdf = e.message; }
    try { Limpeza.limpar(new Uint8Array([0xFF, 0xD8, 0xFF, 0xE1, 0xFF])); out.truncado = 'limpou (ERRADO)'; } catch (e) { out.truncado = e.message; }
    out.tipos = { jpeg: Limpeza.limpaEsteTipo('image/jpeg'), gif: Limpeza.limpaEsteTipo('image/gif'), webp: Limpeza.limpaEsteTipo('image/webp') };
    return out;
  }, entrada);
  for (const n of nomes) {
    await it(`${n}: saída idêntica à aprovada em E2 (${r[n].antes} → ${r[n].bytes} B; removidos: ${r[n].removidos.length})`, () => {
      assert(r[n].sha === esperado[n], `sha ${r[n].sha.slice(0, 12)} ≠ esperado ${esperado[n].slice(0, 12)}`);
      assert(r[n].detectado === r[n].formato, 'detectar ≠ formato');
      if (n === 'limpo.png') assert(r[n].removidos.length === 0 && r[n].bytes === r[n].antes, 'o controle sem metadados mudou');
      else assert(r[n].removidos.length > 0, 'nada removido');
      return r[n].removidos.join('; ') + (r[n].avisos.length ? ' | avisos: ' + r[n].avisos.join('; ') : '');
    });
  }
  await it('formato não suportado e arquivo truncado lançam (o chamador cai no fallback/aviso)', () => assert(/não suportado/.test(r.pdf) && /truncado|marcador|comprimento/.test(r.truncado), JSON.stringify([r.pdf, r.truncado])));
  await it('limpaEsteTipo: jpeg/png/webp sim, gif não (13 §4.5)', () => assert(r.tipos.jpeg && r.tipos.webp && !r.tipos.gif, JSON.stringify(r.tipos)));
  await it('sem erros de página/console', () => assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros })));
  await p.pg.close();
  return R;
};
