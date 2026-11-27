#!/bin/bash
# ÖZEL ölçüm kilidinin içinde: Bilanço parça ayrıştırması (yeni kod), kilitsiz + kilitli.
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c6h3-ana
SRC=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/ana-kabul/temiz-100k
ROOT=/home/user/ofis---y-netimi/.claude/worktrees/agent-ab54e5fc492a09964
export HUKUK_LICENSE_URL=http://127.0.0.1:9
for KIP in kilitsiz kilitli; do
  S=/dev/shm/c6h3-olcum/parca-$KIP
  echo "== $KIP · başta yük $(cat /proc/loadavg) · $(date -u +%H:%M:%S)"
  rm -rf "$S"; mkdir -p /dev/shm/c6h3-olcum || exit 1
  cp -a "$SRC" "$S" || exit 1
  if [ "$KIP" = kilitli ]; then python3 -I /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a2-olcum/kilit.py "$S/data/destekofis.sqlite" || exit 1; fi
  timeout -k 10 1200 node --disable-warning=ExperimentalWarning --max-old-space-size=6144 "$N/betik/parca.mjs" "$ROOT" "$S"
  echo "çıkış $?"
  rm -rf "$S"
done
echo "sonda yük $(cat /proc/loadavg) · $(date -u +%H:%M:%S)"
