#!/bin/bash
# Cari kâhini bakımı 21b — kanıt koşusu (program AÇILMAZ). Kullanım: kos.sh <utc|ist>
# Çalışma dizini: bakım worktree'si (temiz ağaç); eski kopya: scratchpad/kahincari21b-eski (git archive c7b2f-kc21 (301c0e29) test/bagimsiz/cari — bakım 21 kâhini).
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-aad3118e61923359b
E=$S/kahincari21b-eski
A=docs/kanit/2026-11-19/kahincari21b-arac
L=$S/olcum.lock
case "$1" in
  utc) export TZ=UTC ;;
  ist) export TZ=Europe/Istanbul ;;
  *) echo "kullanım: $0 utc|ist"; exit 2 ;;
esac
Z=$1
export KANIT_DIR=$S/kahincari21b-kanit
mkdir -p "$KANIT_DIR" || exit 1
cd "$W" || exit 1
echo "commit $(git rev-parse HEAD) · TZ=$TZ · $(date -u +%FT%TZ) · yük $(cat /proc/loadavg)"
git status -s | grep -v '^?? node_modules$' | head -3
D=test/bagimsiz/cari/senaryolar
YENI="$D/d50-c5-s206-s25c-b1-iptal-havale.json $D/d49-c5-s15-s25-iptal-ve-fazla.json"
k() { timeout -k 5 5400 node tools/kanit.mjs kos "kahincari21b-$1-$Z" -- "${@:2}"; echo "== $1: çıkış $?"; }
k oz flock -s -w 3600 $L python3 -I -B test/bagimsiz/cari/oz-test.py
k mutasyon flock -s -w 3600 $L python3 -I -B $A/mutasyon-tara.py --model test/bagimsiz/cari
k g3 flock -s -w 3600 $L python3 -I -B $A/karsilastir.py --eski $E/test/bagimsiz/cari --yeni test/bagimsiz/cari --dokum $KANIT_DIR/kahincari21b-g3-dokum-$Z.json
k elle-yeni python3 -I -B $A/elle-karsilastir.py --model test/bagimsiz/cari $YENI
k kirmizi-eski python3 -I -B $A/elle-karsilastir.py --kirmizi-bekle --model $E/test/bagimsiz/cari $YENI
k elle-fark python3 -I -B $A/elle-fark.py --eski $E/test/bagimsiz/cari --yeni test/bagimsiz/cari
k g1-tara python3 -I -B $A/g1-tara.py $D --sert
k mutant-senaryo python3 -I -B $A/mutant-senaryo.py --model test/bagimsiz/cari
k genis-tarama flock -s -w 3600 $L python3 -I -B $A/genis-tarama.py --model test/bagimsiz/cari
timeout -k 5 1800 python3 -I -B $A/ozet-tara.py test/bagimsiz/cari > $KANIT_DIR/kahincari21b-ozet-tara-$Z.txt 2>&1; echo "== ozet-tara: çıkış $?"
echo "bitti $(date -u +%FT%TZ)"
