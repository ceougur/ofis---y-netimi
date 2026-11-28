#!/bin/bash
# 28.11 hız kabulü (ders 47, 52, 53 (a)) — KDV tur 5 (kdv-a ↔ m1k5yk/yeni) + Değersiz tur 4 (t251-m2t4-taban ↔ t251-m2t4: Silinenler'li Mutabakat / tahsilat yazımı + genel kabul); özel kilit altında.
SP=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad; R=$SP/m2t4yk; O=$SP/olc28
export HUKUK_LICENSE_URL=http://127.0.0.1:9 TZ=UTC
echo "OLCUM 28.11 · başta $(cat /proc/loadavg) · $(date -u +%H:%M:%S)" > $R/ham/olcum.out
bash $O/olc-kdv5.sh; echo "kdv5 bitti $(date -u +%H:%M:%S) · $(cat /proc/loadavg)" >> $R/ham/olcum.out
for k in eski yeni eski yeni; do for a in "5000 10" "20000 1"; do
  echo "### h-olcum $k $a · başta $(cat /proc/loadavg)" >> $R/ham/olcum.out
  timeout 1800 node --disable-warning=ExperimentalWarning $SP/dk-m2t3/h-olcum.mjs $R/$k $a >> $R/ham/olcum.out 2>&1; echo "cikis $?" >> $R/ham/olcum.out
done; done
for k in eski yeni; do bash $SP/ana-kabul/betik/kabul.sh $R/$k $R/ham/kabul-$k.out; done
echo "### d-oneri-ret yeni" >> $R/ham/olcum.out; timeout 600 node --disable-warning=ExperimentalWarning $SP/dk-m2t3/d-oneri-ret.mjs $R/yeni >> $R/ham/olcum.out 2>&1
echo "BITTI $(date -u +%H:%M:%S) · $(cat /proc/loadavg)" >> $R/ham/olcum.out
