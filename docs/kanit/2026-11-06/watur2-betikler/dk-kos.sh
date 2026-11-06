#!/bin/bash
# WhatsApp tur 2: dar kontrol betiklerini (kopya) verilen kod kökünde koşar. Kullanım: bash kos.sh <kodKökü> <etiket>
D=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/watur2-dk
K=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/watur2-kanit
R=$1
E=$2
V=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/watur2-v249
cd "$R" || exit 1
export HUKUK_LICENSE_URL=http://127.0.0.1:9
for B in e2-defter-anon-yeniden-denenmez e3-hata-metni-silmeden-sonra e4-yetki-silinmis-cari e8-wal-okuyucu-varken e10-hazirlaniyor-talep; do
  ROOT="$R" timeout 600 node "$D/$B.mjs" > "$K/dk-$E-$B.txt" 2>&1
  echo "$B çıkış $?"
done
rm -rf "$D/veri-f1-$E"
timeout 600 node "$D/f1-gecis-waba-isareti.mjs" "$V" "$R" "$D/veri-f1-$E" > "$K/dk-$E-f1.txt" 2>&1
echo "f1 çıkış $?"
rm -rf "$D/veri-f1-$E"
for L in hepsi kendi; do
  LIST=$L timeout 600 node "$D/f2-iki-uygulama.mjs" "$R" > "$K/dk-$E-f2-$L.txt" 2>&1
  echo "f2 $L çıkış $?"
done
timeout 600 node "$D/f5-m12-esdegerlik.mjs" "$R" > "$K/dk-$E-f5.txt" 2>&1
echo "f5 çıkış $?"
