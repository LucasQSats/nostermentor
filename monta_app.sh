#!/usr/bin/env bash
# monta_app.sh — monta o Nostermentor: UM único HTML autocontido, a partir de
# src/, na ordem fixa de `15` §2. A receita é o que viaja; o HTML é derivado.
#   uso: ./monta_app.sh [pasta-de-saida]      (padrão: dist/)
# Regras que este script impõe (07 §2, 02 G.1, 15 §2):
#   - bibliotecas conferidas por sha256 contra src/libs/SHA256SUMS (G.1.7);
#   - cada biblioteca em <script> PRÓPRIO; lógica em scripts separados;
#   - sem type="module", sem import(), sem <script src>, sem fetch local;
#   - tripwire: nenhuma nsec real no HTML montado;
#   - versão num só lugar (P-10): APP_VERSION abaixo.
set -euo pipefail
cd "$(dirname "$0")"

APP_VERSION="0.1.0-dev"
SAIDA="${1:-dist}"
HTML="$SAIDA/nostermentor.html"

# 1. bibliotecas íntegras (recusa montar se divergirem de VERSOES.md)
( cd src/libs && sha256sum --quiet -c SHA256SUMS ) || { echo "✗ src/libs difere de SHA256SUMS — ver VERSOES.md" >&2; exit 1; }

LIBS=(nostr-tools.inline.js purify.min.js marked.umd.js mustache.min.js)
CORE=$(ls src/core/*.js 2>/dev/null | sort)
TEMA=$(find src/tema -name '*.js' 2>/dev/null | sort || true)
UI="src/ui/shell.js $(ls src/ui/*.js | grep -v '/shell\.js$' | sort)"
LOGICA="src/textos.js $CORE $TEMA $UI src/arranque.js"

script() { printf '<script>\n'; cat "$1"; printf '\n</script>\n'; }

mkdir -p "$SAIDA"
{
  sed "s/__APP_VERSION__/$APP_VERSION/g" src/base.html
  for l in "${LIBS[@]}"; do script "src/libs/$l"; done
  for f in $LOGICA; do script "$f"; done
  printf '</body>\n</html>\n'
} > "$HTML"
sed "s/__APP_VERSION__/$APP_VERSION/g" src/LEIA-ME.txt > "$SAIDA/LEIA-ME.txt"

# 2. guardas sobre o resultado
falha=0
g() { echo "✗ $1" >&2; falha=1; }
grep -q '__APP_VERSION__' "$HTML" && g 'ficou __APP_VERSION__ por substituir'
grep -Eq '<script[^>]*type="module"' "$HTML" && g 'há <script type="module">'
grep -Eq '<script[^>]*\ssrc=' "$HTML" && g 'há <script src=…> (código externo)'
grep -Eq '(^|[^a-zA-Z_$.])import\(' "$HTML" && g 'há import() dinâmico'
grep -Eq 'nsec1[023456789acdefghjklmnpqrstuvwxyz]{58}' "$HTML" && g 'TRIPWIRE: há uma nsec real no HTML'
abre=$(grep -o '<script' "$HTML" | wc -l); fecha=$(grep -o '</script>' "$HTML" | wc -l)
[ "$abre" = "$fecha" ] || g "tags <script> desbalanceadas: $abre abrem, $fecha fecham"
grep -q 'Content-Security-Policy' "$HTML" || g 'sem CSP'
[ "$falha" = 0 ] || exit 1

printf '%s  versão %s  %s bytes  sha256 %s\n' "$HTML" "$APP_VERSION" "$(stat -c%s "$HTML")" "$(sha256sum "$HTML" | cut -c1-64)"
