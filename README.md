# Nostermentor

Gerenciador de publicação de sites e blogs no protocolo **nsite**
(Nostr + Blossom): um único arquivo HTML que se abre por `file://`,
**sem instalar nada**, e funciona em Tails, Windows e Linux.

- O navegador é o runtime. Nenhum servidor do projeto no caminho.
- A chave (nsec) nunca sai do navegador e nunca é gravada.
- A rede é o banco de dados: o site publicado é reconstruído a partir da npub.

## Estado

**Início do desenvolvimento (2026-08-25).** Ainda não há código do
produto: o próximo passo é o marco **M0** (evidências prévias) do plano
de implementação. Nada aqui está pronto para uso.

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
