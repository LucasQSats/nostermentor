# Nostermentor

Gerenciador de publicação de sites e blogs no protocolo **nsite**
(Nostr + Blossom): um único arquivo HTML que se abre por `file://`,
**sem instalar nada**, e feito para funcionar em Tails, Windows e Linux.

**Site do projeto:** <https://npub1j5tad3x8msv4sy6qnvyrcgvjhfjmlmh32l75kgch2jkqdgfudzaq2wmx2k.nsite.lol/> — feito e publicado com o próprio Nostermentor. Para começar, o [passo a passo do primeiro site](https://npub1j5tad3x8msv4sy6qnvyrcgvjhfjmlmh32l75kgch2jkqdgfudzaq2wmx2k.nsite.lol/blog/seu-primeiro-site-no-nostr-sem-terminal.html).

- O navegador é o runtime. Nenhum servidor do projeto no caminho.
- A chave (nsec) nunca sai do navegador e nunca é gravada.
- A rede é o banco de dados: o site publicado é reconstruído a partir da npub.

## O que promete, e o que não promete

A promessa é esta, e é verdadeira sem asterisco: **publique sob o seu nome ou
sem ele, de qualquer máquina, sem pedir licença a ninguém e sem servidor de
terceiro no caminho da edição.**

O que vem depois merece a mesma clareza:

- **É um CMS — gerencia conteúdo a ser publicado.** Não é hospedagem, não é
  rede, não é servidor. Escreve páginas e artigos, organiza mídia, monta o
  site e assina a publicação com a chave do dono. O que acontece a seguir é
  do protocolo: relays, servidores Blossom e gateways.
- **O projeto não se responsabiliza pelo que é publicado.** A chave é do
  usuário, a assinatura é dele, a decisão de publicar é dele. Não existe
  backend do projeto — ninguém aqui vê o conteúdo, nem teria como aprovar ou
  recusar.
- **Dá para publicar sem se identificar, e isso não é impunidade.** O
  anonimato técnico protege a ligação entre a obra e a pessoa; não apaga a
  responsabilidade por aquilo que se escreve, nem torna ninguém inalcançável.
  Use com responsabilidade e bom senso.
- **Servidores de terceiros podem bloquear a exibição, e isso não está sob
  controle do Nostermentor.** Gateways e servidores Blossom têm políticas e
  jurisdições próprias. O conteúdo continua existindo e recuperável pela
  npub; chegar até ele pela web comum depende de quem serve a página.

## O que o app faz

Entrar com a chave (colar, arquivo ou gerar uma nova, mostrada uma vez) →
reconstruir o site pela rede → escrever páginas e artigos em Markdown com
pré-visualização isolada → enviar imagens e vídeos → **publicar** nos
servidores Blossom e nos relays, com diff e placar honesto ("N de M") →
conferir a saúde da publicação e reenviar o mapa aos relays que o perderam,
sem pedir a chave → exportar e importar o backup. O site gerado é HTML estático **sem uma única tag de
script**.

Em JPEG, PNG e WebP os metadados saem antes de subir — EXIF, GPS, XMP, IPTC
e o que estiver depois do fim do arquivo —, sem recomprimir a imagem: os
pixels e o perfil de cor ficam byte a byte iguais. Nos demais tipos, vídeo
inclusive, **o app não sabe limpar e diz isso** em vez de deixar acreditar que
limpou.

No editor, além do Markdown: três botões que inserem blocos prontos — um botão
de ação, uma galeria de artigos e os contatos do site — e um botão **HTML**, que cola trecho de
fora já limpo pelo mesmo filtro da publicação, dizendo o que tirou e por
quê. Artigos ganham etiquetas, e cada etiqueta vira uma página do site. Capas
geram miniatura. Endereços antigos continuam funcionando quando uma página é
renomeada.

A aparência sai de uma galeria de **21 temas** — do mais sóbrio ao mais
gritante, com um deles pensado para alto contraste — e se ajusta sem sair do
painel: fundo, cor de destaque, letras, tamanho, largura, cantos e o logo do
cabeçalho. As opções vêm do manifesto do tema, não de uma lista no core — e é
o tema que valida os valores, para que nada escrito por alguém de fora chegue
à folha de estilo que o leitor baixa. As letras são sempre as do sistema: uma
fonte remota diria ao servidor dela quem visitou o site. Escrever um tema não
exige ler o código do app — a especificação é o `TEMAS.md`.

A tela **Contatos** tem duas metades. Em "Mensagens", o site recebe mensagens
privadas pelo Nostr (NIP-17) e o dono responde de dentro do painel, com a chave
do site — ou começa a conversa, escrevendo para qualquer endereço Nostr que
publique onde recebe mensagens. As mensagens são abertas só no navegador, e
enquanto a aba está aberta o que chega aparece sozinho. Vem desligado — ligar publica na rede onde o site
recebe mensagens, e desligar publica que ele deixou de receber. Em "Onde me
encontrar", o dono preenche as formas de contato que quiser mostrar (e-mail,
WhatsApp, Telegram, Instagram, X, Nostr, Signal ou outro link), cada uma com o
aviso do que ela revela de quem a usa, e insere o bloco de contatos na página
que escolher.

Arquivos publicados por outra ferramenta são preservados; quando um deles
ocupa um caminho que o app precisa gerar, a publicação **para** e o dono
escolhe — nunca se troca em silêncio. E dá para tirar o site do ar: mapa
vazio nos relays, blobs apagados onde o servidor deixar, placar servidor por
servidor, e o conteúdo local intacto para republicar depois.

Antes de publicar, o painel avisa quando uma página busca arquivo de outro
servidor — uma imagem de fora entrega a esse servidor o IP e a hora de cada
visita — e não impede nada. Avisa também quando o logo ou o ícone escolhido é
SVG, que o Tor Browser no nível de segurança mais alto não mostra.

## Estado

**O app publica de verdade, e o ciclo inteiro foi validado no Tails real:**
entrar, editar, publicar na rede, guardar o backup, **reiniciar a máquina** e
recuperar tudo a partir da chave. Publicar e tirar do ar foram medidos contra
a rede real, não só contra servidor de teste — inclusive o gateway devolvendo
`404` depois da remoção. Pelo Tor, arquivos de até 50 MB sobem inteiros; a
partir de ~98 MB, não. Testado no Tails em computador de verdade e no Linux,
em Firefox e Chrome; no Windows, ainda não numa máquina real.

As telas da versão 1 estão completas: entrar, carregar, início, páginas,
artigos, editor, mídia, contatos, configurações, publicar, temas, backup e
ajuda. O painel é feito para computador (uma janela de pelo menos 600 pontos de
largura); o site publicado serve a qualquer tela. O que falta para a `0.1.0` é
o aviso de versão nova dentro do painel.

A suíte roda em Firefox e Chrome, sempre nos dois — metade das correções de
tema deste projeto veio de os dois discordarem.

```
./gera_bundle.sh      # (só se mudar a versão do nostr-tools) regenera src/libs/nostr-tools.inline.js
./monta_app.sh        # → dist/nostermentor.html + dist/LEIA-ME.txt (bytes + sha256)
test/roda.sh          # suíte Playwright em Firefox + Chrome, de file://
test/tails/entrega.sh # ISO para a bancada Tails
```

As dependências de desenvolvimento (`package.json`) são instaladas no
scratchpad, nunca aqui; nada delas entra no produto. As cinco bibliotecas
embutidas (nostr-tools, DOMPurify, marked, Mustache, qrcode-generator) entram
como estão, com versão e sha256 em `VERSOES.md` — a montagem recusa gerar o
app se alguma divergir.

## Documentação

O que é público e serve a quem chega está aqui: `TEMAS.md` (como escrever um
tema, sem precisar ler o código do app) e `VERSOES.md` (as bibliotecas
embutidas, com origem, licença e hash). Requisitos, arquitetura, protocolo,
schema de dados, desenho das telas e plano vivem numa base de conhecimento
fora deste repositório, que não é pública — este repositório é o código.
Quando o código diverge da documentação, **o código é a verdade**.

## Regras que o código respeita (resumo)

- Zero instalação; um HTML montado por script (`monta_app.sh`); sem módulos
  ES, sem `fetch` de arquivo local, sem código remoto — CSP no próprio HTML.
- Nada vindo da rede executa no painel; pré-visualização só em iframe isolado.
- Nenhum tema é programa: um tema são dados (manifesto, moldes e CSS), e o
  site publicado não carrega nada de outro servidor.
- Nunca inventar kind, tag, header ou comportamento de navegador sem evidência.
- Sucesso parcial é o estado normal: toda operação de rede reporta "N de M".

## Licença

MIT — ver `LICENSE`.
