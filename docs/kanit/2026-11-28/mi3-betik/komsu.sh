#!/bin/bash
# Mİ tur 3 — komşu ve iki TZ koşuları (yeni kod) + eski kod (taban) kırmızı / yeşil. Her adım tools/kanit.mjs kos ile.
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a00060fd6c1db3744
ESKI=/dev/shm/mi3-dk/eski
SP=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$SP/mi3-kanit PLAYWRIGHT_BROWSERS_PATH=$SP/pw-1194
cd "$W" || exit 1
UNITS="test/mi1-taksit-no-251.test.mjs test/mi2-grup-ozeti-251.test.mjs test/mi2-kuyruk-girdisi-251.test.mjs test/mi2-tek-numara-251.test.mjs test/kalan-metin-246.test.mjs test/tyk-birlesik8-ekranlar-250.test.mjs test/uiux-244-ux9.test.mjs test/yazim-duzeni.test.mjs test/disa-aktarim-dugmeleri.test.mjs test/liste-kapisi-daha-fazla.test.mjs test/form-izolasyon.test.mjs"
for tz in UTC Europe/Istanbul; do
  k=$( [ "$tz" = UTC ] && echo utc || echo ist )
  TZ=$tz node tools/kanit.mjs kos mi3-komsu-birim-$k -- node --test $UNITS 2>&1 | tail -3
  TZ=$tz EKRAN_DIR=$SP/mi3-ekran-yeni-$k node tools/kanit.mjs kos mi3-senaryo-mi2-yeni-$k -- npm run test:senaryo-mi2-251 2>&1 | tail -2
  TZ=$tz node tools/kanit.mjs kos mi3-senaryo-mi1-yeni-$k -- npm run test:senaryo-mi1-251 2>&1 | tail -2
done
for s in whatsapp-gonder-248 whatsapp-donem-248 222; do
  TZ=UTC node tools/kanit.mjs kos mi3-komsu-senaryo-$s-utc -- npm run test:senaryo-$s 2>&1 | tail -2
done
# Eski kod (taban): yeni senaryo adımı + yeni 'Diğer' testi (eski kopyaya yalnız yeni test dosyaları — ders 51)
cp "$W/test/e2e/senaryo-mi2-251.mjs" "$ESKI/test/e2e/senaryo-mi2-251.mjs" || exit 1
cp "$W/test/mi2-grup-ozeti-251.test.mjs" "$ESKI/test/mi2-grup-ozeti-251.test.mjs" || exit 1
for tz in UTC Europe/Istanbul; do
  k=$( [ "$tz" = UTC ] && echo utc || echo ist )
  TZ=$tz EKRAN_DIR=$SP/mi3-ekran-eski-$k node tools/kanit.mjs kos mi3-senaryo-mi2-eski-$k -- node --disable-warning=ExperimentalWarning "$ESKI/test/e2e/senaryo-mi2-251.mjs" 2>&1 | tail -14
  TZ=$tz node tools/kanit.mjs kos mi3-grup-ozeti-eski-$k -- node --test "$ESKI/test/mi2-grup-ozeti-251.test.mjs" 2>&1 | tail -2
done
echo BITTI
