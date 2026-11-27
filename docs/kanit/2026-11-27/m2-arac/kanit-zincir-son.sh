#!/bin/bash
# M2 kanıt zinciri (yeni kod): yeni testler + komşular + ekran senaryosu, iki saat dilimi; her adım kendi süre sınırıyla, kanit.mjs kos ile.
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-afce913f2c07f70a9
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m2-kod
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$W/docs/kanit PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/pw-1194
cd $W || exit 1
for TZN in $1; do
  T=$(echo $TZN | tr '/' '-')
  echo "== $TZN yeni testler · $(cat /proc/loadavg)"
  TZ=$TZN timeout -k 5 1800 node tools/kanit.mjs kos m2-son-yeni-testler-$T -- node --disable-warning=ExperimentalWarning --test --test-concurrency=1 test/supheli-degersiz-siniri-m2-251.test.mjs test/supheli-degersiz-siniri-m2-v249-251.test.mjs 2>&1 | tail -1
  echo "== $TZN ekran · $(cat /proc/loadavg)"
  TZ=$TZN timeout -k 5 900 node tools/kanit.mjs kos m2-son-e2e-degersiz-siniri-$T -- node --disable-warning=ExperimentalWarning test/e2e/senaryo-degersiz-siniri-m2-251.mjs 2>&1 | tail -1
  echo "== $TZN komşular · $(cat /proc/loadavg)"
  TZ=$TZN timeout -k 5 5400 node tools/kanit.mjs kos m2-son-komsular-$T -- node --disable-warning=ExperimentalWarning --test --test-concurrency=1 $(cat $N/komsular.txt) 2>&1 | tail -1
  echo "== $TZN kâhin-cari · $(cat /proc/loadavg)"
  TZ=$TZN timeout -k 5 1800 node tools/kanit.mjs kos m2-son-kahin-cari-$T -- npm run test:kahin-cari > $N/kahin-son2-$T.out 2>&1; tail -1 $N/kahin-son2-$T.out
done
[ "$2" = e2e ] && echo "== e2e komşular (UTC) · $(cat /proc/loadavg)"
[ "$2" = e2e ] && for s in senaryo-supheli-230 senaryo-supheli-kuyruk-250 senaryo-banka-210; do
  TZ=UTC timeout -k 5 1800 node tools/kanit.mjs kos m2-son-e2e-$s -- node --disable-warning=ExperimentalWarning test/e2e/$s.mjs 2>&1 | tail -1
done
echo "bitti $(date -u +%H:%M:%S) · $(cat /proc/loadavg)"
