#!/usr/bin/env bash
# Tur 2f — kanit kos sarmalayıcısı. Kullanım: kos.sh <kod kökü> <kayıt adı> <TZ> <süre sn> <test dosyası…>
# Yük kilidi paylaşımlı ve beklemesiz (-n): kilit doluysa hemen döner. Depo değişkeni (GIT_DIR / GIT_WORK_TREE) verilmez (ders 54).
ROOT="$1"; NAME="$2"; ZONE="$3"; SECS="$4"; shift 4
cd "$ROOT" || exit 1
unset GIT_DIR GIT_WORK_TREE
exec env TZ="$ZONE" HUKUK_LICENSE_URL=http://127.0.0.1:9 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/pw-1194 \
  timeout -k 5 "$SECS" flock -s -n /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock \
  node tools/kanit.mjs kos "$NAME" -- node --disable-warning=ExperimentalWarning --test --test-reporter=tap "$@"
