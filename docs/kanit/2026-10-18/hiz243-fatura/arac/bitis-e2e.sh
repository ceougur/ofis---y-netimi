#!/bin/bash
# 2.4.3 hız düzeltmesi bitişi: etkilenen bütün e2e (ortak kilit altında, tek tek; kanıt aracıyla) ve 10.000 faturalı gerçek eski kod fark testi.
set -uo pipefail
S=/tmp/claude-0/-home-user/9cd0e60e-f0c5-5d7d-bc4f-899fff43162d/scratchpad
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a477c416a56bc423c
OUT=$S/hiz243-arac/bitis
mkdir -p $OUT
export HUKUK_LICENSE_URL=http://127.0.0.1:9
exec 9>$S/e2e-243.lock
echo "kilit bekleniyor $(date -u +%T)" >> $OUT/ozet.log
flock 9
echo "kilit alındı $(date -u +%T); df $(df -h / | tail -1 | awk '{print $4}') boş" >> $OUT/ozet.log
cd $S/hiz243-arac
KLASOR=$PWD/tam ESKI=$S/hiz243-eski-4d546e9 YENI=$S/hiz243-sonra-4d1624e node --disable-warning=ExperimentalWarning fark-10k.mjs > $OUT/fark-10k.json 2> $OUT/fark-10k.err
echo "fark-10k çıkış $? $(date -u +%T)" >> $OUT/ozet.log
cd $W
for t in hiz-243-arka-plan fatura-243-daha-fazla-yaris fatura-243-duzen-kaymasi senaryo-214 senaryo-222 banka-230-hareket-yaris banka-210-kart-onbellek banka-210-daha-fazla acilis-yanit-yaris senaryo-rapor senaryo-216 senaryo-223 senaryo-224 senaryo-pos-220 senaryo-entegrator-240 senaryo-ebelge-242 senaryo-ebelge-243 e2e; do
  timeout 2400 node tools/kanit.mjs kos hiz243-e2e-$t -- npm run -s test:$t > $OUT/$t.out 2>&1
  echo "$t çıkış $? $(date -u +%T): $(grep -E '[0-9]+ geçti|# pass|# fail|geçti,' $OUT/$t.out | tail -2 | tr '\n' ' ')" >> $OUT/ozet.log
done
echo "E2E BİTTİ $(date -u +%T)" >> $OUT/ozet.log
