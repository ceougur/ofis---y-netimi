#!/bin/bash
# Ç5-A tur 2b hız kabulü (ders 47, 53 (a)): taban (c5a2b-taban kopyası) ↔ yeni (HEAD kopyası), kilitsiz + kilitli; ölçüm kilidi dışarıdan (flock -x -n).
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
for kip in kilitsiz kilitli; do
  bash $S/c5a2b-olcum/kos.sh $S/c5a2b-q4/taban taban $kip
  bash $S/c5a2b-olcum/kos.sh $S/c5a2b-q4/mut yeni $kip
done
echo BITTI > $S/c5a2b-olcum/bitti
