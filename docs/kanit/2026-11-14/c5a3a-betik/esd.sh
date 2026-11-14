#!/bin/bash
# Ç5-A tur 3a kabul A: taban ↔ yeni dökümü AYNI veri kaynağının iki taze kopyasında. Kullanım: bash esd.sh <ad> <veri kaynağı klasörü (data/, backups/)> [şimdi]
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
N=$S/c5a3a-t1
AD=$1; KAYNAK=$2; SIMDI=${3:-2026-10-08T12:00:00+03:00}
[ -n "$AD" ] && [ -d "$KAYNAK/data" ] || { echo "kullanım: esd.sh <ad> <kaynak> [şimdi]"; exit 2; }
export HUKUK_LICENSE_URL=http://127.0.0.1:9
YENI=/home/user/ofis---y-netimi/.claude/worktrees/agent-a068d42a7b77ba335
mkdir -p $N/esd || exit 1
echo "esd $AD · kaynak $KAYNAK · şimdi $SIMDI · başta $(cat /proc/loadavg) · $(date -u +%H:%M:%S)"
for KOD in taban yeni; do
  ROOT=$N/taban; [ $KOD = yeni ] && ROOT=$YENI
  KOPYA=/dev/shm/c5a3a-esd-$AD-$KOD
  rm -rf "$KOPYA" && cp -a "$KAYNAK" "$KOPYA" || exit 1
  s=$(date +%s)
  timeout -k 5 3000 node --disable-warning=ExperimentalWarning $N/betik/dok.mjs "$ROOT" "$KOPYA" $N/esd/$AD-$KOD.jsonl "$SIMDI" > $N/esd/$AD-$KOD.ozet 2>&1
  echo "$KOD çıkış $? · $(( $(date +%s) - s )) sn · $(tail -1 $N/esd/$AD-$KOD.ozet)"
  rm -rf "$KOPYA"
done
if cmp -s $N/esd/$AD-taban.jsonl $N/esd/$AD-yeni.jsonl; then echo "SONUÇ $AD: BAYT BAYT AYNI ($(wc -l < $N/esd/$AD-yeni.jsonl) satır; sha256 $(sha256sum < $N/esd/$AD-yeni.jsonl | cut -c1-16))"; else echo "SONUÇ $AD: FARK VAR"; cmp $N/esd/$AD-taban.jsonl $N/esd/$AD-yeni.jsonl | head -3; fi
echo "sonda $(cat /proc/loadavg) · $(date -u +%H:%M:%S)"
