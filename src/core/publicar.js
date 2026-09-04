/* core/publicar.js — o motor de publicação (14 T8, 05 §1 e §3).
   Duas metades separadas de propósito:
     `planear`  — puro, sem rede: o diff entre o site que seria gerado agora
                  e a fotografia `published` (13 §5.4). É o que T8 mostra
                  ANTES de o dono clicar. Determinístico porque o Gerador é
                  (13 §5.2): mesmo conteúdo = mesmos bytes = mesmo hash.
     `executar` — a ordem que a segurança exige (14 T8 passo 4, T-4/T-5):
                  1) sobem TODOS os blobs; 2) só quando cada caminho está
                  confirmado em ≥ 1 servidor é que se assina o manifest;
                  3) vai aos relays; 4) com ≥ 1 relay aceitando, grava.
                  Nunca se assina um mapa que aponte para arquivo que não
                  está em lugar nenhum, e nada muda no estado local antes de
                  a rede confirmar.
   Manifest 15128 (05 §1, empírico 2026-08-18/25): tags `path` (uma por
   arquivo, com o sha256), `server`, `relay`, `client` e — obrigatórias no
   nosso produto (05 §3.1) — `title` e `description`, que são o texto e a
   descrição do link do site no diretório do gateway. Substituível pelo
   NIP-01 (10000–19999): publicar de novo apaga o anterior, não é preciso
   apagar nada.
   Metadados (05 §3): kind 0 (perfil), 10002 (relays, tags `r`) e 10063
   (servidores Blossom, tags `server`) — sem eles o `nsite.run` devolve 404.
   Só entram quando mudaram.
   A nsec não passa por aqui (02 §B): quem chama passa `assinar` =
   `Shell.assinar`. Nada lança por falha de rede — devolve desfecho. */
const Publicar = (function () {
  'use strict';

  const KIND_MANIFEST = 15128, KIND_PERFIL = 0, KIND_RELAYS = 10002, KIND_SERVIDORES = 10063;
  const CLIENTE = 'nostermentor';
  const PARALELAS_PADRAO = 3;              // arquivos ao mesmo tempo; por Tor mais que isto atrapalha (07 §3.2)
  const RE_SHA = /^[0-9a-f]{64}$/;

  function eSha(v) { return typeof v === 'string' && RE_SHA.test(v); }
  function temBytes(m) { return !!m && !!m.bytes; }

  // --- o plano (sem rede) --------------------------------------------------

  // Os caminhos que o app gera sozinho (HTML, aliases, css do tema,
  // site.json) — usado para saber se um caminho que saiu do mapa saiu por
  // decisão do dono ou é herança de outra ferramenta (T-7).
  // ⚠️ Até 2026-08-27 QUALQUER caminho `.html` contava como sendo do app.
  // No fluxo normal era inofensivo (todo herdado vira `media` e entra pelo
  // passo 1), mas um `.html` que estivesse em `published.paths` SEM `media`
  // correspondente saía do manifest sozinho, sem o dono mandar — contra T-7
  // (pendência 20 de `00`, medida com a cobaia Bostil). Agora a extensão não
  // decide sozinha: um `.html` que o app não gera agora só é dele quando há
  // uma página ou artigo no banco que o reivindica, pelo slug ou por um
  // alias. Renomear não escapa a esta regra — o slug é imutável depois da
  // primeira publicação e o antigo vira alias (13 §4.0), que o gerador
  // continua a publicar como stub de redirect.
  function caminhosDoApp(dados) {
    const s = new Set([Modelo.caminhoDe('home'), Modelo.caminhoDe('blog'), Modelo.CAMINHO_SITE_JSON]);
    for (const p of (dados.pages || [])) {
      if (!p || !p.slug) continue;
      s.add(Modelo.caminhoDe('page', p.slug));
      for (const a of (p.aliases || [])) if (a) s.add(Modelo.caminhoDe('page', a));
    }
    for (const p of (dados.posts || [])) {
      if (!p || !p.slug) continue;
      s.add(Modelo.caminhoDe('post', p.slug));
      for (const a of (p.aliases || [])) if (a) s.add(Modelo.caminhoDe('post', a));
    }
    return s;
  }
  // 40 — `/blog/etiqueta/` entra por PREFIXO, como `/tema/`, e não por lista:
  // a etiqueta que o dono acabou de tirar do último artigo já não está em
  // `dados.posts`, e sem esta linha o caminho dela ficaria preservado como
  // "herdado de outra ferramenta" — para sempre, sem botão de apagar. Custo
  // aceite: um nsite de outra ferramenta que use este prefixo perde-o para o
  // app, exatamente como já acontece com `/tema/`.
  function ehDoApp(path, gerado, doApp) {
    return !!gerado.hashes[path] || path.indexOf('/tema/') === 0 || path.indexOf(Modelo.PREFIXO_ETIQUETA + '/') === 0 ||
      path === Modelo.CAMINHO_SITE_JSON || doApp.has(path);
  }

  // Mídia que entra no mapa: tudo que não foi removido e tem hash.
  function midiasNoMapa(dados) {
    return (dados.media || []).filter(m => m && m.status !== 'removed' && eSha(m.sha256));
  }

  // o: { dados, published, gerado } → plano (13 §5.4 × Gerador.gerarSite)
  function planear(o) {
    const dados = o.dados, gerado = o.gerado;
    const publicado = o.published || null;
    const antes = (publicado && publicado.paths) || {};
    const servidoresPorHash = (publicado && publicado.servers) || {};
    const site = dados.site || {};

    // 1. mapa final: o que o app gera + as mídias vivas
    const mapa = {}, arquivoDe = {};
    for (const a of gerado.arquivos) { mapa[a.path] = a.sha256; arquivoDe[a.path] = a; }
    const midias = midiasNoMapa(dados);
    for (const m of midias) {
      if (mapa[m.path]) continue;                      // um caminho gerado nunca é sobreposto por mídia
      mapa[m.path] = m.sha256;
      arquivoDe[m.path] = { path: m.path, sha256: m.sha256, mime: m.mime || Modelo.mimePorCaminho(m.path), tipo: 'media', id: m.id, bytes: m.bytes || null, tamanho: m.size };
    }

    // 2. herdados: caminho que estava publicado, não é do app e ninguém
    //    mandou remover → continua no mapa, com o hash que tinha (T-7).
    const herdados = [];
    const doApp = caminhosDoApp(dados);
    for (const path of Object.keys(antes)) {
      if (mapa[path]) continue;
      if (ehDoApp(path, gerado, doApp)) continue;      // saiu porque a página/artigo saiu
      const removida = (dados.media || []).some(m => m && m.path === path && m.status === 'removed');
      if (removida) continue;                          // o dono mandou remover
      mapa[path] = antes[path];
      herdados.push({ path: path, sha256: antes[path] });
    }

    // 2b. herdados que continuam no ar exatamente como estavam. O dono
    //     precisa de os ver: T2c prometeu-lhe, na entrada, que seriam
    //     preservados (14 T2c / T-7), e sem isto o bloco correspondente de
    //     T8 nunca aparecia — todo herdado vira `media` e entra pelo passo 1,
    //     nunca chegando ao laço acima.
    const preservados = [];
    for (const m of midias) {
      if (m.origin !== 'network') continue;
      if (mapa[m.path] !== m.sha256 || antes[m.path] !== m.sha256) continue;
      preservados.push({ path: m.path, sha256: m.sha256 });
    }

    // 2c. colisão: o app gera um caminho que já pertence a um arquivo
    //     herdado de outra ferramenta (o caso do Bostil: `/index.html`).
    //     Publicar substituiria o arquivo antigo — exatamente o que T2c
    //     prometeu que não aconteceria. A publicação fica **bloqueada** até
    //     o dono remover o herdado em T6, um a um, como o contrato diz.
    //     Decisão do usuário em 2026-08-27 (aceite 2 do M4; ver 11).
    const colisoes = [];
    for (const m of midias) {
      if (m.origin !== 'network') continue;
      const shaApp = gerado.hashes[m.path];
      if (!shaApp || shaApp === m.sha256) continue;           // mesmo conteúdo: não há conflito
      colisoes.push({ path: m.path, midia_id: m.id, sha256_herdado: m.sha256, sha256_app: shaApp });
    }

    // 3. diff
    const sobe = [], atualiza = [], inalterados = [], some = [];
    for (const path of Object.keys(mapa).sort()) {
      const sha = mapa[path], a = arquivoDe[path];
      const item = { path: path, sha256: sha, tipo: a ? a.tipo : 'herdado', id: a ? a.id : null,
        dinamico: !!(a && a.dinamico),
        tamanho: a && a.bytes ? (a.bytes.size != null ? a.bytes.size : a.bytes.length) : (a && a.tamanho) || null };
      if (!antes[path]) { if (a) sobe.push(item); }
      else if (antes[path] !== sha) atualiza.push(item);
      else inalterados.push(item);
    }
    for (const path of Object.keys(antes).sort()) {
      if (mapa[path]) continue;
      const m = (dados.media || []).find(x => x && x.path === path && x.status === 'removed');
      some.push({ path: path, sha256: antes[path], midia_id: m ? m.id : null, apagar_blob: !!m });
    }

    // 4. o que precisa de upload: o conteúdo mudou de caminho ou de hash, e
    //    a mídia que ainda não está confirmada em servidor nenhum. Blob que
    //    já está publicado com o mesmo hash não sobe de novo.
    const upload = [];
    for (const item of sobe.concat(atualiza)) {
      const a = arquivoDe[item.path];
      if (!a) continue;
      if (a.tipo === 'media' && !temBytes(a)) continue;                       // mídia da rede: nada a subir
      upload.push({ path: a.path, sha256: a.sha256, mime: a.mime, tipo: a.tipo, id: a.id, bytes: a.bytes, tamanho: item.tamanho });
    }
    for (const m of midias) {
      if (!temBytes(m)) continue;
      const confirmada = Array.isArray(m.servers) && m.servers.length > 0;
      const jaNaLista = upload.some(u => u.sha256 === m.sha256);
      if (!confirmada && !jaNaLista) upload.push({ path: m.path, sha256: m.sha256, mime: m.mime || Modelo.mimePorCaminho(m.path), tipo: 'media', id: m.id, bytes: m.bytes, tamanho: m.size });
    }

    // 5. remoções de blob (13 §4.3): mídia marcada `removed`
    const remover = (dados.media || []).filter(m => m && m.status === 'removed' && eSha(m.sha256))
      .map(m => ({ id: m.id, path: m.path, sha256: m.sha256, servers: Modelo.uniao(m.servers, servidoresPorHash[m.sha256] || []) }));

    // 6. eventos
    const eventos = { manifest: true, kind0: false, kind10002: false, kind10063: false };
    const anteriores = (publicado && publicado.metadata_events) || {};
    const avatar = avatarDe(site, dados.media);
    const pictureUrl = urlDoAvatar(site, dados.media);
    eventos.kind0 = mudouPerfil(site, anteriores.kind0, pictureUrl);
    eventos.kind10002 = mudouLista(site.network && site.network.relays, anteriores.kind10002, 'r');
    eventos.kind10063 = mudouLista(site.network && site.network.servers, anteriores.kind10063, 'server');

    let bytes = 0;
    for (const u of upload) bytes += (u.bytes && (u.bytes.size != null ? u.bytes.size : u.bytes.length)) || 0;

    const mudou = sobe.length + atualiza.length + some.length + upload.length + remover.length;
    return {
      mapa: mapa, sobe: sobe, atualiza: atualiza, inalterados: inalterados, some: some, herdados: herdados,
      preservados: preservados, colisoes: colisoes,
      upload: upload, remover: remover, eventos: eventos,
      picture_url: pictureUrl, picture_sha: avatar ? avatar.sha256 : null, bytes: bytes,
      relays: Modelo.uniao(site.network && site.network.relays), servidores: Modelo.uniao(site.network && site.network.servers),
      nada: mudou === 0 && !eventos.kind0 && !eventos.kind10002 && !eventos.kind10063,
      caminhos: Object.keys(mapa).length,
      // 31 — vai inteira para a fotografia: é contra ela que o contador de
      // "Publicar" compara as Configurações › Site na sessão seguinte.
      site_config: SiteJson.assinaturaSite(site)
    };
  }

  // --- modelos de evento ---------------------------------------------------

  function agoraUnix() { return Math.floor(Date.now() / 1000); }

  // 05 §1 + §3.1. Caminhos em ordem: o evento é determinístico como o site.
  function modeloManifest(plano, site, agoraS) {
    const tags = [];
    for (const path of Object.keys(plano.mapa).sort()) tags.push(['path', path, plano.mapa[path]]);
    for (const s of plano.servidores) tags.push(['server', s]);
    for (const r of plano.relays) tags.push(['relay', r]);
    tags.push(['client', CLIENTE]);
    const titulo = String((site && site.title) || '').slice(0, 200);
    const descricao = String((site && site.description) || '').slice(0, 1000);
    if (titulo) tags.push(['title', titulo]);
    if (descricao) tags.push(['description', descricao]);
    return { kind: KIND_MANIFEST, created_at: Number.isInteger(agoraS) ? agoraS : agoraUnix(), tags: tags, content: '' };
  }

  // 05 §3 kind 0 — só os campos que o site usa; `picture` é a URL do blob
  // da imagem de perfil num servidor configurado (quando houver).
  // O schema (13 §3) guarda `profile.picture_media_id`; a URL do Nostr é
  // `<servidor>/<sha256>`. Só se anuncia um endereço que vai existir: ou o
  // blob já está confirmado nalgum servidor, ou temos os bytes aqui e ele
  // sobe nesta mesma publicação (a trava de `executar` garante que o
  // manifest — e portanto o kind 0 — só é assinado depois de cada caminho
  // ter casa). Mídia herdada sem arquivo neste navegador não vira `picture`:
  // seria anunciar um endereço que ninguém garantiu.
  function avatarDe(site, media) {
    const id = site && site.profile && site.profile.picture_media_id;
    if (!id) return null;
    const m = (media || []).find(x => x && x.id === id && x.status !== 'removed' && eSha(x.sha256));
    if (!m) return null;
    if (!(Array.isArray(m.servers) && m.servers.length) && !temBytes(m)) return null;
    return m;
  }
  function urlDoAvatar(site, media) {
    const m = avatarDe(site, media);
    if (!m) return (site && site.profile && site.profile.picture_url) || null;
    const servidor = Modelo.uniao(m.servers, site.network && site.network.servers)[0];
    return servidor ? Blossom.urlDoBlob(servidor, m.sha256) : null;
  }
  function conteudoPerfil(site, pictureUrl) {
    const p = (site && site.profile) || {};
    const o = { name: String(p.name || site.title || '').slice(0, 200), about: String(p.about || site.description || '').slice(0, 2000) };
    const url = pictureUrl === undefined ? p.picture_url : pictureUrl;
    if (url) o.picture = String(url).slice(0, 500);
    return JSON.stringify(o);
  }
  function modeloPerfil(site, agoraS, pictureUrl) {
    return { kind: KIND_PERFIL, created_at: Number.isInteger(agoraS) ? agoraS : agoraUnix(), tags: [], content: conteudoPerfil(site, pictureUrl) };
  }
  function modeloRelays(site, agoraS) {          // NIP-65: tags ["r", url]
    return { kind: KIND_RELAYS, created_at: Number.isInteger(agoraS) ? agoraS : agoraUnix(),
      tags: Modelo.uniao(site.network && site.network.relays).map(u => ['r', u]), content: '' };
  }
  function modeloServidores(site, agoraS) {      // BUD-03: tags ["server", url], ordem = confiança
    return { kind: KIND_SERVIDORES, created_at: Number.isInteger(agoraS) ? agoraS : agoraUnix(),
      tags: Modelo.uniao(site.network && site.network.servers).map(u => ['server', u]), content: '' };
  }
  function valoresDeTag(ev, nome) {
    if (!ev || !Array.isArray(ev.tags)) return null;
    return ev.tags.filter(t => Array.isArray(t) && t[0] === nome).map(t => String(t[1]));
  }
  function mudouLista(atual, eventoAnterior, nomeTag) {
    if (!eventoAnterior) return Modelo.uniao(atual).length > 0;
    const antes = valoresDeTag(eventoAnterior, nomeTag) || [];
    return Modelo.uniao(atual).join('\n') !== Modelo.uniao(antes).join('\n');
  }
  // 31 — o contador de "Publicar" tem de enxergar as Configurações › Site, e
  // não só os registros: `Modelo.pendentes` soma status, e o `site` não tem
  // status nenhum. Aqui a pergunta é feita a quem sabe responder — o publicado.
  //   • fotografia nova (desde 2026-08-31): compara a assinatura inteira, exato;
  //   • fotografia antiga (sem `site_config`): usa só o que ela guarda — os
  //     eventos de metadados e as tags `title`/`description` do manifest. NÃO
  //     cobre menu, home, blog, doações, idioma nem privacidade; para esses o
  //     contador só acorda depois da 1ª publicação com a fotografia nova.
  //     É de propósito conservador: falso negativo é o bug de hoje, falso
  //     positivo seria um aviso que nunca mais apaga.
  function configPendente(site, published, media) {
    if (!site || !published) return false;                  // nunca publicado: T3 já o diz com todas as letras
    if (published.site_config !== undefined) return SiteJson.assinaturaSite(site) !== published.site_config;
    // Cada comparação só vale se o dado EXISTIR na fotografia. `mudouPerfil` e
    // `mudouLista` respondem à pergunta do publicador ("preciso publicar este
    // evento?"), e para ela ausência significa sim; aqui a pergunta é outra
    // ("a configuração mudou?") e ausência significa **não sei**. Confundir as
    // duas acendia o contador em site recém-carregado da rede cujo relay não
    // devolveu o kind 0 — falso positivo que nunca mais apagava.
    const ev = published.metadata_events || {};
    if (ev.kind0 && mudouPerfil(site, ev.kind0, urlDoAvatar(site, media))) return true;
    if (ev.kind10002 && mudouLista(site.network && site.network.relays, ev.kind10002, 'r')) return true;
    if (ev.kind10063 && mudouLista(site.network && site.network.servers, ev.kind10063, 'server')) return true;
    const m = published.manifest_event;
    if (m) {
      const tag = (nome) => { const v = valoresDeTag(m, nome); return v && v.length ? String(v[0]) : null; };
      const t = tag('title'), d = tag('description');
      if (t !== null && String(site.title || '').slice(0, 200) !== t) return true;
      if (d !== null && String(site.description || '').slice(0, 1000) !== d) return true;
    }
    return false;
  }

  function mudouPerfil(site, eventoAnterior, pictureUrl) {
    const agora = conteudoPerfil(site, pictureUrl);
    if (!eventoAnterior) return agora !== '{"name":"","about":""}';
    return String(eventoAnterior.content || '') !== agora;
  }

  // --- execução ------------------------------------------------------------

  function cedeALinha() { return new Promise(r => setTimeout(r, 0)); }   // lição do M3: não trancar a UI

  // Roda `tarefa` sobre `itens` com no máximo `n` ao mesmo tempo, na ordem.
  async function emLotes(itens, n, tarefa) {
    const saida = new Array(itens.length);
    let proximo = 0;
    async function trabalhador() {
      for (;;) {
        const i = proximo++;
        if (i >= itens.length) return;
        saida[i] = await tarefa(itens[i], i);
      }
    }
    const trabalhadores = [];
    for (let i = 0; i < Math.max(1, Math.min(n, itens.length)); i++) trabalhadores.push(trabalhador());
    await Promise.all(trabalhadores);
    return saida;
  }

  function bytesDe(b) {
    if (!b) return null;
    if (b instanceof Uint8Array) return b;
    return b;                                     // Blob: o fetch aceita
  }

  // o: { plano, site, assinar, servidores, relays, progresso, sinal, timeoutMs, paralelas }
  // → { desfecho, uploads, manifest, metadados, relaysManifest, placar, remocoes }
  // desfecho: 'publicado' | 'nada' | 'falta_servidor' (nenhum servidor aceitou
  //   algum arquivo — NADA foi assinado) | 'sem_relay' (blobs subiram, relay
  //   nenhum aceitou o mapa) | 'cancelado'
  async function executar(o) {
    const plano = o.plano, site = o.site || {};
    const servidores = Modelo.uniao(o.servidores || plano.servidores);
    const relays = Modelo.uniao(o.relays || plano.relays);
    const prog = typeof o.progresso === 'function' ? function (p) { try { o.progresso(p); } catch (e) {} } : function () {};
    const comum = { assinar: o.assinar, sinal: o.sinal, timeoutMs: o.timeoutMs };
    const resultado = { desfecho: 'nada', uploads: [], manifest: null, metadados: [], relaysManifest: [], placar: null, remocoes: [], servidoresPorHash: {} };
    if (plano.nada) return resultado;
    if (o.sinal && o.sinal.aborted) { resultado.desfecho = 'cancelado'; return resultado; }
    if (servidores.length === 0) { resultado.desfecho = 'falta_servidor'; return resultado; }

    // 1. blobs — em paralelo por servidor, poucos arquivos ao mesmo tempo
    prog({ passo: 'upload', feitos: 0, total: plano.upload.length, bytes: plano.bytes });
    let feitos = 0;
    resultado.uploads = await emLotes(plano.upload, o.paralelas || PARALELAS_PADRAO, async function (item) {
      if (o.sinal && o.sinal.aborted) return { path: item.path, sha256: item.sha256, aceitos: [], porServidor: [], cancelado: true };
      const r = await Blossom.enviarEmTodos(servidores, { sha: item.sha256, bytes: bytesDe(item.bytes), mime: item.mime, assinar: o.assinar, sinal: o.sinal, timeoutMs: o.timeoutMs });
      feitos++;
      prog({ passo: 'upload', feitos: feitos, total: plano.upload.length, path: item.path, aceitos: r.aceitos.length, porServidor: r.porServidor });
      await cedeALinha();
      return { path: item.path, sha256: item.sha256, tipo: item.tipo, id: item.id, aceitos: r.aceitos, porServidor: r.porServidor, cancelado: false };
    });
    if (o.sinal && o.sinal.aborted) { resultado.desfecho = 'cancelado'; return resultado; }

    // O que subiu fica registrado ANTES da trava: um arquivo órfão interrompe a
    // publicação, mas os blobs que já chegaram aos servidores continuam lá, e
    // reenviá-los na tentativa seguinte custa caro pelo Tor. A tela promete
    // isto ao dono ("os arquivos que subiram ficam registrados"); até
    // 2026-08-28 esta linha vinha DEPOIS do `return` e a promessa era falsa —
    // achado da bancada Tails, medido com um vídeo de 98 MB.
    for (const u of resultado.uploads) if (u.aceitos.length) resultado.servidoresPorHash[u.sha256] = u.aceitos.slice();

    // 2. a trava: nenhum manifest é assinado se algum caminho ficou sem casa
    const orfaos = resultado.uploads.filter(u => u.aceitos.length === 0);
    if (orfaos.length > 0) { resultado.desfecho = 'falta_servidor'; resultado.orfaos = orfaos; return resultado; }

    // 3. assinar — o mapa inteiro, sempre (o 15128 é substituível: o evento
    //    novo apaga o anterior, então tem de conter TUDO que fica no ar)
    // Assinar é síncrono e instantâneo: sem ceder a linha, o passo é anunciado
    // e nunca chega a ser pintado — o dono saltaria dos uploads direto para
    // "Enviando aos relays". Medido pelo teste que observa o meio (15 §5).
    prog({ passo: 'assinar' });
    await cedeALinha();
    const agoraS = agoraUnix();
    let manifest;
    try {
      manifest = o.assinar(modeloManifest(plano, site, agoraS));
      // A URL do avatar é fixada aqui, com o que os servidores REALMENTE
      // aceitaram nesta execução — não com o palpite que o plano usou para o diff.
      const aceitosDoAvatar = plano.picture_sha ? resultado.servidoresPorHash[plano.picture_sha] : null;
      const pictureUrl = (aceitosDoAvatar && aceitosDoAvatar.length) ? Blossom.urlDoBlob(aceitosDoAvatar[0], plano.picture_sha) : plano.picture_url;
      if (plano.eventos.kind0) resultado.metadados.push({ kind: KIND_PERFIL, evento: o.assinar(modeloPerfil(site, agoraS, pictureUrl)) });
      if (plano.eventos.kind10002) resultado.metadados.push({ kind: KIND_RELAYS, evento: o.assinar(modeloRelays(site, agoraS)) });
      if (plano.eventos.kind10063) resultado.metadados.push({ kind: KIND_SERVIDORES, evento: o.assinar(modeloServidores(site, agoraS)) });
    } catch (e) {
      resultado.desfecho = 'sem_assinatura'; resultado.erro = e && e.message ? String(e.message) : ''; return resultado;
    }
    resultado.manifest = manifest;

    // 4. relays
    // 34 — pelo Tor esta é a fase LONGA (um relay mudo só cai no tempo-limite)
    // e era a única sem barra: o motor avisava relay a relay e a tela descartava.
    // Contar aqui, e não na tela, mantém a tela sem estado — como no upload.
    let relaysFeitos = 0, relaysAceitos = 0;
    prog({ passo: 'relays', total: relays.length, feitos: 0, aceitos: 0 });
    resultado.relaysManifest = await Relay.publicar(relays, manifest, { sinal: o.sinal, timeoutMs: o.timeoutMs, aoRelay: function (r) {
      relaysFeitos++; if (r && r.estado === 'aceito') relaysAceitos++;
      prog({ passo: 'relays', total: relays.length, feitos: relaysFeitos, aceitos: relaysAceitos, relay: r });
    } });
    resultado.placar = Relay.placar(resultado.relaysManifest);
    if (!resultado.placar.ok) { resultado.desfecho = 'sem_relay'; return resultado; }

    // metadados vão depois: o mapa é que decide o desfecho (05 §3 diz que
    // sem eles o nsite.run devolve 404, mas o site já está no ar).
    for (const m of resultado.metadados) {
      m.resultados = await Relay.publicar(relays, m.evento, { sinal: o.sinal, timeoutMs: o.timeoutMs });
      m.placar = Relay.placar(m.resultados);
      prog({ passo: 'metadados', kind: m.kind, placar: m.placar });
    }

    // 5. remoções — só depois de o mapa novo estar no ar: o caminho já saiu
    //    do site, e o blob some (ou não) sem risco de deixar página quebrada.
    for (const r of plano.remover) {
      const alvos = Modelo.uniao(r.servers, servidores);
      const rem = await Blossom.apagarEmTodos(alvos, { sha: r.sha256, assinar: o.assinar, sinal: o.sinal, timeoutMs: o.timeoutMs });
      resultado.remocoes.push({ id: r.id, path: r.path, sha256: r.sha256, removal: { deleted_from: rem.deleted_from, refused_by: rem.refused_by, unverified: rem.unverified, checked_at: rem.checked_at } });
      prog({ passo: 'remover', path: r.path, removal: rem });
      await cedeALinha();
    }

    resultado.desfecho = 'publicado';
    return resultado;
  }

  // --- gravar o desfecho ---------------------------------------------------

  // A fotografia nova (13 §5.4). `classificacao` vem do placar dos relays.
  function fotografia(resultado, plano, anterior) {
    const relaysEstado = {};
    for (const r of resultado.relaysManifest) relaysEstado[r.url] = r.estado === 'aceito' ? 'atual' : (r.estado === 'recusado' ? 'sem' : 'nao_respondeu');
    const servers = Object.assign({}, (anterior && anterior.servers) || {}, resultado.servidoresPorHash);
    for (const path of Object.keys(plano.mapa)) { const h = plano.mapa[path]; if (!servers[h]) servers[h] = plano.servidores.slice(); }
    const meta = Object.assign({ kind0: null, kind10002: null, kind10063: null }, (anterior && anterior.metadata_events) || {});
    for (const m of resultado.metadados) {
      if (m.placar && m.placar.ok) meta['kind' + m.kind] = Saude.limpo(m.evento);
    }
    const p = resultado.placar;
    return {
      manifest_event: Saude.limpo(resultado.manifest), manifest_event_id: resultado.manifest.id, created_at: resultado.manifest.created_at,
      paths: Object.assign({}, plano.mapa), relays: relaysEstado, servers: servers, metadata_events: meta,
      site_config: plano.site_config,
      health: { checked_at: Modelo.agora(), relays_with_manifest: p.aceitos.slice(), relays_outdated: [], relays_newer: [],
        relays_missing: p.recusados.slice(), relays_unreachable: p.mudos.slice() }
    };
  }

  // Transições de 13 §4.4 + `published_hash` + `servers`/`removal` da mídia,
  // tudo numa transação só. Só é chamada quando o desfecho é 'publicado'.
  async function aplicar(db, o) {
    const resultado = o.resultado, plano = o.plano, dados = o.dados, gerado = o.gerado;
    const ops = [];
    const porPath = {};
    for (const u of resultado.uploads) porPath[u.path] = u.aceitos;
    const remocaoPorId = {};
    for (const r of resultado.remocoes) remocaoPorId[r.id] = r.removal;

    for (const store of ['pages', 'posts']) {
      for (const reg of (dados[store] || [])) {
        const t = Modelo.transicao(reg, 'publicar');
        if (!t) continue;
        if (t.apagar) { ops.push({ op: 'del', store: store, chave: reg.id }); continue; }
        const hash = gerado.porId[reg.id] || reg.published_hash || null;
        if (reg.status === 'published' && reg.published_hash === hash) continue;      // nada mudou neste
        ops.push({ op: 'put', store: store, valor: Object.assign({}, t.registro, { published_hash: hash }) });
      }
    }
    for (const m of (dados.media || [])) {
      if (m.status === 'removed') {
        const rem = remocaoPorId[m.id] || null;
        ops.push({ op: 'del', store: 'media', chave: m.id });                       // o registro sai do banco
        if (rem) ops.push({ op: 'put', store: 'meta', valor: { key: 'removal/' + m.sha256, value: Object.assign({ path: m.path }, rem) } });
        continue;
      }
      const aceitos = porPath[m.path] || [];
      const servers = Modelo.uniao(m.servers, aceitos);
      if (m.status === 'published' && (m.servers || []).join() === servers.join()) continue;
      ops.push({ op: 'put', store: 'media', valor: Object.assign({}, m, { status: 'published', servers: servers, previous_status: null, updated_at: Modelo.agora() }) });
    }
    ops.push({ op: 'put', store: 'published', chave: 'current', valor: o.published });
    ops.push({ op: 'put', store: 'meta', valor: { key: 'last_publish_at', value: Modelo.agora() } });
    await db.escrever(ops);
    return ops.length;
  }

  // Publicação INTERROMPIDA (desfecho 'falta_servidor'): grava na store
  // `media` os servidores que aceitaram cada blob (13 §4.3). Não muda estado
  // nem `published` — o arquivo continua por publicar; o que se preserva é o
  // trabalho de rede já feito, para a tentativa seguinte não reenviar pelo Tor
  // o que já está nos servidores. É o que a tela promete em T8.
  async function registrarSubidos(db, resultado) {
    const porHash = (resultado && resultado.servidoresPorHash) || {};
    if (!Object.keys(porHash).length) return 0;
    const media = await db.getAll('media');
    const ops = [];
    for (const m of media) {
      const aceitos = porHash[m.sha256];
      if (!aceitos || !aceitos.length) continue;
      const servers = Modelo.uniao(m.servers, aceitos);
      if ((m.servers || []).join() === servers.join()) continue;
      ops.push({ op: 'put', store: 'media', valor: Object.assign({}, m, { servers: servers, updated_at: Modelo.agora() }) });
    }
    if (ops.length) await db.escrever(ops);
    return ops.length;
  }

  // --- republicar (14 T3, 13 §5.5) ----------------------------------------

  // Reenvia o evento JÁ ASSINADO aos relays que não o têm. Não pede a nsec —
  // é o motivo de `published.manifest_event` existir. Nunca reenvia um
  // manifest mais antigo que o que a rede tem (guarda de 13 §6.3 item 5).
  async function republicar(o) {
    const publicado = o.published;
    if (!publicado || !publicado.manifest_event) return { desfecho: 'sem_manifest', resultados: [] };
    // A guarda de 13 §5.5 e §6.3 item 5, agora no código (M5): se a última
    // verificação viu um relay com um manifest MAIS NOVO, outra máquina
    // publicou depois desta. Reenviar o local seria pedir à rede que
    // retrocedesse — e o 15128 é substituível, quem chega com `created_at`
    // maior fica. Não existe "forçar": o caminho é recarregar da rede (T2) e
    // publicar por cima do que veio de lá. Quem chama mostra o aviso de
    // publicação concorrente.
    const maisNovos = ((publicado.health || {}).relays_newer) || [];
    if (maisNovos.length) return { desfecho: 'concorrente', relays_newer: maisNovos.slice(), resultados: [] };
    const alvos = Modelo.uniao(o.relays);
    if (alvos.length === 0) return { desfecho: 'sem_relays', resultados: [] };
    const eventos = [publicado.manifest_event];
    const meta = publicado.metadata_events || {};
    for (const k of ['kind0', 'kind10002', 'kind10063']) if (meta[k]) eventos.push(meta[k]);
    const saida = [];
    for (const ev of eventos) {
      const rs = await Relay.publicar(alvos, ev, { sinal: o.sinal, timeoutMs: o.timeoutMs, aoRelay: o.aoRelay });
      saida.push({ kind: ev.kind, resultados: rs, placar: Relay.placar(rs) });
    }
    const principal = saida[0];
    return { desfecho: principal.placar.ok ? 'republicado' : 'falhou', resultados: saida, placar: principal.placar };
  }

  return Object.freeze({
    KIND_MANIFEST, KIND_PERFIL, KIND_RELAYS, KIND_SERVIDORES, CLIENTE, PARALELAS_PADRAO,
    planear, caminhosDoApp, modeloManifest, modeloPerfil, modeloRelays, modeloServidores, conteudoPerfil, avatarDe, urlDoAvatar,
    mudouPerfil, mudouLista, valoresDeTag, configPendente, emLotes, executar, fotografia, aplicar, registrarSubidos, republicar
  });
})();
