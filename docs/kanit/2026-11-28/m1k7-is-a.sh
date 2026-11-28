#!/bin/bash
# m1k7 iş A: yeni / taban birim (iki TZ), komşular (iki TZ), rastgele (iki TZ), kâhin defter (iki TZ), ekran senaryoları (iki TZ) + taban ekran senaryosu (iki TZ).
Y=/home/user/ofis---y-netimi/.claude/worktrees/agent-aa8f377d8c9dd1229
E=/dev/shm/m1k7-eski/eski
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m1k7
L=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$N/kanit PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/pw-1194
D=$N/durum-a.txt
: > "$D"
read l _ < /proc/loadavg; echo "yük $l (başlangıç)" >> "$D"
awk -v l="$l" 'BEGIN{exit !(l>4)}' && { sleep 120; echo "yük $(cut -d' ' -f1 /proc/loadavg) (tek bekleme sonrası)" >> "$D"; }
kos() { # ad dizin tz komut…
  local ad=$1 dir=$2 tz=$3; shift 3
  local s=$(date +%s)
  (cd "$dir" && TZ=$tz flock -s -w 3600 "$L" node "$Y/tools/kanit.mjs" kos "$ad" -- "$@" > /dev/null 2>&1)
  echo "$ad çıkış=$? süre=$(( $(date +%s) - s )) yük=$(cut -d' ' -f1 /proc/loadavg)" >> "$D"
}
YENI="test/kdv-ozeti-devreden-onarim-251.test.mjs test/kdv-ozeti-karma-251.test.mjs test/kdv-ozeti-yalniz391-251.test.mjs test/kdv-ozeti-s4-guncel-degil-251.test.mjs"
TABAN="test/kdv-ozeti-devreden-onarim-251.test.mjs test/m1k7-karma-yeni-beklenti.test.mjs test/m1k7-yalniz391-yeni-beklenti.test.mjs test/m1k7-s4-yeni-beklenti.test.mjs"
KOMSU="$(cat $Y/docs/kanit/2026-11-28/m1k6-komsu-liste.txt) test/kdv-ozeti-devreden-onarim-251.test.mjs"
for tz in UTC Europe/Istanbul; do
  t=${tz//\//-}
  kos m1k7-yeni-test-$t "$Y" $tz node --disable-warning=ExperimentalWarning --test --test-concurrency=1 $YENI
  kos m1k7-taban-kirmizi-$t "$E" $tz node --disable-warning=ExperimentalWarning --test --test-concurrency=1 $TABAN
  kos m1k7-komsu-$t "$Y" $tz node --disable-warning=ExperimentalWarning --test --test-concurrency=1 $KOMSU
  kos m1k7-kahin-defter-$t "$Y" $tz npm run test:kahin-defter
  for s in senaryo-kdv-mahsup-sonrasi-251 senaryo-kdv-zincir-251 senaryo-kdv-devreden-251 senaryo-kdv-donemi-250 senaryo-c7b-kabul-250 senaryo-defter-243; do
    kos m1k7-e2e-$s-$t "$Y" $tz node test/e2e/$s.mjs
  done
  (cd "$Y" && DEPO=$E TZ=$tz flock -s -w 3600 "$L" node "$Y/tools/kanit.mjs" kos m1k7-taban-e2e-kirmizi-$t -- node test/e2e/senaryo-kdv-mahsup-sonrasi-251.mjs > /dev/null 2>&1)
  echo "m1k7-taban-e2e-kirmizi-$t çıkış=$?" >> "$D"
  kos m1k7-rastgele-$t "$Y" $tz node --disable-warning=ExperimentalWarning --test test/kdv-ozeti-rastgele-251.test.mjs
done
echo BITTI >> "$D"
