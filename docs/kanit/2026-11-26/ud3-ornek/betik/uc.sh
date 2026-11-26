#!/bin/bash
# Senaryoyu üç programda koşar (kâhine dokunmaz): yeni (ajan ağacı), eski (e7934c5e), v249. Kullanım: uc.sh <senaryo.json> [anahtar-grep]
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-acb2a64a5f6cdf8f2
D=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/ud3-m8x4
ad=$(basename $1 .json); dir=$(dirname $1)
cd $W || exit 1
for k in ${PROGLAR:-yeni eski v249}; do
  case $k in yeni) unset KAHIN_PROGRAM_KOKU;; *) export KAHIN_PROGRAM_KOKU=$D/$k;; esac
  out=$dir/uc-$ad-$k
  rm -rf $out; mkdir -p $out
  timeout 900 node --disable-warning=ExperimentalWarning test/bagimsiz/cari/kos.mjs $1 --mutasyonsuz --cikti $out > $out.log 2>&1
  echo "== $k (çıkış $?): $(grep -E 'denetim geçti' $out.log | tail -1)"
  grep -E '✗' $out.log | grep -E "${2:-.}" | head -${SATIR:-12} | cut -c1-${GEN:-260}
done
