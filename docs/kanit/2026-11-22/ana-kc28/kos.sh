#!/bin/bash
# Cari kâhini bakımı 28 (§40) — kanıt koşusu (bakım 27 betiğinin uyarlaması). Kullanım: kos.sh <utc|ist> <oz|g3|elle|program|program-eski|yapim>
#   oz           : öz test (program AÇILMAZ)
#   g3           : G3 (eski kâhin bakım 27 = 6a1d19d1 ↔ yeni)
#   elle         : elle tablo farkı, yeni elle tablo (d60) yeni kâhinde, ESKİ kâhin kırmızısı (program AÇILMAZ)
#   program      : npm run test:kahin-cari düzeni (taban dalının programı ↔ YENİ kâhin; bütün elle senaryolar + rastgele 1–2 × 60 + mutasyon taraması; depodaki yapım aşaması listesiyle)
#   program-eski : aynı program ↔ ESKİ kâhin (bakım 27) — d60
#   yapim        : --yapim-asamasi-yaz kendi kopyada (KAHIN_YAPIM_ASAMASI — not defteri)
# Eski kopya: scratchpad/kc28-a5c/eski (git archive 6a1d19d1 test/bagimsiz/cari). Her parça ≤ 40 dk. BÜTÜN koşular flock -s (süre sınırı kilidin İÇİNDE).
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a5cd991d0d986ba51
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/ana-kc28
E=$N/eski
A=docs/kanit/2026-11-22/kahin-cari28-arac
L=$S/olcum.lock
case "$1" in
  utc) export TZ=UTC ;;
  ist) export TZ=Europe/Istanbul ;;
  *) echo "kullanım: $0 utc|ist oz|g3|elle|program|program-eski|yapim"; exit 2 ;;
esac
Z=$1
export KANIT_DIR=$N/kanit HUKUK_LICENSE_URL=http://127.0.0.1:9
mkdir -p "$KANIT_DIR" || exit 1
cd "$W" || exit 1
echo "commit $(git rev-parse HEAD) · TZ=$TZ · $(date -u +%FT%TZ) · yük $(cat /proc/loadavg)"
git status -s | grep -v node_modules | head -3
k() { flock -s -w 3600 "$L" timeout -k 5 2400 node tools/kanit.mjs kos "kahin-cari28-$1-$Z" -- "${@:2}"; echo "== $1: çıkış $?"; }
D=test/bagimsiz/cari/senaryolar
YENI="$D/d60-c5-s255-s254-bagli-odeme-kartli-fatura.json"
case "$2" in
  oz) k oz python3 -I -B test/bagimsiz/cari/oz-test.py ;;
  g3) k g3 python3 -I -B $A/karsilastir.py --eski $E/test/bagimsiz/cari --yeni test/bagimsiz/cari --dokum $KANIT_DIR/kahin-cari28-g3-dokum-$Z.json ;;
  elle)
    k elle-fark python3 -I -B $A/elle-fark.py --eski $E/test/bagimsiz/cari --yeni test/bagimsiz/cari
    k elle-yeni python3 -I -B $A/elle-karsilastir.py --model test/bagimsiz/cari $YENI
    k kirmizi-eski python3 -I -B $A/elle-karsilastir.py --kirmizi-bekle --model $E/test/bagimsiz/cari $YENI
    ;;
  program) k program node --disable-warning=ExperimentalWarning test/bagimsiz/cari/kos.mjs --cikti $N/program-$Z ;;
  program-eski) KAHIN_PROGRAM_KOKU=$W k program-eski node --disable-warning=ExperimentalWarning $E/test/bagimsiz/cari/kos.mjs --mutasyonsuz --cikti $N/program-eski-$Z $YENI ;;
  yapim)
    cp test/bagimsiz/cari/YAPIM-ASAMASI.json $N/YAPIM-ASAMASI-$Z.json || exit 1
    KAHIN_YAPIM_ASAMASI=$N/YAPIM-ASAMASI-$Z.json k yapim node --disable-warning=ExperimentalWarning test/bagimsiz/cari/kos.mjs --yapim-asamasi-yaz --mutasyonsuz --cikti $N/yapim-$Z
    ;;
  *) echo "adım?"; exit 2 ;;
esac
echo "bitti $(date -u +%FT%TZ)"
