#!/bin/bash
# 2.4.9 R2 eşdeğerlik zinciri: eski (git archive e6ee52a8, ayrı kopya) ↔ yeni (çalışma ağacı) — her koşu flock altında TEK TEK, hazır verinin TAZE kopyası (kurulum siler-kopyalar).
# Yol değişkenleri baştadır (not defteri bu oturumun; yeniden koşarken değiştirilir).
S=/tmp/claude-0/-home-user/2a941a30-cea4-5380-a679-f28a541c21a1/scratchpad/r2-249-aa56
YENI=/home/user/ofis---y-netimi/.claude/worktrees/agent-aa56c65749221d09d
ESKI=$S/eski-e6ee52a8
K=$YENI/docs/kanit/2026-11-03/r2/esitlik
mkdir -p $K $S/esitlik $ESKI/test/r2-249 || exit 1
cp $YENI/test/r2-249/*.mjs $ESKI/test/r2-249/ || exit 1
export HUKUK_LICENSE_URL=http://127.0.0.1:9
L=/tmp/destekofis-olcum.lock
{ date -u; uptime; df -h / | tail -1; } > $K/basta.txt
kos() { # $1 kod (eski|yeni) $2 veri adı $3 tz $4 ek
  local kok=$YENI; local isz=""; [ "$1" = eski ] && kok=$ESKI && isz=e6ee52a8
  local ad="$1-$2-$(echo $3 | tr '/' '_')${4:+-$4}"
  (cd $kok && ISZ_COMMIT=$isz TZ=$3 flock $L node --disable-warning=ExperimentalWarning test/r2-249/esitlik-kos.mjs $S/hazir-$2 $S/is-esitlik-$1 $S/esitlik/$ad.json $4 > $K/$ad.log 2>&1)
  echo "$ad çıkış=$?" | tee -a $K/zincir.txt
  rm -rf $S/is-esitlik-$1
}
kos eski iade UTC
kos yeni iade UTC
kos eski cesit UTC
kos yeni cesit UTC
kos eski cesit Europe/Istanbul
kos yeni cesit Europe/Istanbul
kos yeni cesit UTC dis
{ date -u; uptime; df -h / | tail -1; } > $K/sonda.txt
echo bitti | tee -a $K/zincir.txt
