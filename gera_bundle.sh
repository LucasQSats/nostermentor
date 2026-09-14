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
# O esbuild resolve `nostr-tools/...` a partir da pasta do ARQUIVO DE ENTRADA,
# e as dependencias vivem no scratchpad (02 §F: nunca nesta pasta). Por isso a
# entrada e copiada para la e o bundle e gerado de la — chamar o esbuild com
# `src/libs/entrada.js` falha com "Could not resolve nostr-tools/pure".
# Provado em 2026-09-12: com a entrada antiga, este caminho reproduz o bundle
# de 2026-08-26 byte a byte (35.809 B, sha256 bbc120ac…).
cp src/libs/entrada.js "$SCRATCH/entrada.js"
( cd "$SCRATCH" && ./node_modules/.bin/esbuild entrada.js --bundle --format=iife --global-name=NT \
    --minify --target=es2020 --outfile=saida.js )
cp "$SCRATCH/saida.js" src/libs/nostr-tools.inline.js
printf 'src/libs/nostr-tools.inline.js  %s bytes  sha256 %s\n' "$(stat -c%s src/libs/nostr-tools.inline.js)" "$(sha256sum src/libs/nostr-tools.inline.js | cut -c1-64)"
( cd src/libs && sha256sum --quiet -c SHA256SUMS ) && echo "✓ bate com SHA256SUMS" || { echo "✗ NÃO bate com SHA256SUMS (VERSOES.md)" >&2; exit 1; }
