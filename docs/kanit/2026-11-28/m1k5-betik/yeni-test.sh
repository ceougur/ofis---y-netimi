#!/bin/bash
# M1 KÜÇÜK TUR 5 — yeni iki test dosyası (kdv-ozeti-s4-guncel-degil-251, kdv-ozeti-rastgele-251): taban (t251-m1k4; ayrı kopya /dev/shm/m1k5-kdv/eski — worktree --detach;
# içine YALNIZ bu iki yeni test dosyası kopyalandı) ya da yeni kod; bir TZ. flock -s altında çağrılır.
# $1 = taban | yeni, $2 = utc | ist, $3 = yeni kodun kökü, $4 = kanıt klasörü.
WT=${3:-/home/user/ofis---y-netimi/.claude/worktrees/agent-a925406d24b0912d5}
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=${4:-/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m1k5/kanit}
TESTS="test/kdv-ozeti-s4-guncel-degil-251.test.mjs test/kdv-ozeti-rastgele-251.test.mjs"
case "$1" in taban) CODE=/dev/shm/m1k5-kdv/eski ;; yeni) CODE=$WT ;; *) echo "taban | yeni"; exit 2 ;; esac
case "$2" in utc) export TZ=UTC ;; ist) export TZ=Europe/Istanbul ;; *) echo "utc | ist"; exit 2 ;; esac
echo "== $1 $2 $(cat /proc/loadavg)"
cd "$CODE" || exit 1
timeout -k 5 3000 node "$WT/tools/kanit.mjs" kos "m1k5-yeni-test-$1-$2" -- node --test --test-reporter=tap $TESTS
