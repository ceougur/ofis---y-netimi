#!/bin/bash
# B2 ölçüm zinciri (§7): her koşu flock altında TEK TEK; önce/sonra aynı hazır veri, taze kopya (kurulum siler-kopyalar).
S=/tmp/claude-0/-home-user/2a941a30-cea4-5380-a679-f28a541c21a1/scratchpad/b2-kod-a954
YENI=/home/user/ofis---y-netimi/.claude/worktrees/agent-a95435e4eb1b4db61
ESKI=$S/eski-e3f74093
K=$YENI/docs/kanit/2026-11-03/b2/olcum
mkdir -p $K
export HUKUK_LICENSE_URL=http://127.0.0.1:9
export ISZ_COMMIT=e3f74093
export PLAYWRIGHT_BROWSERS_PATH=$S/pw
L=/tmp/destekofis-olcum.lock
olc() { # $1 kod $2 veri $3 set $4 tekrar
  local kok=$YENI; [ "$1" = eski ] && kok=$ESKI
  local ad="olcum-$1-$3"
  (cd $kok && flock $L sh -c "df -h / | tail -1 > $K/$ad.df; node --disable-warning=ExperimentalWarning test/b2-249/olcum.mjs $S/hazir-$2 $S/is-olcum-$1 $K/$ad.json $3 $4" > $K/$ad.log 2>&1)
  echo "$ad çıkış=$?" | tee -a $K/zincir.txt
  rm -rf $S/is-olcum-$1
}
ekran() { # $1 kod $2 tekrar
  local kok=$YENI; [ "$1" = eski ] && kok=$ESKI
  local ad="ekran-$1"
  (cd $kok && flock $L node --disable-warning=ExperimentalWarning test/b2-249/ekran-olcum.mjs $S/hazir-taban $S/is-ekran-$1 $K/$ad.json $2 > $K/$ad.log 2>&1)
  echo "$ad çıkış=$?" | tee -a $K/zincir.txt
  rm -rf $S/is-ekran-$1
}
olc eski taban taban 2
olc yeni taban taban 2
olc eski bes-bin bes-bin 2
olc yeni bes-bin bes-bin 2
olc eski gecmis gecmis 2
olc yeni gecmis gecmis 2
olc yeni iade iade 2
ekran yeni 2
ekran eski 1
echo bitti | tee -a $K/zincir.txt
