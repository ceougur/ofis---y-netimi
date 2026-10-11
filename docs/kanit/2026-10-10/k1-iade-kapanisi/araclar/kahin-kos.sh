#!/bin/bash
# K1 bağımsız kâhin koşuları (sırayla). Çıktılar: $OUT/<ad>.log ve fark JSON kopyaları.
set -u
ROOT=/home/user/ofis---y-netimi/.claude/worktrees/agent-ac6660b9cab091377
OUT=$ROOT/docs/kanit/2026-10-10/k1-iade-kapanisi/kahin
mkdir -p "$OUT"
cd "$ROOT"
run() {
  local name=$1; shift
  echo "### $name: python3 -I test/bagimsiz/fark.py $*" > "$OUT/$name.log"
  python3 -I test/bagimsiz/fark.py "$@" >> "$OUT/$name.log" 2>&1
  echo "### çıkış $?" >> "$OUT/$name.log"
}
run en-kucuk-IADE-KAPAMA --senaryo test/bagimsiz/cikti/en-kucuk-IADE-KAPAMA.json
cp test/bagimsiz/cikti/fark-en-kucuk-IADE-KAPAMA.json "$OUT/" 2>/dev/null
for f in test/bagimsiz/cikti/mini/mini-iade-*.json; do
  b=$(basename "$f" .json)
  run "$b" --senaryo "$f"
  cp "test/bagimsiz/cikti/mini/fark-$b.json" "$OUT/fark-$b.json" 2>/dev/null
done
for t in 1 2 3 4 5; do
  run "tohum-$t-500" --tohum "$t" --islem 500
  cp "test/bagimsiz/cikti/fark-$t.json" "$OUT/fark-$t.json" 2>/dev/null
done
run "tohum-31-2000" --tohum 31 --islem 2000
cp test/bagimsiz/cikti/fark-31.json "$OUT/fark-31.json" 2>/dev/null
echo KAHIN-BITTI > "$OUT/BITTI"
