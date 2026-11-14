#!/bin/bash
# Şüpheliyle ilgili testler — tek TZ hızlı tarama (geliştirme). Kullanım: komsu1.sh <kod kökü> <çıktı klasörü> [TZ]
ROOT="$1"; OUT="$2"; T="${3:-Europe/Istanbul}"
mkdir -p "$OUT"
cd "$ROOT" || exit 1
export HUKUK_LICENSE_URL=http://127.0.0.1:9 TZ=$T
for f in test/banka-230-supheli-bozma.test.mjs test/banka-230-supheli-ekran.test.mjs test/banka-230-supheli.test.mjs test/cari-hareket-249.test.mjs test/defter-243-raporlar.test.mjs test/defter-kaynak-iz-250.test.mjs test/ekstre-ayrinti-245.test.mjs test/hesap-plani-sinif-250.test.mjs test/kapama-ks7-245.test.mjs test/kapama-tek-gecis-245.test.mjs test/kasa-acilis-once-250.test.mjs test/kilit-izi-alanlar-250.test.mjs test/kural-farki-duzeltme-250.test.mjs test/mobil-yazma-247.test.mjs test/obligation-input-250.test.mjs test/s160-iptal-yollari-250.test.mjs test/s160-kilitli-tahsilat-bagi-250.test.mjs test/supheli-230-ayni-gun-degersiz.test.mjs test/supheli-230-elestirmen.test.mjs test/supheli-230-karar.test.mjs test/supheli-230-kontrol2.test.mjs test/supheli-230-sil-cakisma.test.mjs test/supheli-230-yargic.test.mjs test/supheli-240-k4-iptal.test.mjs test/supheli-ileti-b8-250.test.mjs test/tyk-api-250.test.mjs test/tyk-birlesik8-iade-250.test.mjs test/tyk-onbellek-250.test.mjs test/tyk-tur2a-250.test.mjs test/ux18-cek-fatura-244.test.mjs test/vade-takip-soz-b7-250.test.mjs; do
  n=$(basename $f .test.mjs)
  timeout -k 5 900 node --test --test-reporter=tap $f > "$OUT/$n.tap" 2>&1
  echo "$n cikis=$? $(grep -E '^# (pass|fail)' "$OUT/$n.tap" | tr '\n' ' ')"
done
