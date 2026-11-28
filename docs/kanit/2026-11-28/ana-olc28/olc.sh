#!/bin/bash
# 28.11 hız kabulü (ders 47, 53 (a)): KDV küçük tur 1–4 (taban ↔ m1k4), Değersiz sınırı (tur 1 öncesi ↔ tur 1 ↔ tur 3), D3 tur 6 (taban ↔ tur 6); her ölçüm taze 100 bin kopyasında. Özel kilit altında.
SP=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad; O=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olc28; OUT=$O/olcum.out
export HUKUK_LICENSE_URL=http://127.0.0.1:9
cd $O || exit 1
for i in $(seq 1 30); do awk -v l=$(cut -d' ' -f1 /proc/loadavg) 'BEGIN{exit !(l<1.5)}' && break; sleep 20; done
echo "OLCUM 28.11 · nproc $(nproc) · başta $(cat /proc/loadavg) · $(date -u +%H:%M:%S)" > $OUT
m() { b=$1; k=$2; n=$3; rm -rf "${O:?}/v"; cp -a $SP/ana-kabul/temiz-100k $O/v && sync || exit 1; l0=$(cut -d' ' -f1 /proc/loadavg)
  echo "=== $b · $k ($(git -C $O/$k rev-parse --short HEAD)) · başta $(cat /proc/loadavg) $(awk -v l=$l0 'BEGIN{print (l>2)?"· GEÇERSİZ (yük > 2)":""}')" >> $OUT
  timeout 1200 node --disable-warning=ExperimentalWarning $b $O/$k $O/v $n >> $OUT 2>&1; echo "çıkış $? · sonda $(cat /proc/loadavg)" >> $OUT; }
# KDV: küçük tur 5 sonrasına (dar kontrol ORTA-1)
for k in m2-a m2-b m2-c m2-a m2-b m2-c; do m $SP/olc251/olc-m2.mjs $k 5; done
for k in d3-a d3-b d3-a d3-b; do m $O/olc-devir.mjs $k 3; done
rm -rf "${O:?}/v"
for k in m2-b m2-c; do bash $SP/ana-kabul/betik/kabul.sh $O/$k $O/kabul-$k.out; done
echo "bitti $(date -u +%H:%M:%S) · $(cat /proc/loadavg)" >> $OUT
