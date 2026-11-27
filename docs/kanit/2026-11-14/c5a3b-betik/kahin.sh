#!/bin/bash
# Ç5-A tur 3b kabul C: kâhin ↔ program (defter, cari) taban ↔ yeni + yapım aşaması listesinin kendi kopyada yeniden üretimi. Kullanım: flock -s -n <olcum.lock> bash kahin.sh
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a3b-z4
YENI=/home/user/ofis---y-netimi/.claude/worktrees/agent-a076afd863444806e
export HUKUK_LICENSE_URL=http://127.0.0.1:9
mkdir -p $N/kahin || exit 1
echo "başta $(cat /proc/loadavg) $(date -u +%H:%M:%S)"
for KOD in taban yeni; do
  ROOT=$N/taban; [ $KOD = yeni ] && ROOT=$YENI
  for K in defter cari; do
    (cd $ROOT && timeout -k 5 3000 npm run -s test:kahin-$K > $N/kahin/$KOD-$K.out 2>&1); echo "$KOD $K çıkış $? · $(grep -E 'denetim geçti|YAPIM AŞAMASI|SONUÇ|# pass|# fail' $N/kahin/$KOD-$K.out | tail -4 | tr '\n' ' ' | cut -c1-400)"
  done
done
cp $YENI/test/bagimsiz/cari/YAPIM-ASAMASI.json $N/kahin/YAPIM-kopya.json || exit 1
(cd $YENI && KAHIN_YAPIM_ASAMASI=$N/kahin/YAPIM-kopya.json timeout -k 5 3000 node --disable-warning=ExperimentalWarning test/bagimsiz/cari/kos.mjs --yapim-asamasi-yaz > $N/kahin/yapim-yaz.out 2>&1); echo "yapım yaz çıkış $?"
if cmp -s $YENI/test/bagimsiz/cari/YAPIM-ASAMASI.json $N/kahin/YAPIM-kopya.json; then echo "YAPIM AŞAMASI: FARKSIZ"; else echo "YAPIM AŞAMASI: FARK VAR"; diff <(python3 -I -m json.tool $YENI/test/bagimsiz/cari/YAPIM-ASAMASI.json) <(python3 -I -m json.tool $N/kahin/YAPIM-kopya.json) | head -20; fi
(cd $YENI && git status -s test/bagimsiz | head -3)
echo "sonda $(cat /proc/loadavg) $(date -u +%H:%M:%S)"
