#!/bin/bash
# 2.4.9 R2 komşu testleri (ders 9, 10, 41): routes/plans.mjs returnCuts'ı kullanan her yol — forAccount (cari kartı, ekstre, fatura kapama defteri, WhatsApp çekirdeği /
# alıcı listesi / önizleme), ledgerPlansByAccount (mizan, allLedgers); iade / taksit / plan / kapama testleri (rg: returnCuts|coverCuts|sale_return|coversBalance|
# ledgerPlansByAccount|forAccount|waFacts) + WhatsApp alıcı / önizleme komşuları + kaynak tarayan genel denetimler; yeni test iki saat diliminde; bağımsız cari kâhini.
cd /home/user/ofis---y-netimi/.claude/worktrees/agent-aa56c65749221d09d || exit 1
export HUKUK_LICENSE_URL=http://127.0.0.1:9
DAR=$(rg -l "returnCuts|coverCuts|sale_return|coversBalance|ledgerPlansByAccount|forAccount|waFacts" test/*.test.mjs | sort | tr '\n' ' ')
EK="test/whatsapp-213.test.mjs test/whatsapp-w2-veri-248.test.mjs test/whatsapp-w3-ekstre-248.test.mjs test/kapama-tek-gecis-245.test.mjs test/plans.test.mjs test/plan-transfer.test.mjs test/cari-243.test.mjs test/accounts-stock.test.mjs test/is-akisi.test.mjs test/banka-210-kabul-mizan.test.mjs"
KAYNAK="test/lisans-servisi-izolasyonu.test.mjs test/platform-tasinabilirlik.test.mjs test/yazim-duzeni.test.mjs test/banka-210-post-statik.test.mjs"
node tools/kanit.mjs kos r2/komsu-dar-UTC -- env TZ=UTC node --disable-warning=ExperimentalWarning --test --test-concurrency=1 $DAR $EK $KAYNAK
echo "komsu-dar-UTC çıkış=$?"
node tools/kanit.mjs kos r2/yeni-iade-kesinti-tarama-249-Istanbul -- env TZ=Europe/Istanbul node --disable-warning=ExperimentalWarning --test test/iade-kesinti-tarama-249.test.mjs
echo "Istanbul çıkış=$?"
node tools/kanit.mjs kos r2/kahin-cari -- node --disable-warning=ExperimentalWarning test/bagimsiz/cari/kos.mjs
echo "kahin-cari çıkış=$?"
