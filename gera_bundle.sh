#!/usr/bin/env bash
# gera_bundle.sh — regenera src/libs/nostr-tools.inline.js (IIFE, global NT)
# com as versões FIXADAS em package.json + package-lock.json. As dependências
# são instaladas no scratchpad, nunca nesta pasta (02 §F). O resultado tem de
# bater com src/libs/SHA256SUMS — se não bater, é decisão a registrar em 11.
set -euo pipefail
cd "$(dirname "$0")"
SCRATCH="${NOSTERMENTOR_SCRATCH:-${TMPDIR:-/tmp}/nostermentor-dev}/bundle"
mkdir -p "$SCRATCH"
cp package.json package-lock.json "$SCRATCH/"
( cd "$SCRATCH" && npm ci --no-audit --no-fund >/dev/null )
"$SCRATCH/node_modules/.bin/esbuild" src/libs/entrada.js --bundle --format=iife --global-name=NT \
    --minify --target=es2020 --outfile=src/libs/nostr-tools.inline.js
printf 'src/libs/nostr-tools.inline.js  %s bytes  sha256 %s\n' "$(stat -c%s src/libs/nostr-tools.inline.js)" "$(sha256sum src/libs/nostr-tools.inline.js | cut -c1-64)"
( cd src/libs && sha256sum --quiet -c SHA256SUMS ) && echo "✓ bate com SHA256SUMS" || { echo "✗ NÃO bate com SHA256SUMS (VERSOES.md)" >&2; exit 1; }
