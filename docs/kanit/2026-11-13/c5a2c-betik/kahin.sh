#!/bin/bash
# Kâhin koşuları (kabul A, B): defter yeni (iki TZ) + taban İstanbul; cari taban + yeni; yapım aşaması listesi kendi kopyada yeniden üretilir.
Q=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a2c-q
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-abcc7bb2b583ce32f
K=$Q/kanit
export HUKUK_LICENSE_URL=http://127.0.0.1:9
cd "$W" || exit 1
for zone in UTC Europe/Istanbul; do
  n=$(echo "$zone" | tr '/' '-')
  TZ=$zone KANIT_DIR=$K node tools/kanit.mjs kos c5a2c-kahin-defter-yeni-$n -- npm run test:kahin-defter > $K/kahin-defter-yeni-$n.txt 2>&1
done
cd "$Q/taban" || exit 1
TZ=Europe/Istanbul npm run test:kahin-defter > $K/kahin-defter-taban-Europe-Istanbul.txt 2>&1; echo "cikis=$?" >> $K/kahin-defter-taban-Europe-Istanbul.txt
TZ=Europe/Istanbul npm run test:kahin-cari > $K/kahin-cari-taban.txt 2>&1; echo "cikis=$?" >> $K/kahin-cari-taban.txt
cd "$W" || exit 1
TZ=Europe/Istanbul KANIT_DIR=$K node tools/kanit.mjs kos c5a2c-kahin-cari-yeni -- npm run test:kahin-cari > $K/kahin-cari-yeni.txt 2>&1
cp test/bagimsiz/cari/YAPIM-ASAMASI.json $Q/yapim-once.json
cp test/bagimsiz/cari/YAPIM-ASAMASI.json $Q/yapim-sonra.json
TZ=Europe/Istanbul KAHIN_YAPIM_ASAMASI=$Q/yapim-sonra.json node --disable-warning=ExperimentalWarning test/bagimsiz/cari/kos.mjs --yapim-asamasi-yaz > $K/kahin-cari-yapim-yaz.txt 2>&1; echo "cikis=$?" >> $K/kahin-cari-yapim-yaz.txt
echo BITTI > $K/kahin-bitti.txt
