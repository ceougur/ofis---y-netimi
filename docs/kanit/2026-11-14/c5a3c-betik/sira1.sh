#!/bin/bash
K=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a3c-k7
cd $K || exit 1
echo "basla $(date -u +%H:%M:%S) $(cat /proc/loadavg)" > $K/sira1.log
$K/kahin.sh taban $K/taban
echo "taban-kahin bitti $(date -u +%H:%M:%S)" >> $K/sira1.log
$K/komsu1.sh /home/user/ofis---y-netimi/.claude/worktrees/agent-a21e56c46518ba374 $K/k1-yeni > $K/k1-yeni.ozet 2>&1
echo "komsu bitti $(date -u +%H:%M:%S)" >> $K/sira1.log
