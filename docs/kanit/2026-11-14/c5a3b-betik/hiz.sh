#!/bin/bash
# Ç5-A tur 3b kabul E: hız taban ↔ yeni, temiz 100 bin satırın TAZE kopyası (her koşuda), 5 tekrar, sıra taban → yeni → taban → yeni (iki ölçüm çifti).
# Kullanım: flock -x -n <olcum.lock> bash hiz.sh   (yük > 2 ise o koşu GEÇERSİZ yazılır)
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a3b-z4
YENI=/home/user/ofis---y-netimi/.claude/worktrees/agent-a076afd863444806e
KAYNAK=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/ana-kabul/temiz-100k
export HUKUK_LICENSE_URL=http://127.0.0.1:9
mkdir -p $N/hiz || exit 1
echo "başta $(cat /proc/loadavg) $(date -u +%H:%M:%S) · nproc $(nproc)"
i=0
for KOD in taban yeni taban yeni; do
  i=$((i+1)); ROOT=$N/taban; [ $KOD = yeni ] && ROOT=$YENI
  KOPYA=/dev/shm/c5a3b-hiz-$KOD
  rm -rf "$KOPYA" && cp -a "$KAYNAK" "$KOPYA" || exit 1
  sync; l0=$(cut -d' ' -f1 /proc/loadavg)
  timeout -k 5 1800 node --disable-warning=ExperimentalWarning $N/betik/olc.mjs "$ROOT" "$KOPYA" 5 $N/hiz/$i-$KOD.json > $N/hiz/$i-$KOD.ozet 2>&1
  echo "$i $KOD çıkış $? · başta yük $l0 $(awk -v l=$l0 'BEGIN{print (l>2)?"· GEÇERSİZ (yük > 2)":""}') · $(tail -1 $N/hiz/$i-$KOD.ozet)"
  rm -rf "$KOPYA"
done
echo "sonda $(cat /proc/loadavg) $(date -u +%H:%M:%S)"
