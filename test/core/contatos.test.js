// test/core/contatos.test.js — a Etapa 2 dos Contatos: as formas de contato
// que o dono publica, o bloco `[[contatos]]` e o esquema `nostr:` no filtro.
// O que esta suíte existe para provar, por ordem de gravidade:
//  1. SEGURANÇA — o HTML do bloco NÃO passa pelo DOMPurify (é molde de tema),
//     logo `Gerador.hrefSeguro` é a única barreira daqueles `<a>`; e o esquema
//     novo no filtro não pode ter aberto a porta a `javascript:`/`data:`;
//  2. a RESERVA DE MOLDE — o bloco tem de sair nos 22 temas,
//     medido a gerar os 22, não a ler o código. Quatro deles enumeram os oito
//     moldes à mão e não conhecem o nono;
//  3. QUEM NÃO USA NÃO MUDA — sem contato nenhum, o site.json não ganha uma
//     chave e a assinatura da configuração é a mesma de ontem (senão todo site
//     publicado passava a acusar "1 alteração por publicar");
//  4. o DADO, não a URL — o app monta o link a partir do que o dono escreveu,
//     num lugar só.
const { abrir, coletor, assert } = require('../util.js');

module.exports = async function (ctx, u) {
  const { R, it } = coletor();
  const p = await abrir(ctx, u.url);
  const r = await p.pg.evaluate(async () => {
    const out = {};
    // chave de exemplo sem dono (o ponto gerador da secp256k1), nunca um site real
    const NPUB = 'npub10xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqpkge6d';

    // ---- 1. o que cada canal aceita e recusa ----------------------------
    const casos = [
      // [kind, o que o dono escreve, o valor guardado ou null se recusado]
      ['email', 'contato@exemplo.org', 'contato@exemplo.org'],
      ['email', 'mailto:contato@exemplo.org', 'contato@exemplo.org'],
      ['email', 'contato arroba exemplo', null],
      ['email', 'a@b', null],
      ['whatsapp', '+55 (11) 99999-9999', '5511999999999'],
      ['whatsapp', 'https://wa.me/message/ABC123', 'https://wa.me/message/ABC123'],
      ['whatsapp', 'meu zap', null],
      ['telegram', '@fulano', 'fulano'],
      ['telegram', 'https://t.me/fulano', 'fulano'],
      // o convite com "+" mostra o telefone — recusado de propósito (plano §3.3)
      ['telegram', '+5511999999999', null],
      ['instagram', 'https://instagram.com/fulano/', 'fulano'],
      ['x', '@fulano', 'fulano'],
      ['x', 'https://twitter.com/fulano', 'fulano'],
      ['nostr', 'nostr:' + NPUB, NPUB],
      ['nostr', NPUB, NPUB],
      ['nostr', 'npub1curta', null],
      ['signal', 'https://signal.me/#eu/abc-def', 'https://signal.me/#eu/abc-def'],
      ['signal', '+5511999999999', null],
      ['signal', 'https://exemplo.org/nao-e-signal', null],
      ['link', 'https://matrix.to/#/@eu:exemplo.org', 'https://matrix.to/#/@eu:exemplo.org'],
      ['link', 'http://sem-tls.exemplo', null],
      ['link', 'javascript:alert(1)', null],
      ['nao-existe', 'seja o que for', null]
    ];
    out.canais = casos.map(([kind, escrito, esperado]) => {
      const n = Contatos.normalizar({ kind: kind, value: escrito, label: '' });
      return { kind, escrito, esperado, obtido: n ? n.value : null, ok: (n ? n.value : null) === esperado };
    });
    out.canaisErrados = out.canais.filter(c => !c.ok);
    out.quantosCanais = Contatos.tipos().length;

    // a ordem é do dono e não se reordena sozinha; repetido do mesmo canal
    // com o mesmo valor sai; o rótulo só existe no "outro link"
    const lista = [
      { kind: 'nostr', value: NPUB, label: 'ignora-me' },
      { kind: 'email', value: 'a@exemplo.org', label: '' },
      { kind: 'email', value: 'a@exemplo.org', label: '' },
      { kind: 'link', value: 'https://exemplo.org/loja', label: 'Minha loja' },
      { kind: 'email', value: 'nao e email', label: '' }
    ];
    const limpa = Contatos.normalizarLista(lista);
    out.ordem = limpa.map(c => c.kind + ':' + c.value).join(' | ');
    out.rotuloDoNostr = limpa[0].label;
    out.rotuloDoLink = limpa[2].label;

    // ---- 2. o filtro e o juiz -------------------------------------------
    const perigosos = ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<b>x', 'vbscript:x', '//mau.test/p', ' javascript:alert(1)', 'file:///etc/passwd', 'nostr:javascript:alert(1)', 'nostr:', 'nostr:npub1'];
    out.recusados = perigosos.filter(x => Gerador.hrefSeguro(x) === null).length;
    out.perigososTotal = perigosos.length;
    out.aceites = ['nostr:' + NPUB, 'mailto:a@exemplo.org', 'https://ok.test/x', '/interna'].map(x => !!Gerador.hrefSeguro(x));

    // o `nostr:` passa a atravessar o filtro do CONTEÚDO (L9 do 08), e o que
    // era barrado continua barrado
    out.filtro = {
      nostrMd: Gerador.renderizarCorpo('[Fale comigo](nostr:' + NPUB + ')', null).trim(),
      nostrHtml: Gerador.renderizarCorpo('<a href="nostr:' + NPUB + '">Fale</a>', null).trim(),
      js: Gerador.renderizarCorpo('<a href="javascript:alert(1)">x</a>', null).trim(),
      dataHtml: Gerador.renderizarCorpo('<a href="data:text/html,<b>x">x</a>', null).trim(),
      vbs: Gerador.renderizarCorpo('<a href="vbscript:x">x</a>', null).trim(),
      script: Gerador.renderizarCorpo('<script>alert(1)<\/script>', null).trim(),
      onerro: Gerador.renderizarCorpo('<img src=x onerror="alert(1)">', null).trim()
    };

    // ---- 3. o bloco nos 22 temas ----------------------------------------
    const contatos = [
      { kind: 'email', value: 'contato@exemplo.org', label: '' },
      { kind: 'whatsapp', value: '5511999999999', label: '' },
      { kind: 'nostr', value: NPUB, label: '' },
      { kind: 'link', value: 'https://matrix.to/#/@eu:exemplo.org', label: 'Matrix' }
    ];
    function dados(comContatos, corpo, temaId) {
      const site = Modelo.sitePadrao('a'.repeat(64), 'npub1teste');
      site.title = 'Meu Site';
      site.home = { mode: 'blog', page_id: null, latest_posts: 0 };
      site.contacts = comContatos ? JSON.parse(JSON.stringify(contatos)) : [];
      if (temaId) site.theme = { id: temaId, version: 1, options: {} };
      const pag = Modelo.novaPagina('Contato'); pag.id = 'p-1'; pag.status = 'published'; pag.body = corpo;
      return { site: site, pages: [pag], posts: [], media: [] };
    }
    // ⚠️ A CONTAGEM primeiro: uma sonda que compara zero casos diz "tudo certo"
    // e parece sucesso (02 §F.1). O teste falha se não forem os 22.
    const ids = Temas.todos().map(t => t.manifesto.id).sort();
    out.quantosTemas = ids.length;
    out.semMoldeProprio = ids.filter(id => !Temas.porId(id).templates.contatos);
    out.temasComBloco = [];
    out.temasSemBloco = [];
    for (const id of ids) {
      const g = await Gerador.gerarSite(dados(true, '[[contatos: Fale comigo]]', id));
      const html = (g.arquivos.find(a => a.path === '/contato.html') || {}).texto || '';
      const completo = html.indexOf('<section class="contatos">') !== -1
        && html.indexOf('<h2>Fale comigo</h2>') !== -1
        && html.indexOf('href="mailto:contato@exemplo.org"') !== -1
        && html.indexOf('href="https://wa.me/5511999999999"') !== -1
        && html.indexOf('href="nostr:' + NPUB + '"') !== -1
        && html.indexOf('undefined') === -1;
      (completo ? out.temasComBloco : out.temasSemBloco).push(id);
    }

    const gPadrao = await Gerador.gerarSite(dados(true, '[[contatos: Fale comigo]]', 'padrao'));
    out.htmlBloco = (gPadrao.arquivos.find(a => a.path === '/contato.html') || {}).texto || '';

    // sem título, sem `<h2>`; sem contato nenhum, sem bloco; no meio da
    // frase, texto
    const gSemTitulo = await Gerador.gerarSite(dados(true, '[[contatos]]', 'padrao'));
    out.semTitulo = (gSemTitulo.arquivos.find(a => a.path === '/contato.html') || {}).texto || '';
    const gVazio = await Gerador.gerarSite(dados(false, '[[contatos]]', 'padrao'));
    out.semContatos = (gVazio.arquivos.find(a => a.path === '/contato.html') || {}).texto || '';
    const gMeio = await Gerador.gerarSite(dados(true, 'Escreva [[contatos]] no meio.', 'padrao'));
    out.noMeio = (gMeio.arquivos.find(a => a.path === '/contato.html') || {}).texto || '';
    // dentro de bloco de código continua sendo exemplo, não bloco
    const gCerca = await Gerador.gerarSite(dados(true, '```\n[[contatos]]\n```', 'padrao'));
    out.naCerca = (gCerca.arquivos.find(a => a.path === '/contato.html') || {}).texto || '';

    // 56 — a reserva não pode ter mudado os moldes que já existiam
    const tDiario = Temas.porId('diario');
    out.reserva = {
      proprio: Temas.molde(tDiario, 'layout') === tDiario.templates.layout,
      caiuNaReserva: Temas.molde(tDiario, 'contatos') === Temas.moldes.contatos,
      desconhecido: Temas.molde(tDiario, 'nao-existe') === undefined
    };

    // determinismo: mesma entrada duas vezes, mesmos hashes
    const g1 = await Gerador.gerarSite(dados(true, '[[contatos: Fale comigo]]', 'padrao'));
    const g2 = await Gerador.gerarSite(dados(true, '[[contatos: Fale comigo]]', 'padrao'));
    out.determinista = JSON.stringify(g1.hashes) === JSON.stringify(g2.hashes);

    // ---- 4. o site.json e a assinatura ----------------------------------
    const comContatos = dados(true, 'x', 'padrao'), semContatos = dados(false, 'x', 'padrao');
    out.jsonCom = SiteJson.escrever(comContatos);
    out.jsonSem = SiteJson.escrever(semContatos);
    // ⚠️ A pergunta certa é: o MESMO site, com a chave vazia e sem a chave
    // nenhuma, assina igual? Comparar com o site de fábrica só provaria que
    // dois sites diferentes são diferentes.
    const semAChave = JSON.parse(JSON.stringify(semContatos.site));
    delete semAChave.contacts;
    out.assinaturaIgual = SiteJson.assinaturaSite(semContatos.site) === SiteJson.assinaturaSite(semAChave);
    out.assinaturaMuda = SiteJson.assinaturaSite(comContatos.site) !== SiteJson.assinaturaSite(semContatos.site);
    // a volta pela rede: o que é válido volta, o lixo fica pelo caminho
    const volta = SiteJson.ler(out.jsonCom);
    out.voltaOk = volta.ok;
    out.voltaContatos = volta.ok ? (volta.dados.site.contacts || []).map(c => c.kind).join(',') : '';
    const sujo = JSON.parse(out.jsonCom);
    sujo.site.contacts.push({ kind: 'email', value: 'javascript:alert(1)' });
    sujo.site.contacts.push({ kind: 'inventado', value: 'x' });
    const voltaSuja = SiteJson.ler(JSON.stringify(sujo));
    out.voltaSuja = voltaSuja.ok ? voltaSuja.dados.site.contacts.length : -1;
    // e um site.json SEM a chave nenhuma não a ganha na volta
    const voltaSem = SiteJson.ler(out.jsonSem);
    out.voltaSemTemChave = voltaSem.ok ? ('contacts' in voltaSem.dados.site) : true;

    // ---- 5. o convite das mensagens ligadas (D1, 2026-09-14) -------------
    // 14 T13 decisão 31: com as mensagens ligadas, o bloco convida sozinho a
    // escrever pelo Nostr com a npub do site. Quem não liga não muda um byte.
    const dono = Chave.gerar();
    const LIGADAS = { enabled: true, relays: ['wss://auth.nostr1.com', 'wss://nos.lol'] };
    const comEmail = [{ kind: 'email', value: 'contato@exemplo.org', label: '' }];
    function comCaixa(contatosDoSite, messages, temaId) {
      const d = dados(false, '[[contatos: Fale comigo]]', temaId);
      d.site.pubkey = dono.pubkey; d.site.npub = dono.npub;
      d.site.contacts = JSON.parse(JSON.stringify(contatosDoSite));
      if (messages === undefined) delete d.site.messages; else d.site.messages = messages;
      return d;
    }
    const pagina = (g) => (g.arquivos.find(a => a.path === '/contato.html') || {}).texto || '';
    out.conviteNpub = dono.npub;
    out.conviteComBloco = []; out.conviteSemBloco = [];
    for (const id of ids) {
      const html = pagina(await Gerador.gerarSite(comCaixa([], LIGADAS, id)));
      const ok = html.indexOf('<section class="contatos">') !== -1
        && html.indexOf('href="nostr:' + dono.npub + '"') !== -1
        && html.indexOf('>' + Contatos.CONVITE_NOSTR + '</a>') !== -1
        && html.indexOf('<code class="contato-codigo">' + dono.npub + '</code>') !== -1
        && html.indexOf('undefined') === -1;
      (ok ? out.conviteComBloco : out.conviteSemBloco).push(id);
    }
    const hashes = async (d) => JSON.stringify((await Gerador.gerarSite(d)).hashes);
    const semCampo = await hashes(comCaixa(comEmail, undefined, 'padrao'));
    out.desligadoIgual = (await hashes(comCaixa(comEmail, { enabled: false, relays: LIGADAS.relays }, 'padrao'))) === semCampo;
    out.semRelaysIgual = (await hashes(comCaixa(comEmail, { enabled: true, relays: [] }, 'padrao'))) === semCampo;
    out.ligadoMuda = (await hashes(comCaixa(comEmail, LIGADAS, 'padrao'))) !== semCampo;
    out.nadaSemBloco = pagina(await Gerador.gerarSite(comCaixa([], { enabled: false, relays: LIGADAS.relays }, 'padrao'))).indexOf('class="contatos"') === -1;
    // o campo Nostr com a npub do PRÓPRIO site vira o convite, na posição que o
    // dono deixou, e não sai duas vezes
    const hP = pagina(await Gerador.gerarSite(comCaixa([{ kind: 'nostr', value: dono.npub, label: '' }].concat(comEmail), LIGADAS, 'padrao')));
    out.proprio = { nostr: (hP.match(/<li class="contato contato-nostr">/g) || []).length, convite: hP.indexOf('>' + Contatos.CONVITE_NOSTR + '</a>') !== -1, ordem: hP.indexOf('contato-nostr') < hP.indexOf('contato-email') };
    // com OUTRA npub no campo (a pessoal do dono), o campo fica como está e o
    // convite do site vem no FIM
    const hO = pagina(await Gerador.gerarSite(comCaixa([{ kind: 'nostr', value: NPUB, label: '' }], LIGADAS, 'padrao')));
    out.outra = { nostr: (hO.match(/<li class="contato contato-nostr">/g) || []).length, pessoalPrimeiro: hO.indexOf('nostr:' + NPUB) !== -1 && hO.indexOf('nostr:' + NPUB) < hO.indexOf('nostr:' + dono.npub) };
    out.npubInvalidaNaoConvida = Contatos.npubDoConvite({ npub: 'npub1curta', messages: LIGADAS }) === null;
    return out;
  });

  // ---- 1. os canais -------------------------------------------------------
  await it('os oito canais existem e cada um aceita o que é seu e recusa o resto', () => {
    assert(r.quantosCanais === 8, 'canais oferecidos: ' + r.quantosCanais);
    assert(r.canaisErrados.length === 0, JSON.stringify(r.canaisErrados));
  });
  await it('a ordem é a que o dono deixou, o repetido sai, e o rótulo livre só existe no "outro link"', () => {
    assert(r.ordem === 'nostr:npub10xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqpkge6d | email:a@exemplo.org | link:https://exemplo.org/loja', r.ordem);
    assert(r.rotuloDoNostr === '', 'o rótulo de um canal conhecido não pode ser livre: ' + r.rotuloDoNostr);
    assert(r.rotuloDoLink === 'Minha loja', r.rotuloDoLink);
  });

  // ---- 2. segurança -------------------------------------------------------
  await it('o juiz do marcador recusa todo esquema perigoso e aceita nostr:, mailto:, http(s) e caminho interno', () => {
    assert(r.recusados === r.perigososTotal, 'recusou ' + r.recusados + ' de ' + r.perigososTotal);
    assert(r.aceites.every(Boolean), JSON.stringify(r.aceites));
  });
  await it('o `nostr:` passa a atravessar o filtro do conteúdo, e o que era barrado continua barrado', () => {
    assert(/href="nostr:npub10xlxvlh/.test(r.filtro.nostrMd), 'markdown: ' + r.filtro.nostrMd);
    assert(/href="nostr:npub10xlxvlh/.test(r.filtro.nostrHtml), 'html: ' + r.filtro.nostrHtml);
    assert(!/javascript:/i.test(r.filtro.js), 'javascript: passou: ' + r.filtro.js);
    assert(!/data:text\/html/i.test(r.filtro.dataHtml), 'data: passou: ' + r.filtro.dataHtml);
    assert(!/vbscript:/i.test(r.filtro.vbs), 'vbscript: passou: ' + r.filtro.vbs);
    assert(r.filtro.script.indexOf('<script') === -1, 'script passou: ' + r.filtro.script);
    assert(r.filtro.onerro.indexOf('onerror') === -1, 'onerror passou: ' + r.filtro.onerro);
  });

  // ---- 3. o bloco e os temas ----------------------------------------------
  await it('56: o bloco sai nos 22 temas — inclusive nos quatro que enumeram os oito moldes à mão', () => {
    assert(r.quantosTemas === 22, 'temas medidos: ' + r.quantosTemas + ' (se mudou o número, mudar este teste de propósito, não por acidente)');
    assert(r.semMoldeProprio.length === 4, 'temas sem o molde novo no próprio jogo: ' + JSON.stringify(r.semMoldeProprio));
    assert(r.temasSemBloco.length === 0, 'temas sem o bloco: ' + JSON.stringify(r.temasSemBloco));
    assert(r.temasComBloco.length === 22, 'temas com o bloco: ' + r.temasComBloco.length);
  });
  await it('56: a reserva devolve o molde do tema quando ele tem, o do core quando não tem, e nada quando o nome não existe', () => {
    assert(r.reserva.proprio, 'o molde próprio do tema tem de ganhar');
    assert(r.reserva.caiuNaReserva, 'o molde que falta tem de vir do core');
    assert(r.reserva.desconhecido, 'nome inexistente tem de dar undefined, não um molde errado');
  });
  await it('o bloco sai com o dado do dono virado em link, e o Nostr sai em dobro (link e texto para copiar)', () => {
    assert(r.htmlBloco.indexOf('<a href="mailto:contato@exemplo.org" rel="external noopener noreferrer">contato@exemplo.org</a>') !== -1, r.htmlBloco);
    assert(r.htmlBloco.indexOf('<a href="https://wa.me/5511999999999" rel="external noopener noreferrer">+5511999999999</a>') !== -1, r.htmlBloco);
    assert(/<code class="contato-codigo">npub10xlxvlh/.test(r.htmlBloco), 'a npub tem de sair escrita, para copiar: ' + r.htmlBloco);
    assert(r.htmlBloco.indexOf('<span class="contato-canal">Matrix</span>') !== -1, 'o rótulo do "outro link" tem de aparecer: ' + r.htmlBloco);
    assert(r.htmlBloco.indexOf('undefined') === -1, 'saiu um undefined no HTML publicado');
  });
  await it('sem título não sai cabeçalho; sem contato nenhum o bloco não sai; no meio da frase e dentro de código fica texto', () => {
    assert(r.semTitulo.indexOf('<section class="contatos">') !== -1 && r.semTitulo.indexOf('<h2>') === -1, r.semTitulo);
    assert(r.semContatos.indexOf('class="contatos"') === -1, 'bloco vazio no site: ' + r.semContatos);
    assert(r.semContatos.indexOf('[[contatos]]') !== -1, 'o marcador tem de ficar à vista para o dono perceber que falta preencher');
    assert(r.noMeio.indexOf('[[contatos]]') !== -1 && r.noMeio.indexOf('class="contatos"') === -1, 'no meio da frase tem de ficar texto: ' + r.noMeio);
    assert(r.naCerca.indexOf('[[contatos]]') !== -1 && r.naCerca.indexOf('class="contatos"') === -1, 'dentro de ``` tem de ficar exemplo: ' + r.naCerca);
  });
  await it('13 §5.2: o bloco é determinista', () => assert(r.determinista, 'os hashes mudaram entre duas gerações iguais'));

  // ---- 4. o site.json -----------------------------------------------------
  await it('`contacts` viaja no site.json, mas a chave NÃO aparece quando não há nenhum — senão todo site publicado acusava uma alteração que ninguém fez', () => {
    assert(r.jsonCom.indexOf('"contacts":[') !== -1, r.jsonCom.slice(0, 400));
    assert(r.jsonSem.indexOf('contacts') === -1, 'a chave apareceu vazia: ' + r.jsonSem.slice(0, 400));
    assert(r.assinaturaIgual, 'a assinatura de um site sem contatos mudou — isto mandaria todo mundo republicar');
    assert(r.assinaturaMuda, 'preencher um contato TEM de acender o contador de Publicar');
  });
  await it('a volta pela rede passa pela mesma lista branca: o válido volta, o inventado e o perigoso ficam pelo caminho', () => {
    assert(r.voltaOk, 'o site.json com contatos não voltou');
    assert(r.voltaContatos === 'email,whatsapp,nostr,link', r.voltaContatos);
    assert(r.voltaSuja === 4, 'entraram itens a mais vindos da rede: ' + r.voltaSuja);
    assert(r.voltaSemTemChave === false, 'um site.json sem a chave não a pode ganhar na volta');
  });

  // ---- 5. o convite das mensagens ligadas (D1) -----------------------------
  await it('D1: com as mensagens LIGADAS e nenhum contato, o bloco sai nos 22 temas com o convite, o link nostr: e a npub do site para copiar', () => {
    assert(r.quantosTemas === 22, 'temas medidos: ' + r.quantosTemas);
    assert(r.conviteSemBloco.length === 0, 'temas sem o convite: ' + JSON.stringify(r.conviteSemBloco));
    assert(r.conviteComBloco.length === 22, 'temas com o convite: ' + r.conviteComBloco.length);
  });
  await it('D1: quem NÃO liga não muda um byte — desligadas, ou ligadas sem relay nenhum, geram o mesmo site que sem o campo; ligadas, geram outro', () => {
    assert(r.desligadoIgual, '⚠️ as mensagens desligadas mudaram o site gerado — mudaria o site de quem não usa o recurso');
    assert(r.semRelaysIgual, 'ligadas sem relay nenhum não publicam 10050: convidar seria mentir, e o site mudou');
    assert(r.ligadoMuda, 'ligar as mensagens não mudou nada no site gerado');
    assert(r.nadaSemBloco, 'sem contato e com as mensagens desligadas, o bloco não pode sair');
    assert(r.npubInvalidaNaoConvida, 'uma npub malformada não pode virar convite');
  });
  await it('D1: o campo Nostr com a npub do próprio site VIRA o convite (uma vez, na ordem do dono); com outra npub, fica como está e o convite vem no fim', () => {
    assert(r.proprio.nostr === 1 && r.proprio.convite && r.proprio.ordem, JSON.stringify(r.proprio));
    assert(r.outra.nostr === 2 && r.outra.pessoalPrimeiro, JSON.stringify(r.outra));
  });

  await it('sem erros de página/console', () => assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros })));
  await p.pg.close();
  return R;
};
