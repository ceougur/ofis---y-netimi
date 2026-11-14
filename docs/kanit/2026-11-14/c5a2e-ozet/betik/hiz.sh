#!/bin/bash
# Tur 2e HIZ (kabul E; flock -x -n ile çağrılır): taban (c5a2e-taban) ↔ yeni (7c05fad4), aynı veri kopyası, iki tur.
#  (1) temiz-100k kilitsiz: Kural Farkı ön izleme (pasif), Mutabakat Testi, Defter Mutabakatı
#  (2) temiz-100k + kilit 30.06.2026 + düzeltme fişi (01.07.2026) + eşleştirme fişi, bugün 10.01.2027, kilit 31.12.2026 (yazılmış fişin yılı < eşleme yılı — tur 2e'nin yolu): ön izleme, Mutabakat,
#      Defter Mutabakatı; kayıt (POST) her tarafta kendi kopyasında bir kez
#  (3) 5.000 aday (v2.4.9): liste, zil, toplu karar (yönetici + Muhasebe), tek karar, ön izleme, Mutabakat
NB=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a2e-k3
P=$NB/dk/p
SRC=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/ana-kabul/temiz-100k
export HUKUK_LICENSE_URL=http://127.0.0.1:9 ESD_PASS=Kapi-Olcum-2026! TZ=Europe/Istanbul
echo "başta $(cat /proc/loadavg) · nproc $(nproc) · $(date -u +%H:%M:%S)"; df -h / | tail -1
# (2)'nin hazırlığı (yeni kodla; iki tarafa aynı kopya)
rm -rf $NB/hz-src && cp -a $SRC $NB/hz-src || exit 1
timeout -k 5 1800 node --disable-warning=ExperimentalWarning $P/fis-kur.mjs $NB/yeni $NB/hz-src 2027-01-10 2026-06-30 2>&1 | grep -v "Experimental\|trace-warn"
for tur in 1 2; do
  for side in taban yeni; do
    R=$NB/$side
    rm -rf $NB/hz1 && cp -a $SRC $NB/hz1 || exit 1
    echo "== tur $tur $side (1) kilitsiz"; timeout -k 5 1800 node --disable-warning=ExperimentalWarning $P/hz-kf.mjs $R $NB/hz1 2026-10-08 2>&1 | grep -v "Experimental\|trace-warn"
    rm -rf $NB/hz2 && cp -a $NB/hz-src $NB/hz2 || exit 1
    echo "== tur $tur $side (2) kilit 31.12.2026"; KILIT=2026-12-31 timeout -k 5 1800 node --disable-warning=ExperimentalWarning $P/hz-kf.mjs $R $NB/hz2 2027-01-10 kaydet 2>&1 | grep -v "Experimental\|trace-warn"
    rm -rf $NB/a5k-ol && cp -a $NB/a5k $NB/a5k-ol || exit 1
    echo "== tur $tur $side (3) 5.000 aday"; timeout -k 5 1800 node --disable-warning=ExperimentalWarning $P/aday-olc.mjs $R $NB/a5k-ol 2>&1 | grep -v "Experimental\|trace-warn"
  done
done
rm -rf $NB/hz1 $NB/hz2 $NB/a5k-ol $NB/hz-src
echo "sonda $(cat /proc/loadavg) · $(date -u +%H:%M:%S)"
