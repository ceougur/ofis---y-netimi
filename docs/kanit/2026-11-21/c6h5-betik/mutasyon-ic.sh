#!/bin/bash
# Mutasyon (ders 7): her mutant /dev/shm/c6h5-mut kopyasında (yeni kodun git archive'ı), eşdeğerlik testi iki TZ. Paylaşılan kilit zincir için bir kez. Çağrı: timeout -k 5 7000 bash mutasyon.sh
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a32c17a0bb8351975
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
A=$S/c6h5-ag
M=/dev/shm/c6h5-mut
mkdir -p $A/out $A/kanit || exit 1
echo "başla $(date -u +%H:%M:%S) yük $(cut -d' ' -f1-3 /proc/loadavg)"
for m in $(python3 -I $A/mutantlar.py --liste); do
  cp $W/server/lib/financial-statements.mjs $M/server/lib/financial-statements.mjs || exit 1
  cp $W/server/lib/ledger-snapshots.mjs $M/server/lib/ledger-snapshots.mjs || exit 1
  python3 -I $A/mutantlar.py $M $m || exit 1
  for tz in UTC Europe/Istanbul; do
    n=$(echo $tz | tr / -)
    (cd $M && TZ=$tz HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$A/kanit timeout -k 5 1500 node $W/tools/kanit.mjs kos c6h5-mut-$m-$n -- node --test test/c6h-tek-okuma.test.mjs > $A/out/mut-$m-$n.out 2>&1)
    echo "$m $tz çıkış $? · $(grep -E '^# (pass|fail)' $A/out/mut-$m-$n.out | tr '\n' ' ') · ilk düşen: $(grep -m1 -E '^ *not ok' $A/out/mut-$m-$n.out | cut -c1-140)"
  done
done
cp $W/server/lib/financial-statements.mjs $M/server/lib/financial-statements.mjs
cp $W/server/lib/ledger-snapshots.mjs $M/server/lib/ledger-snapshots.mjs
echo "bitti $(date -u +%H:%M:%S) yük $(cut -d' ' -f1-3 /proc/loadavg)"
