#!/bin/bash
# Kilitli kipte parça ayrıştırması — ÖZEL ölçüm kilidinin içinde çağrılır.
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c6h1-ns
SRC=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/ana-kabul/temiz-100k
S=/dev/shm/c6h1-olcum/parca
WT=${1:-/home/user/ofis---y-netimi/.claude/worktrees/agent-a91ebf10c57360da7}
export HUKUK_LICENSE_URL=http://127.0.0.1:9
rm -rf "$S"
mkdir -p /dev/shm/c6h1-olcum || exit 1
cp -a "$SRC" "$S" || exit 1
python3 -I /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a2-olcum/kilit.py "$S/data/destekofis.sqlite" || exit 1
timeout -k 10 1800 node --disable-warning=ExperimentalWarning --max-old-space-size=6144 "$N/olc-parca.mjs" "$WT" "$S"
echo "çıkış $?"
rm -rf "$S"
