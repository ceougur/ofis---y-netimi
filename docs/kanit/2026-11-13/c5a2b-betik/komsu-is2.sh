#!/bin/bash
# Ç5-A tur 2b İş 2 — G2 komşuları (ders 10; taramayla) iki TZ + etkilenen ekran senaryoları. Her dosya kanit.mjs kos ile.
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a5b6e29fe068192ef
D=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a2b-q4
K=$D/kanit/komsu-is2
mkdir -p $K
cd $W || exit 1
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$K PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/pw-1194
for tz in UTC Europe/Istanbul; do
  tag=$(echo $tz | tr / -)
  TZ=$tz timeout -k 5 3000 node tools/kanit.mjs kos c5a2b-komsu-$tag -- node --test --test-concurrency=2 $(cat $D/komsu-is2.txt | tr '\n' ' ') > $K/komsu-$tag.txt 2>&1
  echo "komsu $tz exit=$?" >> $K/ozet.txt
  grep -E '^# (tests|pass|fail|cancelled|skipped|todo)' $K/komsu-$tag.txt >> $K/ozet.txt
done
for s in senaryo-kasa-acilis-uyari-250 senaryo-donem-kilidi-ilerleme-250 senaryo-226 senaryo-213 senaryo-211; do
  TZ=Europe/Istanbul timeout -k 5 900 node test/e2e/$s.mjs > $K/e2e-$s.txt 2>&1
  echo "$s exit=$? $(grep -E '^# (pass|fail)' $K/e2e-$s.txt | tr '\n' ' ')" >> $K/ozet.txt
done
TZ=UTC timeout -k 5 900 node test/e2e/senaryo-acilis-duzeni-250.mjs > $K/e2e-acilis-duzeni-utc.txt 2>&1
echo "senaryo-acilis-duzeni-250 UTC exit=$? $(grep -E '^# (pass|fail)' $K/e2e-acilis-duzeni-utc.txt | tr '\n' ' ')" >> $K/ozet.txt
DEPO=$D/taban TZ=Europe/Istanbul timeout -k 5 900 node test/e2e/senaryo-acilis-duzeni-250.mjs > $K/e2e-acilis-duzeni-taban.txt 2>&1
echo "senaryo-acilis-duzeni-250 TABAN exit=$? $(grep -E '^# (pass|fail)' $K/e2e-acilis-duzeni-taban.txt | tr '\n' ' ')" >> $K/ozet.txt
echo BITTI >> $K/ozet.txt
