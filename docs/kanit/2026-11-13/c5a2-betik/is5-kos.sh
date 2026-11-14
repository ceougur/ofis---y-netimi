#!/bin/bash
# İş 5 (S160): yeni kod iki TZ + taban kırmızısı + karşı mutantlar. Çağıran yük kilidini -s -n ile alır.
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a294d4187e1bf9872
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a2-k7
cd "$W" || exit 1
cp test/s160-kilitli-tahsilat-bagi-250.test.mjs "$N/taban/test/" || exit 1
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$N/kanit
echo "baslangic yuk $(cat /proc/loadavg)"
TZ=UTC timeout -k 5 600 node tools/kanit.mjs kos c5a2-is5-s160-utc -- node --test test/s160-kilitli-tahsilat-bagi-250.test.mjs | tail -1
TZ=Europe/Istanbul timeout -k 5 600 node tools/kanit.mjs kos c5a2-is5-s160-ist -- node --test test/s160-kilitli-tahsilat-bagi-250.test.mjs | tail -1
timeout -k 5 600 bash "$N/taban-kos.sh" c5a2-is5-s160-taban node --test --test-reporter=spec test/s160-kilitli-tahsilat-bagi-250.test.mjs
grep -E "^  ✖|^  ✔|ℹ (tests|pass|fail)" "$N/kanit/c5a2-is5-s160-taban.out"
timeout -k 5 3000 python3 -I "$N/mutant-is5.py"
echo "bitis yuk $(cat /proc/loadavg)"
