# Versões das bibliotecas embutidas

> Regra `15` §2 / P-12 e `02` G.1.7: cada biblioteca entra **como está**,
> copiada do unpkg (ou gerada por receita fixada), com versão e sha256
> anotados aqui. O `monta_app.sh` **recusa montar** se algum arquivo de
> `src/libs/` divergir de `src/libs/SHA256SUMS` (é o mesmo conteúdo desta
> tabela, em formato `sha256sum -c`). Nenhuma delas é instalada via `npm`
> no produto — o produto é um HTML só.

| Biblioteca | Versão | Arquivo em `src/libs/` | Bytes | sha256 | Licença | Origem | Conferido em |
|---|---|---|---|---|---|---|---|
| nostr-tools (superfície `pure` + `nip19`) | 2.25.0 | `nostr-tools.inline.js` | 35.809 | `bbc120ac543f4953c35cc57fe1758e80731e37d56ebed7f7e10697dfaed57569` | Unlicense | **gerado** por `gera_bundle.sh` (esbuild 0.28.2, `--bundle --format=iife --global-name=NT --minify --target=es2020`, a partir de `entrada.js`; versões fixadas em `package.json` + `package-lock.json`) | 2026-08-26 — idêntico ao bundle da sonda de 2026-08-25 (`02` §F) |
| DOMPurify | 3.4.14 | `purify.min.js` | 29.204 | `c2f26ea4fc0d88141c9aa430eb515ac86fce59418ceebd85fa475b87a8d6c3e6` | Apache-2.0 **ou** MPL-2.0 (escolhemos Apache-2.0) | `https://unpkg.com/dompurify@3.4.14/dist/purify.min.js` | 2026-08-26 |
| marked | 18.0.11 | `marked.umd.js` | 44.679 | `69451c8541c9c1e7a4bf3ffc6f73c4d89633de92bfbe3e484dfe182ef8091f88` | MIT (cabeçalho do próprio arquivo) | `https://unpkg.com/marked@18.0.11/lib/marked.umd.js` (o campo `browser` do `package.json` da versão; não existe `marked.min.js` na raiz desta versão) | 2026-08-26 |
| Mustache | 4.2.0 | `mustache.min.js` | 11.790 | `d7fd0603512461e8edbd81686bead2ab82df3389b9cca235dd9d5b408848e02a` | MIT | `https://unpkg.com/mustache@4.2.0/mustache.min.js` | 2026-08-26 |

Globais que cada uma define ao carregar como `<script>` clássico (medido
pelos testes de `test/telas/`): `NT`, `DOMPurify`, `marked`, `Mustache`.

⚠️ **Esta tabela é mostrada ao usuário** desde 2026-08-27, em T11 → Sobre
(`src/textos.js`, `t11.sobre.bibliotecas`: nome, versão, licença e para que
serve). Mudar uma versão aqui obriga a mudar lá — `test/telas/t11_ajuda.test.js`
compara as quatro linhas e falha se divergirem.

Para regenerar o bundle do nostr-tools: `./gera_bundle.sh` (instala as
dependências de desenvolvimento no scratchpad, nunca nesta pasta — `02`
§F) e conferir que o sha256 impresso é o da tabela. Se não for, **não**
atualizar a tabela sem registrar em `11` o porquê (mudança de versão é
decisão, não acidente).
