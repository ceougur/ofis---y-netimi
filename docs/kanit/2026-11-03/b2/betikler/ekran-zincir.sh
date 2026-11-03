#!/bin/bash
# İlk ekran koşusu (ekran-yeni / ekran-eski) açılışı yanlış andan ölçtü (WhatsApp Web sekmesine tıklamadan); düzeltilmiş betikle yeniden (ekran2-*).
S=/tmp/claude-0/-home-user/2a941a30-cea4-5380-a679-f28a541c21a1/scratchpad/b2-kod-a954
YENI=/home/user/ofis---y-netimi/.claude/worktrees/agent-a95435e4eb1b4db61
ESKI=$S/eski-e3f74093
K=$YENI/docs/kanit/2026-11-03/b2/olcum
export HUKUK_LICENSE_URL=http://127.0.0.1:9
export ISZ_COMMIT=e3f74093
export PLAYWRIGHT_BROWSERS_PATH=$S/pw
L=/tmp/destekofis-olcum.lock
until grep -q bitti $K/zincir.txt; do sleep 10; done
for KOD in yeni eski; do
  kok=$YENI; [ "$KOD" = eski ] && kok=$ESKI
  (cd $kok && flock $L node --disable-warning=ExperimentalWarning test/b2-249/ekran-olcum.mjs $S/hazir-taban $S/is-ekran-$KOD $K/ekran2-$KOD.json 2 > $K/ekran2-$KOD.log 2>&1)
  echo "ekran2-$KOD çıkış=$?" | tee -a $K/zincir.txt
  rm -rf $S/is-ekran-$KOD
done
echo ekran2-bitti | tee -a $K/zincir.txt
