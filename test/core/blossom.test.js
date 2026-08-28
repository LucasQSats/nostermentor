// test/core/blossom.test.js — core/blossom.js (escrita) contra o servidor
// falso: auth BUD-11 (formato do evento, tags t/x/server/expiration, as duas
// codificações), pré-flight BUD-06 com os TRÊS estados, upload BUD-02,
// espelho BUD-04 e remoção BUD-12. O que a rede real não dá sob encomenda:
// servidor que recusa o tipo, que estoura o tamanho, que não deixa apagar,
// que responde erro sem CORS (P26) e que não implementa o pré-flight.
const { abrir, coletor, assert } = require('../util.js');
const { conferirAuth } = require('../servidor_falso.js');

module.exports = async function (ctx, u) {
  const { R, it, pulado } = coletor();
  if (!u.falso) { pulado('core/blossom (todos os casos)', 'servidor falso indisponível'); return R; }
  const p = await abrir(ctx, u.url);
  const f = u.falso;

  f.blossom('bom', {});                                              // aceita tudo
  f.blossom('so-midia', { tiposRecusados: ['text/html', 'application/json'] });
  f.blossom('pequeno', { maxBytes: 100 });
  f.blossom('cego', { preflight: 'sempre200', semXReason: true, semCorsNoErro: true });   // o primal (P26/P33)
  f.blossom('sem-preflight', { preflight: 'nao_implementa' });
  f.blossom('sem-remocao', { remocao: 'recusa' });
  f.blossom('mentiroso', { descritorErrado: true });
  f.blossom('aberto', { exigeAuth: false });
  f.blossom('lento', { atrasoMs: 1500 });                                 // demora de propósito: torna o tempo-limite determinístico

  const U = (n) => f.url(n);
  // corre no navegador com uma chave de sessão gerada lá dentro
  const naPagina = (fn, arg) => p.pg.evaluate(fn, arg);
  const prep = `const ch = Chave.gerar(); const assinar = (m) => Chave.assinar(m, ch.sk);
    const bytes = new TextEncoder().encode(CORPO); const sha = await Blossom.sha256Hex(bytes);`;

  await it('auth BUD-11: kind 24242, content legível, tags t=upload / x=<sha> / expiration futura / server=domínio; base64 padrão e base64url diferem só na codificação', async () => {
    const r = await naPagina(() => {
      const ch = Chave.gerar();
      const sha = 'a'.repeat(64);
      const a = Blossom.autorizacao('upload', sha, 'https://CDN.Exemplo.test:443/x/', (m) => Chave.assinar(m, ch.sk));
      const tag = (n) => a.evento.tags.filter(t => t[0] === n).map(t => t[1]);
      const decodificar = (cab) => { const b = cab.slice(6); const norm = b.replace(/-/g, '+').replace(/_/g, '/'); return JSON.parse(atob(norm + '='.repeat((4 - norm.length % 4) % 4))); };
      return { kind: a.evento.kind, content: a.evento.content, t: tag('t'), x: tag('x'), server: tag('server'), exp: Number(tag('expiration')[0]),
        agora: Math.floor(Date.now() / 1000), verifica: Chave.verificar(a.evento),
        padraoEsquema: a.padrao.slice(0, 6), urlEsquema: a.url.slice(0, 6),
        temPadding: /=$/.test(a.padrao), semPadding: !/=/.test(a.url), iguais: JSON.stringify(decodificar(a.padrao)) === JSON.stringify(decodificar(a.url)) };
    });
    assert(r.kind === 24242 && r.content === 'Upload Blob' && r.verifica === true, JSON.stringify(r));
    assert(r.t[0] === 'upload' && r.x[0] === 'a'.repeat(64) && r.server[0] === 'cdn.exemplo.test', JSON.stringify([r.t, r.x, r.server]));
    assert(r.exp > r.agora && r.exp <= r.agora + 900, 'expiration fora da janela: ' + (r.exp - r.agora));
    assert(r.padraoEsquema === 'Nostr ' && r.urlEsquema === 'Nostr ' && r.semPadding && r.iguais, JSON.stringify(r));
    return `expira em ${r.exp - r.agora} s · server=${r.server[0]}`;
  });

  await it('auth: verbo delete leva t=delete e content próprio; verbo desconhecido lança', async () => {
    const r = await naPagina(() => {
      const ch = Chave.gerar(), assinar = (m) => Chave.assinar(m, ch.sk);
      const d = Blossom.autorizacao('delete', 'b'.repeat(64), 'https://x.test', assinar);
      let erro = null; try { Blossom.autorizacao('apagar-tudo', null, 'https://x.test', assinar); } catch (e) { erro = e.message; }
      return { t: d.evento.tags.filter(t => t[0] === 't')[0][1], content: d.evento.content, erro };
    });
    assert(r.t === 'delete' && r.content === 'Delete Blob' && /verbo de auth desconhecido/.test(r.erro || ''), JSON.stringify(r));
  });

  await it('o servidor falso valida a auth como a spec manda (token vencido, verbo trocado, x errado, server errado → recusa)', async () => {
    const cabs = await naPagina(() => {
      const ch = Chave.gerar(), assinar = (m) => Chave.assinar(m, ch.sk), sha = 'c'.repeat(64);
      const bom = Blossom.autorizacao('upload', sha, 'https://127.0.0.1', assinar).padrao;
      const outroVerbo = Blossom.autorizacao('delete', sha, 'https://127.0.0.1', assinar).padrao;
      const outroSha = Blossom.autorizacao('upload', 'd'.repeat(64), 'https://127.0.0.1', assinar).padrao;
      const outroServidor = Blossom.autorizacao('upload', sha, 'https://outro.test', assinar).padrao;
      const vencido = 'Nostr ' + btoa(JSON.stringify(Chave.assinar({ kind: 24242, created_at: 1000, tags: [['t', 'upload'], ['x', sha], ['expiration', '1100']], content: 'Upload Blob' }, ch.sk)));
      return { bom, outroVerbo, outroSha, outroServidor, vencido, sha };
    });
    const v = (cab) => conferirAuth(cab, 'upload', cabs.sha, '127.0.0.1');
    assert(v(cabs.bom).ok === true, 'o bom devia passar: ' + JSON.stringify(v(cabs.bom)));
    assert(v(cabs.outroVerbo).ok === false && /t !=/.test(v(cabs.outroVerbo).motivo), JSON.stringify(v(cabs.outroVerbo)));
    assert(v(cabs.outroSha).ok === false && /x tag/.test(v(cabs.outroSha).motivo), JSON.stringify(v(cabs.outroSha)));
    assert(v(cabs.outroServidor).ok === false && /server tag/.test(v(cabs.outroServidor).motivo), JSON.stringify(v(cabs.outroServidor)));
    assert(v(cabs.vencido).ok === false && /expiration/.test(v(cabs.vencido).motivo), JSON.stringify(v(cabs.vencido)));
    assert(v('lixo').ok === false && v(null).ok === false, 'cabeçalho lixo devia falhar');
  });

  await it('pré-flight: "aceita" no servidor bom; "recusa" com motivo tipo_nao_aceito e grande_demais; X-Reason exposto', async () => {
    const r = await naPagina(async (urls) => {
      const ch = Chave.gerar(), assinar = (m) => Chave.assinar(m, ch.sk);
      const bytes = new TextEncoder().encode('<!doctype html><title>t</title>');
      const sha = await Blossom.sha256Hex(bytes);
      const grande = new Uint8Array(400); const shaG = await Blossom.sha256Hex(grande);
      return {
        bom: await Blossom.preflight(urls.bom, { sha, tamanho: bytes.length, mime: 'text/html', assinar }),
        tipo: await Blossom.preflight(urls.soMidia, { sha, tamanho: bytes.length, mime: 'text/html', assinar }),
        tamanho: await Blossom.preflight(urls.pequeno, { sha: shaG, tamanho: grande.length, mime: 'image/png', assinar })
      };
    }, { bom: U('bom'), soMidia: U('so-midia'), pequeno: U('pequeno') });
    assert(r.bom.estado === 'aceita' && r.bom.status === 200, JSON.stringify(r.bom));
    assert(r.tipo.estado === 'recusa' && r.tipo.codigo === 'tipo_nao_aceito' && /not allowed/i.test(r.tipo.detalhe), JSON.stringify(r.tipo));
    assert(r.tamanho.estado === 'recusa' && r.tamanho.codigo === 'grande_demais' && /too large/i.test(r.tamanho.detalhe), JSON.stringify(r.tamanho));
    return `motivos: ${r.tipo.codigo} / ${r.tamanho.codigo}`;
  });

  await it('pré-flight: o TERCEIRO estado — servidor que não implementa (404), sem auth (401) e host morto caem em "indeterminado", nunca em recusa', async () => {
    const r = await naPagina(async (urls) => {
      const ch = Chave.gerar(), assinar = (m) => Chave.assinar(m, ch.sk);
      const sha = 'e'.repeat(64);
      return {
        naoImplementa: await Blossom.preflight(urls.semPre, { sha, tamanho: 10, mime: 'text/plain', assinar }),
        morto: await Blossom.preflight('https://127.0.0.1:1', { sha, tamanho: 10, mime: 'text/plain', assinar, timeoutMs: 4000 }),
        semAssinatura: await Blossom.preflight(urls.bom, { sha, tamanho: 10, mime: 'text/plain' })
      };
    }, { semPre: U('sem-preflight'), bom: U('bom') });
    assert(r.naoImplementa.estado === 'indeterminado' && r.naoImplementa.codigo === 'nao_implementa', JSON.stringify(r.naoImplementa));
    assert(r.morto.estado === 'indeterminado' && r.morto.codigo === 'rede', JSON.stringify(r.morto));
    assert(r.semAssinatura.estado === 'indeterminado' && r.semAssinatura.codigo === 'sem_assinatura', JSON.stringify(r.semAssinatura));
    return `${r.naoImplementa.codigo} / ${r.morto.codigo} / ${r.semAssinatura.codigo}`;
  });

  await it('P26 na prática: servidor "cego" (200 a tudo, erro sem CORS) → pré-flight diz "aceita" e o upload real é que recusa; nada disso vira falso negativo', async () => {
    const r = await naPagina(async (url) => {
      const ch = Chave.gerar(), assinar = (m) => Chave.assinar(m, ch.sk);
      const grande = new Uint8Array(4000); const sha = await Blossom.sha256Hex(grande);
      return { pre: await Blossom.preflight(url, { sha, tamanho: grande.length, mime: 'image/png', assinar }),
        envio: await Blossom.enviar(url, { sha, bytes: grande, mime: 'image/png', assinar }) };
    }, U('cego'));
    assert(r.pre.estado === 'aceita', JSON.stringify(r.pre));
    assert(r.envio.estado === 'ok', 'o cego aceita tudo mesmo: ' + JSON.stringify(r.envio));
  });

  await it('upload: 201 na primeira vez, 200 na segunda (já existia), descritor com o sha256 certo; o blob fica no servidor', async () => {
    const r = await naPagina(async (url) => {
      const ch = Chave.gerar(), assinar = (m) => Chave.assinar(m, ch.sk);
      const bytes = new TextEncoder().encode('<h1>upload de teste ' + Math.random() + '</h1>');
      const sha = await Blossom.sha256Hex(bytes);
      const a = await Blossom.enviar(url, { sha, bytes, mime: 'text/html', assinar });
      const b = await Blossom.enviar(url, { sha, bytes, mime: 'text/html', assinar });
      const volta = await Blossom.baixarDe(url, sha, {});
      return { a, b, sha, voltaEstado: volta.estado, mesmoTexto: volta.estado === 'ok' ? new TextDecoder().decode(volta.bytes) === new TextDecoder().decode(bytes) : false };
    }, U('bom'));
    assert(r.a.estado === 'ok' && r.a.status === 201 && r.a.descritor && r.a.descritor.sha256 === r.sha, JSON.stringify(r.a));
    assert(r.b.estado === 'ok' && r.b.status === 200, JSON.stringify(r.b));
    assert(r.voltaEstado === 'ok' && r.mesmoTexto === true, 'o GET devia devolver os mesmos bytes: ' + r.voltaEstado);
    assert(f.temBlob('bom', r.sha), 'o servidor falso devia ter o blob');
    return `201 → 200 · ${r.sha.slice(0, 12)}…`;
  });

  await it('upload recusado: tipo (415) e tamanho (413) viram estado "recusado" (definitivo) com motivo; nada fica no servidor', async () => {
    const r = await naPagina(async (urls) => {
      const ch = Chave.gerar(), assinar = (m) => Chave.assinar(m, ch.sk);
      const html = new TextEncoder().encode('<p>' + Math.random() + '</p>'); const shaH = await Blossom.sha256Hex(html);
      const grande = new Uint8Array(500); grande[0] = 7; const shaG = await Blossom.sha256Hex(grande);
      return { tipo: await Blossom.enviar(urls.soMidia, { sha: shaH, bytes: html, mime: 'text/html', assinar }),
        tamanho: await Blossom.enviar(urls.pequeno, { sha: shaG, bytes: grande, mime: 'image/png', assinar }), shaH, shaG };
    }, { soMidia: U('so-midia'), pequeno: U('pequeno') });
    assert(r.tipo.estado === 'recusado' && r.tipo.codigo === 'tipo_nao_aceito', JSON.stringify(r.tipo));
    assert(r.tamanho.estado === 'recusado' && r.tamanho.codigo === 'grande_demais', JSON.stringify(r.tamanho));
    assert(!f.temBlob('so-midia', r.shaH) && !f.temBlob('pequeno', r.shaG), 'blob recusado não pode ficar guardado');
  });

  await it('upload com hash mentido (X-SHA-256 ≠ corpo) → 409 recusado; e servidor que devolve descritor com outro hash → recusado por hash_diferente', async () => {
    const r = await naPagina(async (urls) => {
      const ch = Chave.gerar(), assinar = (m) => Chave.assinar(m, ch.sk);
      const bytes = new TextEncoder().encode('conteúdo A ' + Math.random());
      const outros = new TextEncoder().encode('conteúdo B ' + Math.random());
      const shaOutro = await Blossom.sha256Hex(outros);
      const mentido = await Blossom.enviar(urls.bom, { sha: shaOutro, bytes, mime: 'text/plain', assinar });
      const shaReal = await Blossom.sha256Hex(bytes);
      const mentiroso = await Blossom.enviar(urls.mentiroso, { sha: shaReal, bytes, mime: 'text/plain', assinar });
      return { mentido, mentiroso };
    }, { bom: U('bom'), mentiroso: U('mentiroso') });
    assert(r.mentido.estado === 'recusado' && r.mentido.status === 409 && r.mentido.codigo === 'hash_diferente', JSON.stringify(r.mentido));
    assert(r.mentiroso.estado === 'recusado' && r.mentiroso.codigo === 'hash_diferente', JSON.stringify(r.mentiroso));
  });

  await it('enviarEmTodos: 2 aceitam e 1 recusa → ok=true com os aceitos nomeados; se TODOS recusam, ok=false (é o que trava a assinatura do manifest)', async () => {
    const r = await naPagina(async (urls) => {
      const ch = Chave.gerar(), assinar = (m) => Chave.assinar(m, ch.sk);
      const html = new TextEncoder().encode('<p>parcial ' + Math.random() + '</p>'); const sha = await Blossom.sha256Hex(html);
      const parcial = await Blossom.enviarEmTodos([urls.bom, urls.aberto, urls.soMidia], { sha, bytes: html, mime: 'text/html', assinar });
      const nenhum = await Blossom.enviarEmTodos([urls.soMidia], { sha, bytes: html, mime: 'text/html', assinar });
      return { parcial, nenhum };
    }, { bom: U('bom'), aberto: U('aberto'), soMidia: U('so-midia') });
    assert(r.parcial.ok === true && r.parcial.aceitos.length === 2 && r.parcial.porServidor.length === 3, JSON.stringify(r.parcial.porServidor.map(x => [x.servidor, x.estado])));
    assert(r.nenhum.ok === false && r.nenhum.aceitos.length === 0, JSON.stringify(r.nenhum));
    return `${r.parcial.aceitos.length} de 3`;
  });

  await it('espelho (BUD-04): destino busca do origem e devolve 201; sem o blob em lado nenhum → 502 (erro temporário, não recusa)', async () => {
    const r = await naPagina(async (urls) => {
      const ch = Chave.gerar(), assinar = (m) => Chave.assinar(m, ch.sk);
      const bytes = new TextEncoder().encode('espelho ' + Math.random()); const sha = await Blossom.sha256Hex(bytes);
      await Blossom.enviar(urls.bom, { sha, bytes, mime: 'text/plain', assinar });
      const espelhado = await Blossom.espelhar(urls.aberto, { sha, origem: Blossom.urlDoBlob(urls.bom, sha), assinar });
      const inexistente = await Blossom.espelhar(urls.aberto, { sha: '9'.repeat(64), origem: Blossom.urlDoBlob(urls.bom, '9'.repeat(64)), assinar });
      return { espelhado, inexistente, sha };
    }, { bom: U('bom'), aberto: U('aberto') });
    assert(r.espelhado.estado === 'ok' && r.espelhado.status === 201, JSON.stringify(r.espelhado));
    assert(f.temBlob('aberto', r.sha), 'o destino devia ter o blob espelhado');
    assert(r.inexistente.estado === 'erro' && r.inexistente.codigo === 'origem_inacessivel', JSON.stringify(r.inexistente));
  });

  await it('remoção (BUD-12): apagado (204) some do servidor; servidor sem direito de remoção → refused_by (P14); hash que não está lá → ausente', async () => {
    const r = await naPagina(async (urls) => {
      const ch = Chave.gerar(), assinar = (m) => Chave.assinar(m, ch.sk);
      const bytes = new TextEncoder().encode('para apagar ' + Math.random()); const sha = await Blossom.sha256Hex(bytes);
      await Blossom.enviar(urls.bom, { sha, bytes, mime: 'text/plain', assinar });
      await Blossom.enviar(urls.semRemocao, { sha, bytes, mime: 'text/plain', assinar });
      const rem = await Blossom.apagarEmTodos([urls.bom, urls.semRemocao], { sha, assinar });
      const ausente = await Blossom.apagar(urls.bom, { sha: '1'.repeat(64), assinar });
      return { rem, ausente, sha };
    }, { bom: U('bom'), semRemocao: U('sem-remocao') });
    assert(r.rem.deleted_from.length === 1 && /\/bom$/.test(r.rem.deleted_from[0]), JSON.stringify(r.rem));
    assert(r.rem.refused_by.length === 1 && /sem-remocao$/.test(r.rem.refused_by[0]) && r.rem.unverified.length === 0, JSON.stringify(r.rem));
    assert(!f.temBlob('bom', r.sha) && f.temBlob('sem-remocao', r.sha), 'o blob devia sair de um e ficar no outro');
    assert(r.ausente.estado === 'ausente', JSON.stringify(r.ausente));
    return `apagado em 1, recusado em 1 — a promessa de 03 §6`;
  });

  // 14 T6 "Reconferir" — BUD-01 HEAD /<sha256>, spec relida em 2026-08-27.
  await it('reconferir (BUD-01 HEAD): blob que está lá → presente; apagado → ausente; servidor que responde erro sem CORS → indeterminado (nunca "sumiu")', async () => {
    const r = await naPagina(async (urls) => {
      const ch = Chave.gerar(), assinar = (m) => Chave.assinar(m, ch.sk);
      const bytes = new TextEncoder().encode('para reconferir ' + Math.random());
      const sha = await Blossom.sha256Hex(bytes);
      await Blossom.enviar(urls.bom, { sha, bytes, mime: 'text/plain', assinar });
      const antes = await Blossom.conferir(urls.bom, sha);
      await Blossom.apagar(urls.bom, { sha, assinar });
      const depois = await Blossom.conferir(urls.bom, sha);
      const cego = await Blossom.conferir(urls.cego, sha);          // 404 sem CORS (P26/P31)
      const invalido = await Blossom.conferir(urls.bom, 'zz');
      return { antes, depois, cego, invalido, sha };
    }, { bom: U('bom'), cego: U('cego') });
    assert(r.antes.estado === 'presente' && r.antes.status === 200, JSON.stringify(r.antes));
    assert(r.depois.estado === 'ausente' && r.depois.status === 404, JSON.stringify(r.depois));
    assert(r.cego.estado === 'indeterminado', 'erro sem CORS não pode virar "ausente": ' + JSON.stringify(r.cego));
    assert(r.invalido.estado === 'indeterminado' && r.invalido.codigo === 'hash_invalido', JSON.stringify(r.invalido));
    return 'presente → ausente, e o servidor cego fica por conferir';
  });

  await it('reconferir em todos: devolve um `removal` novo (13 §4.3) — o que já não está lá vai para deleted_from, o que continua público para refused_by', async () => {
    const r = await naPagina(async (urls) => {
      const ch = Chave.gerar(), assinar = (m) => Chave.assinar(m, ch.sk);
      const bytes = new TextEncoder().encode('em dois servidores ' + Math.random());
      const sha = await Blossom.sha256Hex(bytes);
      await Blossom.enviar(urls.bom, { sha, bytes, mime: 'text/plain', assinar });
      await Blossom.enviar(urls.semRemocao, { sha, bytes, mime: 'text/plain', assinar });
      await Blossom.apagarEmTodos([urls.bom, urls.semRemocao], { sha, assinar });
      const rc = await Blossom.conferirEmTodos([urls.bom, urls.semRemocao], sha);
      return { rc, sha };
    }, { bom: U('bom'), semRemocao: U('sem-remocao') });
    assert(r.rc.deleted_from.length === 1 && /\/bom$/.test(r.rc.deleted_from[0]), JSON.stringify(r.rc));
    assert(r.rc.refused_by.length === 1 && /sem-remocao$/.test(r.rc.refused_by[0]), JSON.stringify(r.rc));
    assert(typeof r.rc.checked_at === 'string' && r.rc.checked_at.length > 10, JSON.stringify(r.rc.checked_at));
    return 'o placar de hoje, não o do dia da remoção';
  });

  await it('cancelar (AbortController) no meio de um upload → "cancelado", sem exceção', async () => {
    const r = await naPagina(async (url) => {
      const ch = Chave.gerar(), assinar = (m) => Chave.assinar(m, ch.sk);
      const bytes = new Uint8Array(200000); const sha = await Blossom.sha256Hex(bytes);
      const c = new AbortController(); setTimeout(() => c.abort(), 5);
      return Blossom.enviar(url, { sha, bytes, mime: 'application/octet-stream', assinar, sinal: c.signal });
    }, U('bom'));
    assert(r.estado === 'cancelado' || r.estado === 'ok', JSON.stringify(r));   // corrida legítima: pode ter acabado antes
  });

  await it('o tempo-limite do upload CRESCE com o tamanho: 2 min de piso para o que é pequeno, +6 s por MB, teto de 30 min (achado da bancada Tails, 2026-08-28)', async () => {
    const r = await naPagina(() => ({
      piso: Blossom.timeoutPara(0),
      nulo: Blossom.timeoutPara(null),
      pequeno: Blossom.timeoutPara(900),                 // 900 B → arredonda para 1 MB
      umMB: Blossom.timeoutPara(1000000),
      vinteDois: Blossom.timeoutPara(22777340),          // o vídeo curto da bancada
      noventaOito: Blossom.timeoutPara(102687174),       // o vídeo que o app abortava aos 120 s
      gigante: Blossom.timeoutPara(5000000000),
      padrao: Blossom.TIMEOUT_PADRAO_MS, teto: Blossom.TIMEOUT_TETO_MS,
    }));
    assert(r.piso === 120000 && r.nulo === 120000, 'arquivo sem tamanho fica no piso: ' + JSON.stringify(r));
    assert(r.pequeno === 126000 && r.umMB === 126000, '1 MB = piso + 6 s: ' + JSON.stringify(r));
    assert(r.vinteDois === 120000 + 23 * 6000, '22,8 MB → 23 MB de acréscimo: ' + r.vinteDois);
    assert(r.noventaOito === 120000 + 103 * 6000, '98 MB → ' + (120000 + 103 * 6000) + ' ms, teve ' + r.noventaOito);
    assert(r.noventaOito > 3.5 * 60 * 1000, 'tem de cobrir os ~3,5 min medidos pelo Tor: ' + r.noventaOito);
    assert(r.gigante === r.teto && r.teto === 1800000, 'nunca acima do teto: ' + JSON.stringify(r));
    return Math.round(r.noventaOito / 1000) + ' s para o vídeo de 98 MB (eram 120)';
  });

  await it('quem chama continua a mandar: um timeoutMs explícito vence o cálculo por tamanho (servidor que demora 1,5 s, tempo dado 200 ms)', async () => {
    const r = await naPagina(async (url) => {
      const ch = Chave.gerar(), assinar = (m) => Chave.assinar(m, ch.sk);
      const bytes = new Uint8Array(300000); const sha = await Blossom.sha256Hex(bytes);
      const t0 = Date.now();
      const res = await Blossom.enviar(url, { sha, bytes, mime: 'application/octet-stream', assinar, timeoutMs: 200 });
      return { estado: res.estado, codigo: res.codigo, ms: Date.now() - t0, calculado: Blossom.timeoutPara(300000) };
    }, U('lento'));
    assert(r.estado === 'timeout' && r.codigo === 'timeout', JSON.stringify(r));
    assert(r.calculado === 126000, 'pelo tamanho seriam 126 s: ' + r.calculado);
    assert(r.ms < 1400, 'devia render-se nos 200 ms pedidos, não esperar o cálculo nem o servidor: ' + r.ms);
    return r.ms + ' ms (o cálculo por tamanho daria ' + r.calculado + ' ms)';
  });

  await it('sem erros de página/console (recusa de servidor nunca vira exceção)', () => assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros })));
  await p.pg.close();
  return R;
};
