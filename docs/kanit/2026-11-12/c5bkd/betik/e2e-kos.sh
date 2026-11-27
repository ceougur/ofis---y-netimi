#!/bin/bash
# Ekran senaryoları (kanıtlı, sırayla; her biri süre sınırlı; yük kilidi paylaşımlı — kos.sh). Kullanım: e2e-kos.sh <ad öneki> <senaryo...>
cd /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5bkd-betik || exit 1
onek=$1; shift
for s in "$@"; do
  bash kos.sh "$onek-$s" UTC 20 node --disable-warning=ExperimentalWarning "test/e2e/$s.mjs" | tail -2
done
echo BITTI
