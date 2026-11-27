#!/bin/bash
# kullanım: belirlenimci-hepsi.sh <db.mjs yolu> <tutmaMs>
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/db-acilis-a4c3
for m in excl-wal begin-exclusive rollback-read; do
  node --disable-warning=ExperimentalWarning "$S/betik/belirlenimci.mjs" "$1" "$m" "$2" || exit 1
  node --disable-warning=ExperimentalWarning "$S/betik/belirlenimci.mjs" "$1" "$m" "$2" ro || exit 1
done
