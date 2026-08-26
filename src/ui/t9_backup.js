/* ui/t9_backup.js — T9 Backup (14 T9; 13 §7): a única cópia durável dos
   rascunhos. Exportar: "O necessário" / "Completo", estimativa de tamanho,
   "Preparar" gera o JSON (tripwire de nsec) e vira um <a download> real —
   o mesmo mecanismo medido no Tails para a chave (07 §5); ao clicar,
   meta.last_export_at é gravado e o contador zera (14 T-13). Importar:
   <input type="file"> → resumo ANTES de mexer em qualquer coisa → "Juntar"
   (por id, updated_at mais recente vence) ou "Substituir tudo" (duas
   etapas); versão maior e outra chave recusadas com texto claro. */
(function () {
  'use strict';
  let urlBlob = null;

  function texto(m, mapa) { let s = m; for (const k of Object.keys(mapa || {})) s = s.split('{' + k + '}').join(String(mapa[k])); return s; }
  function formatarBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
    return (n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0).replace('.', ',') + ' MB';
  }
  function soltarBlob() { if (urlBlob) { try { URL.revokeObjectURL(urlBlob); } catch (e) {} urlBlob = null; } }
  function desmontar() { soltarBlob(); }

  async function montar(raiz) {
    const h = Shell.h, T = Textos.t9, s = Shell.sessao();
    const dados = Shell.dados();
    if (!dados || !dados.db || !dados.db.estaAberto()) {
      raiz.appendChild(h('section', { id: 't9' }, h('h1', {}, T.titulo), h('p', { class: 'alerta' }, Textos.t3.aindaCarregando),
        h('div', { class: 'acoes' }, h('button', { type: 'button', onclick: function () { Shell.ir('t2'); } }, Textos.t3.voltarACarregar))));
      return;
    }
    const db = dados.db;

    // --- exportar ---------------------------------------------------------------
    const X = T.exportar;
    const rNecessario = h('input', { type: 'radio', name: 'exp', id: 'exp-necessario', value: 'necessario', checked: true });
    const rCompleto = h('input', { type: 'radio', name: 'exp', id: 'exp-completo', value: 'completo' });
    const pEstimativa = h('p', { id: 'exp-estimativa', class: 'apoio' });
    const pGrande = h('p', { id: 'exp-grande', class: 'alerta', hidden: true }, X.grande);
    const btnPreparar = h('button', { type: 'button', id: 'exp-preparar', onclick: preparar }, X.preparar);
    const linkBaixar = h('a', { id: 'exp-baixar', class: 'botao-link', hidden: true, onclick: baixou });
    const pPronto = h('p', { id: 'exp-pronto', class: 'apoio', hidden: true });
    const pErroExp = h('p', { id: 'exp-erro', class: 'erro', role: 'alert', hidden: true });
    const pBaixado = h('p', { id: 'exp-baixado', class: 'apoio', hidden: true }, X.baixado);

    async function estimar() {
      try {
        const est = await Backup.estimar(db, rCompleto.checked);
        pEstimativa.textContent = texto(X.estimativa, { x: formatarBytes(est.bytes) });
        pGrande.hidden = est.bytes < 30 * 1024 * 1024;
      } catch (e) { pEstimativa.textContent = ''; }
    }
    function limparPreparado() { soltarBlob(); linkBaixar.hidden = true; linkBaixar.removeAttribute('href'); linkBaixar.removeAttribute('download'); linkBaixar.textContent = ''; pPronto.hidden = true; pBaixado.hidden = true; }
    rNecessario.addEventListener('change', function () { limparPreparado(); estimar(); });
    rCompleto.addEventListener('change', function () { limparPreparado(); estimar(); });

    async function preparar() {
      limparPreparado();
      pErroExp.hidden = true; pErroExp.textContent = '';
      btnPreparar.disabled = true; btnPreparar.textContent = X.preparando;
      try {
        const r = await Backup.exportar(db, { completo: rCompleto.checked, pubkey: s.pubkey, npub: s.npub });
        urlBlob = URL.createObjectURL(r.blob);
        linkBaixar.setAttribute('href', urlBlob);
        linkBaixar.setAttribute('download', r.nome);
        linkBaixar.textContent = texto(X.baixar, { nome: r.nome });
        linkBaixar.hidden = false;
        pPronto.textContent = texto(X.pronto, { x: formatarBytes(r.bytes) });
        pPronto.hidden = false;
      } catch (e) {
        pErroExp.textContent = e && e.codigo === 'tripwire' ? X.tripwire : texto(X.erro, { e: e && e.message ? e.message : String(e) });
        pErroExp.hidden = false;
      } finally { btnPreparar.disabled = false; btnPreparar.textContent = X.preparar; }
    }
    // 14 T-13: o app não sabe se o arquivo chegou ao disco; o contador zera ao disparar o download
    async function baixou() {
      try {
        await db.setMeta('last_export_at', Modelo.agora());
        await db.setMeta('alteracoes_nao_exportadas', 0);
        await Shell.atualizarBarra();
        pBaixado.hidden = false;
      } catch (e) { Shell.erro(e && e.message ? e.message : String(e)); }
    }

    const cartaoExportar = h('div', { class: 'cartao', id: 'cartao-exportar' }, h('h2', {}, X.titulo),
      h('label', { class: 'inline', for: 'exp-necessario' }, rNecessario, X.necessario, ' ', h('span', { class: 'apoio' }, '— ' + X.necessarioApoio)),
      h('label', { class: 'inline', for: 'exp-completo' }, rCompleto, X.completo, ' ', h('span', { class: 'apoio' }, '— ' + X.completoApoio)),
      pEstimativa, pGrande,
      h('div', { class: 'acoes' }, btnPreparar, linkBaixar),
      pPronto, pErroExp, pBaixado,
      h('p', { class: 'apoio' }, X.tails), h('p', { class: 'apoio' }, X.falhou));

    // --- importar ---------------------------------------------------------------
    const I = T.importar;
    const inputArquivo = h('input', { type: 'file', id: 'imp-arquivo', accept: '.json,application/json' });
    const pLendo = h('p', { id: 'imp-lendo', class: 'apoio', hidden: true }, I.lendo);
    const resumo = h('div', { id: 'imp-resumo', class: 'resumo-import', hidden: true });
    const pErroImp = h('p', { id: 'imp-erro', class: 'erro', role: 'alert', hidden: true });
    const resultado = h('div', { id: 'imp-resultado', hidden: true });
    let analise = null, forcarOutraChave = false;

    function mostrarErro(msg, extra) { Shell.limpar(pErroImp); pErroImp.appendChild(document.createTextNode(msg)); if (extra) pErroImp.appendChild(extra); pErroImp.hidden = false; }

    async function renderResumo() {
      Shell.limpar(resumo);
      const a = analise;
      resumo.appendChild(h('p', {}, texto(I.resumo, { d: Modelo.formatarData(a.exported_at) || '?', v: a.version, app: a.app_version || '?' })));
      resumo.appendChild(h('p', { id: 'imp-chave', class: a.mesmaChave ? 'ok' : 'alerta' }, a.mesmaChave ? I.chaveMesma : texto(I.chaveOutra, { npub: a.npub ? Chave.abreviar(a.npub) : '?' })));
      resumo.appendChild(h('p', { id: 'imp-contem' }, texto(I.contem, { p: a.contagens.pages, a: a.contagens.posts, m: a.contagens.media, b: a.contagens.comArquivo })));
      if (!a.mesmaChave && !forcarOutraChave) {
        resumo.appendChild(h('p', { class: 'erro', id: 'imp-outra-chave' }, I.outraChave));
        resumo.appendChild(h('div', { class: 'acoes' }, h('button', { type: 'button', id: 'imp-forcar', class: 'secundario', onclick: function () { forcarOutraChave = true; renderResumo(); } }, I.outraChaveBotao)));
        resumo.hidden = false;
        return;
      }
      if (!a.mesmaChave) resumo.appendChild(h('p', { class: 'alerta', id: 'imp-outra-chave-aviso' }, I.outraChaveAviso));
      const plano = await Backup.planejar(db, a.dados);
      resumo.appendChild(h('p', { id: 'imp-plano' }, texto(I.plano, { n: plano.novos.length, u: plano.atualizados.length, i: plano.iguais.length, l: plano.locais.length })));
      const acoes = h('div', { class: 'acoes' });
      const btnJuntar = h('button', { type: 'button', id: 'imp-juntar', onclick: function () { importar('juntar'); } }, I.juntar);
      const btnSubstituir = h('button', { type: 'button', id: 'imp-substituir', class: 'secundario', onclick: function () {
        Shell.limpar(acoes);
        acoes.appendChild(h('div', { class: 'confirmacao', id: 'imp-confirmacao' }, h('p', { class: 'alerta' }, I.substituirConfirma),
          h('button', { type: 'button', id: 'imp-substituir-sim', onclick: function () { importar('substituir'); } }, I.substituirSim),
          h('button', { type: 'button', id: 'imp-substituir-nao', class: 'secundario', onclick: renderResumo }, I.cancelar)));
      } }, I.substituir);
      acoes.appendChild(btnJuntar); acoes.appendChild(btnSubstituir);
      resumo.appendChild(acoes);
      resumo.hidden = false;
    }

    async function importar(modo) {
      const a = analise; if (!a) return;
      resumo.hidden = true; pErroImp.hidden = true;
      try {
        const r = await Backup.importar(db, a, { modo: modo, pubkey: s.pubkey, npub: s.npub });
        Shell.limpar(resultado);
        resultado.appendChild(h('p', { class: 'ok', id: 'imp-feito' }, modo === 'substituir' ? texto(I.feitoSubstituir, { n: r.novos }) : texto(I.feito, { n: r.novos, u: r.atualizados, i: r.iguais, l: r.locais })));
        if (r.sobrescritos.length) resultado.appendChild(h('p', { class: 'apoio', id: 'imp-sobrescritos' }, texto(I.sobrescritos, { lista: r.sobrescritos.join(', ') })));
        if (r.renomeados.length) resultado.appendChild(h('p', { class: 'apoio', id: 'imp-renomeados' }, texto(I.renomeados, { lista: r.renomeados.join(', ') })));
        resultado.hidden = false;
        Shell.atualizarSite(r.site);
        await Shell.atualizarBarra();
        await estimar();
      } catch (e) { mostrarErro(texto(I.erro, { e: e && e.message ? e.message : String(e) })); }
      analise = null; forcarOutraChave = false; inputArquivo.value = '';
    }

    inputArquivo.addEventListener('change', function () {
      const f = inputArquivo.files && inputArquivo.files[0];
      if (!f) return;
      resumo.hidden = true; resultado.hidden = true; pErroImp.hidden = true; analise = null; forcarOutraChave = false;
      pLendo.hidden = false;
      f.text().then(function (txt) {
        pLendo.hidden = true;
        inputArquivo.value = '';
        const a = Backup.analisar(txt, s);
        if (!a.ok) {
          if (a.codigo === 'versao_maior') mostrarErro(a.motivo + ' ', h('button', { type: 'button', class: 'ligacao', id: 'imp-nova-versao', onclick: function () { Shell.ir('t10'); } }, I.novaVersao));
          else mostrarErro(a.motivo);
          return;
        }
        analise = a;
        renderResumo().catch(function (e) { mostrarErro(texto(I.erro, { e: e.message })); });
      }).catch(function () { pLendo.hidden = true; inputArquivo.value = ''; mostrarErro(I.erroLeitura); });
    });

    const cartaoImportar = h('div', { class: 'cartao', id: 'cartao-importar' }, h('h2', {}, I.titulo),
      h('label', { for: 'imp-arquivo' }, I.rotulo), inputArquivo, pLendo, pErroImp, resumo, resultado);

    raiz.appendChild(h('section', { id: 't9' }, h('h1', {}, T.titulo), h('p', { class: 'alerta' }, T.porque),
      h('div', { class: 'cartoes' }, cartaoExportar, cartaoImportar)));
    await estimar();
    Shell.atualizarBarra();
  }

  Shell.registrar('t9', { montar: montar, desmontar: desmontar });
})();
