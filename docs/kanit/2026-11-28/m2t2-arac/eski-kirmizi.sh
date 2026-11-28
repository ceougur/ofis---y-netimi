#!/bin/bash
# M2T2: yeni testler ESKİ kodda (t251-m2t2-taban; ayrı kopya) iki saat diliminde — beklenen nedenle kırmızı (ders 7, 38).
K=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m2t2/kanit
E=/dev/shm/m2t2-a2da/eski
cd "$E" || exit 1
for tz in UTC Europe/Istanbul; do
  n=$(echo "$tz" | tr '/' '-')
  TZ=$tz HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$K node tools/kanit.mjs kos "m2t2-eski-yeni-testler-$n" -- node --test test/supheli-degersiz-hiz-m2t2-251.test.mjs test/supheli-degersiz-iptal-iade-m2t2-251.test.mjs
  TZ=$tz PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/pw-1194 HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$K node tools/kanit.mjs kos "m2t2-eski-e2e-degersiz-iptal-$n" -- node --disable-warning=ExperimentalWarning test/e2e/senaryo-degersiz-iptal-m2t2-251.mjs
done
echo bitti > "$K/eski-bitti.txt"
