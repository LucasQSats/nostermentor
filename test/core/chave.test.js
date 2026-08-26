// test/core/chave.test.js — core/chave.js, avaliado DENTRO da página file://
// (sem rede). Chaves geradas por execução; nenhuma fixture com nsec (P-8).
const { abrir, coletor, assert } = require('../util.js');

module.exports = async function (ctx, u) {
  const { R, it } = coletor();
  const p = await abrir(ctx, u.url);
  const pg = p.pg;

  const r = await pg.evaluate(() => {
    const out = {};
    const g = Chave.gerar();
    out.gerar = { nsec: /^nsec1[023456789acdefghjklmnpqrstuvwxyz]{58}$/.test(g.nsec), npub: /^npub1[023456789acdefghjklmnpqrstuvwxyz]{58}$/.test(g.npub), pubHex: /^[0-9a-f]{64}$/.test(g.pubkey), skLen: g.sk.length };
    const v = Chave.validarNsec('  ' + g.nsec + '\n');
    out.roundtrip = v.ok === true && v.npub === g.npub && v.pubkey === g.pubkey && v.sk instanceof Uint8Array;
    out.maiusculas = Chave.validarNsec(g.nsec.toUpperCase()).ok === true;
    const invalidos = ['', ' ', 'abc', 'nsec1abc', g.npub, g.pubkey, 'nsec1' + 'q'.repeat(58), g.nsec.slice(0, -1) + (g.nsec.slice(-1) === 'x' ? 'y' : 'x'), null, undefined, 12345];
    const resultados = invalidos.map(s => { try { return Chave.validarNsec(s); } catch (e) { return { lancou: String(e) }; } });
    out.invalidos = resultados.every(r => r.ok === false && typeof r.motivo === 'string' && r.motivo.length > 0);
    out.invalidosDetalhe = resultados.map(r => r.ok === false ? 'nao' : JSON.stringify(r)).join(',');
    out.motivo = resultados[0].motivo;
    out.extrair = {
      comComentario: Chave.extrairDeTexto('# chave\r\n\r\n  ' + g.nsec + '  \r\n' + g.npub) === g.nsec,
      comSufixo: Chave.extrairDeTexto(g.nsec + ' # minha chave') === g.nsec,
      soLF: Chave.extrairDeTexto('x\n' + g.nsec) === g.nsec,
      soCR: Chave.extrairDeTexto('x\r' + g.nsec) === g.nsec,
      sem: Chave.extrairDeTexto('nada\n' + g.npub) === null,
      vazio: Chave.extrairDeTexto('') === null && Chave.extrairDeTexto(null) === null,
      naoNoMeio: Chave.extrairDeTexto('chave: ' + g.nsec) === null
    };
    out.npub8 = Chave.npub8(g.npub) === g.npub.slice(5, 13) && Chave.npub8(g.npub).length === 8;
    out.abreviar = Chave.abreviar(g.npub) === g.npub.slice(0, 9) + '…' + g.npub.slice(-4);
    out.nomeArquivo = Chave.nomeArquivoChave(g.npub) === 'chave-' + g.npub.slice(5, 13) + '.txt';
    const arq = Chave.arquivoDaChave(g);
    out.arquivo = arq.split('\n')[0] === g.nsec && arq.split('\n')[1] === g.npub && Chave.extrairDeTexto(arq) === g.nsec && Chave.validarNsec(Chave.extrairDeTexto(arq)).npub === g.npub;
    const ev = Chave.assinar({ kind: 1, created_at: 1700000000, tags: [], content: 'teste' }, g.sk);
    out.assinar = ev.pubkey === g.pubkey && Chave.verificar(ev) === true && typeof ev.sig === 'string' && ev.sig.length === 128 && /^[0-9a-f]{64}$/.test(ev.id);
    const ev2 = Object.assign({}, JSON.parse(JSON.stringify(ev)), { content: 'alterado' });   // cópia sem o símbolo interno do nostr-tools
    const ev3 = Object.assign({}, ev, { content: 'alterado' });                              // cópia COM o símbolo (cache de "já verificado")
    out.adulterado = Chave.verificar(ev2) === false;
    out.adulteradoComSimbolo = Chave.verificar(ev3) === false;
    out.simboloCopiado = NT.verifyEvent(ev3) === true;   // documenta o comportamento da lib que obriga a reconstrução em Chave.verificar
    out.lixo = Chave.verificar(null) === false && Chave.verificar({}) === false && Chave.verificar('x') === false;
    Chave.apagar(g.sk);
    out.apagar = g.sk.every(b => b === 0);
    out.congelado = Object.isFrozen(Chave);
    return out;
  });

  await it('gerar: nsec/npub bech32, pubkey hex, sk de 32 bytes', () => { assert(r.gerar.nsec && r.gerar.npub && r.gerar.pubHex && r.gerar.skLen === 32, JSON.stringify(r.gerar)); });
  await it('validarNsec: ida e volta (com espaços em volta)', () => assert(r.roundtrip));
  await it('validarNsec: aceita maiúsculas (bech32)', () => assert(r.maiusculas));
  await it('validarNsec: 11 entradas inválidas → ok:false com motivo, sem lançar', () => { assert(r.invalidos, r.invalidosDetalhe); return r.motivo; });
  await it('validarNsec: motivo é o texto de 14 T1', () => assert(r.motivo === 'Isto não é uma chave privada (nsec). A chave começa por nsec1.', r.motivo));
  await it('extrairDeTexto: 1ª linha que começa por nsec1 (CRLF/CR/LF, comentário, sufixo, ausente, vazio)', () => { assert(Object.values(r.extrair).every(Boolean), JSON.stringify(r.extrair)); });
  await it('npub8 = 8 caracteres após "npub1"', () => assert(r.npub8));
  await it('abreviar = "npub1abcd…wxyz" (14 §2)', () => assert(r.abreviar));
  await it('nomeArquivoChave = chave-<npub8>.txt (14 T1)', () => assert(r.nomeArquivo));
  await it('arquivoDaChave: nsec na 1ª linha, npub na 2ª, e é lido de volta por extrairDeTexto', () => assert(r.arquivo));
  await it('assinar: evento com pubkey certa, id/sig válidos, verificar() = true', () => assert(r.assinar));
  await it('verificar: evento adulterado (cópia limpa) → false', () => assert(r.adulterado));
  await it('verificar: cópia adulterada que carrega o símbolo de "já verificado" do nostr-tools → false (a lib crua diz true)', () => assert(r.adulteradoComSimbolo && r.simboloCopiado, JSON.stringify({ comSimbolo: r.adulteradoComSimbolo, libCrua: r.simboloCopiado })));
  await it('verificar: null / {} / string → false sem lançar', () => assert(r.lixo));
  await it('apagar: zera os bytes da sk', () => assert(r.apagar));
  await it('Chave é congelado (Object.freeze)', () => assert(r.congelado));
  await it('sem erros de página/console/CSP durante os testes do core', () => {
    const e = { pageerror: p.erros, console: p.consoleErros };
    assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify(e));
  });
  await pg.close();
  return R;
};
