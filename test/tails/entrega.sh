#!/usr/bin/env bash
# test/tails/entrega.sh — empacota o app montado numa ISO (rótulo M1) para a
# bancada Tails (02 §F: entrega por ISO com xorriso; o Tails automonta o DVD
# em /media/amnesia/<RÓTULO> quando anexado ANTES do arranque). Nada de chave
# entra aqui — só dist/nostermentor.html e o LEIA-ME.
#   uso: test/tails/entrega.sh [saida.iso]   (padrão: ~/VMs/tails-bancada/m1.iso)
set -euo pipefail
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
ISO="${1:-$HOME/VMs/tails-bancada/m1.iso}"
[ -f "$REPO/dist/nostermentor.html" ] || { echo "✗ falta dist/nostermentor.html (./monta_app.sh)" >&2; exit 1; }
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
mkdir -p "$T/nostermentor"
cp "$REPO/dist/nostermentor.html" "$REPO/dist/LEIA-ME.txt" "$T/nostermentor/"
xorriso -as mkisofs -quiet -r -J -volid M1 -o "$ISO" "$T" 2>/dev/null
printf '%s  %s bytes\n' "$ISO" "$(stat -c%s "$ISO")"
( cd "$T/nostermentor" && sha256sum nostermentor.html LEIA-ME.txt )
