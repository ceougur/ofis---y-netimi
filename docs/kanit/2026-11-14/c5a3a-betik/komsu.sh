#!/bin/bash
# Ç5-A tur 3a kabul D: değiştirilen dosyaları adıyla / API yoluyla anan BÜTÜN testler (komsu.txt; tarama) iki saat diliminde, yeni kodda. Kullanım: flock -s -n <olcum.lock> bash komsu.sh
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a3a-t1
cd /home/user/ofis---y-netimi/.claude/worktrees/agent-a068d42a7b77ba335 || exit 1
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$N/kanit
echo "başta $(cat /proc/loadavg) $(date -u +%H:%M:%S) · $(wc -l < $N/komsu.txt) dosya"
for Z in UTC Europe/Istanbul; do
  TZ=$Z timeout -k 5 3300 node tools/kanit.mjs kos c5a3a-komsu-${Z#*/} -- node --disable-warning=ExperimentalWarning --test --test-concurrency=1 $(cat $N/komsu.txt) > $N/komsu-${Z#*/}.out 2>&1
  echo "$Z çıkış $? · $(tail -1 $N/komsu-${Z#*/}.out)"
done
echo "sonda $(cat /proc/loadavg) $(date -u +%H:%M:%S)"
