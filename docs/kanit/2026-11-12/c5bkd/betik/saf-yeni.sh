#!/bin/bash
# Dar kontrolün rastgele saf kuyruk üreticisi (57 örneği bulan tohumlar) YENİ kodda: Σ kalem = bakiye. Yük koşusu (paylaşımlı kilit, beklemeden), her koşu süre sınırlı.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a511c161b54069067
cd "$S/c5bkd-betik" || exit 1
run() { # ad ilkTohum sayı olay
  ROOT=$W flock -s -n "$S/olcum.lock" timeout -k 5 1500 node saf-rastgele.mjs "$2" "$3" "$4" > "$S/c5bkd-kanit/$1.json" 2> "$S/c5bkd-kanit/$1.err"
  echo "$1 cikis=$?"
}
run saf-22-yeni 2001 400 22
run saf-40-yeni 5001 150 40
run saf-70-yeni 8001 60 70
echo BITTI
