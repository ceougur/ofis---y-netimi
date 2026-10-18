#!/bin/bash
# Ana oturum kuralı (17.10.2026): aynı makinede 4 ajan — tarayıcılı e2e ve tam npm test ortak kilitle TEK TEK koşar. Kanıt aracıyla (ders 2).
# Kullanım: kilitli.sh <kanıt adı> <komut> [arg…]   (çalışma klasöründen; çıktı docs/kanit/<gün>/<ad>.json + ham)
set -uo pipefail
LOCK=/tmp/claude-0/-home-user/9cd0e60e-f0c5-5d7d-bc4f-899fff43162d/scratchpad/e2e-243.lock
exec 9>"$LOCK"
flock 9
export HUKUK_LICENSE_URL=http://127.0.0.1:9
name="$1"; shift
node tools/kanit.mjs kos "$name" -- "$@"
