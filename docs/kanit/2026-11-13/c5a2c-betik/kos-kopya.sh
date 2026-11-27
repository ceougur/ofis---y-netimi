#!/bin/bash
# Kullanım: kos-kopya.sh <kopya klasörü> <TZ> <çıktı dosyası> <komut…>  — kopyada (git yok) eski sürüm etiketi için depo .git'i salt okunur verilir.
KOPYA="$1"; shift
ZONE="$1"; shift
OUT="$1"; shift
cd "$KOPYA" || exit 1
export GIT_DIR=/home/user/ofis---y-netimi/.git
export TZ="$ZONE"
export HUKUK_LICENSE_URL=http://127.0.0.1:9
export PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/pw-1194
"$@" > "$OUT" 2>&1
code=$?
echo "cikis=$code" >> "$OUT"
exit $code
