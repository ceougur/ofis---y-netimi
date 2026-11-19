#!/bin/bash
# Ç5-A tur 3a kabul F: TYK ekran senaryosu (ci.yml'de adı 'tyk' geçen) + cari / taksit / fatura akışlarına dokunan senaryolar (ci.yml adlarından taramayla). Kullanım: flock -s -n <olcum.lock> bash e2e.sh
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a3a-t1
cd /home/user/ofis---y-netimi/.claude/worktrees/agent-a068d42a7b77ba335 || exit 1
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$N/kanit PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/pw-1194
echo "başta $(cat /proc/loadavg) $(date -u +%H:%M:%S)"
for S in senaryo-tyk-tur2a-250 senaryo-cari-243 senaryo-cari-vade-245 senaryo-fatura-243 senaryo-kayit-tahsilat-244 senaryo-tahsile-ver-220 senaryo-supheli-230 senaryo-ux18-244 senaryo-kart-iade-gecmis-250 senaryo-duzeltme-kilidi-250 senaryo-219; do
  timeout -k 5 900 node tools/kanit.mjs kos c5a3a-e2e-$S -- npm run -s test:$S > $N/e2e-$S.out 2>&1
  echo "$S çıkış $? · $(tail -1 $N/e2e-$S.out | cut -c1-200)"
done
echo "sonda $(cat /proc/loadavg) $(date -u +%H:%M:%S)"
