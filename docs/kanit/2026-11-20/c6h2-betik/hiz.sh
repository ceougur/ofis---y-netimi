#!/bin/bash
# Ç6-HESAP tur 2 HACİM — ÖZEL ölçüm kilidinin İÇİNDE çağrılır (flock -x). Temiz 100 bin satırlık verinin taze kopyası (/dev/shm): kilitsiz / kilitli (30.06.2026).
# Kullanım: bash hiz.sh <kip: kilitsiz|kilitli> <kod: yeni|eski> [tekrar=5]
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c6h2-ana
SRC=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/ana-kabul/temiz-100k
S=/dev/shm/c6h2-olcum
KIP=${1:-kilitsiz}
KOD=${2:-yeni}
if [ "$KOD" = yeni ]; then ROOT=/home/user/ofis---y-netimi/.claude/worktrees/agent-a7236347e0f8b6e8c; BAL=1; else ROOT=/dev/shm/c6h2-eski; BAL=0; fi
export HUKUK_LICENSE_URL=http://127.0.0.1:9
echo "başta yük $(cat /proc/loadavg) · $(date -u +%H:%M:%S) · kip $KIP · kod $KOD ($ROOT)"
rm -rf "$S/$KIP"
mkdir -p "$S" || exit 1
cp -a "$SRC" "$S/$KIP" || exit 1
if [ "$KIP" = kilitli ]; then python3 -I /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a2-olcum/kilit.py "$S/$KIP/data/destekofis.sqlite" || exit 1; fi
timeout -k 10 2400 node --disable-warning=ExperimentalWarning --max-old-space-size=6144 "$N/olc.mjs" "$ROOT" "$S/$KIP" "${3:-5}" "$BAL"
echo "çıkış $?"
rm -rf "$S/$KIP"
echo "sonda yük $(cat /proc/loadavg) · $(date -u +%H:%M:%S)"
