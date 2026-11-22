#!/bin/bash
# İzt3 komşu ekran senaryoları (yeni kod, ajan ağacı). Paylaşılan kilit çağıranda. Her senaryo en çok 15 dk. Kullanım: bash e2e-kos.sh <TZ> <senaryo adları…>
E=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/izt3-ae8
K=/home/user/ofis---y-netimi/.claude/worktrees/agent-ae8c8568d72566f15
TZV=$1; shift
cd $K || exit 1
export HUKUK_LICENSE_URL=http://127.0.0.1:9 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/pw-1194 TZ=$TZV
mkdir -p $E/e2e
OZ=$E/e2e/ozet-${TZV//\//-}.txt
echo "e2e $TZV · commit $(git log --oneline -1 | cut -c1-9) · $(date -u +%H:%M:%S)" >> $OZ
for s in "$@"; do
  EKRAN_DIR=$E/e2e/ekran-$s timeout -k 5 900 node --disable-warning=ExperimentalWarning test/e2e/$s.mjs > $E/e2e/$s-${TZV//\//-}.log 2>&1
  echo "$s çıkış $? · $(grep -E 'geçti, [0-9]+ kaldı' $E/e2e/$s-${TZV//\//-}.log | tail -1)" >> $OZ
done
echo "bitti $(date -u +%H:%M:%S)" >> $OZ
