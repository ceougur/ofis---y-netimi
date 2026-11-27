#!/bin/bash
# S129 bakımı koşuları (yük kilidi paylaşımlı, tek seferde): eski kâhin kırmızısı + öz test iki TZ
E=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/kahinmobil-s129
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a853e4598e7776030
cd "$W" || exit 1
echo "baslangic $(date -u +%H:%M:%S) yuk $(cat /proc/loadavg)"
true

TZ=UTC KANIT_DIR="$E/kanit" node tools/kanit.mjs kos kahinmobil-s129-oz-utc -- python3 -I -B test/bagimsiz/mobil-yazma/kahin_test.py > "$E/kanit/oz2-utc.konsol" 2>&1
echo "oz-utc cikis $?"
TZ=Europe/Istanbul KANIT_DIR="$E/kanit" node tools/kanit.mjs kos kahinmobil-s129-oz-ist -- python3 -I -B test/bagimsiz/mobil-yazma/kahin_test.py > "$E/kanit/oz2-ist.konsol" 2>&1
echo "oz-ist cikis $?"
echo "bitis $(date -u +%H:%M:%S) yuk $(cat /proc/loadavg)"
