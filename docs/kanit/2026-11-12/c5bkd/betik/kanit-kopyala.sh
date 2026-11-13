#!/bin/bash
# Kanıtı depoya alır: docs/kanit/2026-11-12/c5bkd/ (kanıt aracının JSON + günlükleri, ölçümler, profil, motor, S99 bulgusu, F karşılaştırması, betikler).
# Ham .cikti dosyalarından yalnız kanıt aracının günlüğü OLMAYANLAR (el koşuları) alınır — araç koşularının günlüğü kanit/ altında zaten var.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a511c161b54069067
D=$W/docs/kanit/2026-11-12/c5bkd
mkdir -p "$D/kanit" "$D/olcum" "$D/motor" "$D/s99-bulgu" "$D/F" "$D/betik" "$D/el-kosulari" || exit 1
cp $S/c5bkd-kanit/2026-11-12/c5bkd-*.json $S/c5bkd-kanit/2026-11-12/c5bkd-*.log "$D/kanit/" || exit 1
cp -r $S/c5bkd-kanit/hiz-kabul "$D/olcum/" && cp $S/c5bkd-kanit/hiz-acilis-1.txt $S/c5bkd-kanit/m5-motor-cpu.txt $S/c5bkd-kanit/m5-cek-ani-esdegerlik-100k.txt "$D/olcum/" || exit 1
cp $S/c5bkd-prof/ilik-*.txt $S/c5bkd-prof/borc-*.txt "$D/olcum/" 2>/dev/null
cp $S/c5bkd-kanit/motor/*.out "$D/motor/" || exit 1
cp $S/c5bkd-kanit/s99-bulgu/* "$D/s99-bulgu/" || exit 1
cp $S/c5bkd-kanit/F/* "$D/F/" || exit 1
cp $S/c5bkd-kanit/*.txt "$D/el-kosulari/" || exit 1
cp $S/c5bkd-betik/*.sh $S/c5bkd-betik/*.py $S/c5bkd-betik/commit-*.txt "$D/betik/" || exit 1
for f in prof-zil.mjs prof-ilik.mjs prof-oku.mjs prof-sql.mjs sql-dene.mjs sql-dene2.mjs sema-bak.mjs hiz-uc.mjs acilis.mjs mutant-fark.mjs motor-incele.mjs k28-bak.mjs n7-bak.mjs olc-yazim.mjs olc-kart.mjs fark-dok.mjs ham-kos.mjs s129-pdf.mjs; do [ -f $S/c5bkd-betik/$f ] && cp $S/c5bkd-betik/$f "$D/betik/"; done
du -sh "$D"; find "$D" -type f | wc -l
# Gizli / kişisel veri denetimi: parola, anahtar, e-posta izi olmamalı.
grep -rIl -i "BEGIN .*PRIVATE KEY\|imza-anahtari\|api[_-]\?key\s*[:=]" "$D" | head -5
echo "kopya bitti"
