// test/roda.js — runner: Firefox (Playwright) + Chrome do sistema, file://,
// janela 1200×600 (14 §0.10). Escreve <resultados>/<marco>-<motor>.json e
// capturas. Desde M2 sobe o servidor falso (relay + Blossom locais) quando
// NOSTERMENTOR_CERT_DIR aponta para um certificado autoassinado.
//   node test/roda.js <caminho-do-html> <pasta-de-resultados>
const { firefox, chromium } = require('playwright-core');
const fs = require('fs'), path = require('path');

const [, , HTML, RES] = process.argv;
if (!HTML || !RES) { console.error('uso: node test/roda.js <html> <pasta-resultados>'); process.exit(2); }
fs.mkdirSync(RES, { recursive: true });

const MARCO = 'm2';
const SUITES = [
  ['core/chave', require('./core/chave.test.js')],
  ['core/modelo', require('./core/modelo.test.js')],
  ['core/site_json', require('./core/site_json.test.js')],
  ['core/db', require('./core/db.test.js')],
  ['core/saude', require('./core/saude.test.js')],
  ['core/relay', require('./core/relay.test.js')],
  ['core/rede', require('./core/rede.test.js')],
  ['telas/t1_entrar', require('./telas/t1_entrar.test.js')],
  ['telas/t2_t3', require('./telas/t2_t3.test.js')],
  ['rede/bostil', require('./rede/bostil.test.js')],
];
const SO = process.env.NOSTERMENTOR_SUITES ? process.env.NOSTERMENTOR_SUITES.split(',') : null;
const MOTORES = [
  ['firefox', firefox, {}],
  ['chrome', chromium, { executablePath: process.env.CHROME || '/usr/bin/google-chrome' }],
];
const NPUB_BOSTIL = process.env.NOSTERMENTOR_NPUB_TESTE || 'npub10xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqpkge6d';  // exemplo sem dono: o ponto gerador da secp256k1
const PUBKEY_BOSTIL = process.env.NOSTERMENTOR_PUBKEY_TESTE || '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';

(async () => {
  let falhas = 0, total = 0, pulados = 0;
  const geral = { html: path.resolve(HTML), inicio: new Date().toISOString(), motores: {} };
  let falso = null;
  const certDir = process.env.NOSTERMENTOR_CERT_DIR;
  if (certDir && fs.existsSync(path.join(certDir, 'cert.pem'))) {
    try { falso = await require('./servidor_falso.js').iniciar(certDir); console.log(`servidor falso em ${falso.base}`); }
    catch (e) { console.log('servidor falso NÃO subiu: ' + e.message); }
  } else console.log('sem NOSTERMENTOR_CERT_DIR — as suítes que usam o servidor falso ficam PULADAS');
  for (const [motor, tipo, opts] of MOTORES) {
    let b;
    try { b = await tipo.launch({ headless: true, ...opts }); }
    catch (e) { console.log(`\n### ${motor}: NÃO INICIOU (${String(e.message).split('\n')[0]})`); falhas++; continue; }
    const versao = b.version();
    console.log(`\n### ${motor} ${versao}`);
    const saida = { versao, suites: {} };
    for (const [nome, suite] of SUITES) {
      if (SO && !SO.includes(nome)) continue;
      const ctx = await b.newContext({ acceptDownloads: true, ignoreHTTPSErrors: true, viewport: { width: 1200, height: 600 } });
      const u = { url: 'file://' + path.resolve(HTML), motor, res: RES, NPUB_BOSTIL, PUBKEY_BOSTIL, falso, captura: (n) => path.join(RES, `${n}-${motor}.png`) };
      let R;
      const t0 = Date.now();
      try { R = await suite(ctx, u); }
      catch (e) { R = [{ nome: nome + ' (suíte inteira)', ok: false, detalhe: String(e.stack || e).slice(0, 600) }]; }
      await ctx.close();
      saida.suites[nome] = R;
      for (const r of R) {
        total++;
        if (r.ok === null) pulados++; else if (!r.ok) falhas++;
        const marca = r.ok === null ? ' ---- ' : r.ok ? '  OK  ' : ' FALHA';
        console.log(`${marca} ${nome.padEnd(16)} ${r.nome}${r.ms ? ` [${(r.ms / 1000).toFixed(1)}s]` : ''}${r.detalhe ? '  — ' + r.detalhe : ''}`);
      }
      console.log(`       (${nome}: ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    }
    await b.close();
    geral.motores[motor] = saida;
    fs.writeFileSync(path.join(RES, `${MARCO}-${motor}.json`), JSON.stringify(saida, null, 2));
  }
  if (falso) await falso.fechar();
  geral.fim = new Date().toISOString();
  geral.resumo = { total, falhas, pulados };
  fs.writeFileSync(path.join(RES, `${MARCO}-resumo.json`), JSON.stringify(geral, null, 2));
  console.log(`\n${total} casos · ${falhas} falhas · ${pulados} pulados · resultados em ${RES}`);
  process.exit(falhas ? 1 : 0);
})();
