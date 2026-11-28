#!/bin/bash
# Kullanım: kos.sh <kök> <ad> <TZ> <dosya…> — kanit.mjs kos ile, paylaşımlı ölçüm kilidi altında; özet sonuna.
ROOT="$1"; AD="$2"; ZONE="$3"; shift 3
cd "$ROOT" || exit 1
mkdir -p /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m2t4-ajan/kanit || exit 1
cat /proc/loadavg
TZ="$ZONE" HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m2t4-ajan/kanit flock -s -w 3600 /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock timeout -k 5 5400 node "$ROOT/tools/kanit.mjs" kos "$AD" -- node --test --test-reporter=tap "$@"
echo "cikis $?"
