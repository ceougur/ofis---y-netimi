#!/bin/bash
# Para değişmezi: aynı istek dizisi eski (surucu5-uc) ve yeni kodda, iki TZ; çıktılar birebir karşılaştırılır.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/s229-a343
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a343eda2c3de7a0a1
cp "$W/test/s229-para-degismezi.mjs" "$S/eski/test/" || exit 1
for tz in UTC Europe/Istanbul; do
  t=${tz##*/}
  for kod in yeni eski; do
    K=$W
    [ "$kod" = eski ] && K=$S/eski
    (cd "$K" && TMPDIR=/dev/shm/s229-a343-tmp TZ=$tz HUKUK_LICENSE_URL=http://127.0.0.1:9 timeout -k 5 600 flock -s -w 3600 /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock node test/s229-para-degismezi.mjs "$S/pd-$kod-$t.json") || echo "KOSU HATASI $kod $t"
  done
  python3 -I "$S/pd-karsilastir.py" "$S/pd-eski-$t.json" "$S/pd-yeni-$t.json" "$t"
done
