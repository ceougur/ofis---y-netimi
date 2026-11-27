#!/bin/bash
# Kanıtlı koşu (yük kilidi paylaşımlı, beklemeden): kos.sh <ad> <TZ> <dakika> <komut> [arg...]   — çalışma ağacında koşar; kayıt c5bkd-kanit/<gün>/c5bkd-<ad>.json
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a511c161b54069067
ad=$1; tz=$2; dk=$3; shift 3
cd "$W" || exit 1
TZ=$tz HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$S/c5bkd-kanit PLAYWRIGHT_BROWSERS_PATH=$S/pw-1194 \
  flock -s -n "$S/olcum.lock" node tools/kanit.mjs kos "c5bkd-$ad" --sure "$dk" -- "$@" > "$S/c5bkd-kanit/$ad.cikti" 2>&1
code=$?
[ $code -eq 1 ] && ! grep -q "kanit\|Hüküm\|GEÇTİ\|BAŞARISIZ" "$S/c5bkd-kanit/$ad.cikti" && echo "KİLİT DOLU ya da araç hatası (çıkış 1)"
tail -4 "$S/c5bkd-kanit/$ad.cikti" | cut -c1-300
echo "cikis=$code ($ad, TZ=$tz)"
exit $code
