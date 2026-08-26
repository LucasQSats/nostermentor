#!/usr/bin/env bash
# test/roda.sh — corre a suíte em Firefox (Playwright) e no Chrome do
# sistema, de file://, sob a CSP do produto. Instala playwright-core no
# scratchpad (02 §F), nunca aqui.
#   uso: test/roda.sh [dist/nostermentor.html]
# Variáveis (podem vir de test/local.env, que o git ignora):
#   NOSTERMENTOR_NSEC_TESTE_ARQUIVO  arquivo com a nsec de TESTE do Bostil
#                                    (09 §2). Sem ele, os casos que a usam
#                                    são reportados como PULADOS.
#   NOSTERMENTOR_SCRATCH             pasta de trabalho (padrão: $TMPDIR)
#   CHROME                           binário do Chrome (padrão: /usr/bin/google-chrome)
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
[ -f "$REPO/test/local.env" ] && . "$REPO/test/local.env"
SCRATCH="${NOSTERMENTOR_SCRATCH:-${TMPDIR:-/tmp}/nostermentor-dev}/testes"
mkdir -p "$SCRATCH/resultados"
cp "$REPO/package.json" "$REPO/package-lock.json" "$SCRATCH/"
( cd "$SCRATCH" && [ -d node_modules/playwright-core ] || npm ci --no-audit --no-fund >/dev/null )
HTML="${1:-$REPO/dist/nostermentor.html}"
[ -f "$HTML" ] || { echo "✗ não existe $HTML — corra ./monta_app.sh antes" >&2; exit 1; }
export NOSTERMENTOR_NSEC_TESTE_ARQUIVO="${NOSTERMENTOR_NSEC_TESTE_ARQUIVO:-}"
NODE_PATH="$SCRATCH/node_modules" exec node "$REPO/test/roda.js" "$HTML" "$SCRATCH/resultados"
