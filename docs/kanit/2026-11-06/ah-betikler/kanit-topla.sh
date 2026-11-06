#!/bin/bash
# AH + BS-6 kanıtlarını depoya (docs/kanit/2026-11-06/ah-*) toplar; büyük ham çıktılar .gz.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-ab0062d42feec8f21
D=$W/docs/kanit/2026-11-06
mkdir -p $D/ah-olcum $D/ah-betikler $D/ah-mutasyon $D/ah-esdegerlik || exit 1
# kanit.mjs kos kayıtları (json + log)
for f in $S/ah-kanit/2026-11-06/ah-*; do
  b=$(basename "$f")
  if [ "$(stat -c %s "$f")" -gt 300000 ]; then gzip -c "$f" > "$D/$b.gz"; else cp "$f" "$D/$b"; fi
done
# ölçümler
cp $S/ah-kanit/acilis-*.json $S/ah-kanit/gerileme-*.log $S/ah-kanit/sonra-*.log $S/ah-kanit/once-sonra-*.log $S/ah-kanit/v210-veri-*.log $D/ah-olcum/ 2>/dev/null
cp $S/ah-kanit/eski-maliyet-*.json $S/ah-kanit/profil-*.txt $S/ah-kanit/bs6-uret-*.json $D/ah-olcum/ 2>/dev/null
# eşdeğerlik
for f in $S/ah-kanit/esd/*.json $S/ah-kanit/esd/*.log; do
  [ -f "$f" ] || continue
  b=$(basename "$f")
  if [ "$(stat -c %s "$f")" -gt 300000 ]; then gzip -c "$f" > "$D/ah-esdegerlik/$b.gz"; else cp "$f" "$D/ah-esdegerlik/$b"; fi
done
# mutasyon çıktıları
for f in $S/ah-kanit/mut-*.txt; do
  b=$(basename "$f")
  gzip -c "$f" > "$D/ah-mutasyon/$b.gz"
done
cp $S/ah-kanit/mutasyon-ozet.txt $D/ah-mutasyon/ 2>/dev/null
# betikler
cp $S/ah-betik/*.mjs $S/ah-betik/*.sh $S/ah-betik/*.py $D/ah-betikler/
cp $S/ah-kanit/komsu-hepsi.txt $D/ah-komsu-listesi.txt
ls -la $D | grep " ah-" ; du -sh $D/ah-*
