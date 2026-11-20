#!/bin/bash
# Ç6-HESAP tur 2 — kırmızı kanıt (ders 7, 38, 51): yeni / değişen testler c6h2-taban (469a3d9b) kopyasında (/dev/shm/c6h2-eski). YÜK: flock -s ile çağrılır.
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c6h2-ana
WT=/home/user/ofis---y-netimi/.claude/worktrees/agent-a7236347e0f8b6e8c
OLD=/dev/shm/c6h2-eski
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$N
for f in c6h-bilanco.test.mjs c6h-bilanco-uc.test.mjs c6h-ba.test.mjs c6h-s209.test.mjs; do cp "$WT/test/$f" "$OLD/test/$f" || exit 1; done
cp "$WT/test/c6h-degerleme.test.mjs" "$OLD/test/c6h-degerleme-yeni.test.mjs" || exit 1
# B-a ve S209'un Gelir Tablosu / değerleme bölümleri eski kodda DEĞERLE koşsun (eski kodda balanceSheet yok — o testler "yok" hatasıyla, öbürleri sayıyla kırmızı):
for f in c6h-ba c6h-s209; do
  sed 's/^import { balanceSheet, incomeStatement } from "..\/server\/lib\/financial-statements.mjs";/import { incomeStatement } from "..\/server\/lib\/financial-statements.mjs";\nconst balanceSheet = () => { throw new Error("eski kodda balanceSheet yok"); };/' "$WT/test/$f.test.mjs" > "$OLD/test/$f.test.mjs" || exit 1
done
cd "$OLD" || exit 1
echo "başta yük $(cat /proc/loadavg) · $(date -u +%H:%M:%S) · eski kod $(grep -c balanceSheet server/lib/financial-statements.mjs) balanceSheet anması"
for f in c6h-bilanco c6h-bilanco-uc c6h-ba c6h-s209 c6h-degerleme-yeni; do
  TZ=UTC timeout -k 10 900 node --test test/$f.test.mjs > $N/kirmizi-$f.log 2>&1
  echo "$f çıkış $? · $(grep -E '^# (tests|pass|fail)' $N/kirmizi-$f.log | tr '\n' ' ')"
done
echo "sonda yük $(cat /proc/loadavg) · $(date -u +%H:%M:%S)"
