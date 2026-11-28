#!/bin/bash
# 28.11 hız kabulü (ders 47, 53 (a)): KDV Özeti küçük tur 5 — taban (kdv-a = t251-m1k-taban kopyası) ↔ tur 5 (m1k5yk/yeni); her ölçüm taze temiz-100k kopyasında; özel kilit altında koşulur.
SP=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad; O=$SP/olc28; OUT=$O/olcum-kdv5.out
export HUKUK_LICENSE_URL=http://127.0.0.1:9
cd $O || exit 1
echo "OLCUM KDV5 28.11 · nproc $(nproc) · başta $(cat /proc/loadavg) · $(date -u +%H:%M:%S)" > $OUT
m() { k=$1; rm -rf "${O:?}/v"; cp -a $SP/ana-kabul/temiz-100k $O/v && sync || exit 1; l0=$(cut -d' ' -f1 /proc/loadavg)
  echo "=== KDV Özeti · $k ($(git -C $k rev-parse --short HEAD)) · başta $(cat /proc/loadavg) $(awk -v l=$l0 'BEGIN{print (l>2)?"· GEÇERSİZ (yük > 2)":""}')" >> $OUT
  timeout 1200 node --disable-warning=ExperimentalWarning $SP/olc251/olc-kdv.mjs $k $O/v 5 >> $OUT 2>&1; echo "çıkış $? · sonda $(cat /proc/loadavg)" >> $OUT; }
for k in $O/kdv-a $SP/m1k5yk/yeni $O/kdv-a $SP/m1k5yk/yeni; do m $k; done
rm -rf "${O:?}/v"
echo "bitti $(date -u +%H:%M:%S) · $(cat /proc/loadavg)" >> $OUT
