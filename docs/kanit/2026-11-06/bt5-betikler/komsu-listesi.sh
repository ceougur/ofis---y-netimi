#!/bin/bash
# BT5 G2 komşu listesi (ders 10 + 06.11 eki): değişen yardımcıları / uçları kullanan test dosyaları (test/ grep) ∪ görev metninin saydıkları. Çıktı: bt5-kanit/komsu.txt
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a731f6dec73e0177c
OUT=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/bt5-kanit/komsu.txt
cd "$W" || exit 1
{
  # 1 db.mjs (ortak yardımcı): doğrudan kullananlar, göç, BS-6 / DB-TX, tetikleyici yolları (Sıfırla, donmuş defter, fiş defteri)
  grep -lE "lib/db.mjs|createStore|ERR_TX_LOST|store\.exec|runMigrations|migrations.mjs|db-tx|withTriggersLifted|clearSnapshots" test/*.test.mjs
  # 4 kapalı kart / cari ekstre / toplu defter
  grep -lE "plan-close|closed_at|closedAt|Kart kapatıldı|cari-ekstre|cari-hareketleri|Kartı Kapat|status: \"closed\"|accountLedger|allLedgers|ledgerPlansByAccount|forAccount" test/*.test.mjs
  # 5 / 7 yedek, geri yükleme, ortak katman, Sıfırla, şema kapısı, webhook
  grep -lE "backups/restore|prepareRestoreFile|transplantCommon|company-backups|appWebhook|app-webhook|/reset|sema-kapisi|schemaGate|COMMON_SETTINGS|whatsapp\.appWebhook" test/*.test.mjs
  # 2 / 3 onarım, kısa yol, plan / stok PUT
  grep -lE "repairOwnCards|ownCardRepair|repairScreen|iade-onarim|sameFields|row-version|plans/groups" test/*.test.mjs
  ls test/accounts*.test.mjs test/*stock*.test.mjs test/*plan*.test.mjs test/*ekstre*.test.mjs test/*yedek*.test.mjs test/*restore*.test.mjs test/*migration*.test.mjs 2>/dev/null
} | sort -u > "$OUT"
wc -l < "$OUT"
