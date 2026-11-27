#!/bin/bash
# Tur 2e HIZ ek: Kural Farkı kaydı (POST) — temiz-100k + düzeltme fişi (01.07.2026) + eşleştirme fişi, bugün 10.01.2027, kilit 31.12.2026; her tarafta kendi kopyasında, iki tur
NB=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a2e-k3
P=$NB/dk/p
SRC=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/ana-kabul/temiz-100k
export HUKUK_LICENSE_URL=http://127.0.0.1:9 ESD_PASS=Kapi-Olcum-2026! TZ=Europe/Istanbul
echo "başta $(cat /proc/loadavg) · $(date -u +%H:%M:%S)"
rm -rf $NB/hz-src && cp -a $SRC $NB/hz-src || exit 1
timeout -k 5 1800 node --disable-warning=ExperimentalWarning $P/fis-kur.mjs $NB/yeni $NB/hz-src 2027-01-10 2026-06-30 2>&1 | grep -v "Experimental\|trace-warn"
for tur in 1 2; do
  for side in taban yeni; do
    rm -rf $NB/hz2 && cp -a $NB/hz-src $NB/hz2 || exit 1
    echo "== tur $tur $side kilit 31.12.2026 + kayıt"; KILIT=2026-12-31 timeout -k 5 1800 node --disable-warning=ExperimentalWarning $P/hz-kf.mjs $NB/$side $NB/hz2 2027-01-10 kaydet 2>&1 | grep -v "Experimental\|trace-warn"
  done
done
rm -rf $NB/hz2 $NB/hz-src
echo "sonda $(cat /proc/loadavg) · $(date -u +%H:%M:%S)"
