#!/bin/bash
# Kullanım: kahin.sh <etiket> <kod kökü>   — defter kâhini iki TZ + cari kâhini (normal) + cari listesinin kendi kopyada yeniden üretimi
E="$1"; ROOT="$2"
K=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a3c-k7
cd "$ROOT" || exit 1
export HUKUK_LICENSE_URL=http://127.0.0.1:9
mkdir -p $K/$E-kanit
export KANIT_DIR=$K/$E-kanit
: > $K/$E-kahin.ozet
for tz in UTC Europe/Istanbul; do
  t=${tz//\//-}
  TZ=$tz node tools/kanit.mjs kos c5a3c-$E-kahin-defter-$t -- npm run test:kahin-defter > $K/$E-kahin-defter-$t.txt 2>&1
  echo "defter $tz cikis $?" >> $K/$E-kahin.ozet
done
TZ=UTC node tools/kanit.mjs kos c5a3c-$E-kahin-cari -- npm run test:kahin-cari > $K/$E-kahin-cari.txt 2>&1
echo "cari cikis $?" >> $K/$E-kahin.ozet
cp test/bagimsiz/cari/YAPIM-ASAMASI.json $K/$E-yapim.json
TZ=UTC KAHIN_YAPIM_ASAMASI=$K/$E-yapim.json node test/bagimsiz/cari/kos.mjs --yapim-asamasi-yaz > $K/$E-kahin-cari-yaz.txt 2>&1
echo "cari-yaz cikis $?" >> $K/$E-kahin.ozet
echo bitti >> $K/$E-kahin.ozet
