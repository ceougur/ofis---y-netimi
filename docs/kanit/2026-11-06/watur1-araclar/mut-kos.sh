#!/bin/bash
# WhatsApp tur 1 mutasyon koşusu: her mutasyon için tur1 + WE testleri (TZ=UTC) mutasyon kopyasında; sonra geri alınır. Sonuç: mutasyon başına pass/fail + kırmızı hücreler.
NOT=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
MUT=$NOT/watur1-mut-af9c74c0
OUT=$NOT/watur1-betik/mut
mkdir -p $OUT
cd $MUT || exit 1
export HUKUK_LICENSE_URL=http://127.0.0.1:9
for m in $(node $NOT/watur1-betik/mut.mjs list); do
  [ "$m" = "M14-bos-belirtec-gorunur" ] && continue
  node $NOT/watur1-betik/mut.mjs apply $m || { echo "$m UYGULANAMADI"; continue; }
  TZ=UTC timeout 900 node --test --test-concurrency=1 test/whatsapp-tur1-bildirim-yolu-250.test.mjs test/whatsapp-we-webhook-bilgisi-250.test.mjs > $OUT/$m.txt 2>&1
  c=$?
  node $NOT/watur1-betik/mut.mjs restore $m
  p=$(grep -E "^# pass" $OUT/$m.txt | awk '{print $3}'); f=$(grep -E "^# fail" $OUT/$m.txt | awk '{print $3}')
  red=$(grep -E "^\s+not ok [0-9]+ - (T1|WE)-[0-9]+" $OUT/$m.txt | sed -E 's/^\s+not ok [0-9]+ - ((T1|WE)-[0-9]+).*/\1/' | tr '\n' ' ')
  echo "$m cikis=$c pass=$p fail=$f kirmizi: $red"
done
# M14 (istemci): e2e A4f
m=M14-bos-belirtec-gorunur
node $NOT/watur1-betik/mut.mjs apply $m && PLAYWRIGHT_BROWSERS_PATH=$NOT/pw-1194 EKRAN_DIR=$NOT/watur1-kanit/ekran-mut TZ=UTC timeout 900 node test/e2e/senaryo-whatsapp-ayar-248.mjs > $OUT/$m.txt 2>&1
c=$?
node $NOT/watur1-betik/mut.mjs restore $m
echo "$m cikis=$c $(tail -1 $OUT/$m.txt) kirmizi: $(grep -c '✗' $OUT/$m.txt)"
# Geri alma denetimi: kopyada değişmiş dosya kalmadı
ls $MUT/server/lib/whatsapp/*.mut-orijinal $MUT/client/assets/*.mut-orijinal 2>/dev/null && echo "UYARI: geri alınmamış dosya" || echo "geri alma tamam"
