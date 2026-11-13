#!/bin/bash
# Kabul C — komşu koşusu (son hâl): taramayla bulunan testler + bütün tyk-* + takvim / vade / tahsilat / iade / aktarım aileleri; iki TZ sırayla. Yük kilidi paylaşımlı.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a511c161b54069067
cd "$W" || exit 1
python3 -I $S/c5bkd-betik/komsu-tara.py > $S/c5bkd-kanit/komsu-tarama-ozet.txt || exit 1
{ cat $S/c5bkd-kanit/komsu-liste.txt; ls test/tyk-*.test.mjs test/dues.test.mjs test/takvim-*.test.mjs test/ux18-*.test.mjs test/tablodan-aktar-*.test.mjs test/cari-vade-*.test.mjs test/iade-*.test.mjs test/bulgu-223*.test.mjs test/plans*.test.mjs test/whatsapp-onizleme-*.test.mjs 2>/dev/null; } | sort -u > $S/c5bkd-kanit/komsu-liste-son.txt
echo "komşu dosya: $(wc -l < $S/c5bkd-kanit/komsu-liste-son.txt) · $(date -u +%H:%M:%S)"
for tz in "$@"; do
  ad=komsu-son-$(echo $tz | tr '/' '-' | tr 'A-Z' 'a-z')
  bash $S/c5bkd-betik/kos.sh $ad $tz 100 node --test --test-concurrency=2 $(cat $S/c5bkd-kanit/komsu-liste-son.txt)
  echo "$ad bitti $(date -u +%H:%M:%S) · yük $(cat /proc/loadavg)"
  grep -E "^not ok|^# (tests|pass|fail|cancelled|skipped)" $S/c5bkd-kanit/$ad.cikti | head -30
done
