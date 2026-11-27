#!/bin/bash
# Ç6-HESAP tur 3 — 1 M satır HACİM (ÖZEL ölçüm kilidinin İÇİNDE). Veri /dev/shm/c6h3-1m/n-1000000 (programın kendi yolu: tools/kapi-olcum.mjs --yalniz-kur); disk 5 GB'ın altına düşmesin diye
# RAM diskte ve TEK kopya: kilitsiz ölçümler aynı kopyada (yeni, eski); sonra kilit.py (30.06.2026) → kilitli (yeni koşu dondurur, eski aynı donmuş satırları okur). ≤ 40 dk parçalar.
# Kullanım: bash hiz1m.sh <kip: kilitsiz|kilitli> <kod: yeni|eski> [tekrar=5]
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c6h3-ana
D=/dev/shm/c6h3-1m/n-1000000
KIP=${1:-kilitsiz}
KOD=${2:-yeni}
if [ "$KOD" = yeni ]; then ROOT=/home/user/ofis---y-netimi/.claude/worktrees/agent-ab54e5fc492a09964; else ROOT=/dev/shm/c6h3-eski; fi
export HUKUK_LICENSE_URL=http://127.0.0.1:9
echo "başta yük $(cat /proc/loadavg) · $(date -u +%H:%M:%S) · kip $KIP · kod $KOD · $(free -g | sed -n 2p)"
if [ "$KIP" = kilitli ] && [ ! -f "$D/.kilit" ]; then python3 -I /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a2-olcum/kilit.py "$D/data/destekofis.sqlite" && touch "$D/.kilit" || exit 1; fi
OLC_KISA=1 timeout -k 10 2400 node --disable-warning=ExperimentalWarning --max-old-space-size=8192 "$N/betik/olc.mjs" "$ROOT" "$D" "${3:-5}" auto
echo "çıkış $?"
echo "sonda yük $(cat /proc/loadavg) · $(date -u +%H:%M:%S) · $(free -g | sed -n 2p)"
