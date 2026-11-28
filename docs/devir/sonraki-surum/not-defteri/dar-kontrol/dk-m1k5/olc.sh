#!/bin/bash
# Hız: aynı temiz-100k kopyası, önce eski (t251-m1k4) sonra yeni (t251-m1k5), her kod için taze kopya; sonra bir kez daha yeni → eski (sıra etkisi).
# Özel kilitle çağrılır: flock -x -w 1800 olcum.lock bash olc.sh
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-m1k5
SRC=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/ana-kabul/temiz-100k
K=/dev/shm/dk-m1k5-olc
OUT=$N/olc.txt
export HUKUK_LICENSE_URL=http://127.0.0.1:9
echo "HIZ dk-m1k5 · nproc $(nproc) · başta $(cat /proc/loadavg) · $(date -u +%H:%M:%S)" > "$OUT"
for pair in eski:/dev/shm/dk-m1k5-eski yeni:/home/user/ofis---y-netimi/.claude/worktrees/agent-a77bb907d27f6fded yeni:/home/user/ofis---y-netimi/.claude/worktrees/agent-a77bb907d27f6fded eski:/dev/shm/dk-m1k5-eski; do
  rm -rf /dev/shm/dk-m1k5-olc && cp -a "$SRC" "$K" || exit 1
  sync
  echo "=== ${pair%%:*} · başta $(cat /proc/loadavg)" >> "$OUT"
  timeout 1200 node --disable-warning=ExperimentalWarning "$N/olc-kdv.mjs" "${pair#*:}" "$K" 5 >> "$OUT" 2>&1
  echo "çıkış $? · sonda $(cat /proc/loadavg)" >> "$OUT"
done
rm -rf /dev/shm/dk-m1k5-olc
echo "bitti $(date -u +%H:%M:%S)" >> "$OUT"
