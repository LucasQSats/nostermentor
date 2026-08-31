/* core/despublicar.js — "tirar o site do ar" (14 T7 → Avançado; 03 §6;
   decisão do usuário em 2026-08-27, que fechou a pendência 21 do `00`).
   O que a feature promete, e só isso:
     1. publica um manifest 15128 **sem nenhuma tag `path`** — os gateways
        passam a devolver 404 em todo caminho do site;
     2. tenta apagar TODOS os blobs que o site usava, em todos os servidores
        conhecidos (os da lista + os que a fotografia registou por hash);
     3. relata, servidor por servidor, o que apagou, o que foi recusado
        (P13 de 08) e o que não deu para conferir — a promessa de 03 §6,
        agora aplicada ao site inteiro.
   O que NÃO promete, e a tela diz antes do clique: o 15128 é **substituível,
   não apagável** (o manifest antigo continua nos relays que já o receberam)
   e um servidor pode recusar o DELETE ou demorar a parar de servir (P14).
   Nada de NIP-09: pedido de deleção a relay é pedido, não garantia, e exige
   leitura de spec — anotado como reforço possível no M6.

   Ordem, que é onde mora a segurança (mesma lógica de publicar.js): assina e
   publica o mapa vazio PRIMEIRO; só com ≥ 1 relay aceitando é que se apaga
   blob nenhum. Se relay nenhum aceitar, o site continua no ar exatamente
   como estava e nada local muda.

   O conteúdo local NÃO é apagado: páginas, artigos e a mídia com bytes
   voltam ao estado "nunca publicado" e podem subir de novo. A exceção
   inevitável é a mídia herdada de outra ferramenta (sem bytes neste
   navegador): o app nunca teve o arquivo, então depois de sair do ar não há
   o que republicar — o registro sai da biblioteca e a remoção fica anotada
   no `meta` (mesma convenção de publicar.js).

   A nsec não passa por aqui (02 §B): quem chama passa `assinar`. Nada lança
   por falha de rede — devolve desfecho. */
const Despublicar = (function () {
  'use strict';

  const RE_SHA = /^[0-9a-f]{64}$/;
  function eSha(v) { return typeof v === 'string' && RE_SHA.test(v); }
  function cedeALinha() { return new Promise(r => setTimeout(r, 0)); }

  // --- o plano (sem rede) --------------------------------------------------

  // o: { dados: { site, pages, posts, media }, published }
  // → { temPublicado, caminhos, blobs: [{ sha256, caminhos, servidores }],
  //     servidores, relays, herdados, registros }
  function planear(o) {
    const dados = o.dados || {}, site = dados.site || {};
    const publicado = o.published || null;
    const antes = (publicado && publicado.paths) || {};
    const porHash = (publicado && publicado.servers) || {};
    const servidores = Modelo.uniao(site.network && site.network.servers);
    const relays = Modelo.uniao(site.network && site.network.relays);
    const midias = (dados.media || []).filter(m => m && eSha(m.sha256));

    const caminhos = Object.keys(antes).sort();
    const mapa = new Map();
    function juntar(sha, caminho, extra) {
      if (!eSha(sha)) return;
      const a = mapa.get(sha) || { sha256: sha, caminhos: [], servidores: [] };
      if (caminho && a.caminhos.indexOf(caminho) === -1) a.caminhos.push(caminho);
      a.servidores = Modelo.uniao(a.servidores, porHash[sha] || [], extra || [], servidores);
      mapa.set(sha, a);
    }
    for (const p of caminhos) juntar(antes[p], p);
    for (const m of midias) juntar(m.sha256, m.path, m.servers);        // inclusive o que ainda não estava no mapa

    const blobs = Array.from(mapa.values()).sort((a, b) => (a.sha256 < b.sha256 ? -1 : 1));
    return {
      temPublicado: !!(publicado && publicado.manifest_event),
      caminhos: caminhos, blobs: blobs, servidores: servidores, relays: relays,
      herdados: midias.filter(m => !m.bytes).length,
      registros: (dados.pages || []).length + (dados.posts || []).length
    };
  }

  // O manifest 15128 sem uma única tag `path`. Sem `title` nem `description`
  // de propósito: o cartão do diretório do gateway não pode continuar a
  // anunciar um site que o dono acabou de tirar do ar. `server`, `relay` e
  // `client` ficam — são a infraestrutura dele, e são o que permite
  // republicar depois.
  function modeloVazio(site, plano, agoraS) {
    const tags = [];
    for (const s of plano.servidores) tags.push(['server', s]);
    for (const r of plano.relays) tags.push(['relay', r]);
    tags.push(['client', Publicar.CLIENTE]);
    return { kind: Publicar.KIND_MANIFEST, created_at: Number.isInteger(agoraS) ? agoraS : Math.floor(Date.now() / 1000), tags: tags, content: '' };
  }

  // --- execução ------------------------------------------------------------

  // Um placar por servidor, no formato que T7 mostra: quantos blobs saíram,
  // quantos foram recusados e quantos ficaram por conferir.
  function placarPorServidor(remocoes, servidores) {
    const saida = {};
    for (const s of servidores) saida[s] = { servidor: s, apagados: 0, recusados: 0, por_conferir: 0, total: 0 };
    for (const r of remocoes) {
      const rem = r.removal;
      for (const [lista, campo] of [[rem.deleted_from, 'apagados'], [rem.refused_by, 'recusados'], [rem.unverified, 'por_conferir']]) {
        for (const s of lista || []) {
          if (!saida[s]) saida[s] = { servidor: s, apagados: 0, recusados: 0, por_conferir: 0, total: 0 };
          saida[s][campo]++; saida[s].total++;
        }
      }
    }
    return Object.keys(saida).sort().map(k => saida[k]);
  }

  // o: { plano, site, assinar, relays, servidores, sinal, timeoutMs, progresso }
  // → { desfecho, manifest, relaysManifest, placar, remocoes, porServidor }
  // desfecho: 'fora_do_ar' | 'nada' (nunca esteve publicado) | 'sem_relay'
  //   (relay nenhum aceitou o mapa vazio — NADA foi apagado, o site continua
  //   no ar) | 'sem_assinatura' | 'cancelado'
  async function executar(o) {
    const plano = o.plano, site = o.site || {};
    const relays = Modelo.uniao(o.relays || plano.relays);
    const servidores = Modelo.uniao(o.servidores || plano.servidores);
    const prog = typeof o.progresso === 'function' ? function (p) { try { o.progresso(p); } catch (e) {} } : function () {};
    const r = { desfecho: 'nada', manifest: null, relaysManifest: [], placar: null, remocoes: [], porServidor: [] };
    if (!plano.temPublicado) return r;
    if (o.sinal && o.sinal.aborted) { r.desfecho = 'cancelado'; return r; }
    if (relays.length === 0) { r.desfecho = 'sem_relay'; return r; }

    // Assinar é síncrono e instantâneo: sem ceder a linha aqui, o passo é
    // anunciado e nunca chega a ser pintado — o dono saltaria direto para
    // "Enviando aos relays". Medido pelo teste que observa o meio (15 §5).
    prog({ passo: 'assinar' });
    await cedeALinha();
    try { r.manifest = o.assinar(modeloVazio(site, plano)); }
    catch (e) { r.desfecho = 'sem_assinatura'; r.erro = e && e.message ? String(e.message) : ''; return r; }

    // 34 — a mesma barra do "Publicar": aqui também os relays são a espera longa.
    let feitosRelay = 0, aceitosRelay = 0;
    prog({ passo: 'relays', total: relays.length, feitos: 0, aceitos: 0 });
    r.relaysManifest = await Relay.publicar(relays, r.manifest, { sinal: o.sinal, timeoutMs: o.timeoutMs, aoRelay: function (x) {
      feitosRelay++; if (x && x.estado === 'aceito') aceitosRelay++;
      prog({ passo: 'relays', total: relays.length, feitos: feitosRelay, aceitos: aceitosRelay, relay: x });
    } });
    r.placar = Relay.placar(r.relaysManifest);
    if (!r.placar.ok) { r.desfecho = 'sem_relay'; return r; }        // o site continua no ar: não se apaga nada

    let feitos = 0;
    prog({ passo: 'apagar', feitos: 0, total: plano.blobs.length });
    for (const b of plano.blobs) {
      if (o.sinal && o.sinal.aborted) break;
      const rem = await Blossom.apagarEmTodos(Modelo.uniao(b.servidores, servidores), { sha: b.sha256, assinar: o.assinar, sinal: o.sinal, timeoutMs: o.timeoutMs });
      r.remocoes.push({ sha256: b.sha256, caminhos: b.caminhos.slice(),
        removal: { deleted_from: rem.deleted_from, refused_by: rem.refused_by, unverified: rem.unverified, checked_at: rem.checked_at } });
      feitos++;
      prog({ passo: 'apagar', feitos: feitos, total: plano.blobs.length, sha: b.sha256 });
      await cedeALinha();
    }
    r.porServidor = placarPorServidor(r.remocoes, servidores);
    r.desfecho = 'fora_do_ar';
    return r;
  }

  // --- gravar o desfecho ---------------------------------------------------

  // A fotografia vazia (13 §5.4) + `takedown_at`, que é o que impede o painel
  // de continuar a dizer "seu site está em N relays" como se estivesse no ar.
  function fotografia(resultado, anterior) {
    const relaysEstado = {};
    for (const x of resultado.relaysManifest) relaysEstado[x.url] = x.estado === 'aceito' ? 'atual' : (x.estado === 'recusado' ? 'sem' : 'nao_respondeu');
    const p = resultado.placar, quando = Modelo.agora();
    return {
      manifest_event: Saude.limpo(resultado.manifest), manifest_event_id: resultado.manifest.id, created_at: resultado.manifest.created_at,
      paths: {}, relays: relaysEstado, servers: {},
      // 31 — fora do ar, nada está publicado, a configuração inclusive: `null`
      // difere de qualquer assinatura e o contador volta a acender sozinho.
      site_config: null,
      metadata_events: Object.assign({ kind0: null, kind10002: null, kind10063: null }, (anterior && anterior.metadata_events) || {}),
      takedown_at: quando,
      health: { checked_at: quando, relays_with_manifest: p.aceitos.slice(), relays_outdated: [], relays_newer: [],
        relays_missing: p.recusados.slice(), relays_unreachable: p.mudos.slice() }
    };
  }

  // Volta o local ao estado "nunca publicado", numa transação só. Só é
  // chamada quando o desfecho é 'fora_do_ar'.
  async function aplicar(db, o) {
    const resultado = o.resultado, dados = o.dados, agora = Modelo.agora();
    const remocaoPorSha = {};
    for (const r of resultado.remocoes) remocaoPorSha[r.sha256] = r.removal;
    const ops = [];
    for (const store of ['pages', 'posts']) {
      for (const reg of (dados[store] || [])) {
        if (reg.status === 'removed') { ops.push({ op: 'del', store: store, chave: reg.id }); continue; }   // já saiu do ar com o resto
        if (reg.status === 'draft' && reg.published_hash == null) continue;
        ops.push({ op: 'put', store: store, valor: Object.assign({}, reg, { status: 'draft', published_hash: null, previous_status: null, updated_at: agora }) });
      }
    }
    for (const m of (dados.media || [])) {
      const rem = remocaoPorSha[m.sha256] || null;
      if (!m.bytes || m.status === 'removed') {                       // sem arquivo aqui: não há o que republicar
        ops.push({ op: 'del', store: 'media', chave: m.id });
        if (rem) ops.push({ op: 'put', store: 'meta', valor: { key: 'removal/' + m.sha256, value: Object.assign({ path: m.path }, rem) } });
        continue;
      }
      ops.push({ op: 'put', store: 'media', valor: Object.assign({}, m, { status: 'draft', servers: [], previous_status: null, removal: rem, updated_at: agora }) });
    }
    ops.push({ op: 'put', store: 'published', chave: 'current', valor: o.published });
    ops.push({ op: 'put', store: 'meta', valor: { key: 'last_takedown_at', value: agora } });
    await db.escrever(ops);
    return ops.length;
  }

  return Object.freeze({ planear, modeloVazio, placarPorServidor, executar, fotografia, aplicar });
})();
