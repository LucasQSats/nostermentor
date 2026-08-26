# Nostermentor

Gerenciador de publicação de sites e blogs no protocolo **nsite**
(Nostr + Blossom): um único arquivo HTML que se abre por `file://`,
**sem instalar nada**, e funciona em Tails, Windows e Linux.

- O navegador é o runtime. Nenhum servidor do projeto no caminho.
- A chave (nsec) nunca sai do navegador e nunca é gravada.
- A rede é o banco de dados: o site publicado é reconstruído a partir da npub.

## Estado

**Marco M3 concluído (2026-08-26)** — editar e guardar: listas de Páginas
(T4) e Artigos (T5) com os quatro estados e ações (remover / desfazer /
excluir / definir como Início), o editor (T4a/T5a: Markdown com botões +
pré-visualização isolada em iframe de origem opaca, gravação automática,
slug travado após a publicação com aliases), o gerador determinístico do
site (tema padrão em Mustache, `site.json`) e o Backup (T9: exportar com
tripwire de nsec, importar com resumo, juntar ou substituir). M1
(esqueleto, T0/T1, moldura) e M2 (ler da rede: T2/T3) estão concluídos.
Nada é publicado ainda — o botão "Publicar" acende, mas leva a um aviso
honesto: publicar é o M4.

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
