#!/bin/bash
# M2T2: p6 verileri (taban kodla) — sırayla dört kopya.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m2t2
V=/dev/shm/m2t2-a2da/veri
cd "$S" || exit 1
for spec in "60 1 0" "60 1 1" "250 3 0" "250 3 1"; do
  set -- $spec
  D="$V/n$1-k$2-h$3"
  mkdir -p "$D"
  ROOT=/dev/shm/m2t2-a2da/eski VERI="$D" FATURA=$1 KAYIT=$2 HEDEF=$3 HUKUK_LICENSE_URL=http://127.0.0.1:9 node betik/p6-uret.mjs > "cikti/uret-n$1-k$2-h$3.txt" 2>&1 || echo "HATA $spec" >> cikti/uret-hata.txt
done
echo bitti > cikti/uret-bitti.txt
