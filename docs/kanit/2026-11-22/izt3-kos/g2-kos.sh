#!/bin/bash
# İzt3 G2 komşu taraması: g2-liste.txt'teki test dosyaları, iki saat diliminde, kod = ajan ağacı (son commit). Paylaşılan kilit çağıranda (flock -s).
# Kullanım: bash g2-kos.sh <ek>
E=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/izt3-ae8
K=/home/user/ofis---y-netimi/.claude/worktrees/agent-ae8c8568d72566f15
EK=${1:-1}
cd $K || exit 1
export HUKUK_LICENSE_URL=http://127.0.0.1:9
for tz in UTC Europe/Istanbul; do
  out=$E/g2-$EK-${tz//\//-}.txt
  echo "G2 $tz · commit $(git log --oneline -1 | cut -c1-9) · $(date -u +%H:%M:%S) · yük $(cat /proc/loadavg)" > $out.bas
  TZ=$tz timeout -k 5 3500 node --disable-warning=ExperimentalWarning --test --test-concurrency=1 $(cat $E/g2-liste.txt) > $out 2>&1
  echo "çıkış $? · $(date -u +%H:%M:%S)" >> $out.bas
  { cat $out.bas; grep -E '^# (tests|suites|pass|fail|cancelled|skipped|todo|duration_ms)' $out; grep -E '^not ok' $out | head -20; } > $E/g2-$EK-${tz//\//-}-ozet.txt
done
echo bitti > $E/g2-$EK.bitti
