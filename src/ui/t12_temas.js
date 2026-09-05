/* ui/t12_temas.js — T12 Temas (14 T12): a galeria de temas.
   Nasceu em 2026-09-05, a pedido do dono: o seletor de tema era um `<select>`
   de quatro linhas na aba Aparência do T7 e passou a ser uma tela própria,
   com um cartão por tema e a prévia REAL de cada um — o desenho do WordPress
   (Aparência ▸ Temas é uma tela; ajustar o tema em uso é outra).
   A divisão de trabalho com o T7 é essa mesma: aqui ESCOLHE-SE o tema; lá
   ajustam-se as cores, letras e medidas DO TEMA EM USO, e o logo do
   cabeçalho, que é campo do site e não do tema (13 §3).

   ⚠️ A prévia de cada cartão é o site do dono gerado por inteiro com aquele
   tema, e não o mesmo HTML com outro CSS. Medido em 2026-09-05: os quatro
   temas de então diferem em SEIS dos oito moldes (layout, pagina, artigo,
   blog, etiqueta, galeria), logo trocar só a folha de estilo mostraria o
   Diário com a estrutura do Padrão — uma prévia falsa.

   ⚠️ 2026-09-05, mais tarde: o app passou de 4 para 21 TEMAS, e o custo desta
   tela passou a contar. Medido no Chrome da máquina de dev, com 50 artigos:
   gerar para os 21 levava 229 ms, contra 40 ms dos 4 (era 29 ms com 3
   artigos, 43 com 50 e 148 com 200, quando eram quatro). Daí a memória por
   jogo de moldes em `gerarPrevias` — 12 dos 21 temas são "só de CSS" e
   partilham `Temas.moldes`, e a capa deles é a MESMA. Paga-se uma vez, ao
   abrir a tela.

   O cartão "Enviar tema" está DESLIGADO e diz porquê. Sem o validador de
   pacote (02 G.2, TEMAS.md §11), um tema de estranho pode trazer um
   `url(https://…)` no CSS e fazer o navegador de cada LEITOR do site buscar
   um arquivo no servidor do autor do tema — desanonimização silenciosa de
   quem lê. Esconder o botão seria fingir que a funcionalidade não foi
   pensada; o texto explica a razão em linguagem de quem não é técnico. */
(function () {
  'use strict';
  let ctrl = null;
  const urlsAbertas = [];        // srcdoc não abre blob:, mas o modal pode — simetria com T6
  // A largura em que a prévia se DESENHA, antes de ser encolhida: um ecrã de
  // portátil. O Tor Browser maximizado mede 1200×600 e solto 1000×500 (medido
  // na bancada nº 1, 2026-09-05), logo 1100 fica no meio do que o leitor real
  // vai ver — e não no meio do que um telemóvel veria.
  const LARGURA_PREVIA = 1100;

  function desmontar() {
    if (ctrl) { ctrl.abort(); ctrl = null; }
    for (const u of urlsAbertas) { try { URL.revokeObjectURL(u); } catch (e) {} }
    urlsAbertas.length = 0;
  }
  function texto(m, mapa) { let s = String(m); for (const k of Object.keys(mapa || {})) s = s.split('{' + k + '}').join(String(mapa[k])); return s; }
  function clonar(v) { return JSON.parse(JSON.stringify(v)); }

  async function montar(raiz, params) {
    const h = Shell.h, T = Textos.t12;
    desmontar();
    ctrl = new AbortController();
    const sinal = ctrl.signal;
    const info = Shell.dados();
    if (!info || !info.db || !info.db.estaAberto()) {
      raiz.appendChild(h('section', { id: 't12' }, h('h1', {}, T.titulo), h('p', { class: 'alerta' }, T.aindaCarregando),
        h('div', { class: 'acoes' }, h('button', { type: 'button', onclick: function () { Shell.ir('t2'); } }, T.voltarACarregar))));
      return;
    }
    const db = info.db;
    const s = Shell.sessao();
    const gravado = (await db.get('site', 'site')) || Modelo.sitePadrao(s.pubkey, s.npub);
    // Rascunho igual ao do T7: mexer aqui não grava até o dono mandar. Uma só
    // decisão nesta tela (qual tema), logo um só botão "Salvar".
    let rascunho = clonar(gravado);
    let salvo = JSON.stringify(gravado);
    const pages = await db.getAll('pages');
    const posts = await db.getAll('posts');
    const midias = await db.getAll('media');

    const secaoEl = h('section', { id: 't12' }, h('h1', {}, T.titulo), h('p', { class: 'apoio' }, T.apoio));
    const pDesconhecido = h('p', { class: 'alerta', id: 't12-desconhecido', hidden: true });
    const grade = h('div', { class: 'grade-temas', id: 't12-grade' });
    const pCarregando = h('p', { class: 'apoio', id: 't12-carregando', role: 'status' }, T.carregando);
    const pAviso = h('p', { id: 't12-aviso', class: 'apoio', role: 'status' });
    const btnSalvar = h('button', { type: 'button', id: 't12-salvar', disabled: true, onclick: salvar }, T.salvar);
    const barraSalvar = h('div', { class: 'barra-salvar' }, btnSalvar, pAviso);
    secaoEl.appendChild(pDesconhecido);
    secaoEl.appendChild(pCarregando);
    secaoEl.appendChild(grade);
    secaoEl.appendChild(h('p', { class: 'apoio', id: 't12-ajustar' },
      h('button', { type: 'button', class: 'ligacao', id: 't12-ir-aparencia', onclick: function () { Shell.ir('t7', { secao: 'aparencia' }); } }, T.ajustar),
      h('span', { class: 'apoio' }, ' ' + T.ajustarApoio)));
    secaoEl.appendChild(barraSalvar);
    raiz.appendChild(secaoEl);

    function sujo() { return JSON.stringify(rascunho) !== salvo; }
    function marcarSujo() { btnSalvar.disabled = !sujo(); }

    async function salvar() {
      if (!sujo()) { pAviso.textContent = T.semAlteracoes; return; }
      btnSalvar.disabled = true; btnSalvar.textContent = T.salvando;
      try {
        await db.put('site', rascunho, 'site');
        await Shell.registrarAlteracao(1);
      } catch (e) {
        Shell.erro(e && e.message ? e.message : String(e));
        btnSalvar.textContent = T.salvar; btnSalvar.disabled = false; return;
      }
      salvo = JSON.stringify(rascunho);
      btnSalvar.textContent = T.salvar;
      Shell.atualizarSite(rascunho);
      // Trocar de tema regenera TODAS as páginas (13 §5.3) — não é o caso de
      // "muda só a folha de estilo", que é o das opções na aba Aparência: os
      // moldes mudam com o tema.
      pAviso.textContent = T.salvo;
      pAviso.className = 'apoio';
      marcarSujo();
      const c = await Rede.contagens(db);
      Shell.contadores({ publicar: c.pendentes });
      render();
    }

    // As prévias, uma por tema: o site do dono gerado por inteiro com aquele
    // tema. Guardadas aqui para o modal "Ver maior" não voltar a gerar.
    const previas = {};      // { idDoTema: html-de-prévia | null }

    async function gerarPrevias() {
      const dataUris = await Editor.dataUrisDe(midias);
      // O HTML da capa depende dos MOLDES do tema e de mais nada — as opções
      // só entram na folha de estilo, e o `previa()` abaixo aplica-as a cada
      // cartão. Logo dois temas com os mesmos moldes dão a mesma capa, e
      // gerar o site outra vez para o segundo é trabalho deitado fora.
      // ⚠️ Isto passou a contar em 2026-09-05, quando o app foi de 4 para 21
      // temas: 12 deles são temas "só de CSS" (TEMAS.md §2) e partilham
      // `Temas.moldes`. MEDIDO nesse dia, no Chrome da máquina de dev, com 50
      // artigos: 21 temas sem esta memória custavam 229 ms contra 40 ms dos
      // 4 antigos. O caso "a prévia de cada cartão…" de `telas/t12_temas` é
      // quem garante que a igualdade de moldes implica igualdade de HTML —
      // se isso deixar de ser verdade, ele falha antes desta memória mentir.
      const porMoldes = new Map();
      for (const t of Temas.todos()) {
        if (sinal.aborted) return;
        const id = t.manifesto.id;
        try {
          const chave = JSON.stringify(t.templates);
          let arq = porMoldes.get(chave);
          if (arq === undefined) {
            const d = { site: Object.assign({}, rascunho, { theme: { id: id, version: t.manifesto.version, options: {} } }),
              pages: pages, posts: posts, media: midias };
            const gerado = await Gerador.gerarSite(d);
            arq = gerado.arquivos.find(a => a.path === Modelo.caminhoDe('home')) || null;
            porMoldes.set(chave, arq);
          }
          // ⚠️ Cada cartão desenha-se com as opções que clicar nele DARIA:
          //  - o tema em uso, com as que o dono tem agora;
          //  - um tema já usado antes, com as que ficaram na gaveta — é o que
          //    a troca lhe devolve (`Temas.trocar`), e o cartão tem de o
          //    mostrar, ou promete um visual e entrega outro;
          //  - um tema nunca usado, como chega.
          // `gravado` e não `rascunho`: as prévias geram-se uma vez, no
          // arranque, e a referência é o estado SALVO.
          const memoria = Temas.memoriaDe(gravado);
          const opcoes = (id === Temas.idDe(gravado)) ? Gerador.opcoesDe(gravado) : (memoria[id] || {});
          previas[id] = arq ? Gerador.previa(arq.texto, dataUris, opcoes, t) : null;
        } catch (e) { previas[id] = null; }
      }
    }

    function cartaoDe(t, emUso) {
      const m = t.manifesto;
      const id = m.id;
      const html = previas[id];
      const moldura = h('div', { class: 'tema-previa' });
      moldura.style.setProperty('--previa-larg', LARGURA_PREVIA + 'px');
      if (html) {
        // Isolamento de 02 G.2 / 14 §0.8: sandbox SEM allow-same-origin, logo
        // o iframe não lê o painel nem o IndexedDB. `allow-scripts` porque a
        // galeria e o lightbox do tema são script; sem ele a prévia mentiria
        // ao mostrá-los mortos.
        // Sem `loading="lazy"`: medido em 2026-09-05, poupava 10 KB num delta
        // de 3,5 MB (quatro iframes, Chrome) — o `srcdoc` já está em memória
        // de qualquer maneira, e o atributo só adiava a pintura sem baixar o
        // custo.
        // ⚠️ Esses 3,5 MB vinham de `performance.memory`, que NÃO vê estes
        // iframes: sem `allow-same-origin`, cada prévia corre no seu próprio
        // processo. Medido outra vez em 2026-09-05 pela soma do RSS da árvore
        // de processos do Chrome, que é o número verdadeiro: **+121 MB com 4
        // prévias e +177 MB com 21** — cresce muito abaixo do linear (a
        // primeira prévia paga o processo, as outras quase só o conteúdo),
        // mas cresce. Se um dia forem 50 temas, esta tela precisa de carregar
        // as prévias à medida que se rola até elas. ⚠️ A prévia dos cartões de baixo aparece em branco numa
        // captura `fullPage`: é artefato da ferramenta, que fotografa fora do
        // viewport. Ao rolar até o cartão, ele pinta — verificado.
        const ifr = h('iframe', { class: 'tema-iframe', sandbox: 'allow-scripts',
          title: texto(T.previaTitulo, { nome: m.nome }), tabindex: '-1', 'aria-hidden': 'true' });
        ifr.srcdoc = html;
        moldura.appendChild(ifr);
        // A prévia é uma imagem, não um site navegável: a capa por cima come
        // o clique e leva ao "Ver maior", em vez de deixar navegar dentro de
        // uma miniatura de 320 px.
        moldura.appendChild(h('button', { type: 'button', class: 'tema-capa', 'data-tema': id,
          title: texto(T.previaTitulo, { nome: m.nome }), onclick: function () { verMaior(t); } },
          h('span', { class: 'sr' }, texto(T.previaTitulo, { nome: m.nome }))));
      } else {
        moldura.appendChild(h('p', { class: 'apoio tema-sem-previa' }, T.previaVazia));
      }
      const acoes = h('div', { class: 'acoes' },
        emUso ? h('span', { class: 'etiqueta-uso', id: 't12-em-uso' }, T.emUso)
              : h('button', { type: 'button', class: 'tema-usar', 'data-tema': id, onclick: function () { usar(t); } }, T.usar),
        html ? h('button', { type: 'button', class: 'ligacao tema-ver', 'data-tema': id, onclick: function () { verMaior(t); } }, T.verMaior) : null);
      return h('div', { class: 'cartao tema-cartao' + (emUso ? ' atual' : ''), 'data-tema': id },
        moldura,
        h('p', { class: 'destaque tema-nome' }, m.nome),
        h('p', { class: 'apoio tema-meta' }, texto(T.autor, { autor: m.autor || '' }) + ' · ' + texto(T.versao, { n: m.version })),
        acoes);
    }

    // O cartão do envio: presente, desligado, e com a razão por extenso.
    function cartaoEnviar() {
      return h('div', { class: 'cartao tema-cartao tema-enviar', id: 't12-enviar' },
        h('div', { class: 'tema-previa tema-previa-vazia' }, h('span', { class: 'tema-mais', 'aria-hidden': 'true' }, '+')),
        h('p', { class: 'destaque' }, T.enviarTitulo),
        h('p', { class: 'apoio' }, h('strong', {}, T.enviarEmBreve)),
        h('p', { class: 'apoio tema-porque' }, T.enviarPorque),
        h('p', { class: 'apoio' }, T.enviarSpec));
    }

    // A troca passa pelo `Temas.trocar`, que é quem sabe da gaveta: guarda os
    // ajustes do tema que sai e devolve os do que entra, se ele já cá esteve
    // (decisão dele, 2026-09-05 — antes perdiam-se só por espiar outro tema).
    function usar(t) {
      const r = Temas.trocar(rascunho, t);
      rascunho.theme = r.theme;
      rascunho.theme_memory = r.theme_memory;
      pAviso.textContent = texto(r.lembrou ? T.trocadoLembrado : T.trocado, { nome: t.manifesto.nome });
      pAviso.className = 'apoio';
      marcarSujo();
      render();
    }

    function verMaior(t) {
      const html = previas[t.manifesto.id];
      const titulo = texto(T.previaTitulo, { nome: t.manifesto.nome });
      if (!html) { Shell.modal({ titulo: titulo, conteudo: h('p', { class: 'apoio' }, T.previaVazia) }); return; }
      const ifr = h('iframe', { id: 'previa-completa', sandbox: 'allow-scripts', title: titulo });
      ifr.srcdoc = html;
      // `#previa-completa` é `flex:1` dentro do `.modal-corpo`, que é uma
      // coluna flex: o iframe vai direto, sem embrulho, ou perde a altura.
      Shell.modal({ titulo: titulo, conteudo: [h('p', { class: 'apoio' }, T.previaApoio), ifr], largo: true });
    }

    // A escala de cada prévia depende da largura REAL da moldura, que só se
    // sabe depois de a grade existir: numa grade de três colunas o cartão dá
    // 307 px e numa de uma só dá 460 px (medido em 2026-09-05), e um fator
    // fixo no CSS deixava faixa branca por baixo da prévia. Recalcula-se
    // também quando a janela muda de tamanho — é uma conta, não um layout.
    function ajustarEscalas() {
      const molduras = grade.querySelectorAll('.tema-previa');
      for (const m of molduras) {
        const larg = m.getBoundingClientRect().width;
        if (larg > 0) m.style.setProperty('--previa-escala', String(larg / LARGURA_PREVIA));
      }
    }

    function render() {
      Shell.limpar(grade);
      const atual = Temas.idDe(rascunho);
      for (const t of Temas.todos()) grade.appendChild(cartaoDe(t, t.manifesto.id === atual));
      grade.appendChild(cartaoEnviar());
      const desconhecido = !Temas.conhecido(rascunho);
      pDesconhecido.hidden = !desconhecido;
      if (desconhecido) pDesconhecido.textContent = texto(T.desconhecido, { id: atual });
      marcarSujo();
      ajustarEscalas();
    }

    // O `ctrl` desliga o ouvinte ao sair da tela — a mesma disciplina das
    // outras telas, para não ficar a medir cartões que já não existem.
    window.addEventListener('resize', ajustarEscalas, { signal: sinal });

    render();                       // desenha já os cartões, sem prévia
    await gerarPrevias();
    if (sinal.aborted) return;
    pCarregando.hidden = true;
    render();                       // e outra vez, agora com as prévias
  }

  Shell.registrar('t12', { montar: montar, desmontar: desmontar });
})();
