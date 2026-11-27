#!/bin/bash
# ANA OTURUM — 'Ç7b DK + S229 ALTIN' birleşik küçük turun dar yeniden koşusu (ders 16, 38, 51): yeni = de403915, eski = dkfix-taban 94a7b475 + YALNIZ yeni test dosyaları
# (altın test ve K1 yardımcısı eski kopyada ESKİ hâliyle — ders 51). İki TZ; G2 komşu (ajanın listesi) iki TZ; ekran senaryosu; BULGU-1 için ajanın pk3 / pk4 betikleri AYNEN, iki kodda.
# Paylaşılan kilit bütün zincir için BİR KEZ (bekleme adım sürelerinin dışında). Çağrı: timeout -k 5 7100 bash kos.sh
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad; A=$S/ana-dkfix; Y=/dev/shm/ana-dkfix/yeni; E=/dev/shm/ana-dkfix/eski
export HUKUK_LICENSE_URL=http://127.0.0.1:9 PLAYWRIGHT_BROWSERS_PATH=$S/pw-1194 KANIT_DIR=$A/kanit
mkdir -p $A/kanit
exec 9>$S/olcum.lock; flock -s -w 5400 9 || { echo KİLİT; exit 3; }
echo "kilit $(date -u +%H:%M:%S) · yük $(cut -d' ' -f1-3 /proc/loadavg) · yeni $(git -C $Y rev-parse --short HEAD) eski $(git -C $E rev-parse --short HEAD)"
say() { grep -E "^# (tests|pass|fail|cancelled|skipped)" "$1" | tr '\n' ' '; }
T="test/dkfix-s234-kapali-kart-250.test.mjs test/banka-210-altin.test.mjs"
for tz in UTC Europe/Istanbul; do a=${tz//\//-}
  for k in yeni eski; do R=$Y; [ $k = eski ] && R=$E
    (cd $R && TZ=$tz timeout -k 5 1500 node tools/kanit.mjs kos ana-dkfix-$k-$a -- node --disable-warning=ExperimentalWarning --test --test-concurrency=1 $T > $A/$k-$a.log 2>&1); echo "$k $tz çıkış $? · $(say $A/$k-$a.log)"
  done
done
grep -hE "^not ok|✖" $A/eski-*.log | sort | uniq -c | head -12 | cut -c1-220
mapfile -t G < $A/g2-liste.txt
for tz in UTC Europe/Istanbul; do a=${tz//\//-}
  (cd $Y && TZ=$tz timeout -k 5 3000 node tools/kanit.mjs kos ana-dkfix-g2-$a -- node --disable-warning=ExperimentalWarning --test --test-concurrency=1 "${G[@]}" > $A/g2-$a.log 2>&1); echo "G2 $tz çıkış $? · $(say $A/g2-$a.log)"
done
for k in yeni eski; do R=$Y; [ $k = eski ] && R=$E
  (cd $R && TZ=Europe/Istanbul EKRAN_DIR=$A/ekran-$k timeout -k 5 1500 node --disable-warning=ExperimentalWarning test/e2e/senaryo-dkfix-250.mjs > $A/e2e-$k.log 2>&1); echo "e2e $k çıkış $? · $(grep -E 'geçti|BAŞARISIZ' $A/e2e-$k.log | tail -1)"
  for p in pk3 pk4; do (cd $A/probe && TZ=Europe/Istanbul ROOT=$R timeout 300 node --disable-warning=ExperimentalWarning $p.mjs > $A/$p-$k.out 2>&1); echo "$p $k çıkış $?"; done
done
echo "bitti $(date -u +%H:%M:%S) · yük $(cut -d' ' -f1-3 /proc/loadavg) · temiz yeni $(git -C $Y status -s | grep -v node_modules | wc -l)"
