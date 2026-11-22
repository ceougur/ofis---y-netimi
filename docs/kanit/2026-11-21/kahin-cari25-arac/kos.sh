#!/bin/bash
# Cari kâhini bakımı 25 (§37) — kanıt koşusu. Kullanım: kos.sh <utc|ist> <temel|program|program-eski|yapim|put>
#   temel        : öz test, G3 (eski kâhin kc25-taban ↔ yeni), elle tablo farkı, yeni elle tablolar yeni kâhinde, ESKİ kâhin kırmızısı (program AÇILMAZ)
#   program      : npm run test:kahin-cari düzeni (taban dalının programı ↔ YENİ kâhin; bütün elle senaryolar + rastgele 1–2 × 60 + mutasyon taraması; depodaki yapım aşaması listesiyle)
#   program-eski : aynı program ↔ ESKİ kâhin (bakım 24) — yeni senaryolar d56 / d57
#   yapim        : --yapim-asamasi-yaz kendi kopyada (KAHIN_YAPIM_ASAMASI — not defteri)
#   put          : bağdaştırıcı mutantı — Düzenle eski ucla (PUT, yalnız taslak): d57 kırmızı olmalı
# Eski kopya: scratchpad/kc25/eski (git archive kc25-taban test/bagimsiz/cari). Her parça ≤ 40 dk. BÜTÜN koşular flock -s (süre sınırı kilidin İÇİNDE).
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a24e3718cfe7459df
E=$S/kc25/eski
A=docs/kanit/2026-11-21/kahin-cari25-arac
L=$S/olcum.lock
case "$1" in
  utc) export TZ=UTC ;;
  ist) export TZ=Europe/Istanbul ;;
  *) echo "kullanım: $0 utc|ist temel|program|program-eski|yapim|put"; exit 2 ;;
esac
Z=$1
export KANIT_DIR=$S/kc25/kanit HUKUK_LICENSE_URL=http://127.0.0.1:9
mkdir -p "$KANIT_DIR" || exit 1
cd "$W" || exit 1
echo "commit $(git rev-parse HEAD) · TZ=$TZ · $(date -u +%FT%TZ) · yük $(cat /proc/loadavg)"
git status -s | grep -v node_modules | head -3
k() { flock -s -w 3600 "$L" timeout -k 5 2400 node tools/kanit.mjs kos "kahin-cari25-$1-$Z" -- "${@:2}"; echo "== $1: çıkış $?"; }
D=test/bagimsiz/cari/senaryolar
YENI="$D/d56-c5-s238-s240-iade-ve-secilmeyen.json $D/d57-c5-s241-s242-duzenle.json"
case "$2" in
  temel)
    k oz python3 -I -B test/bagimsiz/cari/oz-test.py
    k g3 python3 -I -B $A/karsilastir.py --eski $E/test/bagimsiz/cari --yeni test/bagimsiz/cari --dokum $KANIT_DIR/kahin-cari25-g3-dokum-$Z.json
    k elle-fark python3 -I -B $A/elle-fark.py --eski $E/test/bagimsiz/cari --yeni test/bagimsiz/cari
    k elle-yeni python3 -I -B $A/elle-karsilastir.py --model test/bagimsiz/cari $YENI
    k kirmizi-eski python3 -I -B $A/elle-karsilastir.py --kirmizi-bekle --model $E/test/bagimsiz/cari $YENI
    ;;
  program) k program node --disable-warning=ExperimentalWarning test/bagimsiz/cari/kos.mjs --cikti $S/kc25/program-$Z ;;
  program-eski) KAHIN_PROGRAM_KOKU=$W k program-eski node --disable-warning=ExperimentalWarning $E/test/bagimsiz/cari/kos.mjs --mutasyonsuz --cikti $S/kc25/program-eski-$Z $YENI ;;
  yapim)
    cp test/bagimsiz/cari/YAPIM-ASAMASI.json $S/kc25/YAPIM-ASAMASI-$Z.json || exit 1
    KAHIN_YAPIM_ASAMASI=$S/kc25/YAPIM-ASAMASI-$Z.json k yapim node --disable-warning=ExperimentalWarning test/bagimsiz/cari/kos.mjs --yapim-asamasi-yaz --mutasyonsuz --cikti $S/kc25/yapim-$Z
    ;;
  put) KAHIN_DUZENLE_UC=put k put node --disable-warning=ExperimentalWarning test/bagimsiz/cari/kos.mjs --mutasyonsuz --cikti $S/kc25/put-$Z $D/d57-c5-s241-s242-duzenle.json ;;
  *) echo "adım?"; exit 2 ;;
esac
echo "bitti $(date -u +%FT%TZ)"
