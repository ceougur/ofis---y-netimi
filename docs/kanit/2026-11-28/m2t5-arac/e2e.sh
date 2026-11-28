#!/bin/bash
# M2 tur 5 ekran senaryoları: yeni kod iki TZ (iki senaryo) + taban (eski kopya, yalnız değişen senaryo, UTC).
D=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m2t5
R=/home/user/ofis---y-netimi/.claude/worktrees/agent-a9a57b6814460a732
L=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock
export PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/pw-1194 HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR="$D/kanit"
run() { # $1 kök $2 ad $3 TZ $4 senaryo
  (cd "$1" && TZ=$3 EKRAN_DIR="$D/ekran-$2" flock -s -w 3600 "$L" timeout -k 5 900 node tools/kanit.mjs kos "$2" -- node --disable-warning=ExperimentalWarning "test/e2e/$4.mjs" 2>&1 | tail -1)
}
mkdir -p "$D/ekran-m2t5-e2e-iptal-EuropeIstanbul" "$D/ekran-m2t5-e2e-siniri-UTC" "$D/ekran-m2t5-e2e-siniri-EuropeIstanbul" "$D/ekran-m2t5-e2e-iptal-taban-UTC"
run "$R" m2t5-e2e-iptal-EuropeIstanbul Europe/Istanbul senaryo-degersiz-iptal-m2t2-251
run "$R" m2t5-e2e-siniri-UTC UTC senaryo-degersiz-siniri-m2-251
run "$R" m2t5-e2e-siniri-EuropeIstanbul Europe/Istanbul senaryo-degersiz-siniri-m2-251
cp "$R/test/e2e/senaryo-degersiz-iptal-m2t2-251.mjs" /dev/shm/m2t5-eski/eski/test/e2e/senaryo-degersiz-iptal-m2t2-251.mjs
run /dev/shm/m2t5-eski/eski m2t5-e2e-iptal-taban-UTC UTC senaryo-degersiz-iptal-m2t2-251
(cd /dev/shm/m2t5-eski/eski && git checkout -- test/e2e/senaryo-degersiz-iptal-m2t2-251.mjs)
