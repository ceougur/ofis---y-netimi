#!/bin/bash
# ÖZEL ölçüm kilidinin içinde: Bilanço parça ayrıştırması. Kullanım: bash parca.sh [kilitsiz|kilitli]
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c6h2-ana
SRC=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/ana-kabul/temiz-100k
S=/dev/shm/c6h2-olcum/parca
KIP=${1:-kilitsiz}
ROOT=/home/user/ofis---y-netimi/.claude/worktrees/agent-a7236347e0f8b6e8c
export HUKUK_LICENSE_URL=http://127.0.0.1:9
echo "başta yük $(cat /proc/loadavg) · $(date -u +%H:%M:%S) · kod $ROOT"
rm -rf "$S"
mkdir -p /dev/shm/c6h2-olcum || exit 1
cp -a "$SRC" "$S" || exit 1
if [ "$KIP" = kilitli ]; then python3 -I /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a2-olcum/kilit.py "$S/data/destekofis.sqlite" || exit 1; fi
timeout -k 10 1200 node --disable-warning=ExperimentalWarning --max-old-space-size=6144 "$N/parca.mjs" "$ROOT" "$S"
echo "çıkış $?"
rm -rf "$S"
echo "sonda yük $(cat /proc/loadavg) · $(date -u +%H:%M:%S)"
