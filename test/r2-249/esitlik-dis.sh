#!/bin/bash
# 2.4.9 R2: eşdeğerlik zincirinin son adımı ayrı (ilk zincir arka plan süre sınırında (30 dk) diş koşusundan önce durdu): yeni kod, çeşitli iadeli kopya, UTC, "dis".
S=/tmp/claude-0/-home-user/2a941a30-cea4-5380-a679-f28a541c21a1/scratchpad/r2-249-aa56
YENI=/home/user/ofis---y-netimi/.claude/worktrees/agent-aa56c65749221d09d
K=$YENI/docs/kanit/2026-11-03/r2/esitlik
export HUKUK_LICENSE_URL=http://127.0.0.1:9
cd $YENI || exit 1
TZ=UTC flock /tmp/destekofis-olcum.lock node --disable-warning=ExperimentalWarning test/r2-249/esitlik-kos.mjs $S/hazir-cesit $S/is-esitlik-yeni $S/esitlik/yeni-cesit-UTC-dis.json dis > $K/yeni-cesit-UTC-dis.log 2>&1
echo "yeni-cesit-UTC-dis çıkış=$?" | tee -a $K/zincir.txt
rm -rf $S/is-esitlik-yeni
{ date -u; uptime; df -h / | tail -1; } > $K/sonda.txt
echo bitti | tee -a $K/zincir.txt
