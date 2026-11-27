#!/bin/bash
# M2 son test dosyasıyla (25acf40c): yeni kodda iki TZ + eski kodda (taban) kırmızı iki TZ + eski kodda ekran.
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-afce913f2c07f70a9
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$W/docs/kanit PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/pw-1194
cd $W || exit 1
for TZN in UTC Europe/Istanbul; do
  T=$(echo $TZN | tr '/' '-')
  TZ=$TZN timeout -k 5 1800 node tools/kanit.mjs kos m2-son-yeni-testler-$T -- node --disable-warning=ExperimentalWarning --test --test-concurrency=1 test/supheli-degersiz-siniri-m2-251.test.mjs test/supheli-degersiz-siniri-m2-v249-251.test.mjs 2>&1 | tail -1
done
bash /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m2-kod/eski-zincir.sh
