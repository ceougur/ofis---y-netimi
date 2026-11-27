#!/bin/bash
# İzleyen tur 4 komşu taraması (ders 10): test/ taramasıyla seçilen dosyalar iki saat diliminde, kanit.mjs kos ile.
# Kullanım: bash komsu.sh <ek_ad>   (çıktılar docs/kanit/2026-11-22/izt4-komsu-<ek>-<tz>.*)
cd /home/user/ofis---y-netimi/.claude/worktrees/agent-ad3ee8a705a609628 || exit 1
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/izt4-ad3
EK=${1:-1}
mapfile -t FILES < $N/komsu-liste.txt
for tz in UTC Europe/Istanbul; do
  t=$(echo $tz | tr '/' '-' | tr 'A-Z' 'a-z')
  echo "== $tz $(date -u +%H:%M:%S) yük $(cat /proc/loadavg)" >> $N/komsu-$EK.log
  TZ=$tz HUKUK_LICENSE_URL=http://127.0.0.1:9 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/pw-1194 \
    node tools/kanit.mjs kos izt4-komsu-$EK-$t -- node --disable-warning=ExperimentalWarning --test --test-concurrency=1 "${FILES[@]}" > $N/komsu-$EK-$t.out 2>&1
  echo "$tz rc=$? $(date -u +%H:%M:%S)" >> $N/komsu-$EK.log
  grep -E "^# (tests|pass|fail|cancelled|skipped|todo)" $N/komsu-$EK-$t.out >> $N/komsu-$EK.log
done
echo BITTI >> $N/komsu-$EK.log
