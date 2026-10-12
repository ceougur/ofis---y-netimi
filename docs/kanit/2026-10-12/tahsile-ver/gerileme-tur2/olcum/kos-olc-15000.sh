#!/bin/bash
# Aynı veri kopyası (her ölçümde taze kopya), eski ↔ yeni sırayla iki tur. Bağımsız doğrulayıcı; kod değiştirmez.
set -u
S=/tmp/claude-0/-home-user/9cd0e60e-f0c5-5d7d-bc4f-899fff43162d/scratchpad
D=$(cd "$(dirname "$0")" && pwd); cd "$D"
uptime > olc15000.durum
for tur in 1 2; do
  for v in v2.1.0 guncel; do
    rm -rf $S/gerileme-tur2-olc-kopya; cp -a $S/gerileme-tur2-olcum-veri-15000 $S/gerileme-tur2-olc-kopya
    node olc.mjs $v $S/gerileme-tur2-olc-kopya 5 olc15000-$v-$tur.json > olc15000-$v-$tur.log 2>&1; echo "$v tur $tur cikis=$? $(uptime)" >> olc15000.durum
  done
done
rm -rf $S/gerileme-tur2-olc-kopya
echo BITTI >> olc15000.durum
