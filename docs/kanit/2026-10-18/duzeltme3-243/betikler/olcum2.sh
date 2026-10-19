#!/bin/bash
set -uo pipefail
S=/tmp/claude-0/-home-user/9cd0e60e-f0c5-5d7d-bc4f-899fff43162d/scratchpad
export HUKUK_LICENSE_URL=http://127.0.0.1:9
for spec in "duzeltme3-243 1500 5000" "duzeltme3-243-eski-d64ebf8 1500 5000" "duzeltme3-243 1500 0"; do
  set -- $spec
  echo "== $1 N=$2 R=$3 ($(date -u +%H:%M:%S))"
  timeout 1500 node --disable-warning=ExperimentalWarning $S/dar2-243-betikler/d2-maliyet.mjs $S/$1 $2 $3 2>&1 | grep -v -i warning
  echo "çıkış=$?"
done
