#!/usr/bin/env bash
# Ç3 tur 1 ölçümleri (ders 15: flock ile tek tek; aynı veri kopyası; önce = 10ed14cf, sonra = çalışma ağacı). Kullanım: olcum-kos.sh <boyut: 100000 | 1000000> <etiket: eski | yeni> [--dondur]
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
N="$1"
TAG="$2"
EXTRA="$3"
if [ "$TAG" = "eski" ]; then ROOT="$S/c3t1-eski-10ed14cf"; else ROOT=/home/user/ofis---y-netimi/.claude/worktrees/agent-a247c14721558ab77; fi
SRC="$S/c3-olcum-veri/n-$N/data/destekofis.sqlite"
OUT="$S/c3t1-kanit/olcum"
mkdir -p "$OUT"
cd /home/user/ofis---y-netimi/.claude/worktrees/agent-a247c14721558ab77 || exit 1
KANIT_DIR="$S/c3t1-kanit/kanit" HUKUK_LICENSE_URL=http://127.0.0.1:9 flock "$S/olcum.lock" node tools/kanit.mjs kos "c3t1-olcum-$N-$TAG" -- node --disable-warning=ExperimentalWarning "$S/c3t1-betik/olcum-pencere.mjs" "$ROOT" "$SRC" "$S/c3t1-olcum-is-$N-$TAG" "$OUT/olcum-$N-$TAG.json" $EXTRA
echo "çıkış $?"
uptime
rm -rf "$S/c3t1-olcum-is-$N-$TAG"
