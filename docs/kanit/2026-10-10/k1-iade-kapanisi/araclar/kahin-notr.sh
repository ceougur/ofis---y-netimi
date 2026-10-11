#!/bin/bash
# K1 nötr koşular: bilinen fark kökleri (iade HARİÇ) kapatılır; kalan açık farkı iade kapanışından ya da yeni bir kökten gelir.
# $1 = depo kökü (güncel ya da K1 öncesi worktree), $2 = etiket (sonra/once)
set -u
ROOT=$1
TAG=$2
OUT=/home/user/ofis---y-netimi/.claude/worktrees/agent-ac6660b9cab091377/docs/kanit/2026-10-10/k1-iade-kapanisi/kahin/notr-$TAG
NOTR=iskonto_dahil,kasa_acilis,kart,fatura_yineleme,kasa_yineleme,vadeli,kredi
mkdir -p "$OUT"
cd "$ROOT"
for spec in 1:500 2:500 3:500 4:500 5:500 31:2000; do
  t=${spec%%:*}; n=${spec##*:}
  echo "### $TAG tohum $t × $n --notr $NOTR (kök $ROOT)" > "$OUT/tohum-$t-$n.log"
  python3 -I test/bagimsiz/fark.py --tohum "$t" --islem "$n" --notr "$NOTR" >> "$OUT/tohum-$t-$n.log" 2>&1
  echo "### çıkış $?" >> "$OUT/tohum-$t-$n.log"
  cp "test/bagimsiz/cikti/fark-$t.json" "$OUT/fark-$t.json" 2>/dev/null
  cp test/bagimsiz/cikti/fark-$t-notr.json "$OUT/" 2>/dev/null
  ls test/bagimsiz/cikti/ | grep -E "^fark-$t" > "$OUT/dosyalar-$t.txt"
done
echo BITTI > "$OUT/BITTI"
