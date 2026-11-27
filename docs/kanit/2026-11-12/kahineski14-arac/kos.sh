#!/bin/bash
# Cari kâhini bakımı 14 (TOPLU: S130 A, S129 A, S131 / S133 / S134 / S135 = C) — kanıt koşusu (program AÇILMAZ). Kullanım: kos.sh <utc|ist>
# Çalışma dizini: bakım 14 worktree'si (temiz ağaç); eski kopya: scratchpad/kahineski14-eski (git archive 86531a4a test/bagimsiz/defter test/bagimsiz/cari — bakım 12 kâhini, çalışma dalı ucu).
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a0479b65317780ba2
E=$S/kahineski14-eski
A=docs/kanit/2026-11-12/kahineski14-arac
L=$S/olcum.lock
case "$1" in
  utc) export TZ=UTC ;;
  ist) export TZ=Europe/Istanbul ;;
  *) echo "kullanım: $0 utc|ist"; exit 2 ;;
esac
Z=$1
export KANIT_DIR=$S/kahineski14-kanit
mkdir -p "$KANIT_DIR" || exit 1
cd "$W" || exit 1
echo "commit $(git rev-parse HEAD) · TZ=$TZ · $(date -u +%FT%TZ) · yük $(cat /proc/loadavg)"
git status -s | head -3
D=test/bagimsiz/cari/senaryolar
YENI="$D/d39-c5-s130-supheli-kalemleri.json $D/d40-c5-s130-sus-bilinen-sinir.json $D/d38-c5-s128-ozge-kalemli-kart.json"
k() { node tools/kanit.mjs kos "kahineski14-$1-$Z" -- "${@:2}"; echo "== $1: çıkış $?"; }
k cari-oz flock -s -n $L python3 -I -B test/bagimsiz/cari/oz-test.py
k defter-oz python3 -I -B test/bagimsiz/defter/oz-test.py
k cari-mutasyon flock -s -n $L python3 -I -B $A/mutasyon-tara.py --model test/bagimsiz/cari
k esdeger-cari flock -s -n $L python3 -I -B $A/karsilastir.py --eski $E/test/bagimsiz/cari --yeni test/bagimsiz/cari --dokum $KANIT_DIR/kahineski14-g3-dokum-$Z.json
k elle-yeni-cari python3 -I -B $A/elle-karsilastir.py --model test/bagimsiz/cari $YENI
k kirmizi-eski-cari python3 -I -B $A/elle-karsilastir.py --kirmizi-bekle --model $E/test/bagimsiz/cari $YENI
k elle-fark python3 -I -B $A/elle-fark.py --eski $E/test/bagimsiz/cari --yeni test/bagimsiz/cari
k g1-tara python3 -I -B $A/g1-tara.py $D --sert
k mutant-senaryo python3 -I -B $A/mutant-senaryo.py --model test/bagimsiz/cari
k genis-tarama flock -s -n $L python3 -I -B $A/genis-tarama.py --model test/bagimsiz/cari
echo "bitti $(date -u +%FT%TZ)"
