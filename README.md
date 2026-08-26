# Nostermentor

Gerenciador de publicação de sites e blogs no protocolo **nsite**
(Nostr + Blossom): um único arquivo HTML que se abre por `file://`,
**sem instalar nada**, e funciona em Tails, Windows e Linux.

- O navegador é o runtime. Nenhum servidor do projeto no caminho.
- A chave (nsec) nunca sai do navegador e nunca é gravada.
- A rede é o banco de dados: o site publicado é reconstruído a partir da npub.

## Estado

**Marco M2 em curso (2026-08-26)** — ler da rede: depois de entrar (T1), o
painel reconstrói o site a partir da npub (T2: manifest `15128` nos relays,
`site.json` com hash conferido, arquivos herdados de sites publicados por
outra ferramenta, mesclagem por `id` com o que já estava no navegador) e
mostra o Início (T3: "seu site está em N de M relays", alterações, backup,
atalhos). M1 (esqueleto, T0/T1, moldura) está concluído. Nada é publicado
ainda (M4); editor e backup chegam no M3.

```
./gera_bundle.sh      # (só se mudar a versão do nostr-tools) regenera src/libs/nostr-tools.inline.js
./monta_app.sh        # → dist/nostermentor.html + dist/LEIA-ME.txt (bytes + sha256)
test/roda.sh          # suíte Playwright em Firefox + Chrome, de file://
test/tails/entrega.sh # ISO para a bancada Tails
```

Dependências de desenvolvimento (`package.json`) instalam-se no scratchpad,
nunca aqui; nada delas entra no produto.

## Base de conhecimento

Requisitos, arquitetura, protocolo, schema, telas e plano vivem na KB do
projeto (artefatos numerados `00`–`15`), fora deste repositório. Este
repositório é o **código**; quando ele divergir da KB, o código é a
verdade e a KB é corrigida.

Ordem de leitura para quem chega: `00` (identidade e pendências) →
`02` (protocolos — obrigatório antes de qualquer código) → `15` (plano).

## Regras que o código respeita (resumo)

- Zero instalação; um HTML montado por script (`monta_app.sh`); sem módulos
  ES, sem `fetch` de arquivo local, sem código remoto — CSP no próprio HTML.
- Nada vindo da rede executa no painel; pré-visualização só em iframe isolado.
- Nunca inventar kind, tag, header ou comportamento de navegador sem evidência.
- Sucesso parcial é o estado normal: toda operação de rede reporta "N de M".

## Licença

MIT — ver `LICENSE`.
