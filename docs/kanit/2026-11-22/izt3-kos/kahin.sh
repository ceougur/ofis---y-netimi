#!/bin/bash
# İzt3 kâhin ↔ program iki TZ (cari + defter) ve yapım aşaması listesi (kendi kopyada; depodaki YAPIM-ASAMASI.json'a dokunulmaz). Her koşu kendi paylaşılan kilidiyle, en çok 40 dk.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
D=$S/izt3-ae8/kahin
TAG=${1:-1}
mkdir -p $D
cd /home/user/ofis---y-netimi/.claude/worktrees/agent-ae8c8568d72566f15 || exit 1
export HUKUK_LICENSE_URL=http://127.0.0.1:9
echo "kâhin $TAG · commit $(git log --oneline -1 | cut -c1-9) · $(date -u +%H:%M:%S)" > $D/kahin$TAG-ozet.txt
for tz in UTC Europe/Istanbul; do
  t=$(echo $tz | tr '/' '-')
  TZ=$tz flock -s -w 3600 $S/olcum.lock timeout -k 5 2400 node --disable-warning=ExperimentalWarning test/bagimsiz/cari/kos.mjs > $D/kahin$TAG-cari-$t.out 2>&1
  echo "cari $tz çıkış $? $(date -u +%H:%M:%S) $(tail -3 $D/kahin$TAG-cari-$t.out | tr '\n' ' ' | cut -c1-400)" >> $D/kahin$TAG-ozet.txt
  TZ=$tz flock -s -w 3600 $S/olcum.lock timeout -k 5 2400 node --disable-warning=ExperimentalWarning test/bagimsiz/defter/kos.mjs > $D/kahin$TAG-defter-$t.out 2>&1
  echo "defter $tz çıkış $? $(date -u +%H:%M:%S) $(tail -3 $D/kahin$TAG-defter-$t.out | tr '\n' ' ' | cut -c1-400)" >> $D/kahin$TAG-ozet.txt
done
cp test/bagimsiz/cari/YAPIM-ASAMASI.json $D/yapim$TAG.json
TZ=UTC KAHIN_YAPIM_ASAMASI=$D/yapim$TAG.json flock -s -w 3600 $S/olcum.lock timeout -k 5 2400 node --disable-warning=ExperimentalWarning test/bagimsiz/cari/kos.mjs --yapim-asamasi-yaz > $D/kahin$TAG-yapim.out 2>&1
echo "yapim çıkış $? $(date -u +%H:%M:%S) $(tail -3 $D/kahin$TAG-yapim.out | tr '\n' ' ' | cut -c1-400)" >> $D/kahin$TAG-ozet.txt
cmp -s test/bagimsiz/cari/YAPIM-ASAMASI.json $D/yapim$TAG.json && echo "yapım listesi: depodakiyle BİREBİR" >> $D/kahin$TAG-ozet.txt || echo "yapım listesi: FARKLI (diff $D/yapim$TAG.json)" >> $D/kahin$TAG-ozet.txt
git status -s test/bagimsiz >> $D/kahin$TAG-ozet.txt
echo bitti >> $D/kahin$TAG-ozet.txt
