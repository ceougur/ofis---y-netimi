#!/bin/bash
# Kullanım: kos-hepsi.sh <dizin> <günlük> [gecikme] [hedef]
S=/tmp/claude-0/-home-user/2a941a30-cea4-5380-a679-f28a541c21a1/scratchpad
export PLAYWRIGHT_BROWSERS_PATH=$S/p1-kod-ac15eb6c/pw
export HUKUK_LICENSE_URL=http://127.0.0.1:9
if [ -n "$3" ]; then export HOF_ZORLA=gorunur HOF_ZORLA_GECIKME=$3; fi
if [ -n "$4" ]; then export HOF_ZORLA_HEDEF="$4"; fi
cd "$1" || exit 2
node --disable-warning=ExperimentalWarning --import ./test/e2e/pencere-yaris-zorla.mjs docs/kilavuz/ekran-banka.mjs --denetim > "$2" 2>&1
code=$?
echo "çıkış=$code"
echo "zorlama satırı: $(grep -c 'ertelendi' "$2")"
grep -n "EKRANDA BULUNMAYAN\|  ✗\|^✗\|başarısız adım\|^# \|metin-denetle:" "$2" | head -40
