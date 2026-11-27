#!/bin/bash
# Kötüleşen iki yolun ayrıştırılması: taban ↔ Mİ tur 2 (yalnız), taban ↔ Değersiz sınırı (yalnız); 20 çift ABBA, ayrı veri kopyaları. Özel kilit altında.
SP=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad; O=$SP/olc251; OUT=$O/olcum-ab.out
export HUKUK_LICENSE_URL=http://127.0.0.1:9
cd $O || exit 1
for i in $(seq 1 30); do awk -v l=$(cut -d' ' -f1 /proc/loadavg) 'BEGIN{exit !(l<1.5)}' && break; sleep 20; done
echo "AYRIŞTIRMA · başta $(cat /proc/loadavg) · $(date -u +%H:%M:%S)" > $OUT
for y in mi2 m2 sinama; do
  rm -rf "${O:?}/va" "${O:?}/vb"; cp -a $SP/ana-kabul/temiz-100k $O/va && cp -a $SP/ana-kabul/temiz-100k $O/vb && sync || exit 1
  echo "=== taban ↔ $y ($(git -C $O/$y rev-parse --short HEAD)) · başta $(cat /proc/loadavg)" >> $OUT
  timeout 1200 node --disable-warning=ExperimentalWarning $O/olc-ab.mjs $O/taban $O/va $O/$y $O/vb 20 >> $OUT 2>&1; echo "çıkış $? · sonda $(cat /proc/loadavg)" >> $OUT
done
rm -rf "${O:?}/va" "${O:?}/vb"
echo "bitti $(date -u +%H:%M:%S)" >> $OUT
