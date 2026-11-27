#!/bin/bash
# M2 eski kod kırmızısı (taban t251-m2-taban, ayrı worktree): yalnız YENİ test dosyaları kopyalanır (ders 51), iki saat dilimi + ekran senaryosu.
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-afce913f2c07f70a9
E=/dev/shm/m2-kod/eski
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$W/docs/kanit PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/pw-1194
cp $W/test/supheli-degersiz-siniri-m2-251.test.mjs $W/test/supheli-degersiz-siniri-m2-v249-251.test.mjs $E/test/ || exit 1
cp $W/test/fixtures/m2-degersiz-senaryo.mjs $E/test/fixtures/ && cp $W/test/fixtures/m2-degersiz-v249/* $E/test/fixtures/m2-degersiz-v249/ && cp $W/test/e2e/senaryo-degersiz-siniri-m2-251.mjs $E/test/e2e/ || exit 1
cd $E || exit 1
for TZN in UTC Europe/Istanbul; do
  T=$(echo $TZN | tr '/' '-')
  TZ=$TZN timeout -k 5 1800 node $W/tools/kanit.mjs kos m2-eski-taban-yeni-testler-$T -- node --disable-warning=ExperimentalWarning --test --test-concurrency=1 test/supheli-degersiz-siniri-m2-251.test.mjs test/supheli-degersiz-siniri-m2-v249-251.test.mjs > /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m2-kod/eski-son-$T.out 2>&1
  tail -1 /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m2-kod/eski-son-$T.out
done
TZ=UTC timeout -k 5 900 node $W/tools/kanit.mjs kos m2-eski-taban-e2e-degersiz-siniri -- node --disable-warning=ExperimentalWarning test/e2e/senaryo-degersiz-siniri-m2-251.mjs > /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m2-kod/eski-son-e2e.out 2>&1
tail -1 /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m2-kod/eski-son-e2e.out
