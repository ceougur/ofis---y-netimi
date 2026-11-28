#!/bin/bash
# M2T3 kanıtlarını depoya kopyalar (docs/kanit/2026-11-28/m2t3-*).
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m2t3-ae39
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-ae39a10810940388a
T="$W/docs/kanit/2026-11-28"
cp "$S"/kanit/2026-11-28/m2t3-* "$T/" || exit 1
mkdir -p "$T/m2t3-mutant" "$T/m2t3-arac" "$T/m2t3-ekran" || exit 1
cp "$S"/kanit/mutant/* "$T/m2t3-mutant/" && cp "$S/kanit/mutant-ozet.txt" "$T/m2t3-mutant/ozet.txt" || exit 1
cp "$S"/kanit/komsu-UTC-yuk.txt "$S"/kanit/komsu-Europe-Istanbul-yuk.txt "$S/kanit/q1-yeni.txt" "$T/m2t3-arac/" || exit 1
cp "$S"/betik/*.py "$S"/betik/*.sh "$S"/betik/*.mjs "$S/komsu-liste.txt" "$S/komsu-duzenle.txt" "$T/m2t3-arac/" || exit 1
for d in UTC Europe-Istanbul eski-UTC eski-Europe-Istanbul; do
  for f in m2t3-3-avansli-iptal-reddi m2t3-4-duzenle-reddi; do cp "$S/kanit/ekran-$d/$f.png" "$T/m2t3-ekran/$d-$f.png" || exit 1; done
done
echo tamam
