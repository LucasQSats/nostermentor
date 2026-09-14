/* core/modelo.js — o contrato de dados (13) em código: defaults do site
   (13 §3), entidades (13 §4), slug e caminhos (13 §4.0, §5.1), máquina de
   estados (13 §4.4) e a infraestrutura padrão (05 §4). Sem DOM, sem rede;
   não referencia outros módulos em tempo de carga. */
const Modelo = (function () {
  'use strict';

  // 13 §2 / §7.4: uma versão para as três cópias. v2 desde 2026-09-12 (os
  // armazéns `messages` e `peers` dos Contatos). ⚠️ Depois desta versão, um app
  // MAIS ANTIGO não abre o banco — é a regra anti-downgrade, e o caminho de
  // volta é o backup, como sempre.
  const SCHEMA_VERSION = 2;
  // ⚠️ A versão do FORMATO PUBLICADO (o `/nostermentor/site.json`) e do arquivo
  // de backup, separada da do banco em 2026-09-12 e pela primeira vez diferente
  // dela. O `13` §2 dizia "uma versão para as três cópias", e valeu enquanto as
  // três mudavam juntas. A migração v2 acrescenta armazéns LOCAIS (as mensagens)
  // e não muda uma vírgula do que se publica — carimbar `version: 2` no
  // site.json teria dois preços, os dois errados:
  //   (1) o arquivo muda de bytes em TODO site já publicado, o hash muda, o
  //       manifest muda, e o painel passa a dizer "1 alteração por publicar" a
  //       quem não mexeu em nada — mandando republicar pelo Tor um site idêntico;
  //   (2) um app da versão anterior RECUSARIA um site.json e um backup que ele
  //       sabe ler perfeitamente (13 §7.4), o que é uma inverdade sobre o arquivo.
  // Sobe quando o CONTRATO PUBLICADO mudar de tal forma que um app anterior
  // deixe de saber lê-lo.
  // ⚠️ NÃO subiu na Etapa 2 dos Contatos (2026-09-12), ao contrário do que esta
  // mesma linha previa na Etapa 1. `site.contacts` é ADITIVO e é OMITIDO quando
  // vazio: um app anterior lê o arquivo inteiro e ignora a chave que não
  // conhece (a lista branca de `SiteJson.lerSite` a descarta), exatamente como
  // já acontece com `favicon_media_id`, que entrou pelo mesmo caminho. Subir
  // para 2 teria os dois preços que a separação das versões existe para evitar:
  // mudava os bytes do site.json de TODO site já publicado (o número está lá
  // dentro) e fazia um app anterior RECUSAR um arquivo que sabe ler.
  // O preço de não subir, dito por inteiro: um app anterior que republique um
  // site com contatos os apaga do site.json, porque não os escreve — é o mesmo
  // que já vale para o ícone da aba, e o caminho de volta é o mesmo (o painel
  // guarda o dado e volta a publicá-lo).
  const FORMATO_VERSION = 1;

  // 05 §4 (revisado 2026-08-20): os 8 relays com o manifest do Bostil;
  // `nostr.cercatrova.me` fora (P7). Oito porque via Tor sobram ~6 (P20).
  const RELAYS_PADRAO = Object.freeze([
    'wss://nos.lol', 'wss://relay.damus.io', 'wss://relay.primal.net', 'wss://relay.nsite.lol',
    'wss://relay.wellorder.net', 'wss://nostr-pub.wellorder.net', 'wss://offchain.pub', 'wss://relay.nostr.wirednet.jp'
  ]);
  // A caixa de entrada das mensagens privadas (NIP-17 kind 10050), decidida por
  // ele em 2026-09-12 com o medido na mão (P44 do 08): um relay de cada tipo.
  //   auth.nostr1.com — entrega as mensagens só ao dono identificado (NIP-42),
  //                     mas exige que quem escreve também se identifique;
  //   nos.lol         — aceita de qualquer aplicativo; em troca, um curioso
  //                     consegue CONTAR os envelopes da npub (não lê nada).
  // O relay.damus.io ficou de fora com razão medida: exige identificação para
  // entregar e não sabe processá-la ("relay needs serviceUrl to be configured
  // before AUTH can work") — o que cair lá não é lido nem pelo dono.
  const RELAYS_CAIXA_PADRAO = Object.freeze(['wss://auth.nostr1.com', 'wss://nos.lol']);
  const MAX_RELAYS_CAIXA = 3;             // "1 to 3 relays", NIP-17
  // 05 §4 + 03 §6: só servidores que aceitam todos os tipos E deixam apagar.
  const SERVIDORES_PADRAO = Object.freeze(['https://cdn.hzrd149.com', 'https://blossom.primal.net']);
  // 14 T3 / T-9: nsite.lol é o gateway de "Ver o site"; nsite.cloud "pode levar dias" (P1).
  const GATEWAYS = Object.freeze([
    Object.freeze({ host: 'nsite.lol', principal: true }),
    Object.freeze({ host: 'nsite.cloud', lento: true }),
    Object.freeze({ host: 'nsite.run' })
  ]);

  const RESERVADOS = Object.freeze(['index', 'blog', 'img', 'media', 'tema', 'nostermentor', 'feed', 'sitemap', 'robots']);
  const CAMINHOS_RESERVADOS = Object.freeze(['/feed.xml', '/sitemap.xml', '/robots.txt']);   // pendência 13
  const CAMINHO_SITE_JSON = '/nostermentor/site.json';                                         // 13 §6
  const PREFIXO_BLOG = '/blog';
  const PREFIXO_ETIQUETA = PREFIXO_BLOG + '/etiqueta';                                         // 40
  const STATUS = Object.freeze(['draft', 'published', 'modified', 'removed']);

  // 13 §5.1: imagem em /img/, o resto em /media/
  const MIME = Object.freeze({
    html: 'text/html', htm: 'text/html', css: 'text/css', js: 'text/javascript', json: 'application/json',
    xml: 'application/xml', txt: 'text/plain', md: 'text/markdown', svg: 'image/svg+xml',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
    avif: 'image/avif', ico: 'image/x-icon', mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg',
    m4a: 'audio/mp4', ogg: 'audio/ogg', opus: 'audio/ogg', wav: 'audio/wav', pdf: 'application/pdf',
    ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2',
    // 46 — formatos que faltavam e que o dono encontra no dia a dia: um vídeo
    // de celular é `.mov`. Sem estar aqui, o caminho publicado virava
    // `.bin`, e `.bin` faz o navegador do LEITOR tratar o vídeo como arquivo
    // para baixar em vez de o tocar. Vão no fim de propósito: `extensaoDe`
    // procura pela primeira chave com o mesmo mime, e a ordem de cima é a
    // que já estava certa (`jpg` antes de `jpeg`).
    mov: 'video/quicktime', m4v: 'video/x-m4v', mkv: 'video/x-matroska',
    avi: 'video/x-msvideo', '3gp': 'video/3gpp', ogv: 'video/ogg',
    flac: 'audio/flac', aac: 'audio/aac', weba: 'audio/webm'
  });

  // 14 §0.9 / T-10: tudo em UTC, sem milissegundos.
  function agora() { return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'); }
  function formatarData(iso) { const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(iso || '')); return m ? m[1] : ''; }
  function formatarDataHora(iso) { const s = String(iso || ''); return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) ? s.slice(0, 10) + ' ' + s.slice(11, 16) : ''; }
  function dataDeUnix(segundos) { return new Date(segundos * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z'); }

  function novoId() { return crypto.randomUUID(); }

  // 13 §4.0: minúsculas, a-z0-9-, NFD sem diacríticos
  function slug(titulo) {
    return String(titulo == null ? '' : titulo).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  function slugValido(s) { return typeof s === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s) && s.length <= 120 && RESERVADOS.indexOf(s) === -1; }

  // 13 §5.1
  function caminhoDe(tipo, slugOuArquivo) {
    switch (tipo) {
      case 'home': return '/index.html';
      case 'blog': return PREFIXO_BLOG + '/index.html';
      case 'page': return '/' + slugOuArquivo + '.html';
      case 'post': return PREFIXO_BLOG + '/' + slugOuArquivo + '.html';
      case 'etiqueta': return PREFIXO_ETIQUETA + '/' + slugOuArquivo + '.html';
      case 'img': return '/img/' + slugOuArquivo;
      case 'media': return '/media/' + slugOuArquivo;
      case 'tema': return '/tema/' + slugOuArquivo;
      case 'site_json': return CAMINHO_SITE_JSON;
    }
    throw new Error('tipo de caminho desconhecido: ' + tipo);
  }

  // 40 — as etiquetas dos artigos, agrupadas pelo CAMINHO que vão gerar.
  // Agrupar por slug (e não por nome) é obrigatório, não conveniência: "São
  // Paulo" e "sao paulo" produzem `sao-paulo`, e dois arquivos no mesmo
  // caminho partiriam 13 §5.2 — o segundo apagaria o primeiro em silêncio.
  // O nome exibido é o MENOR em ordem de code point entre os que caem no mesmo
  // slug; `localeCompare` está fora de propósito aqui, porque a sua ordem
  // depende do locale do motor e isto vira bytes publicados.
  // Etiqueta cujo slug fica vazio (ex.: "!!!" ou "///") não gera página: fica
  // texto no artigo, como hoje. Devolve [] se não houver nenhuma.
  // → [{ slug, nome, nomes: [...], ids: [...] }] em ordem de slug
  function etiquetasDe(posts) {
    const porSlug = new Map();
    for (const p of posts || []) {
      if (!p || p.status === 'removed' || !Array.isArray(p.tags)) continue;
      for (const t of p.tags) {
        if (typeof t !== 'string' || !t) continue;
        const s = slug(t);
        if (!s || s.length > 120) continue;
        let e = porSlug.get(s);
        if (!e) { e = { slug: s, nome: t, nomes: [t], ids: [] }; porSlug.set(s, e); }
        else { if (e.nomes.indexOf(t) === -1) e.nomes.push(t); if (t < e.nome) e.nome = t; }
        if (e.ids.indexOf(p.id) === -1) e.ids.push(p.id);
      }
    }
    const saida = Array.from(porSlug.values());
    for (const e of saida) e.nomes.sort();
    saida.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
    return saida;
  }
  // O caminho de uma etiqueta pelo NOME (o que o artigo mostra) — null quando
  // o nome não produz slug nenhum.
  function caminhoDaEtiqueta(nome) { const s = slug(nome); return s && s.length <= 120 ? caminhoDe('etiqueta', s) : null; }

  function extensao(path) { const m = /\.([a-z0-9]+)$/i.exec(String(path || '')); return m ? m[1].toLowerCase() : null; }
  function mimePorCaminho(path) { const e = extensao(path); return e && MIME[e] ? MIME[e] : null; }

  function normalizarUrl(u) { return String(u == null ? '' : u).trim().replace(/\/+$/, ''); }
  function uniao() {
    const vistos = new Set(), saida = [];
    for (let i = 0; i < arguments.length; i++) {
      const lista = arguments[i];
      if (!Array.isArray(lista)) continue;
      for (const v of lista) { if (typeof v !== 'string') continue; const n = normalizarUrl(v); if (n && !vistos.has(n)) { vistos.add(n); saida.push(n); } }
    }
    return saida;
  }
  function urlDoSite(npub, host) { return 'https://' + npub + '.' + host + '/'; }

  // 13 §3
  function sitePadrao(pubkey, npub) {
    return {
      pubkey: pubkey, npub: npub, title: '', description: '', language: 'pt-BR',
      profile: { name: '', about: '', picture_media_id: null },
      logo_media_id: null,                 // 38: o logo do cabeçalho — NÃO é o avatar do kind 0
      // O ícone da ABA do navegador de quem lê o site. Terceira imagem, e não
      // uma das duas de cima, porque serve a um terceiro formato: quadrado e
      // legível com 16 px de lado. Campo do SITE, como o logo — trocar de tema
      // não pode apagar o ícone.
      favicon_media_id: null,
      home: { mode: 'blog', page_id: null, latest_posts: 5 },
      blog: { prefix: PREFIXO_BLOG, title: 'Blog' },
      menu: [{ type: 'blog' }],
      theme: { id: 'padrao', version: 1, options: {} },
      // 2026-09-05 — a gaveta de ajustes por tema (`Temas.trocar`): os valores
      // dos temas que NÃO estão em uso, para voltarem quando o dono voltar a
      // eles. Campo LOCAL: não sai no `site.json` publicado (13 §6.1 lista o
      // que a rede recebe), mas vai no BACKUP.
      theme_memory: {},
      donations: { lightning_address: '', support_block: false, footer_credit: true },
      privacy: { show_publish_time: false },
      discovery: { canonical_base: null },
      network: { relays: RELAYS_PADRAO.slice(), servers: SERVIDORES_PADRAO.slice(), capabilities: {} },
      // 61 — as mensagens privadas (NIP-17). Campo LOCAL: não sai no site.json
      // (13 §6.1), logo não muda um byte publicado de quem não usa, e não entra
      // na assinatura da configuração — o contador de "Publicar" não acende por
      // causa de mensagens (14 T13 decisão 10). DESLIGADO de fábrica: quem nunca
      // o ligou não publica kind 10050 nenhum, e nenhum aplicativo que siga a spec
      // manda mensagem para este site. Ligá-lo é gesto do dono; desligar depois
      // publica o aviso sem relays (`core/publicar.js`, `mudouCaixa`).
      messages: { enabled: false, relays: RELAYS_CAIXA_PADRAO.slice() },
      // 61 Etapa 2 — as formas de contato que o dono publica (e-mail, WhatsApp,
      // Telegram, Instagram, X, Nostr, Signal e "outro link"). Ao contrário das
      // mensagens acima, este campo É publicado: sai no site.json e desenha o
      // bloco `[[contatos]]` nas páginas onde o dono o inserir. Vazio de
      // fábrica, e VAZIO SOME do site.json — quem não usa não vê um byte mudar
      // no que já publicou. Quem conhece os oito canais é `core/contatos.js`.
      contacts: []
    };
  }

  // 13 §4.0 — campos comuns; página (§4.1) e artigo (§4.2)
  function registroBase(titulo) {
    const t = agora();
    return { id: novoId(), slug: slug(titulo), aliases: [], title: String(titulo == null ? '' : titulo), description: '',
      body: '', body_format: 'markdown', status: 'draft', created_at: t, updated_at: t, published_hash: null, previous_status: null };
  }
  // 35 — a capa é DADO da página: o tema padrão não a desenha (decisão do
  // usuário em 2026-08-31), mas ela viaja no site.json para os temas a usarem.
  function novaPagina(titulo) { return Object.assign(registroBase(titulo), { in_menu: true, cover_media_id: null }); }
  function novoArtigo(titulo) { return Object.assign(registroBase(titulo), { date: agora(), excerpt: '', tags: [], cover_media_id: null }); }

  // 13 §4.3 — arquivo herdado: caminho do manifest que o site.json não descreve
  function midiaHerdada(path, sha256, servers) {
    const t = agora();
    return { id: novoId(), path: path, mime: mimePorCaminho(path), size: null, sha256: sha256, width: null, height: null,
      alt: '', caption: '', bytes: null, status: 'published', servers: Array.isArray(servers) ? servers.slice() : [],
      removal: null, metadata: { stripped: null, removed_segments: [], warning: null }, origin: 'network',
      created_at: t, updated_at: t, previous_status: null };
  }

  // 13 §4.4 — devolve { registro } (cópia nova), { apagar: true } ou null (transição inválida)
  function transicao(reg, acao) {
    if (!reg || typeof reg !== 'object') return null;
    const s = reg.status, t = agora();
    const com = (novo, extra) => ({ registro: Object.assign({}, reg, { status: novo, updated_at: t }, extra || {}) });
    switch (acao) {
      case 'editar':
        if (s === 'published') return com('modified');
        if (s === 'modified' || s === 'draft') return com(s);
        return null;
      case 'publicar':
        if (s === 'removed') return { apagar: true };
        if (STATUS.indexOf(s) !== -1) return com('published', { previous_status: null });
        return null;
      case 'remover':
        if (s === 'published' || s === 'modified') return com('removed', { previous_status: s });
        return null;
      case 'excluir':
        return s === 'draft' ? { apagar: true } : null;
      case 'desfazer_remocao':
        if (s !== 'removed') return null;
        return com(reg.previous_status === 'modified' ? 'modified' : 'published', { previous_status: null });
    }
    return null;
  }

  function contarPorStatus(lista) {
    const c = { draft: 0, published: 0, modified: 0, removed: 0, total: 0 };
    for (const r of lista || []) { if (r && c.hasOwnProperty(r.status)) c[r.status]++; c.total++; }
    return c;
  }
  function pendentes(c) { return (c.draft || 0) + (c.modified || 0) + (c.removed || 0); }

  return Object.freeze({
    SCHEMA_VERSION, FORMATO_VERSION, RELAYS_PADRAO, SERVIDORES_PADRAO, RELAYS_CAIXA_PADRAO, MAX_RELAYS_CAIXA, GATEWAYS, RESERVADOS, CAMINHOS_RESERVADOS, CAMINHO_SITE_JSON, PREFIXO_BLOG, PREFIXO_ETIQUETA, STATUS, MIME,
    agora, formatarData, formatarDataHora, dataDeUnix, novoId, slug, slugValido, caminhoDe, etiquetasDe, caminhoDaEtiqueta, extensao, mimePorCaminho,
    normalizarUrl, uniao, urlDoSite, sitePadrao, novaPagina, novoArtigo, midiaHerdada, transicao, contarPorStatus, pendentes
  });
})();
