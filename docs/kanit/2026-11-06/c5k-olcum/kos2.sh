#!/bin/bash
# Ç5-K ölçüm 2: önce / sonra / önce / sonra (yük kaymasını dengelemek için sıralı, her koşu taze kopya; flock olcum.lock — ders 15).
O=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5k-olcum
E=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5k-eski-f5903164
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a6f19e17f6fe2a037
export HUKUK_LICENSE_URL=http://127.0.0.1:9
export TZ=Europe/Istanbul
cd "$O" || exit 1
for i in 1 2; do
  for v in once sonra; do
    rm -rf "$O/k2-veri" && cp -a "$O/taban" "$O/k2-veri" || exit 1
    root="$W"; [ "$v" = once ] && root="$E"
    echo "== $v $i $(date -u +%H:%M:%S) $(cut -d' ' -f1-3 /proc/loadavg)"
    timeout 1800 flock "$O/../olcum.lock" node olc2.mjs "$root" "$O/k2-veri" 100 2>&1 | grep -v -i "warning\|trace-warn"
  done
done
rm -rf "$O/k2-veri"
