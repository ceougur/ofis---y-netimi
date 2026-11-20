#!/bin/bash
# Ç6-HESAP tur 3 HACİM — ÖZEL ölçüm kilidinin İÇİNDE çağrılır (flock -x). Verinin taze kopyası (/dev/shm): kilitsiz / kilitli (30.06.2026; kilit.py).
# Kullanım: bash hiz.sh <kip: kilitsiz|kilitli> <kod: yeni|eski> [tekrar=5] [kaynak veri=temiz-100k] [şirket2 kimliği]
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c6h3-ana
SRC=${4:-/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/ana-kabul/temiz-100k}
S=/dev/shm/c6h3-olcum
KIP=${1:-kilitsiz}
KOD=${2:-yeni}
if [ "$KOD" = yeni ]; then ROOT=/home/user/ofis---y-netimi/.claude/worktrees/agent-ab54e5fc492a09964; else ROOT=/dev/shm/c6h3-eski; fi
export HUKUK_LICENSE_URL=http://127.0.0.1:9
echo "başta yük $(cat /proc/loadavg) · $(date -u +%H:%M:%S) · kip $KIP · kod $KOD ($ROOT) · veri $SRC"
rm -rf "$S/$KIP"
mkdir -p "$S" || exit 1
cp -a "$SRC" "$S/$KIP" || exit 1
if [ "$KIP" = kilitli ]; then python3 -I /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a2-olcum/kilit.py "$S/$KIP/data/destekofis.sqlite" || exit 1; fi
timeout -k 10 2400 node --disable-warning=ExperimentalWarning --max-old-space-size=6144 "$N/betik/olc.mjs" "$ROOT" "$S/$KIP" "${3:-5}" "${5:-sirket-5a5ffa3a-674f-4df8-b2f6-5c43b11b61a8}"
echo "çıkış $?"
rm -rf "$S/$KIP"
echo "sonda yük $(cat /proc/loadavg) · $(date -u +%H:%M:%S)"
