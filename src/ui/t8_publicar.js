/* ui/t8_publicar.js — T8 Publicar (14 T8). Quatro momentos, na ordem que a
   segurança exige: (1) conferir — relê os relays e bloqueia se outra máquina
   publicou depois (13 §6.3 item 5), regenera tudo e compara com a fotografia;
   (2) o diff, com o porquê de cada caminho e o total; (3) "Assinar e
   publicar", um botão só (a chave já está em memória); (4) progresso ao vivo
   e o placar honesto (D8) — quantos servidores, quantos relays, o que foi
   recusado, o que não respondeu.
   Nada aqui decide sozinho: quem sobe, assina e grava é core/publicar.js.
   A tela mostra, pergunta e relata — inclusive quando corre mal. */
(function () {
  'use strict';
  let ctrl = null;

  function desmontar() { if (ctrl) { ctrl.abort(); ctrl = null; } }
  function texto(m, mapa) { let s = String(m); for (const k of Object.keys(mapa || {})) s = s.split('{' + k + '}').join(String(mapa[k])); return s; }
  function bytes(n) {
    if (!n) return '0 B';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
    return (n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0).replace('.', ',') + ' MB';
  }
  function motivo(codigo) { return (Textos.t8.motivos && Textos.t8.motivos[codigo]) || codigo || ''; }
  function servidorCurto(u) { try { return new URL(u).hostname; } catch (e) { return String(u); } }
  function relayCurto(u) { return String(u).replace(/^wss:\/\//, ''); }

  // Cache do pré-flight (13 §3 `network.capabilities`), mesmo formato e mesma
  // janela de 24h que `ui/t6_midia.js` usa — sem isso cada publicação
  // reconferiria com os servidores todo arquivo já testado no dia (07 §3.2:
  // menos conexões pelo Tor). Puras (recebem o mapa, devolvem resultado/mapa
  // novo); quem chama decide quando gravar no `site`.
  const DIA_MS = 24 * 60 * 60 * 1000;
  function tipoBase(mime) { return String(mime || '').split(';')[0].trim().toLowerCase(); }
  function doCachePreflight(cap, servidor, mime, tamanho) {
    const c = cap[servidor];
    if (!c || !c.checked_at) return null;
    const idade = Date.now() - Date.parse(c.checked_at);
    if (!(idade >= 0 && idade < DIA_MS)) return null;
    const base = { servidor: servidor, estado: 'recusa', status: 0, ms: 0, checked_at: c.checked_at, cache: true };
    if (Array.isArray(c.refuses) && c.refuses.indexOf(tipoBase(mime)) !== -1) return Object.assign({}, base, { codigo: 'tipo_nao_aceito' });
    if (typeof c.max_bytes === 'number' && c.max_bytes > 0 && tamanho > c.max_bytes) return Object.assign({}, base, { codigo: 'grande_demais' });
    return null;
  }
  function comCapacidades(cap, resultados, mime) {
    const novo = Object.assign({}, cap);
    const tipo = tipoBase(mime);
    for (const r of resultados) {                     // só resultados AO VIVO chegam aqui (quem chama filtra os do cache)
      const antes = novo[r.servidor] || { checked_at: null, max_bytes: null, refuses: [] };
      const refuses = Array.isArray(antes.refuses) ? antes.refuses.slice() : [];
      if (r.estado === 'recusa' && r.codigo === 'tipo_nao_aceito' && tipo && refuses.indexOf(tipo) === -1) refuses.push(tipo);
      if (r.estado === 'aceita') { const i = refuses.indexOf(tipo); if (i !== -1) refuses.splice(i, 1); }
      novo[r.servidor] = { checked_at: r.checked_at, max_bytes: antes.max_bytes, refuses: refuses };
    }
    return novo;
  }

  // O porquê de cada caminho (14 T8 passo 2)
  function porque(item) {
    const P = Textos.t8.porques, p = item.path;
    if (p === Modelo.CAMINHO_SITE_JSON) return P.site_json;
    if (p.indexOf('/tema/') === 0) return P.tema;
    if (item.tipo === 'alias') return P.alias;
    if (p === Modelo.PREFIXO_BLOG + '/index.html') return P.blog;
    if (p === '/index.html' && item.tipo !== 'page') return P.home;
    return '';
  }

  async function montar(raiz) {
    const h = Shell.h, T = Textos.t8, s = Shell.sessao();
    desmontar();
    const info = Shell.dados();
    if (!info || !info.db || !info.db.estaAberto()) {
      raiz.appendChild(h('section', { id: 't8' }, h('h1', {}, T.titulo), h('p', { class: 'alerta' }, Textos.t3.aindaCarregando),
        h('div', { class: 'acoes' }, h('button', { type: 'button', onclick: function () { Shell.ir('t2'); } }, Textos.t3.voltarACarregar))));
      return;
    }
    const db = info.db;
    const secao = h('section', { id: 't8' }, h('h1', {}, T.titulo));
    const corpo = h('div', { id: 't8-corpo' }, h('p', { id: 't8-conferindo', class: 'apoio' }, T.conferindo));
    secao.appendChild(corpo);
    raiz.appendChild(secao);

    const site = (await db.get('site', 'site')) || Modelo.sitePadrao(s.pubkey, s.npub);
    let published = (await db.get('published', 'current')) || null;
    Shell.atualizarSite(site);

    // --- 1. conferir ------------------------------------------------------
    const dados = { site: site, pages: await db.getAll('pages'), posts: await db.getAll('posts'), media: await db.getAll('media') };
    const gerado = await Gerador.gerarSite(dados);
    const plano = Publicar.planear({ dados: dados, gerado: gerado, published: published });

    let concorrente = false, semResposta = false, quandoConcorrente = '';
    if (published && published.manifest_event && Modelo.uniao(site.network.relays).length) {
      Shell.limpar(corpo);
      corpo.appendChild(h('p', { id: 't8-conferindo', class: 'apoio' }, T.conferindoRede));
      ctrl = new AbortController();
      const meu = ctrl;
      try {
        const v = await Saude.verificar({ relays: site.network.relays, pubkey: s.pubkey, referencia: published.manifest_event, sinal: meu.signal });
        if (meu.signal.aborted) return;
        concorrente = v.classificacao.concorrente;
        semResposta = v.classificacao.listas.nao_respondeu.length === v.resultados.length;
        if (concorrente) {
          const novo = Saude.maisRecente(v.resultados.reduce((a, r) => a.concat(Saude.manifestsValidos(r.eventos, s.pubkey)), []));
          quandoConcorrente = novo ? Modelo.formatarData(Modelo.dataDeUnix(novo.created_at)) : '';
        }
        published = Object.assign({}, published, { health: v.health, relays: v.classificacao.por_relay });
        await db.put('published', published, 'current');
      } catch (e) {
        if (meu.signal.aborted) return;
        semResposta = true;
      } finally { if (ctrl === meu) ctrl = null; }
    }

    // --- 2. o diff --------------------------------------------------------
    Shell.limpar(corpo);
    if (concorrente) {
      Shell.faixa(texto(T.concorrente, { d: quandoConcorrente }), 'erro', { rotulo: T.recarregar, fn: function () { Shell.ir('t2'); } });
      corpo.appendChild(h('p', { class: 'erro', id: 't8-concorrente' }, texto(T.concorrente, { d: quandoConcorrente })));
      corpo.appendChild(h('div', { class: 'acoes' }, h('button', { type: 'button', id: 't8-recarregar', onclick: function () { Shell.ir('t2'); } }, T.recarregar)));
      return;
    }
    if (semResposta) corpo.appendChild(h('p', { class: 'alerta', id: 't8-nao-conferi' }, T.naoConferi));
    if (plano.nada) {
      corpo.appendChild(h('p', { id: 't8-vazio' }, T.vazio));
      corpo.appendChild(h('div', { class: 'acoes' }, h('button', { type: 'button', class: 'secundario', onclick: function () { Shell.ir('t3'); } }, T.voltar)));
      Shell.contadores({ publicar: 0 });
      return;
    }

    // --- 2b. pré-flight por arquivo (14 T8; ficou para o M5) --------------
    // "Repete o pré-flight só para uploads sem verificação recente": cada
    // item de `plano.upload` é conferido nos servidores configurados, com o
    // cache acima poupando quem já foi testado no dia. "Não consegui
    // verificar" nunca conta como recusa (mesma regra de T6) — só quando
    // TODOS os servidores recusam de fato é que o arquivo "não pode subir".
    const preflightPorPath = {};
    if (plano.upload.length && plano.servidores.length) {
      const statusPre = h('p', { id: 't8-conferindo-servidores', class: 'apoio' }, T.conferindoServidores);
      corpo.appendChild(statusPre);
      const capsAntes = (site.network && site.network.capabilities) || {};
      let capsNovas = capsAntes;
      ctrl = ctrl || new AbortController();
      const meu = ctrl;
      const porItem = await Publicar.emLotes(plano.upload, Publicar.PARALELAS_PADRAO, async function (item) {
        const sabidos = [], perguntar = [];
        for (const sv of plano.servidores) {
          const c = doCachePreflight(capsNovas, sv, item.mime, item.tamanho);
          if (c) sabidos.push(c); else perguntar.push(sv);
        }
        if (!perguntar.length || (meu.signal && meu.signal.aborted)) return { path: item.path, resultados: sabidos };
        const vivos = await Blossom.preflightEmTodos(perguntar, { sha: item.sha256, tamanho: item.tamanho, mime: item.mime, assinar: Shell.assinar, sinal: meu.signal });
        capsNovas = comCapacidades(capsNovas, vivos, item.mime);
        return { path: item.path, resultados: sabidos.concat(vivos) };
      });
      if (meu.signal.aborted) return;
      if (ctrl === meu) ctrl = null;
      for (const r of porItem) preflightPorPath[r.path] = r.resultados;
      if (capsNovas !== capsAntes) {
        site.network = Object.assign({}, site.network, { capabilities: capsNovas });
        try { await db.put('site', site, 'site'); } catch (e) {}
      }
      corpo.removeChild(statusPre);
    }
    const avisosPreflight = plano.upload.map(function (item) {
      const pf = preflightPorPath[item.path];
      if (!pf || !pf.length) return null;
      const recusam = pf.filter(function (r) { return r.estado === 'recusa'; });
      if (!recusam.length) return null;
      const resto = pf.filter(function (r) { return r.estado !== 'recusa'; });
      return { path: item.path, recusam: recusam, resto: resto, bloqueado: resto.length === 0 };
    }).filter(Boolean);
    const naoPodeSubir = avisosPreflight.filter(function (a) { return a.bloqueado; });

    function lista(rotulo, itens, extra) {
      if (!itens.length) return null;
      return h('div', { class: 'bloco-diff', 'data-bloco': rotulo },
        h('h2', {}, rotulo + ' (' + itens.length + ')'),
        h('ul', { class: 'lista-diff' }, itens.map(function (i) {
          const p = extra ? extra(i) : porque(i);
          return h('li', {}, h('code', {}, i.path), i.tamanho ? h('span', { class: 'apoio' }, ' ' + bytes(i.tamanho)) : null,
            p ? h('span', { class: 'apoio' }, ' — ' + p) : null);
        })));
    }
    corpo.appendChild(h('div', { id: 't8-diff' },
      lista(T.blocos.sobe, plano.sobe),
      lista(T.blocos.atualiza, plano.atualiza),
      lista(T.blocos.some, plano.some, function (i) { return i.apagar_blob ? Textos.t8.porques.apagar : Textos.t8.porques.sai; }),
      (function () {
        // "Fica como está": o que veio de outra ferramenta e continua no ar
        // — tanto o que o app nem tem registado (herdados) como a mídia
        // herdada que se manteve intacta (preservados). Sem os segundos, o
        // bloco nunca aparecia no caso real (ver 11, 2026-08-27).
        const fica = plano.herdados.concat(plano.preservados || []);
        return fica.length ? lista(T.blocos.herdados, fica, function () { return ''; }) : null;
      })(),
      avisosPreflight.length ? h('div', { class: 'bloco-diff', id: 't8-avisos' }, h('h2', {}, T.avisosTitulo),
        h('ul', {}, avisosPreflight.map(function (a) {
          const recusa = a.recusam.map(function (r) { return servidorCurto(r.servidor) + ' ' + T.avisoVaiRecusar + ' (' + motivo(r.codigo) + ')'; }).join('; ');
          const texto2 = a.bloqueado ? (recusa + ' — ' + T.naoPodeSubirItem) : texto(T.avisoParcial, { recusa: recusa, aceita: a.resto.map(function (r) { return servidorCurto(r.servidor); }).join(', ') });
          return h('li', { class: a.bloqueado ? 'erro' : 'apoio' }, h('code', {}, a.path), h('span', {}, ' — ' + texto2));
        }))) : null));

    const eventosLista = [T.eventos.manifest]
      .concat(plano.eventos.kind0 ? [T.eventos.kind0] : [])
      .concat(plano.eventos.kind10002 ? [T.eventos.kind10002] : [])
      .concat(plano.eventos.kind10063 ? [T.eventos.kind10063] : []);
    corpo.appendChild(h('div', { class: 'bloco-diff', id: 't8-eventos' }, h('h2', {}, T.eventosTitulo),
      h('ul', {}, eventosLista.map(x => h('li', {}, x)))));

    corpo.appendChild(h('p', { id: 't8-total', class: 'destaque' }, texto(T.total, { n: plano.upload.length, x: bytes(plano.bytes), m: plano.relays.length })));
    corpo.appendChild(h('p', { class: 'apoio', id: 't8-tor' }, T.tor));      // dito sempre: o app não sabe se está no Tor (P21)

    const pProgresso = h('p', { id: 't8-progresso', class: 'apoio', role: 'status', hidden: true });
    const medidor = h('progress', { id: 't8-barra', hidden: true });
    const divPlacar = h('div', { id: 't8-placar', hidden: true });
    const pErro = h('p', { id: 't8-erro', class: 'erro', role: 'alert', hidden: true });
    const btn = h('button', { type: 'button', id: 't8-assinar', onclick: publicar }, T.assinar);
    const acoes = h('div', { class: 'acoes' }, btn, h('button', { type: 'button', class: 'secundario', id: 't8-voltar', onclick: function () { Shell.ir('t3'); } }, T.voltar));
    corpo.appendChild(acoes); corpo.appendChild(medidor); corpo.appendChild(pProgresso); corpo.appendChild(pErro); corpo.appendChild(divPlacar);

    if (plano.servidores.length === 0) { btn.disabled = true; pErro.hidden = false; pErro.textContent = T.semServidor; }

    // Colisão com arquivo herdado (T-7): publicar apagaria do ar um arquivo
    // que o app prometeu preservar em T2c. Bloqueia e manda resolver em T6,
    // onde o herdado já aparece na lista com o botão Remover.
    if (plano.colisoes.length) {
      btn.disabled = true;
      pErro.hidden = false;
      const caminhos = plano.colisoes.map(function (c) { return c.path; }).join(', ');
      pErro.textContent = texto(plano.colisoes.length === 1 ? T.colisao : T.colisoes, { p: caminhos });
      corpo.insertBefore(h('p', { class: 'apoio', id: 't8-colisao-apoio' }, T.colisaoApoio), acoes);
      acoes.insertBefore(h('button', { type: 'button', id: 't8-colisao-ir', onclick: function () { Shell.ir('t6', { aba: 'herdados' }); } }, T.colisaoBotao), btn);
    }

    // "Não pode subir" (14 T8; M5): pelo menos um arquivo não tem nenhum
    // servidor que aceite — o bloco vermelho acima já nomeia qual e porquê;
    // aqui só desliga o botão até o dono remover o arquivo ou trocar de
    // servidor (Avançado).
    if (naoPodeSubir.length) { btn.disabled = true; pErro.hidden = false; pErro.textContent = T.bloqueado; }

    // --- 3 e 4. publicar e relatar ---------------------------------------
    function progresso(p) {
      pProgresso.hidden = false;
      if (p.passo === 'upload') {
        medidor.hidden = false;
        medidor.setAttribute('max', String(p.total));
        medidor.setAttribute('value', String(p.feitos));
        pProgresso.textContent = texto(T.passos.upload, { f: p.feitos, t: p.total });
      } else {
        medidor.hidden = true; medidor.removeAttribute('value');
        pProgresso.textContent = T.passos[p.passo] || '';
      }
    }

    async function publicar() {
      btn.disabled = true; btn.textContent = T.publicando;
      pErro.hidden = true; pErro.textContent = '';
      ctrl = new AbortController();
      const meu = ctrl;
      let res = null;
      try {
        res = await Publicar.executar({ plano: plano, site: site, assinar: Shell.assinar, servidores: plano.servidores, relays: plano.relays,
          sinal: meu.signal, progresso: progresso });
      } catch (e) {
        pErro.hidden = false; pErro.textContent = e && e.message ? e.message : String(e);
        btn.disabled = false; btn.textContent = T.assinar;
        return;
      } finally { if (ctrl === meu) ctrl = null; medidor.hidden = true; pProgresso.hidden = true; }
      if (meu.signal.aborted) return;

      if (res.desfecho === 'falta_servidor') {
        // o que chegou aos servidores fica gravado antes de qualquer aviso:
        // é o que a linha de apoio promete ao dono, e pelo Tor reenviar custa
        await Publicar.registrarSubidos(db, res);
        const primeiro = (res.orfaos && res.orfaos[0]) || null;
        pErro.hidden = false;
        pErro.textContent = primeiro ? texto(T.interrompida, { p: primeiro.path }) : T.semServidor;
        divPlacar.hidden = false; Shell.limpar(divPlacar);
        divPlacar.appendChild(h('p', { class: 'apoio' }, T.interrompidaApoio));
        if (primeiro) divPlacar.appendChild(h('ul', { id: 't8-orfaos' }, (primeiro.porServidor || []).map(x => h('li', {}, servidorCurto(x.servidor) + ' — ' + motivo(x.codigo) + (x.detalhe ? ' (' + x.detalhe + ')' : '')))));
        btn.disabled = false; btn.textContent = T.assinar;
        return;
      }
      if (res.desfecho === 'sem_assinatura') { pErro.hidden = false; pErro.textContent = T.erroAssinar; return; }
      if (res.desfecho === 'sem_relay') {
        pErro.hidden = false; pErro.textContent = T.semRelay;
        divPlacar.hidden = false; Shell.limpar(divPlacar);
        divPlacar.appendChild(h('ul', { id: 't8-relays' }, res.relaysManifest.map(x => h('li', {}, relayCurto(x.url) + ' — ' + ((T.relayEstados && T.relayEstados[x.estado]) || x.estado) + (x.mensagem ? ': ' + x.mensagem : '')))));
        btn.disabled = false; btn.textContent = T.assinar;
        return;
      }
      if (res.desfecho !== 'publicado') { pErro.hidden = false; pErro.textContent = String(res.desfecho); btn.disabled = false; btn.textContent = T.assinar; return; }

      // gravar: só agora o estado local muda
      const foto = Publicar.fotografia(res, plano, published);
      await Publicar.aplicar(db, { resultado: res, plano: plano, dados: dados, gerado: gerado, published: foto });
      await db.incrementar('alteracoes_nao_exportadas', 1);        // o mapa assinado é novo: o backup ficou velho (13 §7)
      published = foto;

      // placar (14 T8 passo 5)
      Shell.limpar(divPlacar); divPlacar.hidden = false;
      acoes.hidden = true;
      divPlacar.appendChild(h('h2', { id: 't8-publicado' }, T.publicado));
      const total = res.uploads.length;
      const porServidor = {};
      for (const u of res.uploads) for (const sv of u.aceitos) porServidor[sv] = (porServidor[sv] || 0) + 1;
      const ulArquivos = h('ul', { id: 't8-placar-arquivos' });
      for (const sv of plano.servidores) ulArquivos.appendChild(h('li', {}, texto(T.placarArquivos, { n: porServidor[sv] || 0, t: total, s: servidorCurto(sv) })));
      if (total > 0) divPlacar.appendChild(ulArquivos);
      const p = res.placar;
      divPlacar.appendChild(h('p', { id: 't8-placar-relays' }, texto(T.placarRelays, { n: p.com, m: p.total }),
        (p.recusados.length + p.mudos.length) > 0 ? ' ' + texto(T.placarRelaysDetalhe, { r: p.recusados.length, q: p.mudos.length }) : ''));
      for (const r of res.remocoes) {
        if (r.removal.deleted_from.length) divPlacar.appendChild(h('p', { class: 'apoio' }, texto(T.placarRemocao, { p: r.path, ok: r.removal.deleted_from.map(servidorCurto).join(', ') })));
        const naoDeu = r.removal.refused_by.concat(r.removal.unverified);
        if (naoDeu.length) divPlacar.appendChild(h('p', { class: 'alerta' }, texto(T.placarRemocaoNao, { p: r.path, nao: naoDeu.map(servidorCurto).join(', ') })));
      }
      divPlacar.appendChild(h('p', { class: 'apoio' }, T.demora));
      const gw = Modelo.GATEWAYS.find(g => g.principal);
      divPlacar.appendChild(h('p', {}, T.confira + ' ', h('a', { id: 't8-ver-site', href: Modelo.urlDoSite(s.npub, gw.host), target: '_blank', rel: 'noopener noreferrer' }, Modelo.urlDoSite(s.npub, gw.host))));
      divPlacar.appendChild(h('p', { class: 'alerta' }, T.backupAgora));
      divPlacar.appendChild(h('div', { class: 'acoes' },
        h('button', { type: 'button', id: 't8-exportar', onclick: function () { Shell.ir('t9'); } }, T.exportar),
        h('button', { type: 'button', class: 'secundario', onclick: function () { Shell.ir('t3'); } }, T.voltar)));

      const c = await Rede.contagens(db);
      Shell.contadores({ publicar: c.pendentes, naoExportadas: (await db.getMeta('alteracoes_nao_exportadas')) || 0 });
      Shell.atualizarBarra();
    }
  }

  Shell.registrar('t8', { montar: montar, desmontar: desmontar });
})();
