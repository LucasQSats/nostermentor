/* tema/defi/tema.js — DEFI: a aparência das aplicações de finanças
   descentralizadas (12; TEMAS.md). Fundo índigo profundo, degradê de duas
   cores que o dono escolhe, cartões muito arredondados com um halo suave e o
   nome do site pintado com o próprio degradê.

   Tema só de CSS: os oito moldes base (`Temas.moldes`). O degradê no texto
   vai dentro de um `@supports`, com cor sólida como base — se o motor não o
   souber fazer, o nome do site continua legível em vez de desaparecer.
   Nenhum recurso externo (02 G.2.4); letras do sistema. */
const TemaDefi = (function () {
  'use strict';

  const options = Object.freeze({
    esquema: Object.freeze({ tipo: 'escolha', rotulo: 'Fundo', padrao: 'indigo',
      opcoes: Object.freeze([['grafite', 'Grafite'], ['ametista', 'Ametista'], ['indigo', 'Índigo']]) }),
    cor_inicio: Object.freeze({ tipo: 'cor', rotulo: 'Cor do degradê (início)', padrao: '#8b5cf6' }),
    cor_fim: Object.freeze({ tipo: 'cor', rotulo: 'Cor do degradê (fim)', padrao: '#22d3ee',
      apoio: 'As duas cores pintam o nome do site, os botões e o traço dos cartões. Se ficarem perto demais do fundo, o site clareia só o texto.' }),
    cantos: Object.freeze({ tipo: 'medida', rotulo: 'Arredondamento', padrao: 18, min: 0, max: 30, passo: 2, unidade: 'px' }),
    halo: Object.freeze({ tipo: 'escolha', rotulo: 'Halo dos cartões', padrao: 'sim',
      opcoes: Object.freeze([['nao', 'Não'], ['sim', 'Sim']]),
      apoio: 'A luz difusa por trás das caixas. É sombra de CSS, não imagem.' }),
    tamanho_texto: Object.freeze({ tipo: 'escolha', rotulo: 'Tamanho do texto', padrao: 'medio',
      opcoes: Object.freeze([['pequeno', 'Pequeno'], ['medio', 'Médio'], ['grande', 'Grande']]) }),
    largura: Object.freeze({ tipo: 'escolha', rotulo: 'Largura da página', padrao: 'media',
      opcoes: Object.freeze([['estreita', 'Estreita'], ['media', 'Média'], ['larga', 'Larga']]) }),
    altura_logo: Object.freeze({ tipo: 'medida', rotulo: 'Altura do logo', padrao: 40, min: 24, max: 96, passo: 2, unidade: 'px' })
  });

  const manifesto = Object.freeze({ id: 'defi', version: 1, nome: 'DeFi', autor: 'Nostermentor', engine_min: 1, options: options });

  const templates = Temas.moldes;
  function resolver(opcoes) { return Temas.resolver(options, opcoes); }

  const ESQUEMAS = {
    indigo:   { fundo: '#0b1020', tinta: '#e2e8f5', suave: '#8f9bbb', linha: '#1e2748', bloco: '#141c33', vidro: 'rgba(255,255,255,.045)' },
    ametista: { fundo: '#140b22', tinta: '#ece2f7', suave: '#a291bd', linha: '#2c1a45', bloco: '#1d1030', vidro: 'rgba(255,255,255,.05)' },
    grafite:  { fundo: '#101214', tinta: '#e6e8ea', suave: '#93999f', linha: '#232830', bloco: '#171a1f', vidro: 'rgba(255,255,255,.04)' }
  };
  const TAMANHOS = { pequeno: 16, medio: 17, grande: 19 };
  const LARGURAS = { estreita: 640, media: 720, larga: 900 };
  const SANS = 'system-ui,-apple-system,"Segoe UI",Roboto,Ubuntu,"Noto Sans",sans-serif';

  function css(opcoes) {
    const v = resolver(opcoes);
    const e = ESQUEMAS[v.esquema];
    const C = Temas.cor;
    const c1 = C.acentoLegivel(v.cor_inicio, e.fundo);
    const c2 = C.acentoLegivel(v.cor_fim, e.fundo);
    const halo = v.halo === 'sim' ? '0 10px 34px rgba(0,0,0,.45)' : 'none';
    return [
      '/* Nostermentor — tema DeFi v1. Degradês e halos são CSS; nenhuma imagem, nenhuma letra vinda de fora. */',
      ':root{--fundo:' + e.fundo + ';--tinta:' + e.tinta + ';--suave:' + e.suave + ';--linha:' + e.linha + ';--bloco:' + e.bloco + ';--vidro:' + e.vidro + ';' +
        '--c1:' + c1 + ';--c2:' + c2 + ';--c1-cheia:' + v.cor_inicio + ';--c2-cheia:' + v.cor_fim + ';' +
        '--sobre-c1:' + C.textoSobre(C.paraRgb(v.cor_inicio)) + ';--degrade:linear-gradient(100deg,var(--c1),var(--c2));' +
        '--canto:' + v.cantos + 'px;--halo:' + halo + ';' +
        '--sans:' + SANS + ';--base:' + TAMANHOS[v.tamanho_texto] + 'px;--largura:' + LARGURAS[v.largura] + 'px;--logo-altura:' + v.altura_logo + 'px}',
      '*{box-sizing:border-box}',
      'html{-webkit-text-size-adjust:100%}',
      'body{margin:0;background:var(--fundo);color:var(--tinta);font-family:var(--sans);font-size:var(--base);line-height:1.68;overflow-wrap:anywhere}',
      'a{color:var(--c2);text-underline-offset:3px}',
      'img,video{max-width:100%;height:auto}',
      'code,pre{font-family:ui-monospace,Menlo,Consolas,"Liberation Mono",monospace;font-size:.9em}',
      'code{background:var(--bloco);padding:1px 5px;border-radius:5px}',
      'pre{overflow:auto;padding:16px;background:var(--bloco);border:1px solid var(--linha);border-radius:var(--canto)}',
      'pre code{background:none;padding:0}',
      'table{display:block;overflow-x:auto;overflow-wrap:normal;margin:0 0 1.6em;border-collapse:collapse}',
      'th,td{padding:8px 16px 8px 0;text-align:left;vertical-align:top;border-bottom:1px solid var(--linha)}',
      'thead th{color:var(--c2);font-size:.88em;text-transform:uppercase;letter-spacing:.07em}',
      'blockquote{margin:1.5em 0;padding:.6em 1.1em;border:0;border-left:3px solid var(--c1);background:var(--vidro);border-radius:0 var(--canto) var(--canto) 0;color:var(--suave)}',
      // --- o cabeçalho: pílula de vidro -------------------------------------
      '.cabecalho{max-width:var(--largura);margin:20px auto 0;padding:14px 20px;background:var(--vidro);border:1px solid var(--linha);border-radius:var(--canto);box-shadow:var(--halo);display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px 22px}',
      '.marca{font-size:1.4em;line-height:1.2;font-weight:800;letter-spacing:-.02em;text-decoration:none;color:var(--c2)}',
      // O degradê no texto só entra se o motor o souber fazer; sem isto, com
      // `color:transparent` fixo, um motor sem suporte apagava o nome do site.
      '@supports (background-clip:text) or (-webkit-background-clip:text){.marca{background-image:var(--degrade);-webkit-background-clip:text;background-clip:text;color:transparent}}',
      '.marca-logo{line-height:0;background-image:none;color:inherit}',
      '.marca-logo img{max-height:var(--logo-altura);max-width:100%;width:auto;height:auto;display:block}',
      '.menu{display:flex;flex-wrap:wrap;gap:6px 8px}',
      '.menu a{display:inline-block;padding:4px 12px;border-radius:999px;text-decoration:none;font-size:.9em;font-weight:600;line-height:1.6;color:var(--suave)}',
      '.menu a[aria-current=page]{background:var(--vidro);color:var(--tinta)}',
      '.principal{max-width:var(--largura);margin:0 auto;padding:32px 20px 48px}',
      'h1{font-size:2em;line-height:1.14;margin:0 0 .4em;font-weight:800;letter-spacing:-.028em}',
      'h2{font-size:1.38em;line-height:1.22;margin:1.7em 0 .4em;font-weight:700;letter-spacing:-.015em}',
      'h3{font-size:1.1em;margin:1.4em 0 .35em;font-weight:700}',
      '.meta{color:var(--suave);font-size:.88em;margin:0 0 1.6em}',
      '.etiqueta{display:inline-block;padding:3px 12px;border-radius:999px;background:var(--vidro);border:1px solid var(--linha);font-size:1em;text-decoration:none;color:inherit;line-height:1.5}',
      'a.etiqueta:hover{border-color:var(--c2);color:var(--c2)}',
      '.cta{margin:1.8em 0}',
      '.botao{display:inline-block;padding:.65em 1.7em;border-radius:999px;background:linear-gradient(100deg,var(--c1-cheia),var(--c2-cheia));color:var(--sobre-c1);text-decoration:none;font-weight:700;box-shadow:var(--halo)}',
      '.capa{margin:0 0 1.8em;border-radius:var(--canto);overflow:hidden;box-shadow:var(--halo)}',
      '.capa img{width:100%;height:auto;display:block}',
      '.capa figcaption{padding:8px 14px;background:var(--bloco);color:var(--suave);font-size:.86em}',
      '.ampliar{display:block;line-height:0;text-decoration:none;cursor:zoom-in}',
      '.galeria{margin:2.2em 0}',
      '.cartoes{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:20px}',
      '.cartao{margin:0;background:var(--vidro);border:1px solid var(--linha);border-radius:var(--canto);padding:14px;box-shadow:var(--halo)}',
      '.cartao-capa{display:block;line-height:0;margin:0 0 .7em;border-radius:calc(var(--canto) - 4px);overflow:hidden}',
      '.cartao-capa img{width:100%;height:auto;display:block}',
      '.cartao-titulo{font-size:1.06em;line-height:1.28;margin:0 0 .2em;font-weight:700}',
      '.cartao-titulo a{text-decoration:none;color:var(--tinta)}',
      '.cartao .meta{margin:0 0 .3em}',
      '.cartao .resumo{margin:0;font-size:.92em;color:var(--suave)}',
      '.lista-artigos{list-style:none;margin:0;padding:0}',
      '.lista-artigos li{margin:0 0 14px;padding:16px 18px;background:var(--vidro);border:1px solid var(--linha);border-radius:var(--canto);box-shadow:var(--halo)}',
      '.lista-artigos h2{margin:0 0 .2em;font-size:1.2em}',
      '.lista-artigos h2 a{text-decoration:none;color:var(--tinta)}',
      '.lista-artigos time{color:var(--suave);font-size:.88em}',
      // ⚠️ `em` COMPÕE: na listagem o `<time>` vive dentro do `<p class="meta">`,
      // que já reduziu o tamanho — reduzir outra vez dava 11,8 px no tema
      // Galeria e 12,0 no Neon, abaixo do piso de 12 (TEMAS.md §7.2 R5),
      // medido em 2026-09-05. Na secção "últimos artigos" o `<time>` é filho
      // direto do `<li>` e a redução acima é a que se quer; daí o escopo.
      '.lista-artigos .meta time{font-size:1em}',
      '.lista-artigos a,.ultimos p a,.blog>p a,.cartao-titulo a{display:inline-block;padding:3px 0}',
      // A data dentro de uma listagem não é a data de um artigo aberto: ali
      // ela abre espaço antes do texto, aqui separa duas linhas do mesmo
      // item. Sem esta regra herda a margem grande de `.meta` e a lista fica
      // com um buraco entre a data e o resumo — visto na captura, 2026-09-05.
      '.lista-artigos .meta{margin:0 0 .35em}',
      '.resumo{margin:.3em 0 0;color:var(--suave)}',
      '.ultimos{margin-top:2.6em;padding-top:1.4em;border-top:1px solid var(--linha)}',
      '.ultimos h2{margin-top:0}',
      '.vazio{color:var(--suave)}',
      '.rodape{max-width:var(--largura);margin:0 auto;padding:18px 20px 44px;border-top:1px solid var(--linha);color:var(--suave);font-size:.86em}',
      '.apoie h2{font-size:1.05em;margin:0 0 .3em;color:var(--tinta)}',
      '.credito{margin:1em 0 0}',
      ''
    ].join('\n');
  }

  return Object.freeze({ manifesto, templates, css, resolver });
})();
Temas.registar(TemaDefi);
