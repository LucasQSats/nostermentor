// ui/miniaturas.js — mídia que veio da REDE não tem bytes locais, e as três
// telas que mostram imagem (T6, o modal "Inserir imagem", o modal de capa)
// desenhavam a partir dos bytes: numa máquina nova, tudo ficava sem miniatura
// (pendência 32, achada na bancada Tails com o banco vazio).
//
// A correção ingénua — baixar tudo ao abrir — colide com duas coisas já
// decididas: `13` D17 (o IndexedDB é cache de sessão, não arquivo) e P38 de
// `08` (no Tails a biblioteca inteira vive na RAM). No caso real do dono eram
// ~35 MB pelo Tor a 0,46 MB/s.
//
// Por isso, o que este módulo faz (opção (a) da pendência, decidida pelo dono
// em 2026-08-31):
//   • baixa SÓ o que entrou no campo de visão (IntersectionObserver);
//   • uma de cada vez, em fila — pelo Tor, paralelismo não acelera, só
//     multiplica conexões;
//   • guarda em memória, por sessão, nunca no banco;
//   • acima de um teto de bytes NÃO baixa sozinho: mostra o tamanho e um
//     botão, porque rolar uma lista não pode custar 7 MB por linha sem aviso.
// A opção (c) da mesma pendência — miniaturas GERADAS e guardadas como mídia
// própria — entra com a pendência 30 e continua a fazer sentido: esta cobre
// a mídia antiga, que nunca terá miniatura guardada.
const Miniaturas = (function () {
  'use strict';

  // Acima disto, o dono decide. 1 MiB pelo Tor a ~0,46 MB/s são ~2 s; uma foto
  // de câmera (7 MB) seriam ~15 s por linha, e a lista tem muitas linhas.
  const TETO_AUTOMATICO = 1048576;
  const cache = new Map();          // sha256 → Blob (só nesta sessão)
  const urls = [];                  // blob: abertos, revogados em `limpar`
  const fila = [];
  let correndo = false;
  let observador = null;

  function ehImagem(mime) { return String(mime || '').indexOf('image/') === 0; }

  function proxima() {
    if (correndo) return;
    const tarefa = fila.shift();
    if (!tarefa) return;
    correndo = true;
    tarefa().catch(function () {}).then(function () { correndo = false; proxima(); });
  }
  function enfileirar(tarefa) { fila.push(tarefa); proxima(); }

  // → Blob | null. Nunca lança: uma miniatura que falha é um espaço vazio, não
  // um erro na cara do dono (ele não pediu esta imagem, só rolou a página).
  async function obter(m, servidores, sinal) {
    if (!m || !m.sha256) return null;
    if (cache.has(m.sha256)) return cache.get(m.sha256);
    const lista = Modelo.uniao(m.servers, servidores);
    if (!lista.length) return null;
    let r;
    try { r = await Blossom.baixar(lista, m.sha256, { sinal: sinal || null, timeoutMs: Blossom.timeoutPara(m.size || 0) }); }
    catch (e) { return null; }
    if (!r || !r.ok) return null;
    const blob = new Blob([r.bytes], { type: m.mime || 'application/octet-stream' });
    cache.set(m.sha256, blob);
    return blob;
  }

  // 39 — o primeiro quadro de um vídeo, SÓ para o dono o reconhecer no modal.
  // Nunca é guardado nem publicado: por isso a variação de compressão do
  // `canvas` entre motores, que partiria o determinismo de `13` §5.2, aqui
  // não custa nada — o que sai daqui morre na tela.
  // Exige `media-src blob:` na CSP do painel (é memória local, não rede: a
  // regra de `02` G.1.1, "nenhum código nem recurso remoto", fica intacta).
  function primeiroQuadro(blob) {
    return new Promise(function (resolve) {
      let url = null;
      function fim(r) { if (url) { try { URL.revokeObjectURL(url); } catch (e) {} } resolve(r); }
      try { url = URL.createObjectURL(blob); } catch (e) { return resolve(null); }
      const v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.preload = 'metadata';
      const timer = setTimeout(function () { fim(null); }, 8000);
      v.addEventListener('error', function () { clearTimeout(timer); fim(null); });
      v.addEventListener('loadeddata', function () {
        clearTimeout(timer);
        try {
          const l = v.videoWidth || 320, a = v.videoHeight || 240;
          const c = document.createElement('canvas');
          c.width = Math.min(l, 480);
          c.height = Math.max(1, Math.round(a * (c.width / l)));
          c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
          if (c.toBlob) c.toBlob(function (b) { fim(b || null); }, 'image/png');
          else fim(null);
        } catch (e) { fim(null); }
      });
      v.src = url;
      try { v.load(); } catch (e) { clearTimeout(timer); fim(null); }
    });
  }

  // O elemento de um VÍDEO no modal: o primeiro quadro quando os bytes estão
  // aqui; caso contrário o rótulo, porque baixar um vídeo da rede só para
  // desenhar um quadradinho é exatamente o que a pendência 32 proíbe.
  function elementoVideo(m, o) {
    const h = Shell.h, T = o.textos || {};
    const caixa = h('span', { class: 'mini-caixa', 'data-sha': m.sha256 || '' });
    caixa.appendChild(h('span', { class: 'sem-mini', title: T.semMiniatura || '' }, 'vídeo'));
    const local = m.bytes || cache.get(m.sha256);
    if (!local) return caixa;
    enfileirar(async function () {
      const quadro = await primeiroQuadro(local);
      if (!quadro) return;
      const u = urlDe(quadro);
      if (!u) return;
      Shell.limpar(caixa);
      caixa.appendChild(h('img', { class: o.classe || '', src: u, alt: m.alt || '', loading: 'lazy' }));
      if (typeof o.aoTrocar === 'function') { try { o.aoTrocar(); } catch (e) {} }
    });
    return caixa;
  }

  function urlDe(blob) {
    let u;
    try { u = URL.createObjectURL(blob); } catch (e) { return null; }
    urls.push(u);
    return u;
  }

  // O elemento que vai para a tela. Devolve SEMPRE algo — nunca undefined —
  // e troca-se a si próprio quando (e se) os bytes chegarem.
  //   o: { servidores, classe, textos, aoTrocar? }
  function elemento(m, o) {
    const h = Shell.h, T = o.textos || {}, classe = o.classe || 'mini';
    const rotuloVazio = (Modelo.extensao(m.path) || '?');
    const caixa = h('span', { class: 'mini-caixa', 'data-sha': m.sha256 || '' });

    function pintarVazio(titulo) {
      Shell.limpar(caixa);
      caixa.appendChild(h('span', { class: 'sem-mini', title: titulo || '' }, rotuloVazio));
    }
    function pintarImagem(blob) {
      const u = urlDe(blob);
      if (!u) return pintarVazio(T.falhou);
      Shell.limpar(caixa);
      caixa.appendChild(h('img', { class: classe, src: u, alt: m.alt || '', loading: 'lazy' }));
      if (typeof o.aoTrocar === 'function') { try { o.aoTrocar(); } catch (e) {} }
    }
    async function baixar() {
      Shell.limpar(caixa);
      caixa.appendChild(h('span', { class: 'sem-mini baixando', title: T.baixando || '' }, '…'));
      const blob = await obter(m, o.servidores);
      if (blob) pintarImagem(blob); else pintarVazio(T.falhou);
    }

    // 1. os bytes já estão aqui (enviada nesta máquina, ou já baixada antes)
    const local = m.bytes || cache.get(m.sha256);
    if (ehImagem(m.mime) && local) { pintarImagem(local); return caixa; }
    if (!ehImagem(m.mime) || !m.sha256) { pintarVazio(T.semMiniatura); return caixa; }

    // 2. grande demais para baixar sem o dono mandar
    const tam = Number.isInteger(m.size) ? m.size : null;
    if (tam !== null && tam > TETO_AUTOMATICO) {
      caixa.appendChild(h('button', { type: 'button', class: 'sem-mini ver-mini', title: T.grandeTitulo || '',
        onclick: function () { enfileirar(baixar); } }, T.ver || 'ver'));
      return caixa;
    }

    // 3. sob demanda: só quando entra no campo de visão
    pintarVazio(T.semMiniatura);
    if (typeof IntersectionObserver !== 'function') { enfileirar(baixar); return caixa; }
    if (!observador) {
      observador = new IntersectionObserver(function (entradas) {
        for (const e of entradas) {
          if (!e.isIntersecting) continue;
          observador.unobserve(e.target);
          const fn = e.target.__baixar;
          if (fn) enfileirar(fn);
        }
      }, { rootMargin: '200px' });
    }
    caixa.__baixar = baixar;
    observador.observe(caixa);
    return caixa;
  }

  // --- 32(c): a miniatura GUARDADA -----------------------------------------
  // A de cima (32(a)) é para o PAINEL e morre com a aba. Esta é para o LEITOR
  // do site publicado: vira arquivo próprio, com o seu sha256, e sobe uma vez.
  // Por isso a variação de compressão do `canvas` entre motores, que aqui não
  // importaria, também não importa: os bytes nascem UMA vez, na máquina do
  // dono, e a partir daí são um `media` como qualquer outro — 13 §5.2 continua
  // de pé porque o gerador só referencia o caminho, nunca regera a imagem.
  const MINI_LARGURA = 480;          // ~2× o cartão de 220px da galeria (telas densas)
  const MINI_QUALIDADE = 0.8;
  // Abaixo disto a original JÁ é uma miniatura: gerar outra seria publicar um
  // arquivo a mais pelo Tor para poupar nada.
  const MINI_DISPENSA_BYTES = 122880;   // 120 KiB

  function valeAPena(m) {
    if (!m || !ehImagem(m.mime)) return false;
    if (m.mime === 'image/svg+xml') return false;        // vetor não tem tamanho de arquivo a poupar
    if (Number.isInteger(m.width) && m.width <= MINI_LARGURA && Number.isInteger(m.size) && m.size <= MINI_DISPENSA_BYTES) return false;
    return true;
  }

  function paraBlob(canvas, tipo, q) {
    return new Promise(function (resolve) {
      if (!canvas.toBlob) return resolve(null);
      let feito = false;
      const t = setTimeout(function () { if (!feito) { feito = true; resolve(null); } }, 8000);
      try { canvas.toBlob(function (b) { if (feito) return; feito = true; clearTimeout(t); resolve(b || null); }, tipo, q); }
      catch (e) { if (!feito) { feito = true; clearTimeout(t); resolve(null); } }
    });
  }

  // → { bytes: Uint8Array, mime, width, height } | null. Nunca lança: sem
  // miniatura a galeria serve a original, que é pior mas funciona.
  // O `mime` devolvido é o que o motor PRODUZIU, não o que se pediu: um motor
  // sem WebP devolve PNG, e gravar o pedido em vez do produzido daria um
  // caminho `.webp` com bytes de PNG — e o gateway serve pelo caminho (13 §5.1).
  async function gerar(bytes, mime) {
    if (!ehImagem(mime) || mime === 'image/svg+xml') return null;
    if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return null;
    let bmp = null;
    try {
      bmp = await createImageBitmap(new Blob([bytes], { type: mime }));
      const l = bmp.width, a = bmp.height;
      if (!l || !a) return null;
      const largura = Math.min(l, MINI_LARGURA);
      const altura = Math.max(1, Math.round(a * (largura / l)));
      const c = document.createElement('canvas');
      c.width = largura; c.height = altura;
      const ctx = c.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(bmp, 0, 0, largura, altura);
      const blob = await paraBlob(c, 'image/webp', MINI_QUALIDADE);
      if (!blob || !blob.size) return null;
      const buf = new Uint8Array(await blob.arrayBuffer());
      // Se a "miniatura" saiu maior que o original, não é miniatura nenhuma.
      if (buf.length >= bytes.length) return null;
      return { bytes: buf, mime: blob.type || 'image/png', width: largura, height: altura };
    } catch (e) { return null; }
    finally { if (bmp && typeof bmp.close === 'function') { try { bmp.close(); } catch (e) {} } }
  }

  // Ao sair da tela: os blob: são revogados, o CACHE FICA. Rever a mesma tela
  // não repete o download — o que seria absurdo pelo Tor —, e o cache morre
  // com a aba, que é o que `13` D17 manda.
  function limpar() {
    for (const u of urls.splice(0)) { try { URL.revokeObjectURL(u); } catch (e) {} }
    if (observador) { try { observador.disconnect(); } catch (e) {} observador = null; }
    fila.length = 0;
  }
  function esquecer() { cache.clear(); }

  return Object.freeze({ TETO_AUTOMATICO, MINI_LARGURA, MINI_DISPENSA_BYTES, obter, elemento, elementoVideo, primeiroQuadro,
    gerar, valeAPena, limpar, esquecer,
    temNoCache: function (sha) { return cache.has(sha); } });
})();
