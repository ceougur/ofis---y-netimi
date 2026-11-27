#!/bin/bash
# Cari kâhini bakımı 9 (S120) — kanıt koşusu (program AÇILMAZ). Kullanım: kos.sh <utc|ist>
# Çalışma dizini: bakım 9 worktree'si (temiz ağaç); eski kopya: scratchpad/kahineski9-eski (git archive 9446aff4 test/bagimsiz/defter test/bagimsiz/cari — bakım 8 kâhini 467d289b).
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-aa85b9828a1e24841
E=$S/kahineski9-eski
A=docs/kanit/2026-11-11/kahineski9-arac
L=$S/olcum.lock
case "$1" in
  utc) export TZ=UTC ;;
  ist) export TZ=Europe/Istanbul ;;
  *) echo "kullanım: $0 utc|ist"; exit 2 ;;
esac
Z=$1
export KANIT_DIR=$S/kahineski9-kanit
mkdir -p "$KANIT_DIR" || exit 1
cd "$W" || exit 1
echo "commit $(git rev-parse HEAD) · TZ=$TZ · $(date -u +%FT%TZ) · yük $(cat /proc/loadavg)"
git status -s | head -3
D=test/bagimsiz/cari/senaryolar
YENI="$D/d35-c5-s120-elle-borclar.json $D/d34-c5-s110-kendi-borcu.json $D/d8-c5-tanimsiz.json"
k() { node tools/kanit.mjs kos "kahineski9-$1-$Z" -- "${@:2}"; echo "== $1: çıkış $?"; }
k cari-oz flock -s -n $L python3 -I -B test/bagimsiz/cari/oz-test.py
k defter-oz python3 -I -B test/bagimsiz/defter/oz-test.py
k cari-mutasyon flock -s -n $L python3 -I -B $A/mutasyon-tara.py --model test/bagimsiz/cari
k esdeger-cari flock -s -n $L python3 -I -B $A/karsilastir.py --eski $E/test/bagimsiz/cari --yeni test/bagimsiz/cari --dokum $KANIT_DIR/kahineski9-g3-dokum-$Z.json
k elle-yeni-cari python3 -I -B $A/elle-karsilastir.py --model test/bagimsiz/cari $YENI
k kirmizi-eski-cari python3 -I -B $A/elle-karsilastir.py --kirmizi-bekle --model $E/test/bagimsiz/cari $YENI
k elle-fark python3 -I -B $A/elle-fark.py --eski $E/test/bagimsiz/cari --yeni test/bagimsiz/cari
k g1-tara python3 -I -B $A/g1-tara.py $D --sert
k genis-tarama flock -s -n $L python3 -I -B $A/genis-tarama.py --model test/bagimsiz/cari
echo "bitti $(date -u +%FT%TZ)"
