#!/bin/bash
set -uo pipefail
cd /tmp/claude-0/-home-user/9cd0e60e-f0c5-5d7d-bc4f-899fff43162d/scratchpad/hiz-fatura
export KLASOR=$PWD/tam
exec 9>/tmp/claude-0/-home-user/9cd0e60e-f0c5-5d7d-bc4f-899fff43162d/scratchpad/hiz-fatura/olcum.lock
flock -n 9 || { echo "başka ölçüm koşuyor"; exit 1; }
for spec in "D1 5 0" "D2 8 2" "D3 5 15"; do
  set -- $spec
  node --disable-warning=ExperimentalWarning hiz.mjs duzey $1 $2 $3 600 11 > kosu-$1.log 2>&1
  echo "$1 çıkış $?" >> kosu-ozet.log
done
echo HEPSI BITTI >> kosu-ozet.log
