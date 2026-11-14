#!/bin/bash
# Ç5-A tur 2c hız kabulü (ders 47, 53 (a)): taban (c5a2c-taban kopyası) ↔ yeni (İş 3 + İş 1 commit'inin kopyası), kilitsiz + kilitli; ölçüm kilidi dışarıdan (flock -x -n).
Q=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a2c-q
for kip in kilitsiz kilitli; do
  bash $Q/olcum/kos.sh $Q/taban taban $kip
  bash $Q/olcum/kos.sh $Q/c4 yeni $kip
done
echo BITTI > $Q/olcum/bitti
