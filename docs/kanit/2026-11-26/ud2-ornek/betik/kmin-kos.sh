#!/bin/bash
# Kâhin senaryosunu (kâhine dokunmadan) üç programda koşar: yeni (ajan ağacı), aday e7934c5e (eski), v2.4.9. Kullanım: kmin-kos.sh <senaryo.json>
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a3efe37d598ece90c
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/ud2-r4k9
ad=$(basename $1 .json)
cd $W || exit 1
for k in yeni eski v249; do
  case $k in yeni) unset KAHIN_PROGRAM_KOKU;; *) export KAHIN_PROGRAM_KOKU=$S/$k;; esac
  out=$S/kmin/$ad-$k
  mkdir -p $out
  timeout 600 node --disable-warning=ExperimentalWarning test/bagimsiz/cari/kos.mjs $1 --mutasyonsuz --cikti $out > $out.log 2>&1
  echo "== $k (çıkış $?): $(grep -E 'denetim geçti' $out.log | tail -1)"
  grep -E '✗' $out.log | head -${SATIR:-8} | cut -c1-330
done
