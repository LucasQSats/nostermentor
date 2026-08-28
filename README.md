# Nostermentor

Gerenciador de publicação de sites e blogs no protocolo **nsite**
(Nostr + Blossom): um único arquivo HTML que se abre por `file://`,
**sem instalar nada**, e funciona em Tails, Windows e Linux.

- O navegador é o runtime. Nenhum servidor do projeto no caminho.
- A chave (nsec) nunca sai do navegador e nunca é gravada.
- A rede é o banco de dados: o site publicado é reconstruído a partir da npub.

## O que o app faz

Entrar com a chave (colar, arquivo ou gerar uma nova, mostrada uma vez) →
reconstruir o site pela rede → escrever páginas e artigos em Markdown com
pré-visualização isolada → enviar imagens, com os metadados removidos antes
de subir → **publicar** nos servidores Blossom e nos relays, com diff e
placar honesto ("N de M") → conferir a saúde da publicação e reenviar o mapa
aos relays que o perderam, sem pedir a chave → exportar e importar o backup.
O site gerado é HTML estático **sem uma única tag de script**.

Arquivos publicados por outra ferramenta são preservados; quando um deles
ocupa um caminho que o app precisa gerar, a publicação **para** e o dono
escolhe — nunca se troca em silêncio.

## Estado

**Marco M4 concluído (2026-08-27) — o protótipo publica de verdade**, e o
ciclo inteiro foi validado no Tails real: entrar, editar, publicar na rede,
guardar o backup, **reiniciar a máquina** e recuperar tudo. **M5 em curso**
(completar a v1): T3 Início, T6 Mídia, T7 Configurações e T11 Ajuda estão
feitas, com "tirar o site do ar" e a imagem clicável; faltam a edição de
endereços antigos (aliases) e o bloco de bloqueio em T8. M1 (esqueleto,
T0/T1, moldura), M2 (ler da rede) e M3 (editar, gerar e backup) estão
concluídos. O aviso de nova versão dentro do painel é o M6.

```
./gera_bundle.sh      # (só se mudar a versão do nostr-tools) regenera src/libs/nostr-tools.inline.js
./monta_app.sh        # → dist/nostermentor.html + dist/LEIA-ME.txt (bytes + sha256)
test/roda.sh          # suíte Playwright em Firefox + Chrome, de file://
test/tails/entrega.sh # ISO para a bancada Tails
```

Dependências de desenvolvimento (`package.json`) instalam-se no scratchpad,
nunca aqui; nada delas entra no produto. As quatro bibliotecas embutidas
(nostr-tools, DOMPurify, marked, Mustache) entram como estão, com versão e
sha256 em `VERSOES.md` — a montagem recusa gerar o app se alguma divergir.

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
