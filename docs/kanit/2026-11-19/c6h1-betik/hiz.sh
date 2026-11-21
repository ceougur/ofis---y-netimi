#!/bin/bash
# Ç6-HESAP tur 1 HACİM — ÖZEL ölçüm kilidinin İÇİNDE çağrılır (flock -x). Temiz 100 bin satırlık verinin taze kopyası (/dev/shm; diski korur): kilitsiz / kilitli (30.06.2026).
# Kullanım: bash hiz.sh <kip: kilitsiz|kilitli> [tekrar=5]
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c6h1-ns
SRC=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/ana-kabul/temiz-100k
S=/dev/shm/c6h1-olcum
WT=/home/user/ofis---y-netimi/.claude/worktrees/agent-a91ebf10c57360da7
KIP=${1:-kilitsiz}
export HUKUK_LICENSE_URL=http://127.0.0.1:9
echo "başta yük $(cat /proc/loadavg) · $(date -u +%H:%M:%S) · kip $KIP · uç $(git -C "$WT" rev-parse --short HEAD)"
rm -rf "$S/$KIP"
mkdir -p "$S" || exit 1
cp -a "$SRC" "$S/$KIP" || exit 1
if [ "$KIP" = kilitli ]; then python3 -I /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a2-olcum/kilit.py "$S/$KIP/data/destekofis.sqlite" || exit 1; fi
timeout -k 10 2400 node --disable-warning=ExperimentalWarning --max-old-space-size=6144 "$N/olc.mjs" "$WT" "$S/$KIP" "${2:-5}"
echo "çıkış $?"
rm -rf "$S/$KIP"
echo "sonda yük $(cat /proc/loadavg) · $(date -u +%H:%M:%S)"
