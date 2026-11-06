#!/bin/bash
# BT5 madde 6: banka-230 ön koşul yarışı ZORLA (ders 20). Eski test (taban kopyası 578c12d4) ve düzeltilmiş test (worktree) aynı zorlamayla.
# Kullanım: b230-zorla.sh <HOF_ZORLA_B230 değeri> <ad-eki>
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a731f6dec73e0177c
for SIDE in eski yeni; do
  if [ "$SIDE" = eski ]; then R="$S/bt5-eski-578c"; else R="$W"; fi
  OUT="$S/bt5-kanit/b230-zorla-$2-$SIDE.txt"
  (cd "$R" && HOF_ZORLA_B230="$1" TZ=UTC PLAYWRIGHT_BROWSERS_PATH="$S/pw-1194" HUKUK_LICENSE_URL=http://127.0.0.1:9 timeout 1500 node --disable-warning=ExperimentalWarning --import ./test/e2e/banka-230-onkosul-zorla.mjs test/e2e/banka-230-hareket-yaris.mjs) > "$OUT" 2>&1
  CODE=$?
  echo "$SIDE ($1): çıkış $CODE · $(grep -cE '^\[b230-zorla\] (POST|cpu)' "$OUT") zorlama satırı · $(grep -E 'ön koşulu oluş|geçti, [0-9]+ kaldı' "$OUT" | tr '\n' ' ' | cut -c1-300)"
done
