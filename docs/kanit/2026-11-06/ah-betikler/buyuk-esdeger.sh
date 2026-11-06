#!/bin/bash
# AH: büyük veride eski ↔ yeni eşdeğerlik (döküm sha256 + eleme değişmezi) — (1) v2.4.9 koduyla açılmış (göç 20→45) 100.000 verisi (G6 zinciri), (2) Ç3 100.000 verisi.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-ab0062d42feec8f21
export HUKUK_LICENSE_URL=http://127.0.0.1:9
export TZ=UTC
rm -rf "$S/ah-veri249"
cp -a "$S/ah-veri210/n-100000" "$S/ah-veri249" || exit 1
echo "== v2.4.9 ile aç $(date -u +%H:%M:%S)"
flock $S/olcum.lock node --disable-warning=ExperimentalWarning $S/ah-betik/surumle-ac.mjs $S/ah-v249 $S/ah-veri249 || exit 1
echo "== eşdeğerlik v249 verisi $(date -u +%H:%M:%S)"
cd "$W" || exit 1
flock $S/olcum.lock node --disable-warning=ExperimentalWarning --max-old-space-size=8192 tools/acilis-onarimi-esdegerlik-250.mjs --eski $S/ah-taban --veri $S/ah-veri249 --bugun 2026-10-08 --parola Kapi-Olcum-2026! --ozet --eleme --calisma $S/ah-calisma-esd-249 --cikti $S/ah-kanit/esd/v249veri-100k.json > $S/ah-kanit/esd/v249veri-100k.log 2>&1
echo "cikis $? $(date -u +%H:%M:%S)"
echo "== eşdeğerlik Ç3 verisi $(date -u +%H:%M:%S)"
flock $S/olcum.lock node --disable-warning=ExperimentalWarning --max-old-space-size=8192 tools/acilis-onarimi-esdegerlik-250.mjs --eski $S/ah-taban --veri $S/ah-veri/n-100000 --bugun 2026-10-08 --parola Kapi-Olcum-2026! --ozet --eleme --calisma $S/ah-calisma-esd-c3 --cikti $S/ah-kanit/esd/c3veri-100k.json > $S/ah-kanit/esd/c3veri-100k.log 2>&1
echo "cikis $? $(date -u +%H:%M:%S)"
touch $S/ah-kanit/esd/BUYUK.BITTI
