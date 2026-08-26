// test/roda.js — runner: Firefox (Playwright) + Chrome do sistema, file://,
// janela 1200×600 (14 §0.10). Escreve <resultados>/m1-<motor>.json e capturas.
//   node test/roda.js <caminho-do-html> <pasta-de-resultados>
const { firefox, chromium } = require('playwright-core');
const fs = require('fs'), path = require('path');

const [, , HTML, RES] = process.argv;
if (!HTML || !RES) { console.error('uso: node test/roda.js <html> <pasta-resultados>'); process.exit(2); }
fs.mkdirSync(RES, { recursive: true });

const SUITES = [
  ['core/chave', require('./core/chave.test.js')],
  ['telas/t1_entrar', require('./telas/t1_entrar.test.js')],
];
const MOTORES = [
  ['firefox', firefox, {}],
  ['chrome', chromium, { executablePath: process.env.CHROME || '/usr/bin/google-chrome' }],
];
const NPUB_BOSTIL = process.env.NOSTERMENTOR_NPUB_TESTE || 'npub10xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqpkge6d';  // exemplo sem dono: o ponto gerador da secp256k1

(async () => {
  let falhas = 0, total = 0, pulados = 0;
  const geral = { html: path.resolve(HTML), inicio: new Date().toISOString(), motores: {} };
  for (const [motor, tipo, opts] of MOTORES) {
    let b;
    try { b = await tipo.launch({ headless: true, ...opts }); }
    catch (e) { console.log(`\n### ${motor}: NÃO INICIOU (${String(e.message).split('\n')[0]})`); falhas++; continue; }
    const versao = b.version();
    console.log(`\n### ${motor} ${versao}`);
    const saida = { versao, suites: {} };
    for (const [nome, suite] of SUITES) {
      const ctx = await b.newContext({ acceptDownloads: true, viewport: { width: 1200, height: 600 } });
      const u = { url: 'file://' + path.resolve(HTML), motor, res: RES, NPUB_BOSTIL, captura: (n) => path.join(RES, `${n}-${motor}.png`) };
      let R;
      try { R = await suite(ctx, u); }
      catch (e) { R = [{ nome: nome + ' (suíte inteira)', ok: false, detalhe: String(e.stack || e).slice(0, 600) }]; }
      await ctx.close();
      saida.suites[nome] = R;
      for (const r of R) {
        total++;
        if (r.ok === null) pulados++; else if (!r.ok) falhas++;
        const marca = r.ok === null ? ' ---- ' : r.ok ? '  OK  ' : ' FALHA';
        console.log(`${marca} ${nome.padEnd(16)} ${r.nome}${r.detalhe ? '  — ' + r.detalhe : ''}`);
      }
    }
    await b.close();
    geral.motores[motor] = saida;
    fs.writeFileSync(path.join(RES, `m1-${motor}.json`), JSON.stringify(saida, null, 2));
  }
  geral.fim = new Date().toISOString();
  geral.resumo = { total, falhas, pulados };
  fs.writeFileSync(path.join(RES, 'm1-resumo.json'), JSON.stringify(geral, null, 2));
  console.log(`\n${total} casos · ${falhas} falhas · ${pulados} pulados · resultados em ${RES}`);
  process.exit(falhas ? 1 : 0);
})();
