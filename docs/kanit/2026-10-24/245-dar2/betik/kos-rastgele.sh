#!/bin/bash
# tohum başına yeni (8d73aad) ve eski (201ffef) aynı dizi
cd /tmp/claude-0/-home-user/456ebc12-8183-520e-989e-af270fef8a58/scratchpad/245-dar2/betik
for t in $@; do
  node --disable-warning=ExperimentalWarning p-rastgele.mjs $t 150 /tmp/claude-0/-home-user/456ebc12-8183-520e-989e-af270fef8a58/scratchpad/245-dar2/yeni-t$t.jsonl > /tmp/claude-0/-home-user/456ebc12-8183-520e-989e-af270fef8a58/scratchpad/245-dar2/yeni-t$t.log 2>&1; echo "yeni t$t cikis $?" >> /tmp/claude-0/-home-user/456ebc12-8183-520e-989e-af270fef8a58/scratchpad/245-dar2/rastgele-ozet.txt
  ROOT=/tmp/claude-0/-home-user/456ebc12-8183-520e-989e-af270fef8a58/scratchpad/245-dar2/eski-201ffef node --disable-warning=ExperimentalWarning p-rastgele.mjs $t 150 /tmp/claude-0/-home-user/456ebc12-8183-520e-989e-af270fef8a58/scratchpad/245-dar2/eski-t$t.jsonl > /tmp/claude-0/-home-user/456ebc12-8183-520e-989e-af270fef8a58/scratchpad/245-dar2/eski-t$t.log 2>&1; echo "eski t$t cikis $?" >> /tmp/claude-0/-home-user/456ebc12-8183-520e-989e-af270fef8a58/scratchpad/245-dar2/rastgele-ozet.txt
done
