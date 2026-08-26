#!/usr/bin/env bash
# test/roda.sh — corre a suíte em Firefox (Playwright) e no Chrome do
# sistema, de file://, sob a CSP do produto. Instala playwright-core (e o
# nostr-tools dos testes) no scratchpad (02 §F), nunca aqui. Gera um
# certificado autoassinado para o servidor falso (relay + Blossom locais).
#   uso: test/roda.sh [dist/nostermentor.html]
# Variáveis (podem vir de test/local.env, que o git ignora):
#   NOSTERMENTOR_NSEC_TESTE_ARQUIVO  arquivo com a nsec de TESTE do Bostil
#                                    (09 §2). Sem ele, os casos que a usam
#                                    são reportados como PULADOS.
#   NOSTERMENTOR_SCRATCH             pasta de trabalho (padrão: $TMPDIR)
#   NOSTERMENTOR_SUITES              só estas suítes (lista separada por vírgula)
#   CHROME                           binário do Chrome (padrão: /usr/bin/google-chrome)
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
[ -f "$REPO/test/local.env" ] && . "$REPO/test/local.env"
SCRATCH="${NOSTERMENTOR_SCRATCH:-${TMPDIR:-/tmp}/nostermentor-dev}/testes"
mkdir -p "$SCRATCH/resultados" "$SCRATCH/cert"
cp "$REPO/package.json" "$REPO/package-lock.json" "$SCRATCH/"
( cd "$SCRATCH" && [ -d node_modules/playwright-core ] && [ -d node_modules/nostr-tools ] || npm ci --no-audit --no-fund >/dev/null )
if [ ! -f "$SCRATCH/cert/cert.pem" ]; then
  openssl req -x509 -newkey rsa:2048 -nodes -keyout "$SCRATCH/cert/key.pem" -out "$SCRATCH/cert/cert.pem" -days 30 \
    -subj "/CN=127.0.0.1" -addext "subjectAltName=IP:127.0.0.1" >/dev/null 2>&1
fi
HTML="${1:-$REPO/dist/nostermentor.html}"
[ -f "$HTML" ] || { echo "✗ não existe $HTML — corra ./monta_app.sh antes" >&2; exit 1; }
export NOSTERMENTOR_NSEC_TESTE_ARQUIVO="${NOSTERMENTOR_NSEC_TESTE_ARQUIVO:-}"
export NOSTERMENTOR_CERT_DIR="$SCRATCH/cert"
NODE_PATH="$SCRATCH/node_modules" exec node "$REPO/test/roda.js" "$HTML" "$SCRATCH/resultados"
