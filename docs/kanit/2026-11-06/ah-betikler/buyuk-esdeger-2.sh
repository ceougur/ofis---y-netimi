#!/bin/bash
# AH: büyük veride eski ↔ yeni eşdeğerlik, ikinci deneme (ilkinde dökümün girişi kapi-olcum parolasını bilmiyordu: 401). ah-veri249 = v2.4.9 koduyla açılmış veri.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-ab0062d42feec8f21
export HUKUK_LICENSE_URL=http://127.0.0.1:9
export TZ=UTC
cd "$W" || exit 1
for pair in "v249veri:$S/ah-veri249" "c3veri:$S/ah-veri/n-100000"; do
  ad=${pair%%:*}; veri=${pair#*:}
  echo "== eşdeğerlik $ad $(date -u +%H:%M:%S)"
  flock $S/olcum.lock node --disable-warning=ExperimentalWarning --max-old-space-size=8192 tools/acilis-onarimi-esdegerlik-250.mjs --eski $S/ah-taban --veri "$veri" --bugun 2026-10-08 --parola Kapi-Olcum-2026! --ozet --eleme --calisma $S/ah-calisma-esd-$ad --cikti $S/ah-kanit/esd/$ad-100k.json > $S/ah-kanit/esd/$ad-100k.log 2>&1
  echo "cikis $? $(date -u +%H:%M:%S)"
done
touch $S/ah-kanit/esd/BUYUK2.BITTI
