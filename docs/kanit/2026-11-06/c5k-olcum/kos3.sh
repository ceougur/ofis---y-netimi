#!/bin/bash
O=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5k-olcum
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a6f19e17f6fe2a037
export HUKUK_LICENSE_URL=http://127.0.0.1:9
export TZ=Europe/Istanbul
cd "$O" || exit 1
rm -rf "$O/k3-veri" && cp -a "$O/taban" "$O/k3-veri" || exit 1
echo "== yük $(cut -d' ' -f1-3 /proc/loadavg)"
timeout 1800 flock "$O/../olcum.lock" node olc3.mjs "$W" "$O/k3-veri" 2>&1 | grep -v -i "warning\|trace-warn"
echo "cikis ${PIPESTATUS[0]}"
rm -rf "$O/k3-veri"
