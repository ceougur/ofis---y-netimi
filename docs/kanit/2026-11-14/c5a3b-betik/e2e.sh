#!/bin/bash
# Ç5-A tur 3b kabul F: ci.yml'deki e2e adlarından cari VE taksit / iade yoluna dokunanlar (e2e-sec.py taraması; 'tyk' geçen dahil) + adı iade / kart / kayıt bağı olan dört senaryo.
# Kullanım: flock -s -n <olcum.lock> bash e2e.sh <parça: 1|2>
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a3b-z4
cd /home/user/ofis---y-netimi/.claude/worktrees/agent-a076afd863444806e || exit 1
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$N/kanit PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/pw-1194
LIST=$(python3 -I $N/betik/e2e-sec.py . $N/ci-e2e.txt 2>/dev/null)
LIST="$LIST test:senaryo-kart-iade-gecmis-250 test:senaryo-iade-246 test:senaryo-tahsile-ver-220 test:senaryo-kayit-bag-31e"
set -- $LIST
ALL=("$@"); HALF=$(( (${#ALL[@]} + 1) / 2 ))
if [ "$PARCA" = 2 ]; then SEL=("${ALL[@]:$HALF}"); else SEL=("${ALL[@]:0:$HALF}"); fi
echo "parça ${PARCA:-1} · ${#SEL[@]} / ${#ALL[@]} senaryo · başta $(cat /proc/loadavg) $(date -u +%H:%M:%S)"
for S in "${SEL[@]}"; do
  AD=${S#test:}
  timeout -k 5 900 node tools/kanit.mjs kos c5a3b-e2e-$AD -- npm run -s $S > $N/e2e-$AD.out 2>&1
  echo "$AD çıkış $? · $(tail -1 $N/e2e-$AD.out | cut -c1-200)"
done
echo "sonda $(cat /proc/loadavg) $(date -u +%H:%M:%S)"
