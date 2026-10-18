#!/bin/bash
# 2.4.3 hız düzeltmesi: ölçüm verisi (10.000 fatura) ESKİ kodla (4d546e9) programın API'sinden üretilir; kilit altında (ders 15).
set -uo pipefail
cd /tmp/claude-0/-home-user/9cd0e60e-f0c5-5d7d-bc4f-899fff43162d/scratchpad/hiz243-arac
export KLASOR=$PWD/tam
export HIZ_KOD=/tmp/claude-0/-home-user/9cd0e60e-f0c5-5d7d-bc4f-899fff43162d/scratchpad/hiz243-eski-4d546e9
export HUKUK_LICENSE_URL=http://127.0.0.1:9
mkdir -p tam
echo "kilit bekleniyor $(date -u +%T)"
exec 9>/tmp/claude-0/-home-user/9cd0e60e-f0c5-5d7d-bc4f-899fff43162d/scratchpad/e2e-243.lock
flock 9
echo "kilit alındı $(date -u +%T)"
node --disable-warning=ExperimentalWarning hiz.mjs veri
echo "veri çıkış $? $(date -u +%T)"
