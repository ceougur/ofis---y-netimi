#!/bin/bash
# m2t6: yeni test — yeni kod ve taban kopyası, iki TZ
K=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m2t6-kanit
YENI=/home/user/ofis---y-netimi/.claude/worktrees/agent-a961aa7259bce4276
ESKI=/dev/shm/m2t6-yk/eski
export HUKUK_LICENSE_URL=http://127.0.0.1:9
for tz in UTC Europe/Istanbul; do
  s=$(echo $tz | tr '/' '-')
  (cd $YENI && TZ=$tz KANIT_DIR=$K node tools/kanit.mjs kos m2t6-yeni-$s -- node --test test/supheli-degersiz-m2t6-251.test.mjs test/supheli-degersiz-m2t5-251.test.mjs > $K/yeni-$s.txt 2>&1; echo "yeni $tz çıkış $?" >> $K/ozet.txt)
  (cd $ESKI && TZ=$tz KANIT_DIR=$K node $YENI/tools/kanit.mjs kos m2t6-eski-$s -- node --test test/supheli-degersiz-m2t6-251.test.mjs > $K/eski-$s.txt 2>&1; echo "eski $tz çıkış $?" >> $K/ozet.txt)
done
