/* test/core/qr.test.js — o gerador de QR (core/qr.js).

   O que se mede aqui é o que um leitor de QR exigiria: que o desenho seja
   EXATAMENTE a matriz do código (nem um módulo a mais nem a menos), que a
   zona de silêncio da norma exista, que textos diferentes deem códigos
   diferentes, e que o código nasça dentro do app — nenhuma rede.

   ⚠️ O caso que mais importa é o do endereço REAL de um nsite: 82
   caracteres com uma npub de 63. Um gerador provado só com "abc" pode
   estourar justamente no único texto que o produto usa. */
const { abrir, coletor, assert } = require('../util.js');

module.exports = async function (ctx, u) {
  const { R, it } = coletor();
  const p = await abrir(ctx, u.url);
  const URL_NSITE = 'https://' + u.NPUB_BOSTIL + '.nsite.lol/';
  // Tudo o que o app pedir a http/https/ws enquanto gera QR. Tem de ficar
  // vazio: um QR buscado fora entregaria o endereço do site a um terceiro.
  const pedidos = [];
  p.pg.on('request', (r) => { if (/^(https?|wss?):/.test(r.url())) pedidos.push(r.url().slice(0, 120)); });

  await it('a matriz é a do código: o SVG desenha exatamente os módulos escuros, e nada na zona de silêncio', async () => {
    const r = await p.pg.evaluate(function (url) {
      const m = Qr.matriz(url);
      const svg = Qr.svgTexto(url);
      const d = svg.match(/ d="([^"]*)"/)[1];
      const g = [];
      for (let i = 0; i < m.lado; i++) g.push(new Array(m.lado).fill(false));
      for (const seg of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
        const x = +seg[1], y = +seg[2], w = +seg[3];
        for (let i = 0; i < w; i++) g[y][x + i] = true;
      }
      let dif = 0, escuros = 0, naMargem = 0;
      for (let l = 0; l < m.n; l++) for (let c = 0; c < m.n; c++) {
        const e = m.escuro(l, c); if (e) escuros++;
        if (e !== g[l + Qr.MARGEM][c + Qr.MARGEM]) dif++;
      }
      for (let l = 0; l < m.lado; l++) for (let c = 0; c < m.lado; c++) {
        const borda = l < Qr.MARGEM || l >= m.lado - Qr.MARGEM || c < Qr.MARGEM || c >= m.lado - Qr.MARGEM;
        if (borda && g[l][c]) naMargem++;
      }
      return { n: m.n, lado: m.lado, margem: Qr.MARGEM, ecc: Qr.ECC, dif: dif, escuros: escuros, naMargem: naMargem };
    }, URL_NSITE);
    assert(r.margem === 4, 'a norma pede 4 módulos de zona de silêncio, e o módulo diz ' + r.margem);
    assert(r.lado === r.n + 8, r.lado + ' != ' + r.n + ' + 8');
    assert(r.escuros > 0, 'matriz vazia');
    assert(r.dif === 0, r.dif + ' módulos do desenho não batem com o código');
    assert(r.naMargem === 0, r.naMargem + ' módulos pintados dentro da zona de silêncio');
    return 'endereço de ' + URL_NSITE.length + ' caracteres → ' + r.n + '×' + r.n + ' módulos (ECC ' + r.ecc + '), ' + r.escuros + ' escuros, desenho idêntico ao código';
  });

  await it('o endereço real de um nsite cabe com folga, textos diferentes dão códigos diferentes e texto vazio é recusado', async () => {
    const r = await p.pg.evaluate(function (url) {
      const versao = (n) => (n - 17) / 4;
      const a = Qr.svgTexto(url);
      const b = Qr.svgTexto(url.replace('nsite.lol', 'nsite.cloud'));
      const c = Qr.svgTexto(url.replace('nsite.lol', 'nsite.run'));
      // O maior endereço que o produto pode gerar hoje: gateway + o caminho
      // de um artigo com slug no limite. Se ISTO couber, tudo cabe.
      const longo = url + 'blog/' + 'a'.repeat(120);
      let erroLongo = null, nLongo = 0;
      try { nLongo = Qr.matriz(longo).n; } catch (e) { erroLongo = String(e.message); }
      let erroVazio = null;
      try { Qr.matriz(''); } catch (e) { erroVazio = String(e.message); }
      return {
        versao: versao(Qr.matriz(url).n),
        distintos: new Set([a, b, c]).size,
        versaoLonga: nLongo ? versao(nLongo) : 0, erroLongo: erroLongo, erroVazio: erroVazio
      };
    }, URL_NSITE);
    assert(r.versao >= 1 && r.versao <= 10, 'versão inesperada para o endereço padrão: ' + r.versao);
    assert(r.distintos === 3, 'os três gateways deram ' + r.distintos + ' código(s) — tinham de dar 3');
    assert(r.erroLongo === null && r.versaoLonga <= 40, 'o endereço longo não coube: ' + (r.erroLongo || r.versaoLonga));
    assert(r.erroVazio !== null, 'texto vazio tinha de recusar, e passou');
    return 'endereço padrão em versão ' + r.versao + '; o mais longo que o app gera em versão ' + r.versaoLonga + '; três gateways, três códigos';
  });

  await it('o PNG sai pronto para imprimir (fundo branco, escala inteira, pelo menos 600 px) e nada foi buscado na rede', async () => {
    const r = await p.pg.evaluate(async function (url) {
      const b = await Qr.png(url);
      if (!b) return { blob: false };
      // Reabre o PNG e confere o canto: tem de ser branco (zona de silêncio).
      const bit = await createImageBitmap(b);
      const c = document.createElement('canvas');
      c.width = bit.width; c.height = bit.height;
      const ctx2 = c.getContext('2d');
      ctx2.drawImage(bit, 0, 0);
      const canto = ctx2.getImageData(2, 2, 1, 1).data;
      return { blob: true, tipo: b.type, bytes: b.size, larg: bit.width, alt: bit.height, canto: [canto[0], canto[1], canto[2]], lado: Qr.matriz(url).lado };
    }, URL_NSITE);
    assert(r.blob, 'não veio blob nenhum de Qr.png');
    assert(r.tipo === 'image/png', r.tipo);
    assert(r.larg === r.alt && r.larg >= 600, 'imagem ' + r.larg + '×' + r.alt);
    assert(r.larg % r.lado === 0, 'a escala não é inteira (' + r.larg + ' / ' + r.lado + ') — a borda sai borrada');
    assert(r.canto[0] === 255 && r.canto[1] === 255 && r.canto[2] === 255, 'o canto não é branco: ' + r.canto.join(','));
    assert(pedidos.length === 0, 'o QR pediu alguma coisa à rede: ' + JSON.stringify(pedidos));
    assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros }));
    return 'PNG ' + r.larg + '×' + r.alt + ' (' + r.bytes + ' B), escala inteira, canto branco, zero pedidos de rede';
  });

  await p.pg.close();
  return R;
};
