#!/bin/bash
# Ç5-A tur 3b — son kanıt koşuları (dıştan flock -s -n): kalıcı test iki TZ (kanit kos) + Mutabakat / Defter Mutabakatı testleri iki TZ (tur 3a'nın listesi).
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a3b-z4
cd /home/user/ofis---y-netimi/.claude/worktrees/agent-a076afd863444806e || exit 1
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$N/kanit
MUT="test/mutabakat-cekirdek.test.mjs test/mutabakat-213.test.mjs test/mutabakat-araci-uyari-250.test.mjs test/banka-210-mutabakat-araci.test.mjs test/mutabakat-yil-donumu.test.mjs test/defter-243-kapi.test.mjs test/defter-243-raporlar.test.mjs test/kural-farki-alarm-250.test.mjs test/kural-farki-duzeltme-250.test.mjs test/kural-farki-kapi-disi-250.test.mjs"
echo "son başta $(cat /proc/loadavg) $(date -u +%H:%M:%S)"
for Z in UTC Europe/Istanbul; do
  TZ=$Z timeout -k 5 900 node tools/kanit.mjs kos c5a3b-oi-${Z#*/} -- node --disable-warning=ExperimentalWarning --test test/obligation-input-250.test.mjs > $N/oi-${Z#*/}.out 2>&1; echo "oi $Z çıkış $? · $(tail -1 $N/oi-${Z#*/}.out | cut -c1-160)"
  TZ=$Z timeout -k 5 1800 node tools/kanit.mjs kos c5a3b-mutabakat-${Z#*/} -- node --disable-warning=ExperimentalWarning --test --test-concurrency=1 $MUT > $N/mutabakat-${Z#*/}.out 2>&1; echo "mutabakat $Z çıkış $? · $(tail -1 $N/mutabakat-${Z#*/}.out | cut -c1-160)"
done
echo "son sonda $(cat /proc/loadavg) $(date -u +%H:%M:%S)"
