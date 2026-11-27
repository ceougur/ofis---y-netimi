#!/bin/bash
# Ç5-A tur 3b — sıralı yük koşuları (tek seferde biri; dıştan `flock -s -n olcum.lock` ile): mutasyon (yeni HEAD kopyası) → kâhin → komşular iki TZ → eşdeğerlik (temiz 100k, v2.4.9).
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
T=$S/c5a3b-z4
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a076afd863444806e
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$T/kanit
echo "yük başta $(cat /proc/loadavg) · $(date -u +%H:%M:%S) · HEAD $(cd $W && git rev-parse --short HEAD)"
# 1) mutasyon — yeni HEAD'in ayrı kopyası
rm -rf $T/mut && mkdir -p $T/mut $T/mut-dokum || exit 1
(cd $W && git archive HEAD ':!docs/kanit') | tar -x -C $T/mut || exit 1
ln -s /home/user/ofis---y-netimi/node_modules $T/mut/node_modules
(cd $W && node tools/kanit.mjs kos c5a3b-mut-oi -- node $T/mut/test/obligation-input-250-mutasyon.mjs --kopya $T/mut --dokum $T/mut-dokum > $T/mut-oi.out 2>&1); echo "mutasyon çıkış $? · $(grep SONUÇ $T/mut-oi.out) · $(date -u +%H:%M:%S)"
(cd $W && node tools/kanit.mjs kos c5a3b-mut-r2 -- node $T/mut/test/r2-249/mutasyon.mjs $T/mut > $T/mut-r2.out 2>&1); echo "r2 çıkış $? · $(grep -E '^# (pass|fail)' $T/mut-r2.out | tr '\n' ' ') · $(date -u +%H:%M:%S)"
rm -rf $T/tyk-mut-k && mkdir -p $T/tyk-mut-k
(cd $W && node tools/kanit.mjs kos c5a3b-mut-tyk -- node $T/mut/test/tyk-mutasyon-250.mjs --klasor $T/tyk-mut-k --yalniz KD1-c,KD1-d,KD1-e,KD1-f,KD1-i > $T/mut-tyk.out 2>&1); echo "tyk çıkış $? · $(grep -c ÖLDÜ $T/mut-tyk.out) öldü · $(date -u +%H:%M:%S)"
rm -rf $T/tyk-mut-k $T/mut
# 2) kâhin taban ↔ yeni + yapım aşaması listesi kendi kopyada
bash $T/betik/kahin.sh > $T/kahin.log 2>&1; echo "kâhin çıkış $? · $(date -u +%H:%M:%S)"
# 4) eşdeğerlik
bash $T/betik/esd.sh temiz100k $S/ana-kabul/temiz-100k > $T/esd-temiz100k.log 2>&1; echo "esd temiz100k çıkış $? · $(grep SONUÇ $T/esd-temiz100k.log) · $(date -u +%H:%M:%S)"
bash $T/betik/esd.sh v249 $T/v249-kaynak 2026-10-20T12:00:00+03:00 > $T/esd-v249.log 2>&1; echo "esd v249 çıkış $? · $(grep SONUÇ $T/esd-v249.log) · $(date -u +%H:%M:%S)"
echo "yük sonda $(cat /proc/loadavg) · $(date -u +%H:%M:%S)"
