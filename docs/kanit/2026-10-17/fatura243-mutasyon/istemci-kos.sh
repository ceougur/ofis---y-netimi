#!/bin/bash
# İstemci mutasyon kopyasında senaryo-fatura-243 (ortak e2e kilidiyle). Kullanım: istemci-kos.sh <kopya kökü> <çıktı dosyası>
set -uo pipefail
exec 9>/tmp/claude-0/-home-user/9cd0e60e-f0c5-5d7d-bc4f-899fff43162d/scratchpad/e2e-243.lock
flock 9
HUKUK_LICENSE_URL=http://127.0.0.1:9 timeout 900 node --disable-warning=ExperimentalWarning "$1/test/e2e/senaryo-fatura-243.mjs" > "$2" 2>&1
echo "cikis=$?" >> "$2"
