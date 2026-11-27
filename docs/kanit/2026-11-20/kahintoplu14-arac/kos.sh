#!/bin/bash
# Toplu kâhin bakımı 14 (muhasebe bakım 14 + cari bakım 22) — kanıt koşusu (program AÇILMAZ). Kullanım: kos.sh <utc|ist> <temel|mut1|mut2>
# Çalışma dizini: bakım worktree'si (temiz ağaç); eski kopya: scratchpad/kahintoplu14-eski (git archive kahin-toplu14-taban test/bagimsiz/muhasebe test/bagimsiz/cari — muhasebe bakım 13 / cari bakım 21b).
# Parçalar ≤ 40 dk: temel (testler, G3, eski kırmızı, cari taramaları), mut1 / mut2 (muhasebe mutasyonunun iki yarısı — MUTASYON_ARALIK).
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-aa6366f4d4126b97f
E=$S/kahintoplu14-eski
K=$S/kahintoplu14-kirmizi-$1
A=docs/kanit/2026-11-20/kahintoplu14-arac
L=$S/olcum.lock
case "$1" in
  utc) export TZ=UTC ;;
  ist) export TZ=Europe/Istanbul ;;
  *) echo "kullanım: $0 utc|ist temel|mut1|mut2"; exit 2 ;;
esac
Z=$1
export KANIT_DIR=$S/kahintoplu14-kanit
mkdir -p "$KANIT_DIR" || exit 1
cd "$W" || exit 1
echo "commit $(git rev-parse HEAD) · TZ=$TZ · $(date -u +%FT%TZ) · yük $(cat /proc/loadavg)"
git status -s | grep -v node_modules | head -3
k() { timeout -k 5 2400 node tools/kanit.mjs kos "kahintoplu14-$1-$Z" -- "${@:2}"; echo "== $1: çıkış $?"; }
D=test/bagimsiz/cari/senaryolar
YENI="$D/d51-c5-s210-s211-kart-kapanir.json $D/d50-c5-s206-s25c-b1-iptal-havale.json"
case "$2" in
  temel)
    # eski kâhin + yeni senaryo / test dosyaları (ders 7, 38): muhasebe — senaryolar_elle.py + test_model.py
    rm -rf "$K" && mkdir -p "$K" && cp -r "$E/test/bagimsiz/muhasebe" "$K/" \
      && cp test/bagimsiz/muhasebe/senaryolar_elle.py test/bagimsiz/muhasebe/test_model.py "$K/muhasebe/" || exit 1
    k muh-test python3 -I -B test/bagimsiz/muhasebe/test_model.py
    k muh-eski-kirmizi python3 -I -B "$K/muhasebe/test_model.py"
    k muh-g3 python3 -I -B $A/g3-muh.py --eski $E/test/bagimsiz/muhasebe --yeni test/bagimsiz/muhasebe --dokum $KANIT_DIR/kahintoplu14-muh-g3-dokum-$Z.json
    k muh-yeni-mutantlar python3 -I -B $A/yeni-mutantlar-muh14.py test/bagimsiz/muhasebe
    k cari-oz python3 -I -B test/bagimsiz/cari/oz-test.py
    k cari-mutasyon flock -s -w 3600 $L python3 -I -B $A/mutasyon-tara.py --model test/bagimsiz/cari
    k cari-g3 python3 -I -B $A/karsilastir.py --eski $E/test/bagimsiz/cari --yeni test/bagimsiz/cari --dokum $KANIT_DIR/kahintoplu14-cari-g3-dokum-$Z.json
    k cari-elle-yeni python3 -I -B $A/elle-karsilastir.py --model test/bagimsiz/cari $YENI
    k cari-kirmizi-eski python3 -I -B $A/elle-karsilastir.py --kirmizi-bekle --model $E/test/bagimsiz/cari $YENI
    k cari-elle-fark python3 -I -B $A/elle-fark.py --eski $E/test/bagimsiz/cari --yeni test/bagimsiz/cari
    k cari-g1-tara python3 -I -B $A/g1-tara.py $D --sert
    k cari-mutant-senaryo python3 -I -B $A/mutant-senaryo.py --model test/bagimsiz/cari
    k cari-genis-tarama flock -s -w 3600 $L python3 -I -B $A/genis-tarama.py --model test/bagimsiz/cari
    timeout -k 5 1800 python3 -I -B $A/ozet-tara.py test/bagimsiz/cari > $KANIT_DIR/kahintoplu14-cari-ozet-tara-$Z.txt 2>&1; echo "== cari-ozet-tara: çıkış $?"
    ;;
  mut1) export MUTASYON_ARALIK=0:165; k muh-mutasyon1 flock -s -w 3600 $L python3 -I -B test/bagimsiz/muhasebe/mutasyon.py ;;
  mut2) export MUTASYON_ARALIK=165:; k muh-mutasyon2 flock -s -w 3600 $L python3 -I -B test/bagimsiz/muhasebe/mutasyon.py ;;
  *) echo "kullanım: $0 utc|ist temel|mut1|mut2"; exit 2 ;;
esac
echo "bitti $(date -u +%FT%TZ)"
