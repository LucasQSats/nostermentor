/* core/qr.js — o QR Code de um endereço do site.

   Existe por um motivo de produto e não de tecnologia: o endereço de um
   nsite é `https://<npub>.<gateway>/`, e a npub tem 63 caracteres que
   ninguém digita nem dita ao telefone. O QR é a única forma prática de
   passar esse endereço para outra pessoa — num cartão, num panfleto, na
   tela do celular de quem está ao lado.

   ⚠️ O QR nasce DENTRO do app, sempre. Chamar um serviço de QR na
   internet entregaria o endereço do site (e o IP de quem gera) a um
   terceiro; a CSP do painel (`img-src 'self' data: blob:`) já barra isso
   na raiz, e este módulo existe para que não haja tentação.

   Codificação: `qrcode-generator` 1.4.4 (VERSOES.md), global `qrcode`.
   `qrcode(0, …)` escolhe sozinho a menor versão que couber. */
const Qr = (function () {
  'use strict';

  // Nível de correção de erro. M ("médio", ~15%) é o padrão de facto:
  // com L o código não sobrevive a uma dobra do papel; com Q ou H a mesma
  // URL de 82 caracteres passa de 37 para 45 e 49 módulos, o que deixa
  // cada módulo MENOR no mesmo espaço impresso — pior de ler, não melhor.
  const ECC = 'M';
  // Zona de silêncio exigida pela norma: 4 módulos de cada lado. Sem ela
  // muitos leitores simplesmente não encontram o código.
  const MARGEM = 4;

  function matriz(texto) {
    const s = String(texto == null ? '' : texto);
    if (!s) throw new Error('QR sem texto');
    const q = qrcode(0, ECC);
    q.addData(s);
    q.make();
    const n = q.getModuleCount();
    return { n: n, lado: n + MARGEM * 2, escuro: function (l, c) { return q.isDark(l, c); } };
  }

  // O desenho como UM caminho SVG só (um `rect` por módulo daria mais de
  // mil elementos). Devolve o `d` e o lado total em módulos.
  function caminho(m) {
    const partes = [];
    for (let l = 0; l < m.n; l++) {
      for (let c = 0; c < m.n; c++) {
        if (!m.escuro(l, c)) continue;
        let largura = 1;
        while (c + largura < m.n && m.escuro(l, c + largura)) largura++;
        partes.push('M' + (c + MARGEM) + ' ' + (l + MARGEM) + 'h' + largura + 'v1h-' + largura + 'z');
        c += largura - 1;
      }
    }
    return partes.join('');
  }

  // Texto SVG puro — sem DOM, para poder ser medido em teste.
  function svgTexto(texto) {
    const m = matriz(texto);
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + m.lado + ' ' + m.lado + '" shape-rendering="crispEdges">'
      + '<rect width="' + m.lado + '" height="' + m.lado + '" fill="#fff"/>'
      + '<path d="' + caminho(m) + '" fill="#000"/>'
      + '</svg>';
  }

  // O mesmo desenho como elemento, montado nó a nó (o painel nunca usa
  // innerHTML). `o.rotulo` vira o texto alternativo: quem usa leitor de
  // tela ouve o endereço, não "imagem".
  function elemento(texto, o) {
    const NS = 'http://www.w3.org/2000/svg';
    const m = matriz(texto);
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + m.lado + ' ' + m.lado);
    svg.setAttribute('shape-rendering', 'crispEdges');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', (o && o.rotulo) || String(texto));
    if (o && o.classe) svg.setAttribute('class', o.classe);
    const fundo = document.createElementNS(NS, 'rect');
    fundo.setAttribute('width', String(m.lado));
    fundo.setAttribute('height', String(m.lado));
    fundo.setAttribute('fill', '#fff');
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', caminho(m));
    p.setAttribute('fill', '#000');
    svg.appendChild(fundo);
    svg.appendChild(p);
    return svg;
  }

  // PNG para guardar e levar para onde for preciso (o painel entrega por
  // <a download>, como o backup e o arquivo da chave). Sem texto por cima:
  // o dono põe o código onde quiser, e legenda ele mesmo.
  // ⚠️ `toBlob` pode não existir e pode falhar calado — quem chama trata
  // `null`, nunca supõe sucesso (mesma regra de `ui/miniaturas.js`).
  function png(texto, o) {
    return new Promise(function (resolve) {
      let m;
      try { m = matriz(texto); } catch (e) { return resolve(null); }
      // Pelo menos 600 px de lado: abaixo disso o código impresso a 4 cm
      // já sai serrilhado. Escala inteira, para não borrar as bordas.
      const alvo = (o && o.alvo) || 600;
      const escala = Math.max(4, Math.ceil(alvo / m.lado));
      const c = document.createElement('canvas');
      c.width = c.height = m.lado * escala;
      const ctx = c.getContext('2d');
      if (!ctx || !c.toBlob) return resolve(null);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = '#000';
      for (let l = 0; l < m.n; l++) {
        for (let col = 0; col < m.n; col++) {
          if (m.escuro(l, col)) ctx.fillRect((col + MARGEM) * escala, (l + MARGEM) * escala, escala, escala);
        }
      }
      let feito = false;
      const t = setTimeout(function () { if (!feito) { feito = true; resolve(null); } }, 5000);
      try {
        c.toBlob(function (b) { if (feito) return; feito = true; clearTimeout(t); resolve(b || null); }, 'image/png');
      } catch (e) { feito = true; clearTimeout(t); resolve(null); }
    });
  }

  return Object.freeze({ ECC, MARGEM, matriz, svgTexto, elemento, png });
})();
