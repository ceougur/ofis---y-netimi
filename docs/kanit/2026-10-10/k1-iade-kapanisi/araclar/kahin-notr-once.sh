#!/bin/bash
# K1 öncesi kod (aee0906 worktree) ile aynı nötr koşular: tohum 1–3 × 500 (iade nötrleştirilmez).
set -u
ROOT=/tmp/claude-0/-home-user/f3fde27e-cd8e-54af-b1ca-43dd7d833c3d/scratchpad/onceki
OUT=/home/user/ofis---y-netimi/.claude/worktrees/agent-ac6660b9cab091377/docs/kanit/2026-10-10/k1-iade-kapanisi/kahin/notr-once
NOTR=iskonto_dahil,kasa_acilis,kart,fatura_yineleme,kasa_yineleme,vadeli,kredi
mkdir -p "$OUT"
cd "$ROOT"
for t in 1 2 3; do
  echo "### K1 öncesi (aee0906) tohum $t × 500 --notr $NOTR" > "$OUT/tohum-$t-500.log"
  python3 -I test/bagimsiz/fark.py --tohum "$t" --islem 500 --notr "$NOTR" >> "$OUT/tohum-$t-500.log" 2>&1
  echo "### çıkış $?" >> "$OUT/tohum-$t-500.log"
  cp "test/bagimsiz/cikti/fark-$t-notr.json" "$OUT/" 2>/dev/null
done
echo BITTI > "$OUT/BITTI"
