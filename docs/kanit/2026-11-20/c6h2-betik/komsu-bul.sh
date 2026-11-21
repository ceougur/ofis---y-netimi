#!/bin/bash
# Ç6-HESAP tur 2 — G2 komşu taraması (ders 10; tahmin değil): değişen dosyaları (server/lib/financial-statements*.mjs, server/lib/stock-valuation.mjs, server/routes/financial-statements.mjs)
# adıyla / API yoluyla anan testler + kaynağı klasörden tarayan testler (readdirSync + server/lib | server/routes) + overview.view (yetki; yeni uç bu izinle) + rapor iş parçacığı testleri.
cd /home/user/ofis---y-netimi/.claude/worktrees/agent-a7236347e0f8b6e8c || exit 1
OUT=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c6h2-ana/komsu.txt
TMP=$OUT.tmp
: > "$TMP"
grep -lE 'financial-statements|stock-valuation|balance-sheet|income-statement' test/*.test.mjs >> "$TMP"
grep -l 'readdirSync' test/*.test.mjs | xargs grep -l 'server/routes\|server/lib\|"routes"\|"lib"' >> "$TMP"
grep -l 'overview\.view' test/*.test.mjs >> "$TMP"
grep -l 'registerReportCenter\|report-worker\|rapor-is-parcacigi' test/*.test.mjs >> "$TMP"
sort -u "$TMP" | grep -v 'test/c6h-' > "$OUT"
rm -f "$TMP"
wc -l < "$OUT"
tr '\n' ' ' < "$OUT"
echo
