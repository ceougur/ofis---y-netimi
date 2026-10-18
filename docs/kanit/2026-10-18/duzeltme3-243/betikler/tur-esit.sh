#!/bin/bash
S=/tmp/claude-0/-home-user/9cd0e60e-f0c5-5d7d-bc4f-899fff43162d/scratchpad
export HUKUK_LICENSE_URL=http://127.0.0.1:9 ORTAK=$S/dar2-243-betikler/ortak.mjs
for r in duzeltme3-243 duzeltme3-243-eski-d64ebf8 duzeltme3-243 duzeltme3-243-eski-d64ebf8; do
  echo "== $r ($(date -u +%H:%M:%S))"
  flock $S/e2e-243.lock timeout 1500 node --disable-warning=ExperimentalWarning $S/duzeltme3-243-betikler/tur-esit.mjs $S/$r 1500 600 2>&1 | grep -v -i warning
  echo "çıkış=${PIPESTATUS[0]}"
done
echo BITTI
