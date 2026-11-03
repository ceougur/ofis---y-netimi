#!/bin/bash
# 2.4.9 R2 ölçüm zinciri (ders 15, 24, 47): her koşu flock altında TEK TEK; önce/sonra AYNI hazır veri (R2 kopyası hazir-iade), taze kopya (kurulum siler-kopyalar),
# aynı sahte saat. Makine paylaşımlı: her koşunun önünde ve sonunda `uptime` (yük) + `df -h /` kayda geçer (<ad>.uptime). Sıra eski/yeni dönüşümlü (kayma azalsın).
S=/tmp/claude-0/-home-user/2a941a30-cea4-5380-a679-f28a541c21a1/scratchpad/r2-249-aa56
YENI=/home/user/ofis---y-netimi/.claude/worktrees/agent-aa56c65749221d09d
ESKI=$S/eski-e6ee52a8
K=$YENI/docs/kanit/2026-11-03/r2/olcum
mkdir -p $K $ESKI/test/r2-249 || exit 1
cp $YENI/test/r2-249/*.mjs $ESKI/test/r2-249/ || exit 1
export HUKUK_LICENSE_URL=http://127.0.0.1:9
L=/tmp/destekofis-olcum.lock
olc() { # $1 kod (eski|yeni) $2 betik (olcum = test/b2-249/olcum.mjs iade kümesi | olcum-ek = test/r2-249/olcum-ek.mjs)
  local kok=$YENI; local isz=""; [ "$1" = eski ] && kok=$ESKI && isz=e6ee52a8
  local ad betik arg
  if [ "$2" = olcum ]; then ad="olcum-$1-iade"; betik=test/b2-249/olcum.mjs; arg="iade 2"; else ad="olcum-ek-$1"; betik=test/r2-249/olcum-ek.mjs; arg="2"; fi
  (cd $kok && ISZ_COMMIT=$isz flock $L sh -c "{ date -u; uptime; df -h / | tail -1; } > $K/$ad.uptime; node --disable-warning=ExperimentalWarning $betik $S/hazir-iade $S/is-olcum-$1 $K/$ad.json $arg; c=\$?; { date -u; uptime; } >> $K/$ad.uptime; exit \$c" > $K/$ad.log 2>&1)
  echo "$ad çıkış=$?" | tee -a $K/zincir.txt
  rm -rf $S/is-olcum-$1
}
olc eski olcum
olc yeni olcum
olc eski olcum-ek
olc yeni olcum-ek
echo bitti | tee -a $K/zincir.txt
