/* core/contatos.js — as formas de contato que o dono publica no site (61,
   Etapa 2; plano §3, 14 T13 aba "Onde me encontrar"). É o ÚNICO lugar que
   conhece os oito canais: a lista fechada, o que o dono escreve em cada um, o
   que é aceito e como se monta o link. A tela e o gerador perguntam aqui — e é
   de propósito, porque validar em dois lugares é ter duas regras a divergir com
   o tempo (a lição de `hrefSeguro`, 00 §6.2 item 50).

   Decisões que vêm da pesquisa de 2026-09-12 (plano §3), e que o código cumpre:
   · o app guarda o DADO, não a URL (menos Signal e "outro link", onde o
     formato não é nosso): assim o link sai sempre bem formado;
   · a validação é deliberadamente FROUXA. As regras de tamanho e alfabeto de
     nome de usuário de cada plataforma não estão em documentação confiável, e
     inventá-las recusaria contas legítimas. O app recusa o que é seguramente
     errado (espaço, barra, dois-pontos) e mostra a prévia;
   · nada aqui vai à rede, e nada aqui toca o DOM.

   Formatos, com a fonte (plano §3.2): `mailto:` RFC 6068 (lida); `wa.me`
   FAQ do WhatsApp (extrato de busca) + Meta for Developers (lida);
   `t.me/<usuário>` core.telegram.org/api/links (lida); Instagram e X pelo
   PERFIL (o link de mensagem do X exige o id numérico, não o @);
   `nostr:` NIP-21 (lida); o Signal é colado como o app dele gerou (o formato
   exato do link não está em doc oficial). */
const Contatos = (function () {
  'use strict';

  const MAX_VALOR = 300, MAX_ROTULO = 60, MAX_ITENS = 20;

  // Sem espaço, sem barra, sem dois-pontos, sem o que quebraria um link.
  const RE_USUARIO = /^[^\s\/:@?#&"'<>\\]{1,60}$/;
  const RE_EMAIL = /^[^\s@<>"',;:]{1,64}@[^\s@<>"',;:]{1,190}\.[a-z]{2,24}$/i;
  const RE_TELEFONE = /^\d{8,15}$/;                       // internacional, só dígitos
  const RE_NPUB = /^npub1[023456789acdefghjklmnpqrstuvwxyz]{58}$/;
  const RE_NPROFILE = /^nprofile1[023456789acdefghjklmnpqrstuvwxyz]{20,300}$/;
  // `wa.me/message/<ID>` e `wa.me/<usuário>` são as formas que o próprio app
  // do dono gera e que NÃO mostram o número — por isso são aceitos como estão.
  const RE_WA_LINK = /^https:\/\/wa\.me\/(?:message\/)?[A-Za-z0-9_.-]{1,60}$/;
  // Signal: cola o que o aplicativo gerou. Só aceita `https:`, e só do
  // domínio do próprio Signal — um link de terceiro entra pelo campo 8, que é
  // onde o dono sabe que está pondo um endereço qualquer.
  const RE_SIGNAL = /^https:\/\/(?:signal\.me|signal\.group)\/[A-Za-z0-9_.#+\/=-]{1,240}$/;
  const RE_HTTPS = /^https:\/\/[^\s"'<>]{3,290}$/;

  function limpar(v) { return String(v == null ? '' : v).trim(); }
  function semArroba(v) { return limpar(v).replace(/^@+/, ''); }
  function soDigitos(v) { return limpar(v).replace(/[\s()\-.]/g, '').replace(/^\+/, ''); }

  // A lista FECHADA, na ordem de fábrica da tela e do site (plano §3.2). Cada
  // canal: como se normaliza o que o dono escreveu, se é válido, o link que
  // sai, o que o leitor lê, e o `codigo` (o texto a copiar) quando o link pode
  // não funcionar do lado de lá.
  const TIPOS = Object.freeze([
    Object.freeze({
      kind: 'email', rotulo: 'E-mail',
      normalizar: v => limpar(v).replace(/^mailto:/i, ''),
      valido: v => RE_EMAIL.test(v),
      href: v => 'mailto:' + v,
      texto: v => v
    }),
    Object.freeze({
      // Dois caminhos, e o segundo é o recomendado pelo aviso: o link curto e o
      // nome de usuário NÃO mostram o número de telefone.
      kind: 'whatsapp', rotulo: 'WhatsApp',
      normalizar: v => (/^https?:\/\//i.test(limpar(v)) ? limpar(v).replace(/^http:/i, 'https:') : soDigitos(v)),
      valido: v => RE_TELEFONE.test(v) || RE_WA_LINK.test(v),
      href: v => (RE_TELEFONE.test(v) ? 'https://wa.me/' + v : v),
      texto: v => (RE_TELEFONE.test(v) ? '+' + v : v.replace(/^https:\/\//, ''))
    }),
    Object.freeze({
      kind: 'telegram', rotulo: 'Telegram',
      // ⚠️ A forma `t.me/+<telefone>` é recusada de propósito (plano §3.3): pelo
      // nome de usuário ninguém vê o número, e pelo convite com `+` vê.
      normalizar: v => semArroba(limpar(v).replace(/^https?:\/\/t\.me\//i, '')),
      valido: v => RE_USUARIO.test(v) && v.charAt(0) !== '+',
      href: v => 'https://t.me/' + v,
      texto: v => '@' + v
    }),
    Object.freeze({
      kind: 'instagram', rotulo: 'Instagram',
      normalizar: v => semArroba(limpar(v).replace(/^https?:\/\/(?:www\.)?instagram\.com\//i, '').replace(/\/+$/, '')),
      valido: v => RE_USUARIO.test(v),
      href: v => 'https://instagram.com/' + v,
      texto: v => '@' + v
    }),
    Object.freeze({
      kind: 'x', rotulo: 'X',
      normalizar: v => semArroba(limpar(v).replace(/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\//i, '').replace(/\/+$/, '')),
      valido: v => RE_USUARIO.test(v),
      href: v => 'https://x.com/' + v,
      texto: v => '@' + v
    }),
    Object.freeze({
      // O único que sai em DOBRO: link `nostr:` E o texto para copiar. A NIP-21
      // não tem reserva — sem aplicativo Nostr, o clique não faz nada.
      kind: 'nostr', rotulo: 'Nostr',
      normalizar: v => limpar(v).replace(/^nostr:/i, ''),
      valido: v => RE_NPUB.test(v) || RE_NPROFILE.test(v),
      href: v => 'nostr:' + v,
      texto: v => 'Meu endereço Nostr',
      codigo: v => v,
      // 61 (2026-09-14, decisão dele: opção (a), SEM botão de copiar — o site
      // publicado não leva JavaScript, 02 G.0). O que se pode dar ao leitor é a
      // instrução. Diz as duas coisas que o endereço cru sozinho não dizia: que
      // aquilo se copia para um aplicativo Nostr, e que o clique pode não fazer
      // nada sem um instalado — o buraco da NIP-21 descrito acima, que até aqui
      // o leitor descobria clicando e não acontecendo nada.
      nota: () => 'Copie este endereço para o seu aplicativo Nostr. Se o link não abrir nada, é porque ainda não há um instalado neste aparelho.'
    }),
    Object.freeze({
      kind: 'signal', rotulo: 'Signal',
      normalizar: v => limpar(v).replace(/^http:/i, 'https:'),
      valido: v => RE_SIGNAL.test(v),
      href: v => v,
      texto: v => v.replace(/^https:\/\//, '')
    }),
    Object.freeze({
      // A saída genérica que todo construtor tem, e o que mantém a tela pequena:
      // cobre Matrix, SimpleX, Mastodon, Bluesky, Threema, onion, loja, catálogo.
      kind: 'link', rotulo: 'Outro link', pedeRotulo: true,
      normalizar: v => limpar(v),
      valido: v => RE_HTTPS.test(v),
      href: v => v,
      texto: v => v.replace(/^https:\/\//, '').replace(/\/$/, '')
    })
  ]);

  const PORKIND = new Map(TIPOS.map(t => [t.kind, t]));
  function tipoDe(kind) { return PORKIND.get(String(kind || '')) || null; }
  function tipos() { return TIPOS; }

  // Um item bruto (do banco, do backup ou do site.json) → o item limpo, ou null.
  // `label` só existe para o "outro link" — nos outros o rótulo é do canal, e
  // deixá-lo livre daria "WhatsApp" apontando para outra coisa qualquer.
  function normalizar(item) {
    if (!item || typeof item !== 'object') return null;
    const t = tipoDe(item.kind);
    if (!t) return null;
    const valor = t.normalizar(item.value).slice(0, MAX_VALOR);
    if (!valor || !t.valido(valor)) return null;
    const rotulo = t.pedeRotulo ? String(item.label == null ? '' : item.label).trim().slice(0, MAX_ROTULO) : '';
    return { kind: t.kind, value: valor, label: rotulo };
  }
  // A lista inteira. Mantém a ORDEM que o dono escolheu (é visível no site e
  // tem de ser determinístico — 13 §5.2) e recusa o repetido do mesmo canal com
  // o mesmo valor. Devolve [] quando não sobra nada: é o estado de fábrica, e
  // é ele que faz o campo sumir do site.json (nenhum site publicado muda).
  function normalizarLista(lista) {
    if (!Array.isArray(lista)) return [];
    const saida = [], vistos = new Set();
    for (const bruto of lista) {
      const item = normalizar(bruto);
      if (!item) continue;
      const chave = item.kind + ' ' + item.value;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      saida.push(item);
      if (saida.length >= MAX_ITENS) break;
    }
    return saida;
  }
  function valido(item) { return normalizar(item) !== null; }

  // O que o molde `contatos` do tema desenha. `hrefSeguro` é o mesmo juiz do
  // marcador (Gerador), passado de fora para este módulo não depender dele em
  // tempo de carga (a ordem dos scripts de core/ é alfabética): um item cujo
  // link não passe no juiz NÃO sai — é a única barreira daquele `<a>`, porque
  // o HTML do molde não passa pelo DOMPurify (é dado do tema, 02 G.0).
  // `opts.conviteNostr` (desde 2026-09-14): a npub que `npubDoConvite` devolveu,
  // ou nada.
  function itensParaMolde(lista, hrefSeguro, opts) {
    const convite = opts && opts.conviteNostr ? String(opts.conviteNostr) : '';
    const destinoDe = typeof hrefSeguro === 'function' ? hrefSeguro : (bruto => ({ href: bruto, externo: true }));
    const saida = [];
    let convidou = false;
    for (const item of normalizarLista(lista)) {
      const t = tipoDe(item.kind);
      const destino = destinoDe(t.href(item.value));
      if (!destino) continue;
      // O campo Nostr que o dono preencheu com o endereço do PRÓPRIO site já é
      // o convite: muda só o texto, e o site não o mostra duas vezes.
      const ehConvite = !!convite && item.kind === 'nostr' && item.value === convite;
      if (ehConvite) convidou = true;
      saida.push({
        tipo: item.kind,
        rotulo: (item.label || t.rotulo),
        texto: ehConvite ? CONVITE_NOSTR : t.texto(item.value),
        href: destino.href,
        externo: !!destino.externo,
        codigo: t.codigo ? t.codigo(item.value) : '',
        nota: t.nota ? t.nota(item.value) : ''
      });
    }
    // Vai no FIM: a ordem dos campos é do dono e é visível no site (13 §5.2);
    // o convite não é um campo dele, e não passa à frente de nenhum.
    if (convite && !convidou) {
      const t = tipoDe('nostr');
      const destino = destinoDe(t.href(convite));
      if (destino) saida.push({ tipo: 'nostr', rotulo: t.rotulo, texto: CONVITE_NOSTR, href: destino.href, externo: !!destino.externo, codigo: t.codigo(convite), nota: t.nota(convite) });
    }
    return saida;
  }

  // 61 D1 (14 T13 decisão 31, 2026-09-14) — com as mensagens LIGADAS, o bloco
  // `[[contatos]]` convida sozinho a escrever pelo Nostr, com a npub do site,
  // sem o dono preencher o campo Nostr. Decisão dele (*"sim"*). Foi o E-C3 que
  // mostrou o buraco: com a caixa de entrada publicada, o site não dizia a
  // ninguém que aceitava mensagens. → a npub, ou null.
  // Só com pelo menos um relay na caixa: sem ele o painel não publica 10050
  // nenhum (`Publicar.relaysDaCaixaDo` usa a mesma conta), e convidar seria
  // mentir. Quem não liga as mensagens não muda um byte do site.
  const CONVITE_NOSTR = 'Mande uma mensagem privada';
  function npubDoConvite(site) {
    const m = site && site.messages;
    if (!m || m.enabled !== true || !Modelo.uniao(m.relays).length) return null;
    const npub = String(site.npub || '');
    return RE_NPUB.test(npub) ? npub : null;
  }

  return Object.freeze({ TIPOS, MAX_VALOR, MAX_ROTULO, MAX_ITENS, CONVITE_NOSTR, tipos, tipoDe, normalizar, normalizarLista, valido, itensParaMolde, npubDoConvite });
})();
