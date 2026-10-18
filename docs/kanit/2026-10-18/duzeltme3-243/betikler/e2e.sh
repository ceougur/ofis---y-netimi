#!/bin/bash
S=/tmp/claude-0/-home-user/9cd0e60e-f0c5-5d7d-bc4f-899fff43162d/scratchpad
cd $S/duzeltme3-243
export HUKUK_LICENSE_URL=http://127.0.0.1:9
mkdir -p $S/d3-e2e
for t in gg243-dar2-ekran gg243-tumunu-gonder senaryo-fatura-243 senaryo-ebelge-242 senaryo-ebelge-243 senaryo-entegrator-240 gg243-odak-kalem-sil fatura-243-daha-fazla-yaris gg243-banka-kart-aciklama senaryo-form-izolasyon-243; do
  echo "== $t ($(date -u +%H:%M:%S))"
  flock $S/e2e-243.lock timeout 1800 npm run -s test:$t > $S/d3-e2e/$t.txt 2>&1
  echo "çıkış=$?"; tail -2 $S/d3-e2e/$t.txt
done
echo "== ESKİ 276f94e gg243-dar2-ekran"
DEPO=$S/duzeltme3-243-eski-276f94e flock $S/e2e-243.lock timeout 900 node --disable-warning=ExperimentalWarning test/e2e/gg243-dar2-ekran.mjs > $S/d3-e2e/eski-276f94e-gg243-dar2-ekran.txt 2>&1
echo "çıkış=$?"; tail -2 $S/d3-e2e/eski-276f94e-gg243-dar2-ekran.txt
echo BITTI
