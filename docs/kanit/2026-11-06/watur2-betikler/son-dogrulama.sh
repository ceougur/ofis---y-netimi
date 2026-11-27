#!/bin/bash
# WhatsApp tur 2 son doğrulama — A: (1) iki yeni test dosyası iki saat diliminde, (2) mutasyon (Europe/Istanbul), (3) bütün WhatsApp e2e'leri (+ KVKK); sırayla.
# B (komsu): G2 komşu listesi (komsu-liste.txt; UTC) ayrı koşulur. Kullanım: bash son-dogrulama.sh <depo kökü> A|B
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
K=$S/watur2-kanit
R=$1
cd "$R" || exit 1
if [ "$2" = "A" ]; then
  for Z in UTC Europe/Istanbul; do
    N=$(echo $Z | tr / _)
    TZ=$Z KANIT_DIR=$K timeout 2400 node tools/kanit.mjs kos watur2-son-$N -- node --test test/whatsapp-tur2-bildirim-yolu-250.test.mjs test/whatsapp-tur2-kvkk-250.test.mjs > "$K/son-$N.txt" 2>&1
    echo "son $Z çıkış $?"
  done
  TZ=Europe/Istanbul timeout 3600 node "$S/watur2-betik/mutasyon.mjs" > "$K/mutasyon-son-istanbul.txt" 2>&1
  echo "mutasyon çıkış $?"
  tail -1 "$K/mutasyon-son-istanbul.txt"
  for E in senaryo-whatsapp senaryo-whatsapp-ayar-248 senaryo-whatsapp-donem-248 senaryo-whatsapp-sablon-248 senaryo-whatsapp-gonder-248 senaryo-whatsapp-kvkk-250; do
    PLAYWRIGHT_BROWSERS_PATH=$S/pw-1194 EKRAN_DIR=$K/ekran-$E KANIT_DIR=$K timeout 900 node tools/kanit.mjs kos watur2-e2e-$E -- node --disable-warning=ExperimentalWarning "test/e2e/$E.mjs" > "$K/e2e-$E.txt" 2>&1
    echo "e2e $E çıkış $?"
  done
fi
if [ "$2" = "B" ]; then
  mapfile -t LISTE < "$K/komsu-liste.txt"
  TZ=UTC KANIT_DIR=$K timeout 7000 node tools/kanit.mjs kos watur2-komsu-UTC -- node --disable-warning=ExperimentalWarning --test --test-concurrency=1 "${LISTE[@]}" > "$K/komsu-UTC.txt" 2>&1
  echo "komşu çıkış $?"
fi
