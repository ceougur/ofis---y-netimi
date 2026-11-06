#!/bin/bash
# WhatsApp tur 1 — son kanıt koşuları (son commit'te; ağaç temiz). Her adımın çıkış kodu kanit.mjs kos ile; ham çıktılar KANIT_DIR'de.
AG=/home/user/ofis---y-netimi/.claude/worktrees/agent-a4f37145169a88f67
NOT=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
ESKI=$NOT/watur1-eski-3fe5a92d
export KANIT_DIR=$NOT/watur1-kanit/son
export HUKUK_LICENSE_URL=http://127.0.0.1:9
export PLAYWRIGHT_BROWSERS_PATH=$NOT/pw-1194
export T6_KOK=$NOT/watur1-t6kok
mkdir -p "$T6_KOK"
cd "$AG" || exit 1
git status -s | grep -v "^?? node_modules$" && echo "UYARI: ağaç temiz değil"
YENI="test/whatsapp-tur1-bildirim-yolu-250.test.mjs"
# 1) yeni testler iki saat diliminde
TZ=UTC node tools/kanit.mjs kos watur1-yeni-utc -- node --test --test-concurrency=1 $YENI test/whatsapp-we-webhook-bilgisi-250.test.mjs; echo "yeni-utc cikis=$?"
TZ=Europe/Istanbul node tools/kanit.mjs kos watur1-yeni-europe-istanbul -- node --test --test-concurrency=1 $YENI test/whatsapp-we-webhook-bilgisi-250.test.mjs; echo "yeni-ist cikis=$?"
# 2) eski kod (3fe5a92d) — yeni testler ayrı kopyada (beklenen: kırmızı, nedenleri çıktıda)
cp $YENI test/whatsapp-wy-ortak.mjs test/whatsapp-we-webhook-bilgisi-250.test.mjs $ESKI/test/ || exit 1
( cd $ESKI && TZ=UTC node $AG/tools/kanit.mjs kos watur1-eski-3fe5a92d-utc -- node --test --test-concurrency=1 $YENI test/whatsapp-we-webhook-bilgisi-250.test.mjs ); echo "eski-utc cikis=$?"
( cd $ESKI && TZ=Europe/Istanbul node $AG/tools/kanit.mjs kos watur1-eski-3fe5a92d-europe-istanbul -- node --test --test-concurrency=1 $YENI test/whatsapp-we-webhook-bilgisi-250.test.mjs ); echo "eski-ist cikis=$?"
# 3) bütün WhatsApp e2e'leri (ders 28 — değişen A4f dahil)
for e in test/e2e/senaryo-whatsapp-ayar-248.mjs test/e2e/senaryo-whatsapp-donem-248.mjs test/e2e/senaryo-whatsapp-gonder-248.mjs test/e2e/senaryo-whatsapp-sablon-248.mjs test/e2e/senaryo-whatsapp.mjs; do
  ad=$(basename $e .mjs)
  EKRAN_DIR=$NOT/watur1-kanit/ekran-$ad TZ=UTC node tools/kanit.mjs kos watur1-e2e-$ad -- node $e; echo "e2e $ad cikis=$?"
done
# 4) kâhin sürücüsü S33 / S41 / S43 iki saat diliminde
SEN="S33-01-yol-2-imzasiz-bildirim-isaret-koymaz-sure-dolmaz-ayni-donem-daha-once,S33-02-yol-1-imzasiz-bildirim-kabul-isaret-ve-sure-dolumu-sahte-de-islenir,S41-01-yol-2-uygulama-duzeyi-adres-imzali-islenir-imzasiz-duser,S41-02-yol-1-uygulama-duzeyi-adres-imzasiz-kabul,S43-01-yol-2-imzali-taninmayan-bildirim-isaret-koymaz-ayni-donem-daha-once,S43-02-yol-1-imzasiz-taninmayan-bildirim-kabul-isaret-koymaz,S43-03-yol-2-is-kimligiyle-taninan-bildirim-isaret-koyar-sure-dolar"
node tools/kanit.mjs kos watur1-surucu-europe-istanbul -- node test/bagimsiz/whatsapp-248/surucu.mjs --senaryo "$SEN" --uc hizli --kip yol2 --tz Europe/Istanbul --cikti $NOT/watur1-kanit/son-surucu-ist; echo "surucu-ist cikis=$?"
node tools/kanit.mjs kos watur1-surucu-utc -- node test/bagimsiz/whatsapp-248/surucu.mjs --senaryo "$SEN" --uc hizli --kip yol2 --tz UTC --cikti $NOT/watur1-kanit/son-surucu-utc; echo "surucu-utc cikis=$?"
node tools/kanit.mjs kos watur1-surucu-kendi-testi -- node test/bagimsiz/whatsapp-248/surucu.mjs --kendi-testi; echo "surucu-kendi cikis=$?"
# 5) G2 komşular (whatsapp*.test.mjs + kaynak / şema kapısı / geri yükleme / mobil / lisans)
LISTE=$(tr '\n' ' ' < $NOT/watur1-betik/komsu-liste.txt)
TZ=UTC node tools/kanit.mjs kos watur1-komsu-utc -- node --test --test-concurrency=3 $LISTE; echo "komsu-utc cikis=$?"
