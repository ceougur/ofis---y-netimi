#!/bin/bash
# AH + BS-6: son kanıtlar (komşu koşuları, son hedefli koşular, betikler) docs/kanit/2026-11-06'ya.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
D=/home/user/ofis---y-netimi/.claude/worktrees/agent-ab0062d42feec8f21/docs/kanit/2026-11-06
for f in $S/ah-kanit/2026-11-06/ah-komsu-* $S/ah-kanit/2026-11-06/ah-son-yeni-*; do
  b=$(basename "$f")
  if [ "$(stat -c %s "$f")" -gt 300000 ]; then gzip -c "$f" > "$D/$b.gz" || exit 1; else cp "$f" "$D/$b" || exit 1; fi
done
cp $S/ah-betik/komsu-kos-tz.sh $S/ah-betik/yasayan-mutant.mjs $S/ah-betik/eski-maliyet-olc.mjs $S/ah-betik/mutasyon.py $S/ah-betik/buyuk-esdeger-2.sh $S/ah-betik/kanit-son.sh $D/ah-betikler/ || exit 1
cp $S/ah-kanit/komsu-hepsi.txt $D/ah-komsu-listesi.txt || exit 1
ls $D/ah-mutasyon/
ls -la $D | grep " ah-"
du -sh $D/ah-* | sort -h | tail -5
