#!/bin/bash
# Cari kâhini bakımı 16 (S155 A toplam ölçü, S158 A her kartta, S156 / S157 = C metin, S154 alan yok) — kanıt koşusu (program AÇILMAZ). Kullanım: kos.sh <utc|ist>
# Çalışma dizini: bakım 16 worktree'si (temiz ağaç); eski kopya: scratchpad/kahineski16-eski (git archive 6453ad3b test/bagimsiz/defter test/bagimsiz/cari — bakım 15 kâhini).
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a24a9b176b2cdfc4a
E=$S/kahineski16-eski
A=docs/kanit/2026-11-13/kahineski16-arac
L=$S/olcum.lock
case "$1" in
  utc) export TZ=UTC ;;
  ist) export TZ=Europe/Istanbul ;;
  *) echo "kullanım: $0 utc|ist"; exit 2 ;;
esac
Z=$1
export KANIT_DIR=$S/kahineski16-kanit
mkdir -p "$KANIT_DIR" || exit 1
cd "$W" || exit 1
echo "commit $(git rev-parse HEAD) · TZ=$TZ · $(date -u +%FT%TZ) · yük $(cat /proc/loadavg)"
git status -s | head -3
D=test/bagimsiz/cari/senaryolar
YENI="$D/d44-c5-s155-s158.json $D/d41-c5-s136-s139-s145-s148.json $D/d42-c5-s140-s151-satis-karti-iade.json"
k() { timeout -k 5 3600 node tools/kanit.mjs kos "kahineski16-$1-$Z" -- "${@:2}"; echo "== $1: çıkış $?"; }
k cari-oz flock -s -n $L python3 -I -B test/bagimsiz/cari/oz-test.py
k defter-oz python3 -I -B test/bagimsiz/defter/oz-test.py
k cari-mutasyon flock -s -n $L python3 -I -B $A/mutasyon-tara.py --model test/bagimsiz/cari
k esdeger-cari flock -s -n $L python3 -I -B $A/karsilastir.py --eski $E/test/bagimsiz/cari --yeni test/bagimsiz/cari --dokum $KANIT_DIR/kahineski16-g3-dokum-$Z.json
k elle-yeni-cari python3 -I -B $A/elle-karsilastir.py --model test/bagimsiz/cari $YENI
k kirmizi-eski-cari python3 -I -B $A/elle-karsilastir.py --kirmizi-bekle --model $E/test/bagimsiz/cari $YENI
k elle-fark python3 -I -B $A/elle-fark.py --eski $E/test/bagimsiz/cari --yeni test/bagimsiz/cari
k g1-tara python3 -I -B $A/g1-tara.py $D --sert
k mutant-senaryo python3 -I -B $A/mutant-senaryo.py --model test/bagimsiz/cari
k genis-tarama flock -s -n $L python3 -I -B $A/genis-tarama.py --model test/bagimsiz/cari
echo "bitti $(date -u +%FT%TZ)"
