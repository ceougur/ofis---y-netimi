#!/usr/bin/env bash
# taban-kesik.mjs: eski (bc495a1c) ve yeni kodla, 6.000 ve 100 karakterlik bozuk tarih.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
cd "$S/c2t3-betik" || exit 1
OUT="$S/c2t3-calisma/taban-kesik.txt"
: > "$OUT"
for root in "$S/c2t3-eski-bc495a1c" /home/user/ofis---y-netimi/.claude/worktrees/agent-a7280bb16b4491d5b; do
  for len in 6000 100; do
    echo "== $(basename "$root") uzunluk $len" >> "$OUT"
    HUKUK_LICENSE_URL=http://127.0.0.1:9 TZ=UTC timeout 300 node --disable-warning=ExperimentalWarning taban-kesik.mjs "$root" "$len" >> "$OUT" 2>&1
    echo "çıkış $?" >> "$OUT"
  done
done
cat "$OUT"
