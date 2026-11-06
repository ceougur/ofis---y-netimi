#!/usr/bin/env bash
# Ç2 tur 3 kanıtını depoya taşır: kanit.mjs kayıtları (c2t3-*.json/.log), ölçüm çıktıları ve betikler → docs/kanit/2026-11-06/. Commit YAPMAZ.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
D=/home/user/ofis---y-netimi/.claude/worktrees/agent-a7280bb16b4491d5b/docs/kanit/2026-11-06
mkdir -p "$D/c2t3-betik" || exit 1
cp "$S"/c2t3-kanit/2026-11-06/c2t3-* "$D/" || exit 1
for f in kos-ozet.txt g2-liste.txt v249-kesik.txt olcum-kayit.txt taban-kesik.txt banka-iptal-eski.log; do cp "$S/c2t3-calisma/$f" "$D/c2t3-olcum-$f" || exit 1; done
for f in c2t3-kos.sh c2t3-kos2.sh g2-liste.mjs banka-iptal.mjs taban-kesik.mjs taban-kos.sh v249-kesik.mjs olcum-kayit.mjs olcum-kos.sh hukum.mjs mutant-denetim.mjs kanit-tasi.sh; do cp "$S/c2t3-betik/$f" "$D/c2t3-betik/$f" || exit 1; done
ls "$D" | grep -c "^c2t3"
