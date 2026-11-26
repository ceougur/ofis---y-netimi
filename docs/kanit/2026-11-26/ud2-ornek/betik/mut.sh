#!/bin/bash
# kullanım: mut.sh <tohum> <islem>   (çalışma dizini: ajan worktree'si)
L=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock
D=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/ud2-r4k9
ad=ud2-mutabakat-tohum$1-islem$2
flock -s -w 3600 $L timeout 6900 node tools/kanit.mjs kos $ad -- npm run test:mutabakat -- --islem $2 --tohum $1 --tohumlar 1 > $D/$ad.log 2>&1
echo "$ad çıkış $?" >> $D/bitti.txt
