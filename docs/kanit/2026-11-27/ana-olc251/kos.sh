#!/bin/bash
# ANA OTURUM ÖLÇÜM PENCERESİ (27.11; ders 15, 47, 52, 53 (a)): özel kilit ALTINDA çağrılır. Her koşu temiz-100k'nın TAZE kopyasında; sıra taban / yeni / yeni / taban.
SP=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad; O=$SP/olc251; OUT=$O/olcum.out
export HUKUK_LICENSE_URL=http://127.0.0.1:9
cd $O || exit 1
gecer() { awk -v l=$(cut -d' ' -f1 /proc/loadavg) 'BEGIN{print (l>2)?"· GEÇERSİZ (yük > 2)":"· geçerli"}'; }
kopya() { rm -rf "${O:?}/kopya" && cp -a $SP/ana-kabul/temiz-100k "$O/kopya" && sync; }
adim() { # ad kod betik args...
  local ad=$1 kod=$2; shift 2; kopya || exit 1
  echo "=== $ad · kod $kod ($(git -C $O/$kod rev-parse --short HEAD)) · başta $(cat /proc/loadavg) $(gecer) · $(date -u +%H:%M:%S)" >> $OUT
  timeout 1200 node --disable-warning=ExperimentalWarning "$@" >> $OUT 2>&1; echo "çıkış $? · sonda $(cat /proc/loadavg) $(gecer)" >> $OUT
}
for i in $(seq 1 30); do awk -v l=$(cut -d' ' -f1 /proc/loadavg) 'BEGIN{exit !(l<1.5)}' && break; sleep 20; done
echo "ÖLÇÜM PENCERESİ · nproc $(nproc) · başta $(cat /proc/loadavg) · $(date -u +%H:%M:%S)" > $OUT
for k in taban sinama sinama taban; do adim "Mİ değişen yollar" $k $O/olc-mi2.mjs $O/$k $O/kopya $k 5; done
for k in taban sinama sinama taban; do adim "Değersiz sınırı (şüpheli liste vb.)" $k $O/olc-m2.mjs $O/$k $O/kopya 5; done
for k in taban m1k m1k taban; do adim "KDV Özeti" $k $O/olc-kdv.mjs $O/$k $O/kopya 5; done
adim "Devir ön izlemesi H-1 (tur 4 kodu)" d3t4 $O/d3t4/test/devir-d3-hacim-tyk.mjs $O/d3t4 $O/kopya 2025-12-31 2026-10-08T12:00:00+03:00
rm -rf "${O:?}/kopya"
echo "bitti $(date -u +%H:%M:%S) · $(cat /proc/loadavg)" >> $OUT
