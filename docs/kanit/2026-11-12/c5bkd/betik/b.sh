#!/bin/bash
# Kullanım: b.sh <kod kökü: yeni|taban|tam yol> <saniye> <betik> [argümanlar...]   — çıktı stdout (JSON), hata akışı süzülür. TZ ortamdan.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
kod=$1; sn=$2; betik=$3; shift 3
case "$kod" in
  yeni) R=/home/user/ofis---y-netimi/.claude/worktrees/agent-a511c161b54069067 ;;
  taban) R=$S/c5bkd-taban ;;
  *) R=$kod ;;
esac
cd "$S/c5bkd-betik" || exit 1
ROOT=$R HUKUK_LICENSE_URL=http://127.0.0.1:9 timeout -k 5 "$sn" node "$betik" "$@" 2> "$S/c5bkd-betik/son.err"
code=$?
grep -v "ExperimentalWarning\|trace-warnings" "$S/c5bkd-betik/son.err" | tail -5 | cut -c1-400 >&2
exit $code
