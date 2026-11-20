#!/bin/bash
# Ç6-HESAP tur 3 — G2 komşu taraması (ders 10; tahmin değil): değişen dosyaları (financial-statements.mjs, ledger-snapshots.mjs) adıyla / API yoluyla anan testler; ledger-snapshots
# okuyucularını (snapshots.book / trial / entries / state, donmuş defter, dönem kilidi) anan testler; kaynağı klasörden tarayan testler; overview.view; rapor iş parçacığı; şema kapısı ve
# geri yükleme (ortak katman — ders 10). Tur 2'nin listesi (komsu.txt, 80) + tur 3 ekleri.
cd /home/user/ofis---y-netimi/.claude/worktrees/agent-ab54e5fc492a09964 || exit 1
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c6h3-ana
OUT=$N/komsu.txt
TMP=$OUT.tmp
: > "$TMP"
grep -lE 'financial-statements|stock-valuation|balance-sheet|income-statement' test/*.test.mjs >> "$TMP"
grep -lE 'ledger-snapshots|snapshots\.(book|trial|entries|state|coverage)|frozenSums|period-lock|lockAndWait' test/*.test.mjs >> "$TMP"
grep -l 'readdirSync' test/*.test.mjs | xargs grep -l 'server/routes\|server/lib\|"routes"\|"lib"' >> "$TMP"
grep -l 'overview\.view' test/*.test.mjs >> "$TMP"
grep -l 'registerReportCenter\|report-worker\|rapor-is-parcacigi' test/*.test.mjs >> "$TMP"
grep -lE 'sema-kapisi|backups/restore' test/*.test.mjs >> "$TMP"
sort -u "$TMP" | grep -v 'test/c6h-' > "$OUT"
rm -f "$TMP"
wc -l < "$OUT"
echo "tur 2 listesine göre ek:"
comm -13 <(sort $N/betik/komsu.txt) "$OUT" | wc -l
