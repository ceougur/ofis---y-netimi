#!/bin/bash
# Kâhin ↔ program iki TZ (cari + defter) ve yapım aşaması listesi (kendi kopyada). Paylaşılan kilit; her koşu en çok 40 dk.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
D=$S/izt-a68
cd /home/user/ofis---y-netimi/.claude/worktrees/agent-a685ea99951e1d5f9 || exit 1
export HUKUK_LICENSE_URL=http://127.0.0.1:9
for tz in UTC Europe/Istanbul; do
  t=$(echo $tz | tr '/' '-')
  TZ=$tz flock -s -w 3600 $S/olcum.lock timeout -k 5 2400 node --disable-warning=ExperimentalWarning test/bagimsiz/cari/kos.mjs > $D/kahin-cari-$t.out 2>&1
  echo "cari $tz çıkış $? $(date -u +%H:%M:%S)" >> $D/kahin-ozet.txt
  TZ=$tz flock -s -w 3600 $S/olcum.lock timeout -k 5 2400 node --disable-warning=ExperimentalWarning test/bagimsiz/defter/kos.mjs > $D/kahin-defter-$t.out 2>&1
  echo "defter $tz çıkış $? $(date -u +%H:%M:%S)" >> $D/kahin-ozet.txt
done
cp test/bagimsiz/cari/YAPIM-ASAMASI.json $D/yapim-yeni.json
TZ=UTC KAHIN_YAPIM_ASAMASI=$D/yapim-yeni.json flock -s -w 3600 $S/olcum.lock timeout -k 5 2400 node --disable-warning=ExperimentalWarning test/bagimsiz/cari/kos.mjs --yapim-asamasi-yaz > $D/kahin-yapim.out 2>&1
echo "yapim çıkış $? $(date -u +%H:%M:%S)" >> $D/kahin-ozet.txt
