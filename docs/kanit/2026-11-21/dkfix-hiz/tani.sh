#!/bin/bash
# Fatura kartı GET tanısı: son kod (mut) ↔ iptal notunun kapsam metni kapalı (tA) ↔ inPlans kapalı (tB); aynı kopyada yalnız okuma, dönüşümlü 3 tur. ÖZEL kilit altında.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
D=$S/dkfix-ab23
OUT=$D/hiz/tani.txt
export HUKUK_LICENSE_URL=http://127.0.0.1:9 TZ=Europe/Istanbul
for t in tA tB; do
  rm -rf $D/$t && mkdir -p $D/$t && cp -a $D/mut/. $D/$t/ || exit 1
done
python3 -I -c "import sys; p=sys.argv[1]; s=open(p,encoding='utf-8').read(); a='planCancelText(row.planId), coverCancelText(row)]'; assert s.count(a)==1; open(p,'w',encoding='utf-8').write(s.replace(a,'planCancelText(row.planId)]'))" $D/tA/server/routes/invoices.mjs || exit 1
python3 -I -c "import sys; p=sys.argv[1]; s=open(p,encoding='utf-8').read(); a='inPlans: inPlansOf(row, state),'; assert s.count(a)==1; open(p,'w',encoding='utf-8').write(s.replace(a,'inPlans: [],'))" $D/tB/server/routes/invoices.mjs || exit 1
rm -rf $D/hiz/kopya && cp -a $S/ana-kabul/temiz-100k $D/hiz/kopya || exit 1
echo "TANI · başta $(cat /proc/loadavg)" > $OUT
for tur in 1 2 3; do
  for kod in mut tA tB; do
    echo "=== tur $tur · $kod · başta $(cat /proc/loadavg)" >> $OUT
    timeout 900 node --disable-warning=ExperimentalWarning $D/hiz/tani.mjs $D/$kod $D/hiz/kopya >> $OUT 2>&1
  done
done
rm -rf $D/hiz/kopya $D/tA $D/tB
echo "bitti $(cat /proc/loadavg)" >> $OUT
