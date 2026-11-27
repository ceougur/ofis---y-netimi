#!/bin/bash
# WhatsApp tur 2 son doğrulama 2 (dfabbe06 — açılış yolunun yeniden düzenlenmesinden sonra): iki dosya iki TZ, eski kodda kvkk dosyası (kırmızı nedenleri), mutasyon (tam),
# delta komşuları (whatsapp-* + şema kapısı + yedek / geri yükleme + lisans). Kullanım: bash son-dogrulama-2.sh <depo kökü>
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
K=$S/watur2-kanit
R=$1
cd "$R" || exit 1
for Z in UTC Europe/Istanbul; do
  N=$(echo $Z | tr / _)
  TZ=$Z KANIT_DIR=$K timeout 2400 node tools/kanit.mjs kos watur2-son2-$N -- node --test test/whatsapp-tur2-bildirim-yolu-250.test.mjs test/whatsapp-tur2-kvkk-250.test.mjs > "$K/son2-$N.txt" 2>&1
  echo "son2 $Z çıkış $?"
done
cp "$R/test/whatsapp-tur2-kvkk-250.test.mjs" "$S/watur2-eski-329d5d1b/test/"
( cd "$S/watur2-eski-329d5d1b" && TZ=UTC KANIT_DIR=$K timeout 1800 node tools/kanit.mjs kos watur2-eski2-kvkk-UTC -- node --test test/whatsapp-tur2-kvkk-250.test.mjs > "$K/eski2-kvkk-UTC.txt" 2>&1; echo "eski2 kvkk çıkış $?" )
git -C "$R" archive HEAD server test/whatsapp-tur2-bildirim-yolu-250.test.mjs test/whatsapp-tur2-kvkk-250.test.mjs | tar -x -C "$S/watur2-mut"
TZ=Europe/Istanbul timeout 3600 node "$S/watur2-betik/mutasyon.mjs" > "$K/mutasyon-son2-istanbul.txt" 2>&1
echo "mutasyon2 çıkış $?"
tail -1 "$K/mutasyon-son2-istanbul.txt"
LISTE=($(ls test/whatsapp-*.test.mjs; ls test/*.test.mjs | grep -E "/(license|lisans-|backup|yedek|geri-yukle|sirket-yedek|sema-kapisi)"))
TZ=Europe/Istanbul KANIT_DIR=$K timeout 5400 node tools/kanit.mjs kos watur2-komsu2-Europe_Istanbul -- node --disable-warning=ExperimentalWarning --test --test-concurrency=1 "${LISTE[@]}" > "$K/komsu2-Europe_Istanbul.txt" 2>&1
echo "komşu2 çıkış $?"
