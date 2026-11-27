#!/bin/bash
# DÜŞÜK-3 alt sınırının 5.000 işlemlik koşuda verdiği iki uyarı Ç5-B kapanış düzeltmesinden ÖNCE de var mı? Taban kod (0c9d1069 = 8d6ea9c9 ürünü) + YENİ motor, aynı tohumlar.
# Kullanım: motor-taban.sh <kod: taban|benim> <tohum> <işlem> [ek kos.mjs argümanı]
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a511c161b54069067
KOD=$1; TOHUM=$2; ISLEM=$3; shift 3
M=$S/c5bkd-motor-$KOD-$TOHUM
rm -rf "$S/c5bkd-motor-$KOD-$TOHUM"
mkdir -p "$M" || exit 1
if [ "$KOD" = taban ]; then cp -a $S/c5bkd-taban/server $S/c5bkd-taban/test $S/c5bkd-taban/package.json "$M/" || exit 1
else cp -a $W/server $W/test $W/package.json "$M/" || exit 1; fi
cp "$W/test/mutabakat/motor.mjs" "$W/test/mutabakat/kos.mjs" "$W/test/mutabakat/sigma.mjs" "$M/test/mutabakat/" || exit 1
ln -s /home/user/ofis---y-netimi/node_modules "$M/node_modules"
mkdir -p $S/c5bkd-kanit/motor
OUT=$S/c5bkd-kanit/motor/uzun-$KOD-tohum$TOHUM.out
( cd "$M" && HUKUK_LICENSE_URL=http://127.0.0.1:9 TZ=UTC flock -s -n $S/olcum.lock timeout -k 5 3000 node --disable-warning=ExperimentalWarning test/mutabakat/kos.mjs --islem "$ISLEM" --tohum "$TOHUM" --tohumlar 1 --her 1 "$@" > "$OUT" 2>&1; echo "$KOD tohum $TOHUM: çıkış $? · $(grep -m1 -o 'Tohum [0-9]*: [0-9]* işlem, [0-9]* doğrulama' "$OUT") · $(date -u +%H:%M:%S)" )
grep -m3 -A2 "^✗" "$OUT" | cut -c1-600
rm -rf "$S/c5bkd-motor-$KOD-$TOHUM"
