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

const MARCO = 'm4';
const SUITES = [
  ['core/chave', require('./core/chave.test.js')],
  ['core/modelo', require('./core/modelo.test.js')],
  ['core/site_json', require('./core/site_json.test.js')],
  ['core/db', require('./core/db.test.js')],
  ['core/saude', require('./core/saude.test.js')],
  ['core/relay', require('./core/relay.test.js')],
  ['core/mensagens', require('./core/mensagens.test.js')],
  ['core/blossom', require('./core/blossom.test.js')],
  ['core/publicar', require('./core/publicar.test.js')],
  ['core/despublicar', require('./core/despublicar.test.js')],
  ['core/rede', require('./core/rede.test.js')],
  ['core/limpeza', require('./core/limpeza.test.js')],
  ['core/gerador', require('./core/gerador.test.js')],
  ['core/qr', require('./core/qr.test.js')],
  ['core/blocos', require('./core/blocos.test.js')],
  ['core/contatos', require('./core/contatos.test.js')],
  ['core/html_colado', require('./core/html_colado.test.js')],
  ['core/externos', require('./core/externos.test.js')],
  ['core/backup', require('./core/backup.test.js')],
  ['core/responsivo', require('./core/responsivo.test.js')],
  ['telas/t1_entrar', require('./telas/t1_entrar.test.js')],
  ['telas/t2_t3', require('./telas/t2_t3.test.js')],
  ['telas/t3_inicio', require('./telas/t3_inicio.test.js')],
  ['telas/t4_t5_editor', require('./telas/t4_t5_editor.test.js')],
  ['telas/t9_backup', require('./telas/t9_backup.test.js')],
  ['telas/t6_t8', require('./telas/t6_t8.test.js')],
  ['telas/t6_midia', require('./telas/t6_midia.test.js')],
  ['telas/t7_config', require('./telas/t7_config.test.js')],
  ['telas/t11_ajuda', require('./telas/t11_ajuda.test.js')],
  ['telas/t12_temas', require('./telas/t12_temas.test.js')],
  ['telas/t13_contatos', require('./telas/t13_contatos.test.js')],
  ['telas/piso_painel', require('./telas/piso_painel.test.js')],
  // Medição de escala, não aceite: só corre quando pedida por NOSTERMENTOR_SUITES.
  ['telas/escala', require('./telas/escala.test.js')],
  ['rede/bostil', require('./rede/bostil.test.js')],
  ['rede/bostil_publicar', require('./rede/bostil_publicar.test.js')],
  ['rede/publicar_real', require('./rede/publicar_real.test.js')],
];
const SO = process.env.NOSTERMENTOR_SUITES ? process.env.NOSTERMENTOR_SUITES.split(',') : null;
// NOSTERMENTOR_MOTORES=chrome corre só num motor. Existe por causa de
// `core/responsivo`, que com 21 temas leva dezenas de minutos NOS DOIS: ao
// afinar um tema, medir num motor e só no fim correr os dois. ⚠️ Nunca fechar
// trabalho com um motor só — metade das correções de tema deste projeto
// vieram de o Firefox e o Chrome discordarem (TEMAS.md §7.4).
const SO_MOTOR = process.env.NOSTERMENTOR_MOTORES ? process.env.NOSTERMENTOR_MOTORES.split(',') : null;
const MOTORES = [
  ['firefox', firefox, {}],
  ['chrome', chromium, { executablePath: process.env.CHROME || '/usr/bin/google-chrome' }],
].filter(([nome]) => !SO_MOTOR || SO_MOTOR.includes(nome));
// O endereço do nsite de ensaio vem da nsec de teste (util.js, enderecoDeTeste):
// não fica escrito aqui, e sem a nsec cai numa chave de exemplo sem dono.
const ENDERECO_TESTE = require('./util.js').enderecoDeTeste();
const NPUB_BOSTIL = ENDERECO_TESTE.npub;
const PUBKEY_BOSTIL = ENDERECO_TESTE.pubkey;

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
