// test/core/html_colado.test.js — 51: o botão "HTML" da barra do editor.
// O que esta suíte existe para provar, por ordem de gravidade:
//  1. SEGURANÇA — `limparHtmlColado` usa o MESMO `PURIFY` da geração; nada do
//     que o filtro barra pode atravessá-la. É a única razão pela qual este
//     botão não abre exceção nenhuma;
//  2. HONESTIDADE DO AVISO — o que o filtro tira TEM de aparecer na lista.
//     Medido em 2026-09-04: `DOMPurify.removed` (3.4.14) NÃO reporta o
//     `<script>` quando o HTML começa por ele nem quando há vários; daí o
//     inventário antes/depois. Um aviso que cala é pior do que não haver;
//  3. O FORMATO — as três maneiras de o Markdown partir HTML colado
//     (indentação, linha em branco no meio, e o remendo que daí sai);
//  4. IDEMPOTÊNCIA — o que se insere no corpo atravessa `renderizarCorpo` sem
//     mudar mais nada, senão o determinismo de 13 §5.2 caía.
const { abrir, coletor, assert } = require('../util.js');

module.exports = async function (ctx, u) {
  const { R, it } = coletor();
  const p = await abrir(ctx, u.url);
  const r = await p.pg.evaluate(async () => {
    const out = {};
    const L = (x) => Gerador.limparHtmlColado(x);
    const nomes = (res) => res.removidos.map(x => (x.tipo === 'atributo' ? x.nome + '=' : '<' + x.nome + '>')).join(' ');
    const grupos = (res) => res.removidos.map(x => Gerador.grupoRemovido(x)).join(',');

    // --- 1/2. o filtro e o aviso -------------------------------------------
    out.scriptPrimeiro = L('<scr' + 'ipt>a</scr' + 'ipt><div>ok</div>');
    out.scriptSozinho = L('<scr' + 'ipt>a</scr' + 'ipt>');
    out.tresScripts = L('<scr' + 'ipt>1</scr' + 'ipt><scr' + 'ipt>2</scr' + 'ipt><scr' + 'ipt>3</scr' + 'ipt>');
    out.onclick = L('<button onclick="alert(1)">b</button>');
    out.javascriptHref = L('<a href="javascript:alert(1)">l</a>');
    out.iframe = L('<iframe src="https://fora.test/"></iframe><p>fica</p>');
    out.styleTag = L('<style>.a{color:red}</style>\n<div class="a">x</div>');
    out.linkCss = L('<link rel="stylesheet" href="https://fora.test/a.css">');
    out.limpo = L('<div class="caixa">\n  <p>Olá</p>\n</div>');
    out.tabela = L('<table><tr><td>a</td></tr></table>');
    out.nomes = {
      scriptPrimeiro: nomes(out.scriptPrimeiro), scriptSozinho: nomes(out.scriptSozinho),
      tresScripts: nomes(out.tresScripts), onclick: nomes(out.onclick), javascriptHref: nomes(out.javascriptHref),
      iframe: nomes(out.iframe), styleTag: nomes(out.styleTag), linkCss: nomes(out.linkCss),
      limpo: nomes(out.limpo), tabela: nomes(out.tabela)
    };
    out.grupos = {
      scriptSozinho: grupos(out.scriptSozinho), onclick: grupos(out.onclick),
      javascriptHref: grupos(out.javascriptHref), iframe: grupos(out.iframe), styleTag: grupos(out.styleTag)
    };

    // --- 3. o formato -------------------------------------------------------
    out.indentado = L('    <div class="caixa">\n        <p>Olá</p>\n    </div>');
    out.linhaEmBranco = L('<div class="colunas">\n  <div>A</div>\n\n  <div>B</div>\n</div>');
    out.preComBranco = L('<pre>um\n\ndois</pre>');
    out.preEmDiv = L('<div>\n<pre>um\n\ndois</pre>\n</div>');
    out.soEspacos = L('   \n\n  \n');
    // o que o Markdown faz com o MESMO html sem a limpeza (o defeito de hoje)
    out.cruIndentado = Gerador.renderizarCorpo('    <div class="caixa">\n        <p>Olá</p>\n    </div>', null);
    out.cruPreEmDiv = Gerador.renderizarCorpo('<div>\n<pre>um\n\ndois</pre>\n</div>', null);

    // --- 4. idempotência e determinismo ------------------------------------
    const casos = ['<div class="caixa"><p>Olá</p></div>', '<table><tr><td>a</td></tr></table>',
      '<video src="/media/v.mp4" controls></video>', '<details open><summary>s</summary>x</details>',
      '<div style="color:red">a &amp; b</div>'];
    out.estaveis = casos.map(function (c) {
      const um = L(c).html, dois = L(um).html;
      return { um: um, dois: dois, render: Gerador.renderizarCorpo(um, null) };
    });
    // o corpo com o HTML já limpo, inserido como o editor insere, chega
    // intacto ao arquivo publicado
    const site = Modelo.sitePadrao('a'.repeat(64), 'npub1teste');
    site.title = 'S'; site.home = { mode: 'blog', page_id: null, latest_posts: 0 };
    const pag = Modelo.novaPagina('Sobre'); pag.id = 'p-1'; pag.status = 'published';
    pag.body = 'Antes.\n\n' + L('  <div class="destaque">\n    <p>Caixa</p>\n\n  </div>').html + '\n\nDepois.';
    const g = await Gerador.gerarSite({ site: site, pages: [pag], posts: [], media: [] });
    out.publicado = (g.arquivos.find(a => a.path === '/sobre.html') || {}).texto || '';
    return out;
  });

  await it('SEGURANÇA: o <script> não atravessa em posição nenhuma, e o filtro é o mesmo da geração', () => {
    assert(!/<script/i.test(r.scriptPrimeiro.html) && r.scriptPrimeiro.html === '<div>ok</div>', JSON.stringify(r.scriptPrimeiro.html));
    assert(r.scriptSozinho.vazio && r.scriptSozinho.html === '', JSON.stringify(r.scriptSozinho));
    assert(r.tresScripts.vazio, JSON.stringify(r.tresScripts));
    assert(r.onclick.html === '<button>b</button>', r.onclick.html);
    assert(r.javascriptHref.html === '<a>l</a>', r.javascriptHref.html);
    assert(r.iframe.html === '<p>fica</p>', r.iframe.html);
    assert(r.styleTag.html === '<div class="a">x</div>', r.styleTag.html);
    assert(r.linkCss.vazio, JSON.stringify(r.linkCss));
  });
  await it('HONESTIDADE: tudo o que o filtro tirou aparece na lista — inclusive o <script> que DOMPurify.removed cala', () => {
    assert(r.nomes.scriptPrimeiro === '<script>', r.nomes.scriptPrimeiro);
    assert(r.nomes.scriptSozinho === '<script>', r.nomes.scriptSozinho);
    assert(r.nomes.tresScripts === '<script>', 'três iguais deviam dar um item só: ' + r.nomes.tresScripts);
    assert(r.nomes.onclick === 'onclick=', r.nomes.onclick);
    assert(r.nomes.javascriptHref === 'href=', 'o href esvaziado tem de ser dito: ' + r.nomes.javascriptHref);
    assert(r.nomes.iframe === '<iframe>', r.nomes.iframe);
    assert(r.nomes.styleTag === '<style>', r.nomes.styleTag);
    // o <link> saiu inteiro: dizer "tirei o rel e o href" seria ruído
    assert(r.nomes.linkCss === '<link>', r.nomes.linkCss);
  });
  await it('sem falso positivo: HTML limpo e a <table> a que o sanitizador ACRESCENTA <tbody> não acusam remoção', () => {
    assert(r.nomes.limpo === '' && r.limpo.removidos.length === 0, JSON.stringify(r.limpo));
    assert(r.nomes.tabela === '' && /<tbody>/.test(r.tabela.html), JSON.stringify(r.tabela));
  });
  await it('cada remoção cai no grupo de explicação certo (é o que a tela mostra ao dono)', () => {
    assert(r.grupos.scriptSozinho === 'programa', r.grupos.scriptSozinho);
    assert(r.grupos.onclick === 'programa', r.grupos.onclick);
    assert(r.grupos.javascriptHref === 'endereco', r.grupos.javascriptHref);
    assert(r.grupos.iframe === 'defora', r.grupos.iframe);
    assert(r.grupos.styleTag === 'defora', r.grupos.styleTag);
  });
  await it('FORMATO: a indentação sai (senão o HTML vira bloco de código à vista do leitor)', () => {
    assert(r.indentado.html === '<div class="caixa">\n    <p>Olá</p>\n</div>', JSON.stringify(r.indentado.html));
    assert(/<pre><code>/.test(r.cruIndentado), 'sem a limpeza tinha de sair código — o defeito que isto corrige: ' + r.cruIndentado);
  });
  await it('FORMATO: a linha em branco do meio sai (é ela que termina o bloco HTML no Markdown)', () => {
    assert(r.linhaEmBranco.html.indexOf('\n\n') === -1 && /<div>A<\/div>\n\s*<div>B<\/div>/.test(r.linhaEmBranco.html), JSON.stringify(r.linhaEmBranco.html));
    assert(/<pre>um<p>dois<\/p><\/pre>/.test(r.cruPreEmDiv), 'sem a limpeza o <pre> dentro do <div> sai partido — o defeito que isto corrige: ' + r.cruPreEmDiv);
    assert(r.preEmDiv.html === '<div>\n<pre>um\ndois</pre>\n</div>', JSON.stringify(r.preEmDiv.html));
  });
  await it('a linha em branco perdida DENTRO de <pre> é conteúdo, e o dono é avisado', () => {
    assert(r.preComBranco.perdeuEmPre === true, JSON.stringify(r.preComBranco));
    assert(r.preEmDiv.perdeuEmPre === true, JSON.stringify(r.preEmDiv));
    assert(r.linhaEmBranco.perdeuEmPre === false, 'linha em branco fora de <pre> não devia avisar');
  });
  await it('só espaços em branco: nada a inserir, e sem estourar', () => assert(r.soEspacos.vazio && r.soEspacos.html === '' && r.soEspacos.removidos.length === 0, JSON.stringify(r.soEspacos)));
  await it('IDEMPOTENTE (13 §5.2): limpar de novo não muda, e o que sai é o que vai ao arquivo publicado', () => {
    // `render === um` seria falso e não é o que importa: o `marked` envolve num
    // <p> o que for elemento INLINE (medido: <video>), e deixa cru o que for de
    // bloco. O que tem de valer é o limpo ATRAVESSAR a geração intacto.
    for (const e of r.estaveis) assert(e.um === e.dois && e.render.indexOf(e.um) !== -1, JSON.stringify(e));
    assert(/<div class="destaque">\n\s*<p>Caixa<\/p>\n<\/div>/.test(r.publicado), 'o bloco não chegou inteiro ao /sobre.html: ' + r.publicado.slice(r.publicado.indexOf('Antes'), r.publicado.indexOf('Antes') + 300));
    assert(/<p>Antes\.<\/p>/.test(r.publicado) && /<p>Depois\.<\/p>/.test(r.publicado), 'os parágrafos à volta partiram-se: ' + r.publicado);
    assert(!/<script/i.test(r.publicado), 'script no site publicado');
  });
  await it('sem erros de página/console', () => assert(p.erros.length === 0 && p.consoleErros.length === 0, JSON.stringify({ pageerror: p.erros, console: p.consoleErros })));
  await p.pg.close();
  return R;
};
