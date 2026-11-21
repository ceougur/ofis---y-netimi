#!/bin/bash
# ANA OTURUM — Ç6-HESAP (c6h3-uc) çalışma dalına (Ç7b dahil) birleşim sınaması: /dev/shm/c6-sinama (dal c6-sinama). G2: Ç6 testleri + yeni modülleri anan testler, iki TZ; sonra BİR tam npm test (ders 41; yeni çekirdek modül).
# Çağrı: timeout -k 5 7100 bash kos.sh
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad; A=$S/ana-c6s; W=/dev/shm/c6-sinama
export HUKUK_LICENSE_URL=http://127.0.0.1:9 PLAYWRIGHT_BROWSERS_PATH=$S/pw-1194
cd $W || exit 1
[ "$(git rev-parse HEAD)" = "$(git rev-parse c6-sinama)" ] || { echo "ağaç c6-sinama ucunda değil"; exit 1; }
mkdir -p $A/kanit
kos() { ad=$1; tz=$2; shift 2
  TZ=$tz KANIT_DIR=$A/kanit timeout -k 5 3000 flock -s -w 3600 $S/olcum.lock node tools/kanit.mjs kos ana-c6s-$ad -- "$@" > $A/$ad.log 2>&1
  echo "$ad çıkış $? · $(date -u +%H:%M) · $(grep -E '^# (tests|pass|fail|cancelled|skipped)' $A/$ad.log | tr '\n' ' ' | cut -c1-200)"; }
echo "başta $(cat /proc/loadavg) · $(date -u +%H:%M) · uç $(git rev-parse --short HEAD)"
T="test/c6h-ba.test.mjs test/c6h-bilanco-uc.test.mjs test/c6h-bilanco.test.mjs test/c6h-degerleme.test.mjs test/c6h-esdegerlik.test.mjs test/c6h-gelir-tablosu.test.mjs test/c6h-s209.test.mjs test/c6h-uc.test.mjs test/c6h-v249-sinif.test.mjs test/db-tx-kayip-250.test.mjs test/donmus-defter-bellek-250.test.mjs test/donmus-defter-tur1-250.test.mjs test/donmus-defter-tur3-250.test.mjs test/donmus-defter-tur4-250.test.mjs"
for tz in UTC Europe/Istanbul; do a=$(echo $tz | tr '/' '-'); kos dar-$a $tz node --test $T; done
grep -E "^not ok|✖" $A/dar-*.log | sort -u | head -10 | cut -c1-220
[ -z "$(git status -s | grep -v node_modules)" ] || { echo "ağaç temiz değil"; git status -s | head -5; exit 1; }
echo "tam test başladı $(date -u +%T) yük $(cut -d' ' -f1-3 /proc/loadavg)"
flock -s -w 3600 $S/olcum.lock flock -n $S/tam-npm-test.lock timeout 5400 node tools/kanit.mjs kos ana-c6s-tam -- npm test > $A/tam.out 2>&1; echo "TAM npm test çıkış $? $(grep -E '^\[kanit\]' $A/tam.out | tail -1 | cut -c1-170)"
grep -E "^# (tests|pass|fail|cancelled|skipped|todo)" $A/tam.out | tr '\n' ' '; echo
grep -E "^not ok|✖" $A/tam.out | sort -u | head -12 | cut -c1-220
echo "bitti $(date -u +%T) yük $(cut -d' ' -f1-3 /proc/loadavg) · temiz mi: $(git status -s | grep -v node_modules | wc -l)"
