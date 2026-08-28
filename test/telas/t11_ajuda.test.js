// test/telas/t11_ajuda.test.js — T11 Ajuda e Sobre (14 T11) pela INTERFACE,
// nos dois motores. O que se prova: as seis seções existem e trocam; a de
// "como abrir" leva o Tails primeiro e repete, palavra por palavra, o que a
// bancada mediu (Documentos a cada sessão — P19; Safest não arranca — P22;
// F5 no arranque mudo — P28; o aviso "Could not read the contents of
// amnesia" é inofensivo — P27); a de "apoiar" diz a verdade enquanto não há
// endereço de doação, em vez de mostrar um placeholder; "Sobre" mostra a
// versão real do app, a licença, o código e as quatro bibliotecas com versão
// e licença; o rodapé e o cartão de T3 abrem direto na aba certa; e a tela
// funciona ANTES de T2 acabar — quem clica "Ajuda" com o site a carregar não
// pode levar uma tela vazia.
const { abrir, coletor, assert, entrarCom, semearSite, esperarT2 } = require('../util.js');
const F = require('../fabrica.js');

module.exports = async function (ctx, u) {
  const { R, it, pulado } = coletor();
  if (!u.falso) { pulado('telas/t11_ajuda (todos os casos)', 'servidor falso indisponível'); return R; }
  const f = u.falso, servers = [f.base];
  f.relay('aj-vazio', { modo: 'vazio', eventos: [] });
  f.relay('aj-mudo', { modo: 'mudo' });

  // Sessão mínima: entra e vai direto à Ajuda, sem esperar a carga da rede.
  async function comAjuda(relays) {
    const ch = F.chave();
    const p = await abrir(ctx, u.url);
    await semearSite(p.pg, ch, { relays: relays || [f.ws('aj-vazio')], servers, title: 'Site do teste T11' });
    await entrarCom(p.pg, ch.nsec);
    await p.pg.click('#menu .item[data-tela="t11"]');
    await p.pg.waitForSelector('#t11-painel');
    return { p, ch };
  }
  const abaTexto = async (pg, aba) => {
    await pg.click(`#t11-abas .aba[data-aba="${aba}"]`);
    await pg.waitForFunction((a) => document.querySelector(`#t11-abas .aba[data-aba="${a}"]`).classList.contains('atual'), aba);
    return (await pg.textContent('#t11-painel')).replace(/\s+/g, ' ');
  };

  await it('as seis seções de 14 T11 existem e trocam; "Como abrir" põe o Tails primeiro e repete o que a bancada mediu (Documentos a cada sessão, Safest não arranca, F5, o aviso do Tails é inofensivo)', async () => {
    const { p } = await comAjuda();
    const abas = await p.pg.evaluate(() => [...document.querySelectorAll('#t11-abas .aba')].map(b => b.getAttribute('data-aba') + ':' + b.textContent));
    assert(abas.join(' | ') === 'abrir:Como abrir | chave:A sua chave | copias:Onde ficam as suas coisas | remover:Remover não é apagar | apoio:Apoiar | sobre:Sobre', abas.join(' | '));
    const t = (await p.pg.textContent('#t11-painel')).replace(/\s+/g, ' ');
    await p.pg.screenshot({ path: u.captura('t11-abrir'), fullPage: true });
    assert(/^Como abrir o Nostermentor/.test(t.trim()), t.slice(0, 80));
    assert(t.indexOf('No Tails') < t.indexOf('No Windows e no Linux'), 'o Tails devia vir primeiro');
    assert(/pasta Documentos, e faça isso a cada sessão/.test(t) && /não abre o app a partir do pendrive nem do Persistent Storage/.test(t), 'P19 ausente');
    assert(/Em Safest o navegador desliga o JavaScript e o painel não arranca/.test(t), 'P22 ausente');
    assert(/ficar parada no aviso inicial, recarregue \(F5\)/.test(t), 'P28 ausente');
    assert(/"Could not read the contents of amnesia", clique OK/.test(t) && /sem consequência/.test(t), 'P27 ausente');
    assert(/não fala com nenhum servidor do projeto/.test(t), 'falta a linha da privacidade');
    const passos = await p.pg.evaluate(() => [...document.querySelectorAll('#t11-painel ol.passos-ajuda')].map(o => o.children.length));
    assert(passos.join('+') === '6+2', 'esperava 6 passos do Tails e 2 do resto, veio ' + passos.join('+'));
    assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros }));
    await p.pg.close();
    return abas.length + ' seções';
  });

  await it('as seções de conteúdo dizem o que 14 T11 manda: a chave não é guardada e não há recuperação; as três cópias com a regra prática; remover tira do site sempre e apagar da rede nem sempre', async () => {
    const { p } = await comAjuda();
    const chave = await abaTexto(p.pg, 'chave');
    assert(/O painel nunca guarda a sua chave/.test(chave) && /Não existe recuperação/.test(chave) && /KeePassXC/.test(chave), chave.slice(0, 200));
    const copias = await abaTexto(p.pg, 'copias');
    assert(/O site publicado vive na rede/.test(copias) && /Os rascunhos vivem no backup/.test(copias) && /O navegador é só a mesa de trabalho/.test(copias), copias.slice(0, 200));
    assert(/publicou, está na rede; não publicou, só existe no backup/.test(copias), 'falta a regra prática');
    const itens = await p.pg.evaluate(() => document.querySelectorAll('#t11-painel ul.lista-copias li').length);
    assert(itens === 3, 'as três cópias viraram ' + itens);
    const remover = await abaTexto(p.pg, 'remover');
    await p.pg.screenshot({ path: u.captura('t11-remover'), fullPage: true });
    assert(/Tirar uma página, um artigo ou uma imagem do site sempre funciona/.test(remover), remover.slice(0, 200));
    assert(/nem sempre é possível/.test(remover) && /servidor por servidor/.test(remover), 'falta a promessa de 03 §6');
    assert(/remove os metadados/.test(remover) && /Configurações → Avançado/.test(remover), 'falta EXIF ou "tirar do ar"');
    assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros }));
    await p.pg.close();
  });

  await it('"Apoiar" e "Sobre": sem endereço de doação a tela diz isso (não mostra placeholder); Sobre traz a versão REAL do app, a licença MIT, o código e as quatro bibliotecas com versão e licença', async () => {
    const { p } = await comAjuda();
    const apoio = await abaTexto(p.pg, 'apoio');
    assert(/O endereço para doações ainda não está publicado/.test(apoio) && /site oficial ainda não está publicado/.test(apoio), apoio.slice(0, 200));
    assert(/grátis e aberto, com licença MIT/.test(apoio) && /Publicado com Nostermentor/.test(apoio), 'falta o texto de A1');
    const sobre = await abaTexto(p.pg, 'sobre');
    await p.pg.screenshot({ path: u.captura('t11-sobre'), fullPage: true });
    const est = await p.pg.evaluate(() => ({
      versao: document.getElementById('t11-versao').textContent,
      appVersion: window.APP_VERSION,
      rodape: document.getElementById('versao').textContent,
      codigo: document.getElementById('t11-codigo').getAttribute('href'),
      libs: [...document.querySelectorAll('#t11-bibliotecas li')].map(li => li.textContent.replace(/\s+/g, ' '))
    }));
    assert(est.versao === 'Versão: ' + est.appVersion && est.rodape.indexOf(est.appVersion) >= 0, JSON.stringify(est.versao) + ' / ' + est.rodape);
    assert(est.codigo === 'https://github.com/LucasQSats/nostermentor', est.codigo);
    assert(/Licença: MIT/.test(sobre) && /não tem telemetria/.test(sobre), sobre.slice(0, 200));
    assert(est.libs.length === 4, 'esperava 4 bibliotecas, veio ' + est.libs.length);
    assert(/^nostr-tools 2\.25\.0 \(Unlicense\)/.test(est.libs[0]) && /^DOMPurify 3\.4\.14 \(Apache-2\.0\)/.test(est.libs[1]), JSON.stringify(est.libs));
    assert(/^marked 18\.0\.11 \(MIT\)/.test(est.libs[2]) && /^Mustache 4\.2\.0 \(MIT\)/.test(est.libs[3]), JSON.stringify(est.libs));
    assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros }));
    await p.pg.close();
    return est.libs.length + ' bibliotecas, versão ' + est.appVersion;
  });

  await it('o rodapé "Apoie o Nostermentor" e o cartão de T3 abrem T11 DIRETO na aba Apoiar; e a Ajuda funciona antes de T2 acabar (relay mudo, site ainda a carregar)', async () => {
    // rodapé, com o site já carregado
    const ch = F.chave();
    const p = await abrir(ctx, u.url);
    await semearSite(p.pg, ch, { relays: [f.ws('aj-vazio')], servers, title: 'Site do teste T11' });
    await entrarCom(p.pg, ch.nsec);
    const d = await esperarT2(p.pg, 30000);
    assert(d.desfecho === 't2b-sem-site', JSON.stringify(d));
    await p.pg.click('#comecar-site');                       // T2b sem site → começa um site novo (vai a T7)
    await p.pg.waitForFunction(() => Shell.telaAtual() === 't7');
    await p.pg.click('#menu .item[data-tela="t3"]');
    await p.pg.waitForSelector('#cartao-saude');
    await p.pg.click('#cartao-apoie button:has-text("Como apoiar")');
    await p.pg.waitForSelector('#t11-painel');
    let aba = await p.pg.evaluate(() => document.querySelector('#t11-abas .aba.atual').getAttribute('data-aba'));
    assert(aba === 'apoio', 'o cartão de T3 abriu a aba ' + aba);
    await p.pg.click('#menu .item[data-tela="t3"]');
    await p.pg.waitForSelector('#cartao-saude');
    await p.pg.click('#rodape button.ligacao');
    await p.pg.waitForSelector('#t11-painel');
    aba = await p.pg.evaluate(() => document.querySelector('#t11-abas .aba.atual').getAttribute('data-aba'));
    assert(aba === 'apoio', 'o rodapé abriu a aba ' + aba);
    await p.pg.close();
    // e com a rede a demorar: a Ajuda não depende do banco nem da carga
    const ch2 = F.chave();
    const p2 = await abrir(ctx, u.url);
    await semearSite(p2.pg, ch2, { relays: [f.ws('aj-mudo')], servers });
    await entrarCom(p2.pg, ch2.nsec);
    await p2.pg.waitForSelector('#t2');
    await p2.pg.click('#menu .item[data-tela="t11"]');
    await p2.pg.waitForSelector('#t11-painel');
    const t = await p2.pg.textContent('#t11-painel');
    assert(t.length > 200 && /Como abrir o Nostermentor/.test(t), 'ajuda vazia durante a carga');
    const largura = await p2.pg.evaluate(() => ({ doc: document.documentElement.scrollWidth, janela: innerWidth }));
    assert(largura.doc <= largura.janela, 'T11 rola na horizontal em 1200×600: ' + JSON.stringify(largura));
    assert(p2.erros.length === 0 && p2.consoleErros.length === 0, JSON.stringify({ pageerror: p2.erros, console: p2.consoleErros }));
    await p2.pg.close();
    return 'aba certa pelos dois caminhos; ajuda legível com a rede parada';
  });

  return R;
};
