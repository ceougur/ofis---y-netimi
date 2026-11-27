#!/bin/bash
# Cari kâhini bakımı 7 — kanıt koşusu (program AÇILMAZ). Kullanım: kahineski7-kos.sh <utc|ist>
# Çalışma dizini: bakım 7 worktree'si (temiz ağaç); eski kopya: scratchpad/kahineski7-eski (git archive a0d8342a).
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a240a08da3ca83440
E=$S/kahineski7-eski
A=docs/kanit/2026-11-10/kahineski7-arac
L=$S/olcum.lock
case "$1" in
  utc) export TZ=UTC ;;
  ist) export TZ=Europe/Istanbul ;;
  *) echo "kullanım: $0 utc|ist"; exit 2 ;;
esac
Z=$1
export KANIT_DIR=$S/kahineski7-kanit
mkdir -p "$KANIT_DIR" || exit 1
cd "$W" || exit 1
echo "commit $(git rev-parse HEAD) · TZ=$TZ · $(date -u +%FT%TZ) · yük $(cat /proc/loadavg)"
git status -s | head -3
D=test/bagimsiz/cari/senaryolar
YENI_ELLE="$D/d27-c5-s99-taksitli-avans.json $D/d28-c5-s99-taksit-vade-gunu.json $D/d29-c5-s99-taksit-ertesi-gun.json $D/d30-c5-s101-bitti-kart.json $D/d31-c5-s101-taksit-vade-gunu.json $D/d32-c5-s101-taksit-ertesi-gun.json $D/d33-c5-s102-s105-sinirlar.json"
G2_ELLE="$D/d30-c5-s101-bitti-kart.json $D/d31-c5-s101-taksit-vade-gunu.json $D/d32-c5-s101-taksit-ertesi-gun.json"
k() { node tools/kanit.mjs kos "kahineski7-$1-$Z" -- "${@:2}"; echo "== $1: çıkış $?"; }
k cari-oz flock -s -n $L python3 -I -B test/bagimsiz/cari/oz-test.py
k defter-oz python3 -I -B test/bagimsiz/defter/oz-test.py
k cari-mutasyon flock -s -n $L python3 -I -B $A/mutasyon-tara.py --model test/bagimsiz/cari
k esdeger-cari flock -s -n $L python3 -I -B $A/karsilastir.py --eski $E/test/bagimsiz/cari --yeni test/bagimsiz/cari --dokum $KANIT_DIR/kahineski7-g3-dokum-$Z.json
k elle-yeni-cari python3 -I -B $A/elle-karsilastir.py --model test/bagimsiz/cari $YENI_ELLE
k kirmizi-eski-cari python3 -I -B $A/kirmizi-eski.py --model $E/test/bagimsiz/cari $G2_ELLE
k g1-tara python3 -I -B $A/g1-tara.py $D --sert
k g1-tara-eski python3 -I -B $A/g1-tara.py $E/$D --ihlal-bekle
k g1-esdeger python3 -I -B $A/g1-esdeger.py --model $E/test/bagimsiz/cari --model test/bagimsiz/cari --eski $E/$D --yeni $D --dokum $KANIT_DIR/kahineski7-g1-dokum-$Z.json d27-c5-s99-taksitli-avans d28-c5-s99-taksit-vade-gunu d29-c5-s99-taksit-ertesi-gun
k elle-tasinan python3 -I -B $A/elle-tasinan.py --eski $E/$D --yeni $D d27-c5-s99-taksitli-avans d28-c5-s99-taksit-vade-gunu d29-c5-s99-taksit-ertesi-gun d30-c5-s101-bitti-kart d31-c5-s101-taksit-vade-gunu d32-c5-s101-taksit-ertesi-gun
k genis-tarama flock -s -n $L python3 -I -B $A/genis-tarama.py --model test/bagimsiz/cari
k g1-uretici flock -s -n $L python3 -I -B $A/g1-uretici.py test/bagimsiz/cari --tohum 30 --islem 120,400
echo "bitti $(date -u +%FT%TZ)"
