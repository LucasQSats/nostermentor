// test/telas/t2_t3.test.js — T2 e T3 (14 T2/T3) pelo painel, contra o
// servidor falso: fluxo carregado → T3; T2c herdado; T2b nos dois textos
// (aceite 2); cancelar; timeout de 45 s (aceite 5); "Verificar de novo";
// publicação concorrente; dois sites → dois bancos (aceite 3); 1200×600.
const { abrir, varrer, coletor, assert, entrarCom, semearSite, esperarT2, lerBanco } = require('../util.js');
const F = require('../fabrica.js');

const T2B_SEM_REDE = 'Não consegui falar com nenhum relay. Pode ser a rede, pode ser o Tor. Tentar de novo? Ou continue sem rede: o que você fizer fica neste navegador até conseguir publicar.';
const T2B_SEM_SITE = 'Não encontrei um site publicado com esta chave. Vamos começar um?';

module.exports = async function (ctx, u) {
  const { R, it, pulado } = coletor();
  if (!u.falso) { pulado('telas/t2_t3 (todos os casos)', 'servidor falso indisponível'); return R; }
  const f = u.falso, servers = [f.base];
  const ch = F.chave();
  const sj = F.siteExemplo(ch, { servers });
  f.blob(sj.bytes, 'application/json');
  const man = F.manifest(ch, { paths: F.pathsDoExemplo(sj), servers, title: 'T', created_at: F.agora() - 60 });
  const manVelho = F.manifest(ch, { paths: { '/index.html': F.sha256('v') }, servers, created_at: F.agora() - 9000 });
  f.relay('t-atual', { eventos: [man, F.perfil(ch)] });
  f.relay('t-antigo', { eventos: [manVelho] });
  f.relay('t-vazio', { modo: 'vazio' });
  f.relay('t-mudo', { modo: 'mudo' });
  f.relay('t-lento', { modo: 'lento', atrasoMs: 1200, eventos: [man] });
  const relays4 = ['t-atual', 't-antigo', 't-vazio', 't-lento'].map(n => f.ws(n));

  await it('fluxo carregado: T1 → T2 (passos ao vivo, textos de 14 T2) → T3 com a linha de resumo, saúde "1 de 4 relays" nos quatro estados, contagens, backup "nada só aqui", atalhos e últimos artigos; varredura limpa', async () => {
    const p = await abrir(ctx, u.url);
    await semearSite(p.pg, ch, { relays: relays4, servers });
    await entrarCom(p.pg, ch.nsec);
    assert(await p.pg.isVisible('#cancelar-t2'), 'Cancelar não está visível em T2');
    const d = await esperarT2(p.pg, 30000);
    assert(d.tela === 't3', 'não chegou a T3: ' + JSON.stringify(d));
    const est = await p.pg.evaluate(() => ({
      resumo: document.getElementById('resumo-carga').textContent,
      saude: document.getElementById('saude-resumo').textContent,
      relays: [...document.querySelectorAll('#lista-relays li')].map(li => li.getAttribute('data-estado') + ':' + li.querySelector('code').textContent),
      quando: document.getElementById('saude-quando').textContent,
      republicar: (() => { const b = document.getElementById('republicar'); return b ? b.disabled : null; })(),
      alteracoes: document.getElementById('alteracoes-resumo').textContent,
      backup: document.getElementById('backup-resumo').textContent,
      verSite: document.getElementById('ver-site').getAttribute('href'),
      ultimos: [...document.querySelectorAll('#cartao-ultimos li')].map(li => li.textContent.trim()),
      nomeSite: document.getElementById('nome-site').textContent,
      publicar: document.getElementById('btn-publicar').textContent,
      apoie: !!document.getElementById('cartao-apoie'),
      faixa: document.getElementById('faixa').hidden
    }));
    await p.pg.screenshot({ path: u.captura('t3-carregado'), fullPage: true });
    assert(/^Site carregado: 2 páginas, 3 artigos, 1 arquivos de mídia\. Publicado pela última vez em \d{4}-\d{2}-\d{2}\.$/.test(est.resumo), est.resumo);
    assert(est.saude === 'Seu site está em 2 de 4 relays', est.saude);
    assert(est.relays.join(' ') === `atual:${f.ws('t-atual')} atual:${f.ws('t-lento')} antigo:${f.ws('t-antigo')} sem:${f.ws('t-vazio')}`, est.relays.join(' '));
    // desde o M4 o botão está ligado (reenvia o manifest já assinado, sem a chave)
    assert(/^Verificado em \d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC$/.test(est.quando) && est.republicar === false, est.quando + ' / republicar=' + est.republicar);
    assert(est.alteracoes === 'Tudo o que está aqui está publicado.' && est.backup === 'Nada só neste navegador: tudo o que está aqui veio da rede.', est.alteracoes + ' | ' + est.backup);
    assert(est.verSite === `https://${ch.npub}.nsite.lol/`, est.verSite);
    assert(est.ultimos.length === 3 && /^2026-08-20 Terceiro artigo/.test(est.ultimos[0]), JSON.stringify(est.ultimos));
    assert(est.nomeSite === 'Site de Teste' && est.publicar === 'Nada a publicar' && est.apoie && est.faixa, JSON.stringify([est.nomeSite, est.publicar, est.apoie, est.faixa]));
    const v = await varrer(p.pg, ch.nsec);
    assert(v.achados.length === 0, v.achados.join(' | '));
    assert(v.bancos.includes('nostermentor/' + ch.pubkey), 'banco não existe: ' + v.bancos);
    // cartão Apoie fecha por sessão
    await p.pg.click('#fechar-apoie');
    await p.pg.click('#menu .item[data-tela="t4"]'); await p.pg.click('#menu .item[data-tela="t3"]');
    await p.pg.waitForSelector('#cartao-saude');
    assert(!(await p.pg.$('#cartao-apoie')), 'cartão Apoie voltou na mesma sessão');
    assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros }));
    await p.pg.close();
    return est.saude + '; passos: ' + d.passos.map(x => x.classe.replace('passo ', '') + '=' + x.estado).join(', ');
  });

  await it('T2: passos mostram "N de M responderam", "encontrado em N relays", "hash conferido ✓", "N rascunhos preservados", "pronto" (gravados por MutationObserver — a carga local leva < 1 s)', async () => {
    const p = await abrir(ctx, u.url);
    await semearSite(p.pg, ch, { relays: relays4, servers });
    // A carga contra o servidor falso acaba antes de qualquer sondagem por
    // polling pegar o último estado de T2 (T3 substitui a tela). Um
    // observador de mutações grava o texto dos passos a cada mudança.
    await p.pg.evaluate(() => { window.__passos = []; new MutationObserver(() => { const ol = document.getElementById('passos'); if (ol) window.__passos.push(ol.textContent.replace(/\s+/g, ' ').trim()); }).observe(document.getElementById('app'), { subtree: true, childList: true, characterData: true }); });
    await entrarCom(p.pg, ch.nsec);
    await esperarT2(p.pg, 30000);
    const log = await p.pg.evaluate(() => window.__passos);
    const ultimo = log[log.length - 1] || '';
    assert(/Conectando aos relays… 4 de 4 responderam/.test(ultimo) && /Procurando o seu site… encontrado em 3 relays/.test(ultimo) && /hash conferido ✓/.test(ultimo) && /Juntando com o que já estava neste navegador… 0 rascunhos preservados/.test(ultimo) && /Conferindo a saúde da publicação… pronto/.test(ultimo), JSON.stringify(ultimo));
    assert(log.some(t => /1 de 4 responderam|2 de 4 responderam|3 de 4 responderam/.test(t)), 'nenhum estado intermediário "N de 4" foi visto: ' + log.length + ' mutações');
    await p.pg.close();
    return `${log.length} mutações; final: ${ultimo.slice(0, 160)}…`;
  });

  await it('T2c: site de outra ferramenta (sem site.json) → texto de 14 T2c com "4 arquivos"; "Ir para o Início" → T3 com a linha de herdados e "Site sem nome"→título do manifest', async () => {
    const chB = F.chave();
    const paths = { '/index.html': F.sha256('i'), '/a.png': F.sha256('a'), '/b.mp4': F.sha256('b'), '/c.webp': F.sha256('c') };
    f.relay('t-b', { eventos: [F.manifest(chB, { paths, servers: ['https://cdn.exemplo.test'], title: 'Site Herdado', client: 'nsyte' })] });
    const p = await abrir(ctx, u.url);
    await semearSite(p.pg, chB, { relays: [f.ws('t-b')], servers });
    await entrarCom(p.pg, chB.nsec);
    const d = await esperarT2(p.pg, 30000);
    assert(d.desfecho === 't2c', JSON.stringify(d));
    const txt = await p.pg.textContent('#t2c');
    assert(/Este site foi publicado por outra ferramenta\. O Nostermentor vê os 4 arquivos dele, mas não consegue editá-los como páginas e artigos\./.test(txt), txt);
    await p.pg.screenshot({ path: u.captura('t2c-herdado'), fullPage: true });
    await p.pg.click('#ir-inicio');
    await p.pg.waitForSelector('#t3');
    const est = await p.pg.evaluate(() => ({ resumo: document.getElementById('resumo-carga').textContent, herdados: document.getElementById('herdados-resumo').textContent, nome: document.getElementById('nome-site').textContent, saude: document.getElementById('saude-resumo').textContent }));
    assert(/^Site carregado: 4 arquivos herdados de outra ferramenta\./.test(est.resumo) && /4 arquivos herdados/.test(est.herdados) && est.nome === 'Site Herdado' && est.saude === 'Seu site está em 1 de 1 relays', JSON.stringify(est));
    const b = await lerBanco(p.pg, chB.pubkey);
    assert(b.media.length === 4 && b.media.every(m => m.origin === 'network'), 'media: ' + b.media.length);
    assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros }));
    await p.pg.close();
  });

  await it('aceite 2 (a): relays respondem, sem manifest → T2b "' + T2B_SEM_SITE.slice(0, 40) + '…" com 3 botões; "Começar um site novo" cria site + Home rascunho e vai a T7; T3 mostra 1 alteração e "Publicar (1)"', async () => {
    const chN = F.chave();
    const p = await abrir(ctx, u.url);
    await semearSite(p.pg, chN, { relays: [f.ws('t-vazio'), f.ws('t-mudo')], servers });
    await entrarCom(p.pg, chN.nsec);
    const t0 = Date.now();
    const d = await esperarT2(p.pg, 60000);
    assert(d.desfecho === 't2b-sem-site', JSON.stringify(d));
    const txt = await p.pg.textContent('#t2b-sem-site p');
    assert(txt === T2B_SEM_SITE, JSON.stringify(txt));
    const botoes = await p.pg.evaluate(() => [...document.querySelectorAll('#t2b-sem-site button')].map(b => b.textContent));
    assert(botoes.join('|') === 'Começar um site novo|Importar um backup|Tentar outros relays', botoes.join('|'));
    await p.pg.screenshot({ path: u.captura('t2b-sem-site'), fullPage: true });
    await p.pg.click('#comecar-site');
    await p.pg.waitForFunction(() => Shell.telaAtual() === 't7');
    const b = await lerBanco(p.pg, chN.pubkey);
    assert(b.site && b.site.home.mode === 'page' && b.pages.length === 1 && b.pages[0].status === 'draft' && b.pages[0].title === 'Início', JSON.stringify([b.site && b.site.home, b.pages.length]));
    await p.pg.click('#menu .item[data-tela="t3"]');
    await p.pg.waitForSelector('#cartao-saude');
    const est = await p.pg.evaluate(() => ({ saude: document.getElementById('saude-nao-publicado').textContent, alt: document.getElementById('alteracoes-resumo').textContent, publicar: document.getElementById('btn-publicar').textContent, backup: document.getElementById('backup-resumo').textContent }));
    assert(est.saude === 'Seu site ainda não foi publicado.' && est.alt === '0 artigos, 1 páginas, 0 mídias' && est.publicar === 'Publicar (1)' && /Você ainda não fez backup/.test(est.backup), JSON.stringify(est));
    await p.pg.close();
    return `T2 concluiu em ${((Date.now() - t0) / 1000).toFixed(1)} s (o relay mudo segura até o timeout)`;
  });

  await it('aceite 2 (b): nenhum relay alcançável → T2b "' + T2B_SEM_REDE.slice(0, 35) + '…" (texto DISTINTO); "Continuar sem rede" → T3', async () => {
    const chN = F.chave();
    const p = await abrir(ctx, u.url);
    await semearSite(p.pg, chN, { relays: ['wss://127.0.0.1:1/x', 'wss://nao-existe.invalid/', f.ws('t-fecha')], servers });
    f.relay('t-fecha', { modo: 'fecha' });
    await entrarCom(p.pg, chN.nsec);
    const d = await esperarT2(p.pg, 60000);
    assert(d.desfecho === 't2b-sem-rede', JSON.stringify(d));
    const txt = await p.pg.textContent('#t2b-sem-rede p');
    assert(txt === T2B_SEM_REDE, JSON.stringify(txt));
    const botoes = await p.pg.evaluate(() => [...document.querySelectorAll('#t2b-sem-rede button')].map(b => b.textContent));
    assert(botoes.join('|') === 'Tentar de novo|Continuar sem rede|Importar um backup', botoes.join('|'));
    assert(/0 de 3 responderam/.test(d.passos[0].estado), d.passos[0].estado);
    await p.pg.screenshot({ path: u.captura('t2b-sem-rede'), fullPage: true });
    await p.pg.click('#continuar-sem-rede');
    await p.pg.waitForSelector('#t3');
    assert((await p.pg.textContent('#saude-nao-publicado')) === 'Seu site ainda não foi publicado.');
    await p.pg.close();
  });

  await it('Cancelar em T2 volta a T1 (sessão esquecida, varredura limpa, banco fechado)', async () => {
    const chN = F.chave();
    const p = await abrir(ctx, u.url);
    await semearSite(p.pg, chN, { relays: [f.ws('t-mudo')], servers });
    await entrarCom(p.pg, chN.nsec);
    await p.pg.click('#cancelar-t2');
    await p.pg.waitForSelector('#t1');
    const est = await p.pg.evaluate(() => ({ sessao: Shell.temSessao(), dados: Shell.dados(), moldura: !!document.getElementById('moldura') }));
    assert(!est.sessao && est.dados === null && !est.moldura, JSON.stringify(est));
    const v = await varrer(p.pg, chN.nsec);
    assert(v.achados.length === 0, v.achados.join(' | '));
    assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros }));
    await p.pg.close();
  });

  await it('aceite 5: relay que nunca responde não segura T2 além de 45 s (mudo + atual → T3 entre 44 e 60 s, "1 de 2 responderam")', async () => {
    const p = await abrir(ctx, u.url);
    await semearSite(p.pg, ch, { relays: [f.ws('t-mudo'), f.ws('t-atual')], servers });
    await entrarCom(p.pg, ch.nsec);
    const t0 = Date.now();
    const d = await esperarT2(p.pg, 70000);
    const dt = Date.now() - t0;
    assert(d.tela === 't3' && dt >= 44000 && dt <= 60000, JSON.stringify([d.tela, dt]));
    const b = await lerBanco(p.pg, ch.pubkey);
    assert(b.published.health.relays_unreachable[0] === f.ws('t-mudo') && b.published.health.relays_with_manifest[0] === f.ws('t-atual'), JSON.stringify(b.published.health));
    await p.pg.close();
    return `${(dt / 1000).toFixed(1)} s`;
  });

  await it('T3 "Verificar de novo": relay que perdeu o manifest passa a "sem"; "Verificado em" muda; health gravado', async () => {
    const p = await abrir(ctx, u.url);
    await semearSite(p.pg, ch, { relays: [f.ws('t-atual'), f.ws('t-antigo')], servers });
    await entrarCom(p.pg, ch.nsec);
    await esperarT2(p.pg, 30000);
    const antes = await p.pg.evaluate(() => ({ q: document.getElementById('saude-quando').textContent, r: [...document.querySelectorAll('#lista-relays li')].map(li => li.getAttribute('data-estado')) }));
    f.relay('t-antigo', { modo: 'vazio' });
    await p.pg.waitForTimeout(1100);   // minuto pode não virar; o que se confere é o estado do relay
    await p.pg.click('#verificar-saude');
    await p.pg.waitForFunction(() => { const li = document.querySelectorAll('#lista-relays li'); return li.length === 2 && [...li].some(x => x.getAttribute('data-estado') === 'sem'); }, null, { timeout: 20000 });
    const depois = await p.pg.evaluate(() => ({ r: [...document.querySelectorAll('#lista-relays li')].map(li => li.getAttribute('data-estado')), saude: document.getElementById('saude-resumo').textContent, btn: document.getElementById('verificar-saude').disabled }));
    assert(antes.r.join() === 'atual,antigo' && depois.r.join() === 'atual,sem' && depois.saude === 'Seu site está em 1 de 2 relays' && depois.btn === false, JSON.stringify([antes, depois]));
    const b = await lerBanco(p.pg, ch.pubkey);
    assert(b.published.health.relays_missing[0] === f.ws('t-antigo'), JSON.stringify(b.published.health));
    f.relay('t-antigo', { eventos: [manVelho] });
    await p.pg.close();
  });

  await it('publicação concorrente: manifest mais novo na rede na 2ª entrada → faixa de aviso de 14 T2 e T3 com a versão nova', async () => {
    const chC = F.chave();
    const sjC1 = F.siteExemplo(chC, { servers }); f.blob(sjC1.bytes, 'application/json');
    const m1 = F.manifest(chC, { paths: F.pathsDoExemplo(sjC1), servers, created_at: F.agora() - 100 });
    f.relay('t-c', { eventos: [m1] });
    const p = await abrir(ctx, u.url);
    await semearSite(p.pg, chC, { relays: [f.ws('t-c')], servers });
    await entrarCom(p.pg, chC.nsec);
    await esperarT2(p.pg, 30000);
    await p.pg.click('#btn-trancar'); await p.pg.waitForSelector('#t1');
    const sjC2 = F.siteExemplo(chC, { servers, tituloHome: 'Início v2' }); f.blob(sjC2.bytes, 'application/json');
    const m2 = F.manifest(chC, { paths: F.pathsDoExemplo(sjC2), servers, created_at: F.agora() });
    f.relay('t-c', { eventos: [m2, m1] });
    await entrarCom(p.pg, chC.nsec);
    const d = await esperarT2(p.pg, 30000);
    // 41 — a faixa contempla o caso comum ("se foi você, está tudo certo") sem
    // perder as duas garantias que ela existe para dar.
    assert(d.tela === 't3' && /publicado a partir de outro navegador ou máquina/.test(d.faixa), JSON.stringify(d));
    assert(/atualizado a partir da rede/.test(d.faixa) && /rascunhos ficaram/.test(d.faixa), d.faixa);
    const b = await lerBanco(p.pg, chC.pubkey);
    assert(b.published.manifest_event_id === m2.id && b.pages.find(x => x.id === 'p-home').title === 'Início v2', 'não atualizou');
    await p.pg.screenshot({ path: u.captura('t3-concorrente'), fullPage: true });
    await p.pg.close();
  });

  await it('aceite 3: duas chaves nesta sessão → dois bancos nostermentor/<hex> distintos, cada um só com o seu site', async () => {
    const p = await abrir(ctx, u.url);
    const bancos = await p.pg.evaluate(() => indexedDB.databases().then(l => l.map(d => d.name).filter(n => n && n.startsWith('nostermentor/')).sort()));
    assert(bancos.includes('nostermentor/' + ch.pubkey) && bancos.length >= 2, JSON.stringify(bancos));
    const b1 = await lerBanco(p.pg, ch.pubkey);
    assert(b1.site.pubkey === ch.pubkey && b1.posts.length === 3, 'banco A: ' + JSON.stringify([b1.site && b1.site.pubkey, b1.posts.length]));
    await p.pg.close();
    return bancos.length + ' bancos';
  });

  await it('T3 cabe em 1200×600 sem rolagem horizontal; T2 idem', async () => {
    const p = await abrir(ctx, u.url);
    await semearSite(p.pg, ch, { relays: [f.ws('t-atual')], servers });
    await entrarCom(p.pg, ch.nsec);
    const m1 = await p.pg.evaluate(() => ({ larguraDoc: document.documentElement.scrollWidth, janela: innerWidth }));
    await esperarT2(p.pg, 30000);
    const m2 = await p.pg.evaluate(() => ({ larguraDoc: document.documentElement.scrollWidth, janela: innerWidth }));
    assert(m1.larguraDoc <= m1.janela && m2.larguraDoc <= m2.janela, JSON.stringify([m1, m2]));
    await p.pg.close();
  });

  return R;
};
