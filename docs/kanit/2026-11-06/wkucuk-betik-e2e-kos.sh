#!/usr/bin/env bash
# WhatsApp e2e'leri (G2; ders 8, 28): bash e2e-kos.sh <kök> <önek> <senaryo>...  — her senaryo kanıt aracıyla, sırayla.
set -u
P=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
KOK="$1"; ONEK="$2"; shift 2
cd "$KOK" || exit 1
export PLAYWRIGHT_BROWSERS_PATH="$P/pw-1194" HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR="$P/wkucuk-kanit"
for S in "$@"; do
  EKRAN_DIR="$P/wkucuk-ekran/$ONEK-$S" node tools/kanit.mjs kos "$ONEK-$S" -- node --disable-warning=ExperimentalWarning "test/e2e/$S.mjs" > /dev/null 2>&1
  echo "$ONEK-$S çıkış $?"
done
